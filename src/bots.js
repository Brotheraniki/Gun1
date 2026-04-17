// Bot AI System
import { WeaponState, WEAPONS } from './weapons.js';
import { checkMapCollision, BOMB_SITES, WAYPOINTS, buildWaypointGraph, findPath, nearestWaypoint, raycastMap } from './map.js';

const PLAYER_HEIGHT = 1.7;
const CROUCH_HEIGHT = 1.0;
const PLAYER_RADIUS = 0.38;

// Difficulty presets
const DIFFICULTY = {
  easy: { reactionTime: 0.9, aimAccuracy: 0.6, aimSpeed: 1.5, aggression: 0.4, decisionRate: 0.4 },
  normal: { reactionTime: 0.45, aimAccuracy: 0.82, aimSpeed: 2.8, aggression: 0.65, decisionRate: 0.7 },
  hard: { reactionTime: 0.15, aimAccuracy: 0.96, aimSpeed: 5.0, aggression: 0.85, decisionRate: 0.95 }
};

const BOT_ROLES = ['entry', 'support', 'anchor', 'lurk', 'sniper'];

let waypointGraph = null;

export class Bot {
  constructor(id, team, difficulty = 'normal') {
    this.id = id;
    this.name = generateBotName(id);
    this.team = team;
    this.difficulty = difficulty;
    this.diff = DIFFICULTY[difficulty] || DIFFICULTY.normal;
    this.role = BOT_ROLES[id % BOT_ROLES.length];

    this.pos = { x: 0, y: PLAYER_HEIGHT, z: 0 };
    this.vel = { x: 0, y: 0, z: 0 };
    this.yaw = 0;
    this.pitch = 0;
    this.targetYaw = 0;
    this.targetPitch = 0;

    this.health = 100;
    this.armor = 0;
    this.alive = true;

    this.weapons = [null, null, null];
    this.activeSlot = 0;
    this.hasBomb = false;
    this.hasDefuseKit = false;

    this.kills = 0;
    this.deaths = 0;
    this.roundKills = 0;
    this.money = 800;

    // AI state
    this.state = 'idle'; // idle, patrol, rush, hold, peek, plant, defuse, retreat, rotate
    this.target = null; // player or null
    this.targetAcquired = false;
    this.reactionTimer = 0;

    this.currentPath = [];
    this.pathIndex = 0;
    this.pathTimer = 0;
    this.decisionTimer = Math.random() * 2;

    this.aimOffsetX = 0;
    this.aimOffsetY = 0;
    this.aimShakeTimer = 0;

    this.isCrouching = false;
    this.isMoving = false;
    this.moveSpeed = 4.5;

    this.plantProgress = 0;
    this.defuseProgress = 0;
    this.interactTimer = 0;

    this.targetWaypointId = null;
    this.destinationWaypointId = null;
    this.holdPosition = null;

    this.lastSeenPlayerPos = null;
    this.lastSeenTime = 0;
    this.isAlert = false;
    this.alertTimer = 0;

    this.peekTimer = 0;
    this.peekDir = 1;
    this.isPeeking = false;

    this.suppressionTimer = 0;
    this.burstCount = 0;
    this.burstTimer = 0;

    if (!waypointGraph) waypointGraph = buildWaypointGraph();
  }

  spawn(spawnPoint) {
    this.pos.x = spawnPoint.x + (Math.random() - 0.5) * 2;
    this.pos.y = PLAYER_HEIGHT;
    this.pos.z = spawnPoint.z + (Math.random() - 0.5) * 2;
    this.yaw = spawnPoint.angle || 0;
    this.pitch = 0;
    this.vel = { x: 0, y: 0, z: 0 };
    this.health = 100;
    this.alive = true;
    this.state = 'idle';
    this.target = null;
    this.targetAcquired = false;
    this.currentPath = [];
    this.pathIndex = 0;
    this.plantProgress = 0;
    this.defuseProgress = 0;
    this.reactionTimer = 0;
    this.isCrouching = false;
    this.roundKills = 0;
    this.isAlert = false;
    this.suppressionTimer = 0;
  }

  equipWeapons(roundNum, money) {
    // Knife always
    this.weapons[2] = new WeaponState(WEAPONS.knife);

    // Buy decision
    const buy = money >= 4750 ? 'top' : money >= 3100 ? 'rifle' : money >= 1700 ? 'smg' : 'eco';

    if (buy === 'top') {
      if (this.role === 'sniper') {
        this.weapons[0] = new WeaponState(WEAPONS.sniper);
      } else {
        this.weapons[0] = Math.random() > 0.5
          ? new WeaponState(WEAPONS.rifle)
          : new WeaponState(WEAPONS.rifle_heavy);
      }
      this.armor = 100;
    } else if (buy === 'rifle') {
      this.weapons[0] = new WeaponState(WEAPONS.rifle);
      this.armor = 100;
    } else if (buy === 'smg') {
      this.weapons[0] = new WeaponState(WEAPONS.smg);
      this.armor = Math.random() > 0.5 ? 100 : 0;
    } else {
      // eco - just pistol
      this.weapons[1] = new WeaponState(
        Math.random() > 0.6 ? WEAPONS.pistol_heavy : WEAPONS.pistol_std
      );
      this.armor = 0;
    }

    if (!this.weapons[1]) this.weapons[1] = new WeaponState(WEAPONS.pistol_std);
    this.activeSlot = this.weapons[0] ? 0 : 1;
  }

  getActiveWeapon() {
    return this.weapons[this.activeSlot] || null;
  }

  takeDamage(amount, armorPen, isHead) {
    if (!this.alive) return 0;
    let dmg = amount;
    if (this.armor > 0) {
      const absorbed = dmg * (1 - armorPen) * 0.6;
      dmg -= absorbed;
      this.armor = Math.max(0, this.armor - absorbed * 0.5);
    }
    this.health -= dmg;

    // React to being shot
    this.isAlert = true;
    this.alertTimer = 8.0;

    if (this.health <= 0) {
      this.health = 0;
      this.alive = false;
      this.deaths++;
      return dmg;
    }
    // Flinch
    this.suppressionTimer = 0.3;
    return dmg;
  }

  update(dt, player, allBots, geometry, roundState, bombState, audio) {
    if (!this.alive) return;

    // Weapon update
    const wep = this.getActiveWeapon();
    if (wep) wep.update(dt);

    // Timers
    this.decisionTimer -= dt;
    this.pathTimer -= dt;
    this.aimShakeTimer -= dt;
    this.alertTimer -= dt;
    if (this.alertTimer <= 0) this.isAlert = false;

    // Check line of sight to player
    const canSeePlayer = player.alive && this._hasLOS(player.pos, geometry);
    if (canSeePlayer) {
      this.lastSeenPlayerPos = { ...player.pos };
      this.lastSeenTime = 0;
      this.isAlert = true;
      this.alertTimer = 12.0;
    } else {
      this.lastSeenTime += dt;
    }

    // Reaction window
    if (canSeePlayer && !this.targetAcquired) {
      this.reactionTimer += dt;
      if (this.reactionTimer >= this.diff.reactionTime) {
        this.targetAcquired = true;
        this.reactionTimer = 0;
      }
    } else if (!canSeePlayer) {
      this.targetAcquired = false;
      this.reactionTimer = 0;
    }

    // State machine
    if (this.decisionTimer <= 0) {
      this.decisionTimer = 0.3 + Math.random() * 0.4 * (1 - this.diff.decisionRate);
      this._makeDecision(player, allBots, roundState, bombState, canSeePlayer);
    }

    // Execute state
    this._executeState(dt, player, geometry, roundState, bombState, canSeePlayer, audio);

    // Aim at target
    if ((canSeePlayer && this.targetAcquired) || (this.state === 'shoot')) {
      this._aimAtTarget(dt, player.pos);
    } else if (this.lastSeenPlayerPos && this.lastSeenTime < 3.0) {
      this._aimAtTarget(dt, this.lastSeenPlayerPos, 0.5);
    } else {
      this._aimIdle(dt);
    }

    // Apply look angles
    this.yaw = this.targetYaw;
    this.pitch = this.targetPitch;

    // Movement
    this._applyMovement(dt, geometry);
  }

  _makeDecision(player, allBots, roundState, bombState, canSee) {
    if (roundState.phase === 'freeze') {
      this.state = 'idle';
      return;
    }

    // Bomb-related logic
    if (this.team === 'attacker') {
      if (this.hasBomb && !bombState.planted) {
        // Should I plant?
        const site = this._getNearestSite();
        if (site) {
          const dist = Math.hypot(this.pos.x - site.center.x, this.pos.z - site.center.z);
          if (dist < site.radius + 1 && !canSee) {
            this.state = 'plant';
            return;
          }
        }
        // Move to site
        this.state = 'rush';
        this.destinationWaypointId = this._getSiteWaypointId();
        return;
      }
    }

    if (this.team === 'defender' && bombState.planted) {
      const siteWP = this._getPlantedSiteWaypoint(bombState);
      if (siteWP !== null) {
        const dist = Math.hypot(this.pos.x - WAYPOINTS[siteWP].x, this.pos.z - WAYPOINTS[siteWP].z);
        if (dist < 6 && !canSee) {
          this.state = 'defuse';
          return;
        }
        this.state = 'rush';
        this.destinationWaypointId = siteWP;
        return;
      }
    }

    if (canSee) {
      const wep = this.getActiveWeapon();
      if (wep && wep.clip > 0) {
        // Decide: hold, peek, or shoot
        const d = Math.hypot(player.pos.x - this.pos.x, player.pos.z - this.pos.z);
        if (d < 5) {
          this.state = 'shoot'; // close — just shoot
        } else if (Math.random() < this.diff.aggression) {
          this.state = 'peek';
        } else {
          this.state = 'hold';
        }
      } else {
        this.state = 'retreat';
      }
      return;
    }

    // No sight
    if (this.isAlert && this.lastSeenPlayerPos && this.lastSeenTime < 5.0) {
      if (Math.random() < this.diff.aggression) {
        this.state = 'rush';
        const wp = nearestWaypoint(this.lastSeenPlayerPos.x, this.lastSeenPlayerPos.z);
        this.destinationWaypointId = wp?.id ?? null;
      } else {
        this.state = 'hold';
        this.holdPosition = { ...this.pos };
      }
      return;
    }

    // Default patrol
    if (this.team === 'defender') {
      this.state = 'hold';
      // Pick a defender waypoint near sites
      const defWPs = WAYPOINTS.filter(w => w.team === 'defender');
      const pick = defWPs[Math.floor(Math.random() * defWPs.length)];
      this.destinationWaypointId = pick.id;
    } else {
      this.state = 'patrol';
      const wp = this._getRandomAttackWaypoint();
      this.destinationWaypointId = wp;
    }
  }

  _executeState(dt, player, geometry, roundState, bombState, canSee, audio) {
    switch (this.state) {
      case 'idle':
        this.isMoving = false;
        break;

      case 'patrol':
      case 'rush':
        this._moveToDestination(dt, geometry);
        break;

      case 'hold':
        if (this.destinationWaypointId !== null) {
          this._moveToDestination(dt, geometry);
        } else {
          this.isMoving = false;
        }
        // Crouch when holding
        this.isCrouching = Math.random() < 0.4;
        break;

      case 'peek': {
        this.isPeeking = true;
        this.peekTimer += dt;
        // Strafe peek
        this.isMoving = true;
        const peekSpeed = 2.0;
        const peekDir = this.peekDir;
        const sideX = Math.cos(this.yaw) * peekDir;
        const sideZ = -Math.sin(this.yaw) * peekDir;
        this.vel.x = sideX * peekSpeed;
        this.vel.z = sideZ * peekSpeed;
        if (this.peekTimer > 0.5 + Math.random() * 0.4) {
          this.peekDir *= -1;
          this.peekTimer = 0;
          if (Math.random() > 0.5) this.state = 'shoot';
        }
        if (canSee) this._fireAtPlayer(dt, player, audio, geometry);
        break;
      }

      case 'shoot':
        this.isMoving = false;
        this.isCrouching = Math.random() < 0.5;
        if (canSee || this.lastSeenTime < 0.5) {
          this._fireAtPlayer(dt, player, audio, geometry);
        } else {
          this.state = 'patrol';
        }
        break;

      case 'retreat':
        this._moveAwayFrom(dt, player.pos, geometry);
        break;

      case 'plant':
        this._doPlant(dt, bombState, audio);
        break;

      case 'defuse':
        this._doDefuse(dt, bombState, audio);
        break;
    }
  }

  _fireAtPlayer(dt, player, audio, geometry) {
    if (!player.alive || !this.targetAcquired) return;
    const wep = this.getActiveWeapon();
    if (!wep) return;

    // Auto-reload
    if (wep.clip <= 0 && !wep.isReloading) {
      wep.startReload();
      return;
    }
    if (wep.isReloading) return;

    const now = performance.now() / 1000;
    if (!wep.canFire(now)) return;

    // Accuracy check
    const d = Math.hypot(player.pos.x - this.pos.x, player.pos.z - this.pos.z);
    const hitRoll = Math.random();
    const rangeAccuracyFactor = wep.def.range > 0 ? Math.min(1, wep.def.range / (d + 0.1)) : 1;
    const hitChance = this.diff.aimAccuracy * rangeAccuracyFactor * (this.suppressionTimer > 0 ? 0.4 : 1);

    wep.fire(now);
    this._playWeaponSound(wep, audio);

    if (hitRoll < hitChance) {
      const isHead = Math.random() < (0.12 * this.diff.aimAccuracy);
      let dmg = isHead ? wep.def.damage * wep.def.headMult : wep.def.damage;
      player.takeDamage(dmg, wep.def.armorPen, isHead, this.name);
      audio?.playHitImpact(isHead);
    }
  }

  _playWeaponSound(wep, audio) {
    if (!audio) return;
    const t = wep.def.audioType;
    if (t === 'rifle') audio.playShot_rifle();
    else if (t === 'pistol') audio.playShot_pistol();
    else if (t === 'smg') audio.playShot_smg();
    else if (t === 'sniper') audio.playShot_sniper();
    else if (t === 'shotgun') audio.playShot_shotgun();
  }

  _aimAtTarget(dt, targetPos, speedMult = 1.0) {
    const dx = targetPos.x - this.pos.x;
    const dz = targetPos.z - this.pos.z;
    const dist = Math.hypot(dx, dz);
    const desiredYaw = Math.atan2(dx, dz);

    const targetHeight = targetPos.y || PLAYER_HEIGHT;
    const headOffset = 0.15 + (Math.random() - 0.5) * (1 - this.diff.aimAccuracy) * 0.4;
    const desiredPitch = -Math.atan2(targetHeight + headOffset - this.pos.y, dist);

    // Smooth aim
    const aimSpd = this.diff.aimSpeed * speedMult * dt;

    // Yaw lerp (handle wrap)
    let dyaw = desiredYaw - this.targetYaw;
    while (dyaw > Math.PI) dyaw -= Math.PI * 2;
    while (dyaw < -Math.PI) dyaw += Math.PI * 2;
    this.targetYaw += dyaw * Math.min(1, aimSpd);

    let dpitch = desiredPitch - this.targetPitch;
    this.targetPitch += dpitch * Math.min(1, aimSpd);

    // Add jitter based on inaccuracy
    const jitter = (1 - this.diff.aimAccuracy) * 0.04;
    this.targetYaw   += (Math.random() - 0.5) * jitter;
    this.targetPitch += (Math.random() - 0.5) * jitter;
  }

  _aimIdle(dt) {
    // Slowly scan
    this.targetYaw += Math.sin(performance.now() * 0.0003 * (this.id + 1)) * dt * 0.4;
  }

  _hasLOS(targetPos, geometry) {
    const origin = { x: this.pos.x, y: this.pos.y - 0.2, z: this.pos.z };
    const dx = targetPos.x - origin.x;
    const dy = (targetPos.y || PLAYER_HEIGHT) - origin.y;
    const dz = targetPos.z - origin.z;
    const dist = Math.hypot(dx, dy, dz);
    if (dist === 0) return true;
    const dir = { x: dx / dist, y: dy / dist, z: dz / dist };
    const hit = raycastMap(origin, dir, dist - 0.4, geometry);
    return !hit.hit;
  }

  _moveToDestination(dt, geometry) {
    if (this.destinationWaypointId === null) { this.isMoving = false; return; }

    // Find path if we don't have one
    if (!this.currentPath.length || this.pathTimer <= 0) {
      const nearest = nearestWaypoint(this.pos.x, this.pos.z);
      const path = findPath(nearest?.id ?? 0, this.destinationWaypointId, waypointGraph);
      this.currentPath = path || [];
      this.pathIndex = 0;
      this.pathTimer = 1.5 + Math.random();
    }

    if (!this.currentPath.length) { this.isMoving = false; return; }

    // Get current target waypoint
    const wpId = this.currentPath[this.pathIndex];
    const wp = WAYPOINTS[wpId];
    if (!wp) { this.currentPath = []; return; }

    const dx = wp.x - this.pos.x;
    const dz = wp.z - this.pos.z;
    const dist = Math.hypot(dx, dz);

    if (dist < 0.8) {
      this.pathIndex++;
      if (this.pathIndex >= this.currentPath.length) {
        this.currentPath = [];
        this.destinationWaypointId = null;
        this.isMoving = false;
        return;
      }
    }

    this.isMoving = true;
    const speed = this.isAlert ? this.moveSpeed : this.moveSpeed * 0.75;
    const nx = dx / dist, nz = dz / dist;
    this.vel.x = nx * speed;
    this.vel.z = nz * speed;
    this.targetYaw = Math.atan2(dx, dz);
  }

  _moveAwayFrom(dt, pos, geometry) {
    const dx = this.pos.x - pos.x;
    const dz = this.pos.z - pos.z;
    const dist = Math.hypot(dx, dz) || 1;
    this.vel.x = (dx / dist) * this.moveSpeed;
    this.vel.z = (dz / dist) * this.moveSpeed;
    this.isMoving = true;
  }

  _applyMovement(dt, geometry) {
    if (!this.isMoving) {
      this.vel.x *= Math.pow(0.01, dt * 8);
      this.vel.z *= Math.pow(0.01, dt * 8);
    }

    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;

    // Wall collision
    const col = checkMapCollision(this.pos.x, this.pos.z, PLAYER_RADIUS, geometry);
    if (col.hit) {
      this.pos.x += col.nx * col.pen;
      this.pos.z += col.nz * col.pen;
      if (col.nx !== 0) this.vel.x = 0;
      if (col.nz !== 0) this.vel.z = 0;
      // Re-path if stuck
      this.currentPath = [];
    }

    // Bounds
    const { MAP_BOUNDS } = { MAP_BOUNDS: { minX: -40, maxX: 40, minZ: -40, maxZ: 40 } };
    this.pos.x = Math.max(-38, Math.min(38, this.pos.x));
    this.pos.z = Math.max(-38, Math.min(38, this.pos.z));
  }

  _doPlant(dt, bombState, audio) {
    if (!this.hasBomb || bombState.planted) { this.state = 'idle'; return; }
    // Check if on site
    for (const site of Object.values(BOMB_SITES)) {
      const d = Math.hypot(this.pos.x - site.center.x, this.pos.z - site.center.z);
      if (d <= site.radius) {
        this.isMoving = false;
        this.interactTimer += dt;
        if (this.interactTimer >= 3.2) {
          bombState.plant(site.id, this.pos);
          this.hasBomb = false;
          this.interactTimer = 0;
          this.state = 'hold';
          audio?.playBombPlanted();
        }
        return;
      }
    }
    // Not on site - move to it
    this.state = 'rush';
    this.destinationWaypointId = this._getSiteWaypointId();
  }

  _doDefuse(dt, bombState, audio) {
    if (!bombState.planted) { this.state = 'idle'; return; }
    const site = BOMB_SITES[bombState.plantedSiteId];
    if (!site) return;
    const d = Math.hypot(this.pos.x - site.center.x, this.pos.z - site.center.z);
    if (d <= site.radius + 1) {
      this.isMoving = false;
      this.isCrouching = true;
      this.interactTimer += dt;
      const defuseTime = this.hasDefuseKit ? 5 : 10;
      if (this.interactTimer >= defuseTime) {
        bombState.defuse();
        this.interactTimer = 0;
        this.state = 'hold';
        audio?.playBombDefused();
      }
    } else {
      this.state = 'rush';
      const siteWP = WAYPOINTS.findIndex(w => w.isSite === bombState.plantedSiteId);
      this.destinationWaypointId = siteWP >= 0 ? siteWP : null;
    }
  }

  _getNearestSite() {
    let best = null, bestDist = Infinity;
    for (const site of Object.values(BOMB_SITES)) {
      const d = Math.hypot(this.pos.x - site.center.x, this.pos.z - site.center.z);
      if (d < bestDist) { bestDist = d; best = site; }
    }
    return best;
  }

  _getSiteWaypointId() {
    // Pick a target site randomly (or stick to one)
    const siteKey = (this.id % 2 === 0) ? 'alpha' : 'beta';
    const wp = WAYPOINTS.findIndex(w => w.isSite === siteKey);
    return wp >= 0 ? wp : 10;
  }

  _getPlantedSiteWaypoint(bombState) {
    const siteWP = WAYPOINTS.findIndex(w => w.isSite === bombState.plantedSiteId);
    return siteWP >= 0 ? siteWP : null;
  }

  _getRandomAttackWaypoint() {
    // Return a mid or approach waypoint
    const attackWPs = WAYPOINTS.filter(w => w.team === 'both' || w.team === 'attacker');
    return attackWPs[Math.floor(Math.random() * attackWPs.length)]?.id ?? 3;
  }
}

// Generate diverse bot names
const BOT_PREFIXES = ['GHOST', 'ECHO', 'IRON', 'NOVA', 'BLADE', 'APEX', 'RAVEN', 'STORM', 'ONYX', 'EMBER'];
const BOT_SUFFIXES = ['ALPHA', 'BRAVO', 'DELTA', 'OMEGA', 'PRIME', 'ZERO', 'SIGMA', 'REAPER', 'VIPER', 'CIPHER'];
function generateBotName(id) {
  return BOT_PREFIXES[id % BOT_PREFIXES.length] + '_' + BOT_SUFFIXES[(id * 3 + 2) % BOT_SUFFIXES.length];
}
