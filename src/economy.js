// Economy system
export const ECONOMY = {
  // Round rewards
  roundWin: 3250,
  roundLoss: 1400,
  lossBonus: [1400, 1900, 2400, 2900, 3400], // consecutive losses
  killReward: 300,
  plantReward: 300,
  defuseReward: 300,
  bombDetonationReward: 0, // covered by round win
  headshot: 50, // bonus
  teamkill: -300,

  // Starting money
  startMoney: 800,
  maxMoney: 16000,

  // Caps
  maxCarryOver: 16000
};

export class EconomyManager {
  constructor() {
    // Per-player money tracking
    this.playerMoney = 800;
    this.consecutiveLosses = 0;
    this.teamConsecutiveLosses = { attacker: 0, defender: 0 };
  }

  reset() {
    this.playerMoney = ECONOMY.startMoney;
    this.consecutiveLosses = 0;
    this.teamConsecutiveLosses = { attacker: 0, defender: 0 };
  }

  getMoney() { return this.playerMoney; }

  addMoney(amount) {
    this.playerMoney = Math.min(ECONOMY.maxMoney, this.playerMoney + amount);
  }

  spendMoney(amount) {
    if (amount > this.playerMoney) return false;
    this.playerMoney -= amount;
    return true;
  }

  canAfford(amount) { return this.playerMoney >= amount; }

  onRoundEnd(playerTeam, winningTeam, events) {
    const won = playerTeam === winningTeam;

    if (won) {
      this.teamConsecutiveLosses[playerTeam] = 0;
      this.addMoney(ECONOMY.roundWin);
    } else {
      this.teamConsecutiveLosses[playerTeam]++;
      const losses = Math.min(this.teamConsecutiveLosses[playerTeam] - 1, 4);
      this.addMoney(ECONOMY.lossBonus[losses]);
    }

    // Apply kill / event rewards
    if (events) {
      if (events.kills) this.addMoney(events.kills * ECONOMY.killReward);
      if (events.planted) this.addMoney(ECONOMY.plantReward);
      if (events.defused) this.addMoney(ECONOMY.defuseReward);
    }
  }

  // Bot money logic
  getBotBuyDecision(money, roundNum, team) {
    // Simple but plausible bot buy logic
    if (money >= 4750) return 'full'; // can buy best
    if (money >= 3100) return 'full'; // rifle
    if (money >= 1700 && roundNum > 2) return 'force'; // smg
    if (money < 1700) return 'eco'; // save
    return 'half';
  }
}
