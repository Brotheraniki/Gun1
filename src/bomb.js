// Bomb / Objective System
export const BOMB_PLANT_TIME = 3.2;
export const BOMB_DEFUSE_TIME = 10.0;
export const BOMB_DEFUSE_TIME_KIT = 5.0;
export const BOMB_DETONATE_TIME = 40.0;

export class BombState {
  constructor() {
    this.reset();
  }

  reset() {
    this.planted = false;
    this.defused = false;
    this.detonated = false;
    this.plantedSiteId = null;
    this.plantedPos = null;
    this.plantTimer = 0;
    this.defuseTimer = 0;
    this.carriedBy = null; // 'player' or bot id or null
    this.beepInterval = 1.0;
    this.beepTimer = 0;
    this.plantProgress = 0;
    this.defuseProgress = 0;
  }

  assignToPlayer() {
    this.carriedBy = 'player';
  }

  assignToBot(botId) {
    this.carriedBy = botId;
  }

  plant(siteId, pos) {
    this.planted = true;
    this.plantedSiteId = siteId;
    this.plantedPos = { ...pos };
    this.plantTimer = 0;
    this.carriedBy = null;
  }

  defuse() {
    this.defused = true;
  }

  update(dt, audio) {
    if (!this.planted || this.defused || this.detonated) return null;

    this.plantTimer += dt;

    // Beeping - faster as it gets closer to detonation
    const timeLeft = BOMB_DETONATE_TIME - this.plantTimer;
    this.beepInterval = Math.max(0.15, Math.min(1.0, timeLeft / 30));
    this.beepTimer -= dt;
    if (this.beepTimer <= 0) {
      this.beepTimer = this.beepInterval;
      audio?.playBombBeep();
    }

    if (this.plantTimer >= BOMB_DETONATE_TIME) {
      this.detonated = true;
      audio?.playExplosion();
      return 'detonated';
    }

    return null;
  }

  getTimeRemaining() {
    return Math.max(0, BOMB_DETONATE_TIME - this.plantTimer);
  }

  getDefuseProgress(dt, hasKit) {
    const time = hasKit ? BOMB_DEFUSE_TIME_KIT : BOMB_DEFUSE_TIME;
    this.defuseTimer += dt;
    this.defuseProgress = Math.min(1, this.defuseTimer / time);
    return this.defuseProgress;
  }

  resetDefuseProgress() {
    this.defuseTimer = 0;
    this.defuseProgress = 0;
  }

  isComplete(hasKit) {
    const time = hasKit ? BOMB_DEFUSE_TIME_KIT : BOMB_DEFUSE_TIME;
    return this.defuseTimer >= time;
  }
}
