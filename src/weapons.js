// Weapons system
export const WEAPONS = {
  knife: {
    id: 'knife', name: 'TALON', slot: 3, price: 0,
    damage: 40, headMult: 2.5, armorPen: 0.3,
    fireRate: 1.5, // shots per second (melee swings)
    spread: 0, recoilX: 0, recoilY: 0,
    magSize: 0, reserveAmmo: 0,
    reloadTime: 0, drawTime: 0.4,
    range: 2.2, isMelee: true,
    audioType: 'knife',
    desc: 'Melee — silent and lethal at close range'
  },
  pistol_std: {
    id: 'pistol_std', name: 'VIPER-P', slot: 2, price: 500,
    damage: 35, headMult: 3.0, armorPen: 0.5,
    fireRate: 4, spread: 0.02, recoilX: 0.008, recoilY: 0.018,
    magSize: 12, reserveAmmo: 36,
    reloadTime: 1.8, drawTime: 0.5,
    range: 60, isMelee: false,
    audioType: 'pistol',
    desc: 'Semi-auto pistol. Cheap, decent damage.'
  },
  pistol_heavy: {
    id: 'pistol_heavy', name: 'FULCRUM', slot: 2, price: 1200,
    damage: 55, headMult: 3.5, armorPen: 0.7,
    fireRate: 2, spread: 0.03, recoilX: 0.012, recoilY: 0.028,
    magSize: 7, reserveAmmo: 21,
    reloadTime: 2.0, drawTime: 0.6,
    range: 50, isMelee: false,
    audioType: 'pistol',
    desc: 'High-caliber pistol. Powerful but slow.'
  },
  smg: {
    id: 'smg', name: 'VECTOR-9', slot: 1, price: 1700,
    damage: 25, headMult: 2.5, armorPen: 0.4,
    fireRate: 13, spread: 0.035, recoilX: 0.006, recoilY: 0.012,
    magSize: 30, reserveAmmo: 90,
    reloadTime: 2.0, drawTime: 0.5,
    range: 45, isAuto: true, isMelee: false,
    audioType: 'smg',
    desc: 'High ROF SMG. Good close-range.'
  },
  rifle: {
    id: 'rifle', name: 'APEX-M4', slot: 1, price: 3100,
    damage: 28, headMult: 3.2, armorPen: 0.8,
    fireRate: 9, spread: 0.018, recoilX: 0.007, recoilY: 0.016,
    magSize: 30, reserveAmmo: 90,
    reloadTime: 2.4, drawTime: 0.55,
    range: 80, isAuto: true, isMelee: false,
    audioType: 'rifle',
    desc: 'Standard assault rifle. Versatile and accurate.'
  },
  rifle_heavy: {
    id: 'rifle_heavy', name: 'KRATOS', slot: 1, price: 3700,
    damage: 35, headMult: 2.8, armorPen: 0.9,
    fireRate: 7, spread: 0.022, recoilX: 0.009, recoilY: 0.02,
    magSize: 25, reserveAmmo: 75,
    reloadTime: 2.6, drawTime: 0.65,
    range: 85, isAuto: true, isMelee: false,
    audioType: 'rifle',
    desc: 'Heavy rifle. Higher damage, more recoil.'
  },
  sniper: {
    id: 'sniper', name: 'HERALD', slot: 1, price: 4750,
    damage: 115, headMult: 4.0, armorPen: 1.0,
    fireRate: 0.85, spread: 0.005, recoilX: 0.015, recoilY: 0.08,
    magSize: 5, reserveAmmo: 15,
    reloadTime: 3.0, drawTime: 0.9,
    range: 200, isMelee: false, isSniper: true,
    audioType: 'sniper',
    scopedSpread: 0.001,
    desc: 'Bolt-action sniper. One-shot body potential.'
  },
  shotgun: {
    id: 'shotgun', name: 'BREACH', slot: 1, price: 2200,
    damage: 20, headMult: 2.0, armorPen: 0.5, pellets: 8,
    fireRate: 1.3, spread: 0.1, recoilX: 0.02, recoilY: 0.04,
    magSize: 7, reserveAmmo: 21,
    reloadTime: 2.8, drawTime: 0.65,
    range: 18, isMelee: false,
    audioType: 'shotgun',
    desc: 'Pump shotgun. Devastating at close range.'
  }
};

export const BUY_CATEGORIES = {
  rifles: ['rifle', 'rifle_heavy', 'sniper'],
  pistols: ['pistol_std', 'pistol_heavy'],
  smgs: ['smg'],
  heavy: ['shotgun'],
  gear: ['armor', 'defuse_kit']
};

export const GEAR_ITEMS = {
  armor: { id: 'armor', name: 'KEVLAR', price: 1000, desc: '100 armor points' },
  defuse_kit: { id: 'defuse_kit', name: 'DEFUSE KIT', price: 400, desc: 'Halves defuse time (Defenders only)' }
};

export class WeaponState {
  constructor(weaponDef) {
    this.def = weaponDef;
    this.clip = weaponDef.magSize;
    this.reserve = weaponDef.reserveAmmo;
    this.isReloading = false;
    this.reloadTimer = 0;
    this.lastFireTime = 0;
    this.recoilAmount = 0; // accumulated recoil
    this.isScoped = false;
  }

  canFire(now) {
    if (this.isReloading) return false;
    if (this.def.isMelee) return (now - this.lastFireTime) >= (1 / this.def.fireRate);
    if (this.clip <= 0) return false;
    return (now - this.lastFireTime) >= (1 / this.def.fireRate);
  }

  fire(now) {
    this.lastFireTime = now;
    if (!this.def.isMelee) this.clip--;
    this.recoilAmount = Math.min(this.recoilAmount + 1, 8);
    return true;
  }

  startReload() {
    if (this.isReloading) return;
    if (this.reserve <= 0) return;
    if (this.clip >= this.def.magSize) return;
    this.isReloading = true;
    this.reloadTimer = this.def.reloadTime;
  }

  update(dt) {
    if (this.isReloading) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        const needed = this.def.magSize - this.clip;
        const taken = Math.min(needed, this.reserve);
        this.clip += taken;
        this.reserve -= taken;
        this.isReloading = false;
      }
    }
    // recoil recovery
    this.recoilAmount = Math.max(0, this.recoilAmount - dt * 4);
  }

  getSpread(moving, crouched, scoped) {
    let spread = this.def.spread;
    if (moving) spread *= 2.2;
    if (crouched) spread *= 0.7;
    if (scoped && this.def.isSniper) spread = this.def.scopedSpread || spread * 0.1;
    spread += this.recoilAmount * 0.003;
    return spread;
  }

  getRecoil(moving) {
    return {
      x: (Math.random() - 0.5) * this.def.recoilX * (moving ? 1.5 : 1),
      y: this.def.recoilY * (moving ? 1.5 : 1)
    };
  }
}
