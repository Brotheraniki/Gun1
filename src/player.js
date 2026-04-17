// Player controller
import { WeaponState, WEAPONS } from './weapons.js';
import { checkMapCollision, MAP_BOUNDS, BOMB_SITES, raycastMap } from './map.js';
import { ECONOMY } from './economy.js';

const PLAYER_HEIGHT = 1.7;
const PLAYER_RADIUS = 0.38;
const CROUCH_HEIGHT = 1.0;
const MOVE_SPEED = 5.5;
const WALK_SPEED = 2.8; // shift
const CROUCH_SPEED = 2.2;
const GRAVITY = -18;
const JUMP_FORCE = 6;
const BOB_FREQ = 8;
const BOB_AMP = 0.018;

export class Player {
  constructor(audio) {
    this.audio = audio;
    this.pos = { x: 0, y: 0, z: 0 };
    this.vel = { x: 0, y: 0, z: 0 };
    this.yaw = 0;   // left-right
    this.pitch = 0; // up-down

    this.health = 100;
    this.armor = 0;
    this.alive = true;
    this.team = 'attacker';

    this.isCrouching = false;
    this.isGrounded = true;
    this.isWalking = false; // shift

    this.bobTimer = 0;
    this.bobOffset = 0;
    this.footstepTimer = 0;

    this.weapons = [null, null, null]; // slot 0=primary, 1=secondary, 2=knife
    this.activeSlot = 0;
    this.hasBomb = false;
    this.hasDefuseKit = false;
    this.isPlanting = false;
    this.isDefusing = false;
    this.interactProgress = 0;

    this.recoilYaw = 0;
    this.recoilPitch = 0;
    this.isScoped = false;
    this.scopeFOV = 1.0; // multiplier for FOV

    this.kills = 0;
    this.deaths = 0;
    this.roundKills = 0;
    this.money = 800;

    this.sensitivity = 3.0;

    // Input state
    this.keys = {};
    this.mouseButtons = {};
    this.mouseDelta = { x: 0, y: 0 };

    this.killedBy = null;
  }

  spawn(spawnPoint, team) {
    this.pos.x = spawnPoint.x;
    this.pos.y = PLAYER_HEIGHT;
    this.pos.z = spawnPoint.z;
    this.yaw = spawnPoint.angle || 0;
    this.pitch = 0;
    this.vel = { x: 0, y: 0, z: 0 };
    this.health = 100;
    this.alive = true;
    this.team = team;
    this.isCrouching = false;
    this.isPlanting = false;
    this.isDefusing = false;
    this.interactProgress = 0;
    this.recoilYaw = 0;
    this.recoilPitch = 0;
    this.isScoped = false;
    this.roundKills = 0;
    this.killedBy = null;
  }

  equipStartingWeapons() {
    this.weapons[1] = new WeaponState(WEAPONS.pistol_std);
    this.weapons[2] = new WeaponState(WEAPONS.knife);
    this.activeSlot = this.weapons[0] ? 0 : 1;
  }

  getActiveWeapon() {
    return this.weapons[this.activeSlot] || null;
  }

  takeDamage(amount, armorPen, isHead, killerName) {
    if (!this.alive) return;
    let dmg = amount;
    if (this.armor > 0) {
      const absorbed = dmg * (1 - armorPen) * 0.6;
      dmg -= absorbed;
      this.armor = Math.max(0, this.armor - absorbed * 0.5);
    }
    this.health -= dmg;
    if (this.health <= 0) {
      this.health = 0;
      this.alive = false;
      this.killedBy = killerName;
      this.deaths++;
    }
    return dmg;
  }

  lookAt(yaw, pitch) {
    this.yaw = yaw;
    this.pitch = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, pitch));
  }

  update(dt, geometry, roundPhase) {
    if (!this.alive) return;

    // Collect input
    const forward = this.keys['KeyW'] || this.keys['ArrowUp'];
    const back    = this.keys['KeyS'] || this.keys['ArrowDown'];
    const left    = this.keys['KeyA'] || this.keys['ArrowLeft'];
    const right   = this.keys['KeyD'] || this.keys['ArrowRight'];
    const jump    = this.keys['Space'];
    this.isCrouching = this.keys['ControlLeft'] || this.keys['ControlRight'];
    this.isWalking = (this.keys['ShiftLeft'] || this.keys['ShiftRight']) && !this.isCrouching;

    // Mouse look
    const sens = this.sensitivity * 0.001;
    this.yaw   += this.mouseDelta.x * sens * (this.isScoped ? 0.35 : 1.0);
    this.pitch -= this.mouseDelta.y * sens * (this.isScoped ? 0.35 : 1.0);
    this.pitch  = Math.max(-1.4, Math.min(1.4, this.pitch));
    this.mouseDelta.x = 0;
    this.mouseDelta.y = 0;

    // Recoil recovery
    this.recoilPitch *= Math.pow(0.1, dt * 6);
    this.recoilYaw   *= Math.pow(0.1, dt * 6);

    // Speed
    let speed = this.isCrouching ? CROUCH_SPEED : this.isWalking ? WALK_SPEED : MOVE_SPEED;

    // Movement direction
    const sinY = Math.sin(this.yaw);
    const cosY = Math.cos(this.yaw);
    let mx = 0, mz = 0;
    if (forward) { mx += sinY; mz += cosY; }
    if (back)    { mx -= sinY; mz -= cosY; }
    if (left)    { mx -= cosY; mz += sinY; }
    if (right)   { mx += cosY; mz -= sinY; }

    const movLen = Math.hypot(mx, mz);
    const isMoving = movLen > 0.01;
    this.isMoving = isMoving;

    if (isMoving) {
      const nv = speed / movLen;
      this.vel.x = mx * nv;
      this.vel.z = mz * nv;
    } else {
      this.vel.x *= Math.pow(0.01, dt * 10);
      this.vel.z *= Math.pow(0.01, dt * 10);
    }

    // Jump
    if (jump && this.isGrounded && !this.isCrouching) {
      this.vel.y = JUMP_FORCE;
      this.isGrounded = false;
    }

    // Gravity
    if (!this.isGrounded) {
      this.vel.y += GRAVITY * dt;
    }

    // Move
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    this.pos.y += this.vel.y * dt;

    // Floor
    const floorY = this.isCrouching ? CROUCH_HEIGHT : PLAYER_HEIGHT;
    if (this.pos.y <= floorY) {
      this.pos.y = floorY;
      this.vel.y = 0;
      this.isGrounded = true;
    }

    // Map bounds
    this.pos.x = Math.max(MAP_BOUNDS.minX + PLAYER_RADIUS, Math.min(MAP_BOUNDS.maxX - PLAYER_RADIUS, this.pos.x));
    this.pos.z = Math.max(MAP_BOUNDS.minZ + PLAYER_RADIUS, Math.min(MAP_BOUNDS.maxZ - PLAYER_RADIUS, this.pos.z));

    // Wall collision
    let col = checkMapCollision(this.pos.x, this.pos.z, PLAYER_RADIUS, geometry);
    if (col.hit) {
      this.pos.x += col.nx * col.pen;
      this.pos.z += col.nz * col.pen;
      if (col.nx !== 0) this.vel.x = 0;
      if (col.nz !== 0) this.vel.z = 0;
    }

    // Camera bob
    if (isMoving && this.isGrounded) {
      this.bobTimer += dt * BOB_FREQ * (this.isCrouching ? 0.7 : 1.0);
      this.bobOffset = Math.sin(this.bobTimer) * BOB_AMP * (this.isWalking ? 0.5 : 1.0);

      // Footsteps
      this.footstepTimer -= dt;
      if (this.footstepTimer <= 0) {
        const interval = this.isCrouching ? 0.65 : this.isWalking ? 0.55 : 0.38;
        this.footstepTimer = interval;
        this.audio?.playFootstep('concrete', this.isCrouching || this.isWalking);
      }
    } else {
      this.bobOffset *= Math.pow(0.01, dt * 5);
    }

    // Weapon update
    const wep = this.getActiveWeapon();
    if (wep) wep.update(dt);

    // Auto-fire
    if ((this.mouseButtons[0]) && wep && !wep.def.isMelee && wep.def.isAuto) {
      this._tryFire(geometry);
    }
  }

  _tryFire(geometry) {
    const now = performance.now() / 1000;
    const wep = this.getActiveWeapon();
    if (!wep || !wep.canFire(now)) return false;

    if (wep.clip <= 0 && !wep.def.isMelee) {
      this.audio?.playDryFire();
      wep.startReload();
      return false;
    }

    wep.fire(now);

    // Apply recoil
    const rec = wep.getRecoil(this.isMoving);
    this.recoilPitch += rec.y;
    this.recoilYaw   += rec.x;

    // Play sound
    if (wep.def.audioType === 'rifle') this.audio?.playShot_rifle();
    else if (wep.def.audioType === 'pistol') this.audio?.playShot_pistol();
    else if (wep.def.audioType === 'smg') this.audio?.playShot_smg();
    else if (wep.def.audioType === 'sniper') this.audio?.playShot_sniper();
    else if (wep.def.audioType === 'shotgun') this.audio?.playShot_shotgun();
    else if (wep.def.isMelee) this.audio?.playKnifeSwing();

    return true;
  }

  attemptFire(geometry, bots, onHit, onKill, effects) {
    const wep = this.getActiveWeapon();
    if (!wep) return;

    const fired = this._tryFire(geometry);
    if (!fired) return;

    const pellets = wep.def.pellets || 1;
    const spread = wep.getSpread(this.isMoving, this.isCrouching, this.isScoped);

    for (let p = 0; p < pellets; p++) {
      // Build ray from camera
      const totalPitch = this.pitch + this.recoilPitch;
      const totalYaw   = this.yaw   + this.recoilYaw;

      const spreadX = (Math.random() - 0.5) * spread;
      const spreadY = (Math.random() - 0.5) * spread;

      const cp = totalPitch + spreadY;
      const cy = totalYaw   + spreadX;

      const dx = Math.sin(cy) * Math.cos(cp);
      const dy = Math.sin(cp);
      const dz = Math.cos(cy) * Math.cos(cp);

      const origin = {
        x: this.pos.x,
        y: this.pos.y + (this.isCrouching ? -0.2 : 0.0),
        z: this.pos.z
      };
      const dir = { x: dx, y: dy, z: dz };

      if (wep.def.isMelee) {
        // Melee range check
        for (const bot of bots) {
          if (!bot.alive) continue;
          const dist = Math.hypot(bot.pos.x - origin.x, bot.pos.z - origin.z);
          if (dist <= wep.def.range) {
            const dmg = this._applyHit(bot, wep, false, effects);
            onHit && onHit(false);
            if (!bot.alive) { onKill && onKill(bot, false); }
          }
        }
        continue;
      }

      // Check bots first
      let hitBot = null, hitBotDist = Infinity, hitIsHead = false;

      for (const bot of bots) {
        if (!bot.alive) continue;
        const result = raycastBot(origin, dir, bot);
        if (result.hit && result.distance < hitBotDist && result.distance <= wep.def.range) {
          hitBotDist = result.distance;
          hitBot = bot;
          hitIsHead = result.isHead;
        }
      }

      // Check walls
      const wallHit = raycastMap(origin, dir, wep.def.range, geometry);

      if (hitBot && hitBotDist < (wallHit.distance || Infinity)) {
        const dmg = this._applyHit(hitBot, wep, hitIsHead, effects);
        onHit && onHit(hitIsHead);
        if (!hitBot.alive) onKill && onKill(hitBot, hitIsHead);
        // Muzzle flash direction
        if (effects) effects.addMuzzleFlash(origin);
      } else if (wallHit.hit) {
        if (effects) effects.addImpact(
          origin.x + dir.x * wallHit.distance,
          origin.y + dir.y * wallHit.distance,
          origin.z + dir.z * wallHit.distance
        );
        this.audio?.playWallImpact();
        if (effects) effects.addMuzzleFlash(origin);
      } else {
        if (effects) effects.addMuzzleFlash(origin);
      }
    }
  }

  _applyHit(target, wep, isHead, effects) {
    let dmg = isHead
      ? wep.def.damage * wep.def.headMult
      : wep.def.damage;

    target.takeDamage(dmg, wep.def.armorPen, isHead);
    this.audio?.playHitImpact(isHead);
    if (effects) effects.addBloodParticle(target.pos.x, target.pos.y, target.pos.z);
    return dmg;
  }

  reload() {
    const wep = this.getActiveWeapon();
    if (wep && !wep.isReloading && wep.clip < wep.def.magSize) {
      wep.startReload();
      this.audio?.playReload();
    }
  }

  switchWeapon(slot) {
    if (slot < 0 || slot > 2) return;
    if (this.weapons[slot] && slot !== this.activeSlot) {
      this.activeSlot = slot;
      this.isScoped = false;
      this.scopeFOV = 1.0;
    }
  }

  toggleScope() {
    const wep = this.getActiveWeapon();
    if (!wep || !wep.def.isSniper) return;
    this.isScoped = !this.isScoped;
    this.scopeFOV = this.isScoped ? 0.25 : 1.0;
  }

  getCameraPosition() {
    const h = this.isCrouching ? CROUCH_HEIGHT - 0.15 : PLAYER_HEIGHT - 0.1;
    return {
      x: this.pos.x,
      y: this.pos.y - (this.isCrouching ? 0.1 : 0) + this.bobOffset,
      z: this.pos.z
    };
  }

  getViewAngles() {
    return {
      yaw: this.yaw + this.recoilYaw,
      pitch: this.pitch + this.recoilPitch
    };
  }

  getNearbyBombSite() {
    for (const site of Object.values(BOMB_SITES)) {
      const d = Math.hypot(this.pos.x - site.center.x, this.pos.z - site.center.z);
      if (d <= site.radius) return site;
    }
    return null;
  }

  isInSite(siteId) {
    const site = BOMB_SITES[siteId];
    if (!site) return false;
    const d = Math.hypot(this.pos.x - site.center.x, this.pos.z - site.center.z);
    return d <= site.radius;
  }
}

// Simple capsule raycast against a bot
function raycastBot(origin, dir, bot) {
  const bx = bot.pos.x, by = bot.pos.y, bz = bot.pos.z;
  const height = 1.7;
  const radius = 0.35;

  // Cylinder intersection
  const dx = origin.x - bx, dz = origin.z - bz;
  const a = dir.x * dir.x + dir.z * dir.z;
  const b = 2 * (dx * dir.x + dz * dir.z);
  const c = dx * dx + dz * dz - radius * radius;
  const disc = b * b - 4 * a * c;

  if (disc < 0) return { hit: false };
  const t = (-b - Math.sqrt(disc)) / (2 * a);
  if (t < 0.1) return { hit: false };

  const hitY = origin.y + dir.y * t;
  if (hitY < by - 0.1 || hitY > by + height) return { hit: false };

  const isHead = hitY > by + height * 0.82;
  return { hit: true, distance: t, isHead };
}
