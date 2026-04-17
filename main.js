// NEXUS PROTOCOL - Main Game Loop
import { AudioSystem } from './src/audio.js';
import { Player } from './src/player.js';
import { Bot } from './src/bots.js';
import { Renderer } from './src/renderer.js';
import { EffectsSystem } from './src/effects.js';
import { RoundManager, ROUND_PHASES } from './src/roundManager.js';
import { BombState, BOMB_PLANT_TIME, BOMB_DEFUSE_TIME, BOMB_DEFUSE_TIME_KIT } from './src/bomb.js';
import { EconomyManager, ECONOMY } from './src/economy.js';
import { HUDManager } from './src/hud.js';
import { BuyMenu } from './src/buyMenu.js';
import { SPAWNS, BOMB_SITES } from './src/map.js';

// ─────────────────────────────────────────────────────
// GAME STATE
// ─────────────────────────────────────────────────────
const audio = new AudioSystem();
const economy = new EconomyManager();
const roundMgr = new RoundManager();
const bombState = new BombState();
let renderer = null;
let effects = null;
let hud = null;
let buyMenu = null;
let player = null;
let bots = [];

let gameActive = false;
let paused = false;
let pointerLocked = false;
let lastTime = 0;
let animFrameId = null;

// Settings
let settings = {
  sensitivity: 3.0,
  volume: 0.7,
  difficulty: 'normal',
  crosshair: 'default'
};

// Match stats
let playerKillsThisRound = 0;
let playerPlanted = false;
let playerDefused = false;

// ─────────────────────────────────────────────────────
// LOADING
// ─────────────────────────────────────────────────────
async function loadGame() {
  const fill = document.getElementById('loading-fill');
  const status = document.getElementById('loading-status');

  const steps = [
    ['Initializing audio...', async () => { audio.init(); }],
    ['Loading renderer...', async () => {
      renderer = new Renderer(document.getElementById('game-canvas'));
      await renderer.init();
    }],
    ['Building systems...', async () => {
      hud = new HUDManager();
      player = new Player(audio);
      economy.reset();
    }],
    ['Compiling map...', async () => {
      await new Promise(r => setTimeout(r, 200)); // simulate load
    }],
    ['Ready.', async () => {
      await new Promise(r => setTimeout(r, 300));
    }],
  ];

  for (let i = 0; i < steps.length; i++) {
    status.textContent = steps[i][0];
    fill.style.width = ((i + 1) / steps.length * 100) + '%';
    await steps[i][1]();
  }

  // Show main menu
  document.getElementById('loading-screen').classList.add('hidden');
  document.getElementById('main-menu').classList.remove('hidden');
  bindMenuEvents();
}

// ─────────────────────────────────────────────────────
// MENU EVENTS
// ─────────────────────────────────────────────────────
function bindMenuEvents() {
  document.getElementById('btn-quickplay').addEventListener('click', () => {
    audio.resume(); audio.playMenuClick();
    showTeamSelect();
  });
  document.getElementById('btn-settings').addEventListener('click', () => {
    audio.playMenuClick();
    document.getElementById('settings-menu').classList.remove('hidden');
  });
  document.getElementById('btn-settings-close').addEventListener('click', () => {
    audio.playMenuClick();
    document.getElementById('settings-menu').classList.add('hidden');
  });
  document.getElementById('btn-controls').addEventListener('click', () => {
    audio.playMenuClick();
    document.getElementById('controls-menu').classList.remove('hidden');
  });
  document.getElementById('btn-controls-close').addEventListener('click', () => {
    audio.playMenuClick();
    document.getElementById('controls-menu').classList.add('hidden');
  });
  document.getElementById('team-attacker').addEventListener('click', () => startMatch('attacker'));
  document.getElementById('team-defender').addEventListener('click', () => startMatch('defender'));

  // Settings sliders
  const sensSlider = document.getElementById('sens-slider');
  const volSlider = document.getElementById('vol-slider');
  const diffSelect = document.getElementById('difficulty-select');
  const crosshairSelect = document.getElementById('crosshair-select');

  sensSlider?.addEventListener('input', e => {
    settings.sensitivity = parseFloat(e.target.value);
    document.getElementById('sens-value').textContent = settings.sensitivity.toFixed(1);
    if (player) player.sensitivity = settings.sensitivity;
  });
  volSlider?.addEventListener('input', e => {
    settings.volume = parseFloat(e.target.value);
    document.getElementById('vol-value').textContent = Math.round(settings.volume * 100) + '%';
    audio.setVolume(settings.volume);
  });
  diffSelect?.addEventListener('change', e => {
    settings.difficulty = e.target.value;
    document.getElementById('diff-display').textContent = e.target.value.toUpperCase();
  });
  crosshairSelect?.addEventListener('change', e => {
    settings.crosshair = e.target.value;
  });

  // Pause menu
  document.getElementById('btn-resume')?.addEventListener('click', resumeGame);
  document.getElementById('btn-pause-settings')?.addEventListener('click', () => {
    document.getElementById('settings-menu').classList.remove('hidden');
  });
  document.getElementById('btn-abandon')?.addEventListener('click', () => {
    endGame();
  });

  // Match over
  document.getElementById('btn-rematch')?.addEventListener('click', () => {
    document.getElementById('match-over').classList.add('hidden');
    audio.playMenuClick();
    startMatch(player.team);
  });
  document.getElementById('btn-main-menu-end')?.addEventListener('click', () => {
    document.getElementById('match-over').classList.add('hidden');
    endGame();
  });
}

function showTeamSelect() {
  document.getElementById('main-menu').classList.add('hidden');
  document.getElementById('team-select').classList.remove('hidden');
  document.getElementById('diff-display').textContent = settings.difficulty.toUpperCase();
}

// ─────────────────────────────────────────────────────
// MATCH SETUP
// ─────────────────────────────────────────────────────
function startMatch(chosenTeam) {
  document.getElementById('team-select').classList.add('hidden');
  document.getElementById('main-menu').classList.add('hidden');
  document.getElementById('game-canvas').classList.remove('hidden');
  document.getElementById('hud').classList.remove('hidden');

  // Reset state
  roundMgr.reset();
  economy.reset();
  bombState.reset();
  bots = [];
  gameActive = true;
  paused = false;

  // Setup player
  player.team = chosenTeam;
  player.sensitivity = settings.sensitivity;
  player.money = economy.getMoney();

  // Create bots (4 per team, player is 5th)
  const botTeams = { attacker: 0, defender: 0 };
  botTeams[chosenTeam]++; // player counts as one

  for (let i = 0; i < 4; i++) {
    const b = new Bot(i, 'attacker', settings.difficulty);
    bots.push(b);
    renderer.createBotMesh(b);
  }
  for (let i = 4; i < 8; i++) {
    const b = new Bot(i, 'defender', settings.difficulty);
    bots.push(b);
    renderer.createBotMesh(b);
  }

  // Setup buy menu
  buyMenu = new BuyMenu(player, economy, audio);

  // Setup effects
  effects = new EffectsSystem(renderer.getScene(), renderer.getTHREE());

  // Input
  bindGameInput();
  requestPointerLock();

  startRound();
}

function spawnAll() {
  // Determine current actual teams (may be swapped at halftime)
  const playerActualTeam = roundMgr.getActualTeam(player.team);

  const attackSpawns = [...SPAWNS.attacker];
  const defendSpawns = [...SPAWNS.defender];

  // Spawn player
  const pSpawns = playerActualTeam === 'attacker' ? attackSpawns : defendSpawns;
  const pSpawn = pSpawns[Math.floor(Math.random() * pSpawns.length)];
  player.spawn(pSpawn, playerActualTeam);
  player.equipStartingWeapons();

  // Assign bomb to a random attacker bot (or player if attacker)
  let bombAssigned = false;
  if (playerActualTeam === 'attacker' && Math.random() < 0.35) {
    player.hasBomb = true;
    bombState.assignToPlayer();
    bombAssigned = true;
  }

  // Spawn bots with actual teams based on halftime
  for (const bot of bots) {
    const botActualTeam = roundMgr.getActualTeam(bot.team);
    const spawns = botActualTeam === 'attacker' ? attackSpawns : defendSpawns;
    const sp = spawns[Math.floor(Math.random() * spawns.length)];
    bot.spawn(sp);
    bot.team = botActualTeam;
    bot.equipWeapons(roundMgr.round, bot.money);

    if (botActualTeam === 'attacker' && !bombAssigned) {
      const shouldCarry = Math.random() < 0.6;
      if (shouldCarry) {
        bot.hasBomb = true;
        bombState.assignToBot(bot.id);
        bombAssigned = true;
      }
    }
  }

  if (!bombAssigned) {
    // Give to random attacker bot
    const attackBots = bots.filter(b => b.team === 'attacker');
    if (attackBots.length) {
      const pick = attackBots[Math.floor(Math.random() * attackBots.length)];
      pick.hasBomb = true;
      bombState.assignToBot(pick.id);
    }
  }
}

// ─────────────────────────────────────────────────────
// ROUND LIFECYCLE
// ─────────────────────────────────────────────────────
function startRound() {
  bombState.reset();
  player.isPlanting = false;
  player.isDefusing = false;
  playerKillsThisRound = 0;
  playerPlanted = false;
  playerDefused = false;

  spawnAll();
  roundMgr.startRound();

  audio.playRoundStart();
  hud.updateScore(roundMgr.scores.attacker, roundMgr.scores.defender);
  hud.showBombStatus(false);

  buyMenu?.close();
}

function endRound(winner, reason) {
  if (!gameActive) return; // prevent double calls
  gameActive = false;
  roundMgr.endRound(winner, reason);

  const playerWon = winner === roundMgr.getActualTeam(player.team);
  audio[playerWon ? 'playRoundWin' : 'playRoundLose']();

  // Economy payout
  const events = {
    kills: playerKillsThisRound,
    planted: playerPlanted,
    defused: playerDefused
  };
  economy.onRoundEnd(roundMgr.getActualTeam(player.team), winner, events);
  player.money = economy.getMoney();

  // Bot economy (simple)
  for (const bot of bots) {
    const botActualTeam = roundMgr.getActualTeam(bot.team);
    const botWon = winner === botActualTeam;
    bot.money += botWon ? ECONOMY.roundWin : ECONOMY.lossBonus[0];
    bot.money += bot.roundKills * ECONOMY.killReward;
    bot.money = Math.min(ECONOMY.maxMoney, bot.money);
  }

  // Round result UI
  const color = playerWon ? '#00ff88' : '#ff3d57';
  hud.showRoundResult(
    playerWon ? 'ROUND WON' : 'ROUND LOST',
    reason,
    color
  );

  hud.updateScore(roundMgr.scores.attacker, roundMgr.scores.defender);

  if (roundMgr.matchOver) {
    setTimeout(showMatchOver, 3500);
  } else if (roundMgr.phase === ROUND_PHASES.HALFTIME) {
    setTimeout(showHalftime, 3500);
  } else {
    setTimeout(() => {
      gameActive = true;
      startRound();
    }, 4500);
  }
}

function showHalftime() {
  // Brief halftime screen
  hud.showRoundResult(
    'HALFTIME',
    `SIDES SWAP — ${roundMgr.scores.attacker} : ${roundMgr.scores.defender}`,
    '#00e5ff'
  );
  setTimeout(() => {
    gameActive = true;
    startRound();
  }, 8000);
}

function showMatchOver() {
  const el = document.getElementById('match-over');
  const titleEl = document.getElementById('match-result-title');
  const scoreEl = document.getElementById('match-final-score');
  const statsEl = document.getElementById('match-stats');
  el.classList.remove('hidden');

  const playerTeamWon = roundMgr.winner === roundMgr.getActualTeam(player.team);

  titleEl.textContent = playerTeamWon ? 'VICTORY' : 'DEFEAT';
  titleEl.style.color = playerTeamWon ? '#00ff88' : '#ff3d57';
  scoreEl.textContent = `${roundMgr.scores.attacker} — ${roundMgr.scores.defender}`;
  statsEl.textContent = `K: ${player.kills}  D: ${player.deaths}`;

  if (playerTeamWon) audio.playRoundWin();
  else audio.playRoundLose();
}

function endGame() {
  gameActive = false;
  if (animFrameId) cancelAnimationFrame(animFrameId);
  document.exitPointerLock?.();

  document.getElementById('game-canvas').classList.add('hidden');
  document.getElementById('hud').classList.add('hidden');
  document.getElementById('death-screen').classList.add('hidden');
  document.getElementById('scoreboard').classList.add('hidden');
  buyMenu?.close();

  document.getElementById('main-menu').classList.remove('hidden');

  // Re-render menu bg
  lastTime = 0;
  gameLoop(performance.now());
}

// ─────────────────────────────────────────────────────
// INPUT
// ─────────────────────────────────────────────────────
function bindGameInput() {
  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);
  document.addEventListener('mousedown', onMouseDown);
  document.addEventListener('mouseup', onMouseUp);
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('wheel', onWheel);
  document.addEventListener('contextmenu', e => e.preventDefault());
}

function onKeyDown(e) {
  if (!gameActive && e.code !== 'Escape') return;

  player.keys[e.code] = true;

  if (e.code === 'Escape') {
    if (gameActive) togglePause();
    return;
  }

  if (paused) return;

  switch (e.code) {
    case 'KeyR':
      player.reload();
      break;
    case 'Digit1':
      player.switchWeapon(0);
      break;
    case 'Digit2':
      player.switchWeapon(1);
      break;
    case 'Digit3':
      player.switchWeapon(2);
      break;
    case 'KeyB':
      if (roundMgr.isBuyPhase()) buyMenu?.toggle();
      break;
    case 'Tab':
      e.preventDefault();
      document.getElementById('scoreboard').classList.remove('hidden');
      updateScoreboard();
      break;
    case 'KeyF':
    case 'KeyE':
      handleInteract();
      break;
  }
}

function onKeyUp(e) {
  player.keys[e.code] = false;
  if (e.code === 'Tab') {
    document.getElementById('scoreboard').classList.add('hidden');
  }
}

function onMouseDown(e) {
  if (paused) return;
  player.mouseButtons[e.button] = true;

  if (!pointerLocked) { requestPointerLock(); return; }

  if (e.button === 0 && player.alive) {
    // Single-fire click for pistols / semi weapons
    const wep = player.getActiveWeapon();
    if (wep && !wep.def.isAuto) {
      player.attemptFire(
        renderer.getGeometry(),
        bots.filter(b => b.alive && b.team !== player.team),
        (isHead) => {
          hud.showHitMarker(false);
        },
        (bot, isHead) => {
          onPlayerKillBot(bot, isHead, wep.def.name);
        },
        effects
      );
    } else if (wep && wep.def.isMelee) {
      player.attemptFire(
        renderer.getGeometry(),
        bots.filter(b => b.alive && b.team !== player.team),
        (isHead) => hud.showHitMarker(false),
        (bot, isHead) => onPlayerKillBot(bot, isHead, wep.def.name),
        effects
      );
    }
  }

  if (e.button === 2) {
    player.toggleScope();
  }
}

function onMouseUp(e) {
  player.mouseButtons[e.button] = false;
}

function onMouseMove(e) {
  if (!pointerLocked || paused) return;
  player.mouseDelta.x += e.movementX;
  player.mouseDelta.y += e.movementY;
}

function onWheel(e) {
  if (!player.alive) return;
  const dir = e.deltaY > 0 ? 1 : -1;
  let slot = player.activeSlot;
  for (let i = 0; i < 3; i++) {
    slot = (slot + dir + 3) % 3;
    if (player.weapons[slot]) {
      player.switchWeapon(slot);
      break;
    }
  }
}

// ─────────────────────────────────────────────────────
// POINTER LOCK
// ─────────────────────────────────────────────────────
function requestPointerLock() {
  const canvas = document.getElementById('game-canvas');
  if (canvas) canvas.requestPointerLock();
}

document.addEventListener('pointerlockchange', () => {
  pointerLocked = !!document.pointerLockElement;
  const msg = document.getElementById('pointer-lock-msg');
  if (!pointerLocked && gameActive && !paused) {
    msg?.classList.add('show');
  } else {
    msg?.classList.remove('show');
  }
});

document.getElementById('game-canvas')?.addEventListener('click', () => {
  if (!pointerLocked && gameActive) requestPointerLock();
});

// ─────────────────────────────────────────────────────
// PAUSE
// ─────────────────────────────────────────────────────
function togglePause() {
  if (!gameActive && !paused) return;
  paused = !paused;
  const pauseMenu = document.getElementById('pause-menu');
  if (paused) {
    pauseMenu.classList.remove('hidden');
    document.exitPointerLock?.();
  } else {
    pauseMenu.classList.add('hidden');
    resumeGame();
  }
}

function resumeGame() {
  paused = false;
  document.getElementById('pause-menu').classList.add('hidden');
  if (gameActive) requestPointerLock();
}

document.getElementById('btn-resume')?.addEventListener('click', resumeGame);

// ─────────────────────────────────────────────────────
// INTERACT (Plant / Defuse / Pick up)
// ─────────────────────────────────────────────────────
function handleInteract() {
  if (!player.alive || !roundMgr.isLivePhase()) return;

  const pTeam = player.team;

  // Plant
  if (pTeam === 'attacker' && player.hasBomb && !bombState.planted) {
    const site = player.getNearbyBombSite();
    if (site) {
      player.isPlanting = true;
      return;
    }
  }

  // Defuse
  if (pTeam === 'defender' && bombState.planted && !bombState.defused) {
    const site = BOMB_SITES[bombState.plantedSiteId];
    if (site) {
      const d = Math.hypot(player.pos.x - site.center.x, player.pos.z - site.center.z);
      if (d <= site.radius + 0.5) {
        player.isDefusing = true;
        bombState.defuseTimer = 0;
        return;
      }
    }
  }

  // Pick up bomb (if dropped)
  if (bombState.carriedBy === null && !bombState.planted && pTeam === 'attacker') {
    // Check if bomb was dropped nearby (simplified: always available)
    player.hasBomb = true;
    bombState.assignToPlayer();
  }
}

// ─────────────────────────────────────────────────────
// KILL HANDLING
// ─────────────────────────────────────────────────────
function onPlayerKillBot(bot, isHead, weaponName) {
  bot.alive = false;
  bot.deaths++;
  player.kills++;
  player.roundKills++;
  playerKillsThisRound++;

  hud.showHitMarker(true);
  hud.addKillfeedEntry('YOU', bot.name, weaponName, isHead, true);
  audio.playRoundWin && undefined; // small win cue not needed here

  // Check if all enemies dead
  checkRoundEndByElimination();
}

function onBotKillPlayer() {
  player.alive = false;
  player.deaths++;

  document.getElementById('death-screen').classList.remove('hidden');
  document.getElementById('death-killer-info').textContent = `Eliminated by ${player.killedBy || 'ENEMY'}`;

  // If bomb carrier dies, drop bomb (transfer to random alive attacker)
  if (player.hasBomb) {
    player.hasBomb = false;
    const aliveAttackers = bots.filter(b => b.alive && b.team === 'attacker');
    if (aliveAttackers.length) {
      const pick = aliveAttackers[0];
      pick.hasBomb = true;
      bombState.assignToBot(pick.id);
    }
  }

  checkRoundEndByElimination();
}

function checkRoundEndByElimination() {
  const enemyTeam = player.team === 'attacker' ? 'defender' : 'attacker';
  const playerTeam = player.team;

  const aliveEnemies = bots.filter(b => b.alive && b.team === enemyTeam);
  const playerAlive = player.alive;
  const aliveAllies = bots.filter(b => b.alive && b.team === playerTeam);

  // All enemies dead → player team wins
  if (!aliveEnemies.length) {
    endRound(player.team, 'ELIMINATION');
    return;
  }

  // All player-team members dead (player + allies)
  if (!playerAlive && !aliveAllies.length) {
    endRound(enemyTeam, 'ELIMINATION');
    return;
  }
}

// ─────────────────────────────────────────────────────
// AUTO-FIRE UPDATE (called in game loop)
// ─────────────────────────────────────────────────────
function updatePlayerAutoFire() {
  if (!player.alive || !player.mouseButtons[0]) return;
  const wep = player.getActiveWeapon();
  if (!wep || !wep.def.isAuto || wep.def.isMelee) return;

  player.attemptFire(
    renderer.getGeometry(),
    bots.filter(b => b.alive && b.team !== player.team),
    (isHead) => hud.showHitMarker(false),
    (bot, isHead) => onPlayerKillBot(bot, isHead, wep.def.name),
    effects
  );
}

// ─────────────────────────────────────────────────────
// PLANT / DEFUSE UPDATE
// ─────────────────────────────────────────────────────
function updatePlantDefuse(dt) {
  if (!player.alive) return;

  // PLANTING
  if (player.isPlanting) {
    if (!player.hasBomb || bombState.planted) {
      player.isPlanting = false;
      hud.hidePlantProgress();
      return;
    }
    if (!player.keys['KeyF'] && !player.keys['KeyE']) {
      player.isPlanting = false;
      player.interactProgress = 0;
      hud.hidePlantProgress();
      return;
    }

    const site = player.getNearbyBombSite();
    if (!site) {
      player.isPlanting = false;
      player.interactProgress = 0;
      hud.hidePlantProgress();
      return;
    }

    player.interactProgress += dt / BOMB_PLANT_TIME;
    hud.showPlantProgress(player.interactProgress, false);

    if (player.interactProgress >= 1.0) {
      player.interactProgress = 0;
      player.isPlanting = false;
      player.hasBomb = false;
      bombState.plant(site.id, player.pos);
      hud.hidePlantProgress();
      hud.showBombStatus(true);
      roundMgr.onBombPlanted();
      audio.playBombPlanted();
      playerPlanted = true;
    }
    return;
  }

  // DEFUSING
  if (player.isDefusing) {
    if (!bombState.planted || bombState.defused) {
      player.isDefusing = false;
      hud.hidePlantProgress();
      return;
    }
    if (!player.keys['KeyF'] && !player.keys['KeyE']) {
      player.isDefusing = false;
      bombState.resetDefuseProgress();
      hud.hidePlantProgress();
      return;
    }

    const site = BOMB_SITES[bombState.plantedSiteId];
    const d = site ? Math.hypot(player.pos.x - site.center.x, player.pos.z - site.center.z) : 999;
    if (d > site.radius + 0.8) {
      player.isDefusing = false;
      bombState.resetDefuseProgress();
      hud.hidePlantProgress();
      return;
    }

    const progress = bombState.getDefuseProgress(dt, player.hasDefuseKit);
    hud.showPlantProgress(progress, true);

    if (bombState.isComplete(player.hasDefuseKit)) {
      player.isDefusing = false;
      hud.hidePlantProgress();
      hud.showBombStatus(false);
      roundMgr.onBombDefused();
      audio.playBombDefused();
      playerDefused = true;
      const winner = roundMgr.endRound('defender', 'DEVICE DEFUSED');
      endRound('defender', 'DEVICE DEFUSED');
    }
  }
}

// ─────────────────────────────────────────────────────
// INTERACT PROMPT
// ─────────────────────────────────────────────────────
function updateInteractPrompt() {
  if (!player.alive) { hud.showInteractPrompt(false); return; }

  const pTeam = player.team;
  if (pTeam === 'attacker' && player.hasBomb && !bombState.planted && roundMgr.isLivePhase()) {
    const site = player.getNearbyBombSite();
    if (site) {
      hud.showInteractPrompt(true, '[F]', `PLANT DEVICE (${site.label})`);
      return;
    }
  }

  if (pTeam === 'defender' && bombState.planted && !bombState.defused && roundMgr.isLivePhase()) {
    const site = BOMB_SITES[bombState.plantedSiteId];
    const d = site ? Math.hypot(player.pos.x - site.center.x, player.pos.z - site.center.z) : 999;
    if (d <= site.radius + 0.5) {
      hud.showInteractPrompt(true, '[F]', 'DEFUSE DEVICE');
      return;
    }
  }

  hud.showInteractPrompt(false);
}

// ─────────────────────────────────────────────────────
// SCOREBOARD
// ─────────────────────────────────────────────────────
function updateScoreboard() {
  const el = document.getElementById('scoreboard-content');
  if (!el) return;
  el.innerHTML = '';

  const all = [{ isPlayer: true, name: 'YOU', kills: player.kills, deaths: player.deaths, health: player.health, alive: player.alive, team: player.team }, ...bots.map(b => ({
    isPlayer: false, name: b.name, kills: b.kills, deaths: b.deaths, health: b.health, alive: b.alive, team: b.team
  }))];

  // Header
  const header = document.createElement('div');
  header.className = 'sb-row sb-header';
  header.innerHTML = `<span class="sb-name">NAME</span><span class="sb-stat">TEAM</span><span class="sb-stat">K</span><span class="sb-stat">D</span><span class="sb-stat">HP</span>`;
  el.appendChild(header);

  for (const p of all) {
    const row = document.createElement('div');
    row.className = 'sb-row' + (p.isPlayer ? ' player-row' : '') + (!p.alive ? ' dead-row' : '');
    row.innerHTML = `
      <span class="sb-name">${p.name}</span>
      <span class="sb-stat" style="color:${p.team==='attacker'?'#ff5e3a':'#00b4d8'}">${p.team.toUpperCase().slice(0,3)}</span>
      <span class="sb-stat">${p.kills}</span>
      <span class="sb-stat">${p.deaths}</span>
      <span class="sb-stat">${p.alive ? Math.round(p.health) : '✗'}</span>
    `;
    el.appendChild(row);
  }
}

// ─────────────────────────────────────────────────────
// MAIN GAME LOOP
// ─────────────────────────────────────────────────────
function gameLoop(timestamp) {
  animFrameId = requestAnimationFrame(gameLoop);

  const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
  lastTime = timestamp;

  if (!renderer) return;

  if (!gameActive || paused) {
    renderer.render();
    return;
  }

  // Round manager
  roundMgr.update(dt);

  // Bomb update
  if (roundMgr.isLivePhase()) {
    const bombResult = bombState.update(dt, audio);
    if (bombResult === 'detonated') {
      effects?.addExplosion(
        bombState.plantedPos?.x || 0,
        1,
        bombState.plantedPos?.z || 0
      );
      endRound('attacker', 'DEVICE DETONATED');
    }
  }

  // Check halftime
  if (roundMgr.phase === ROUND_PHASES.HALFTIME && roundMgr.phaseTimer > 0) {
    // Phase is handled by roundMgr
  }

  // Player update
  if (player.alive) {
    player.update(dt, renderer.getGeometry(), roundMgr.phase);

    // Damage detection (already handled in attemptFire)
    if (player.health <= 0 && player.alive) {
      player.alive = false;
      onBotKillPlayer();
    }
  }

  // Auto-fire
  updatePlayerAutoFire();

  // Plant / defuse
  updatePlantDefuse(dt);

  // Bot updates
  for (const bot of bots) {
    if (!bot.alive) continue;
    bot.update(dt, player, bots, renderer.getGeometry(), roundMgr, bombState, audio);

    // Check if bot kills player
    if (!player.alive && bot.state === 'shoot') {
      // handled in bot._fireAtPlayer via player.takeDamage
    }

    renderer.updateBotMesh(bot);
  }

  // Player health changed?
  if (!player.alive && document.getElementById('death-screen').classList.contains('hidden')) {
    onBotKillPlayer();
  }

  // Watch for player damage
  {
    const wasHP = parseInt(hud.els.healthVal.textContent) || 100;
    if (player.health < wasHP) {
      hud.showDamageVignette();
    }
  }

  // Effects
  effects?.update(dt);

  // Camera
  renderer.updateCamera(player);

  // Bomb meshes
  renderer.updateBombMesh(bombState);
  renderer.updateSiteIndicators(bombState);

  // HUD updates
  hud.updateVitals(player.health, player.armor);

  const wep = player.getActiveWeapon();
  if (wep) {
    hud.updateAmmo(
      wep.clip, wep.reserve,
      wep.def.name, wep.isReloading, wep.def.isMelee
    );
    hud.updateCrosshair(settings.crosshair, wep.getSpread(player.isMoving, player.isCrouching, player.isScoped));
  }

  hud.updateWeaponSlots(player.weapons, player.activeSlot);
  hud.updateMoney(economy.getMoney());
  hud.updateTimer(
    roundMgr.phase === ROUND_PHASES.POST_PLANT
      ? Math.ceil(bombState.getTimeRemaining()) + 's'
      : roundMgr.getTimerDisplay(),
    roundMgr.getPhaseLabel(),
    roundMgr.phaseTimer <= 20 && roundMgr.phase === ROUND_PHASES.LIVE
  );
  hud.updateTeammates(bots, player.team);

  // Buy phase
  if (roundMgr.isBuyPhase()) {
    hud.showBuyPhaseNotice(true, roundMgr.phaseTimer);
  } else {
    hud.showBuyPhaseNotice(false, 0);
  }

  // Bomb status
  if (bombState.planted && !bombState.defused && !bombState.detonated) {
    hud.showBombStatus(true, `💣 ${(BOMB_SITES[bombState.plantedSiteId]?.label || 'SITE')} — ${Math.ceil(bombState.getTimeRemaining())}s`);
  } else {
    hud.showBombStatus(false);
  }

  // Interact prompt
  updateInteractPrompt();

  // Weapon view model
  if (wep) renderer.updateWeaponViewModel(wep.def, wep.isReloading, player.isCrouching);

  renderer.render();
}

// ─────────────────────────────────────────────────────
// BOOT
// ─────────────────────────────────────────────────────
window.addEventListener('load', async () => {
  await loadGame();
  requestAnimationFrame(gameLoop);
});
