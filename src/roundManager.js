// Round manager
export const ROUND_PHASES = {
  FREEZE: 'freeze',
  BUY: 'buy',
  LIVE: 'live',
  POST_PLANT: 'post_plant',
  END: 'end',
  HALFTIME: 'halftime'
};

export const TOTAL_ROUNDS = 24; // 12 per half
export const ROUNDS_PER_HALF = 12;
export const FREEZE_TIME = 15.0;
export const BUY_TIME = 15.0; // overlaps with freeze
export const ROUND_TIME = 105.0; // 1:45
export const HALFTIME_DURATION = 8.0;
export const ROUND_END_DURATION = 5.0;
export const OVERTIME_ROUNDS = 6;

export class RoundManager {
  constructor() {
    this.reset();
  }

  reset() {
    this.round = 0;
    this.phase = ROUND_PHASES.FREEZE;
    this.phaseTimer = 0;
    this.scores = { attacker: 0, defender: 0 };
    this.matchOver = false;
    this.winner = null;
    this.halftimeSwapped = false;
    this.overtimeRound = 0;
    this.roundEndReason = '';
    this.isOvertime = false;
  }

  startRound() {
    this.round++;
    this.phase = ROUND_PHASES.FREEZE;
    this.phaseTimer = FREEZE_TIME;
    this.roundEndReason = '';
  }

  update(dt) {
    this.phaseTimer -= dt;

    if (this.phaseTimer <= 0) {
      this._advancePhase();
    }
  }

  _advancePhase() {
    switch (this.phase) {
      case ROUND_PHASES.FREEZE:
        this.phase = ROUND_PHASES.LIVE;
        this.phaseTimer = ROUND_TIME;
        break;
      case ROUND_PHASES.LIVE:
        // Time ran out — defenders win (attacker fails to plant)
        this.endRound('defender', 'TIME EXPIRED');
        break;
      case ROUND_PHASES.POST_PLANT:
        // Timer ran out handled by bomb system
        break;
      case ROUND_PHASES.END:
        // Check halftime
        if (this.round === ROUNDS_PER_HALF && !this.halftimeSwapped) {
          this.phase = ROUND_PHASES.HALFTIME;
          this.phaseTimer = HALFTIME_DURATION;
        } else {
          this._checkMatchOver();
        }
        break;
      case ROUND_PHASES.HALFTIME:
        this.halftimeSwapped = true;
        this._checkMatchOver();
        break;
    }
  }

  onBombPlanted() {
    if (this.phase !== ROUND_PHASES.LIVE) return;
    this.phase = ROUND_PHASES.POST_PLANT;
    this.phaseTimer = 999; // bomb handles countdown
  }

  onBombDetonated() {
    this.endRound('attacker', 'DEVICE DETONATED');
  }

  onBombDefused() {
    this.endRound('defender', 'DEVICE DEFUSED');
  }

  endRound(winningTeam, reason, delay = ROUND_END_DURATION) {
    if (this.phase === ROUND_PHASES.END) return;
    this.phase = ROUND_PHASES.END;
    this.phaseTimer = delay;
    this.scores[winningTeam]++;
    this.roundEndReason = reason;
    this._checkMatchOver();
    return winningTeam;
  }

  _checkMatchOver() {
    const { attacker: a, defender: d } = this.scores;
    const needed = Math.ceil((TOTAL_ROUNDS / 2) + 1); // 13

    if (a >= needed) { this.matchOver = true; this.winner = 'attacker'; }
    else if (d >= needed) { this.matchOver = true; this.winner = 'defender'; }
    else if (a + d >= TOTAL_ROUNDS) {
      // Tie - overtime
      if (a === d) {
        this.isOvertime = true;
        // Sudden death: first to 4 in a 6-round OT
      } else {
        this.matchOver = true;
        this.winner = a > d ? 'attacker' : 'defender';
      }
    }
  }

  getPhaseLabel() {
    switch (this.phase) {
      case ROUND_PHASES.FREEZE: return 'BUY PHASE';
      case ROUND_PHASES.LIVE:   return 'LIVE';
      case ROUND_PHASES.POST_PLANT: return 'DEVICE PLANTED';
      case ROUND_PHASES.END:    return 'ROUND OVER';
      case ROUND_PHASES.HALFTIME: return 'HALFTIME';
      default: return '';
    }
  }

  getTimerDisplay() {
    const t = Math.max(0, this.phaseTimer);
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  isLivePhase() {
    return this.phase === ROUND_PHASES.LIVE || this.phase === ROUND_PHASES.POST_PLANT;
  }

  isBuyPhase() {
    return this.phase === ROUND_PHASES.FREEZE;
  }

  // Get actual team assignments based on halftime swap
  getActualTeam(originalTeam) {
    if (!this.halftimeSwapped) return originalTeam;
    return originalTeam === 'attacker' ? 'defender' : 'attacker';
  }
}
