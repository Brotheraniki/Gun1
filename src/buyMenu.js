// Buy menu
import { WEAPONS, BUY_CATEGORIES, GEAR_ITEMS, WeaponState } from './weapons.js';

export class BuyMenu {
  constructor(player, economy, audio) {
    this.player = player;
    this.economy = economy;
    this.audio = audio;
    this.isOpen = false;
    this.currentCategory = 'rifles';

    this._buildUI();
    this._bindEvents();
  }

  _buildUI() {
    const catBtns = document.querySelectorAll('.buy-cat');
    catBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        catBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentCategory = btn.dataset.cat;
        this._renderItems();
      });
    });

    document.getElementById('btn-buy-close')?.addEventListener('click', () => this.close());
  }

  _bindEvents() {}

  open() {
    if (this.isOpen) return;
    this.isOpen = true;
    document.getElementById('buy-menu').classList.remove('hidden');
    this._renderItems();
    this._renderLoadout();
    this.audio?.playMenuClick();
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    document.getElementById('buy-menu').classList.add('hidden');
    this.audio?.playMenuClick();
  }

  toggle() {
    this.isOpen ? this.close() : this.open();
  }

  _renderItems() {
    const grid = document.getElementById('buy-items-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const money = this.economy.getMoney();
    const items = BUY_CATEGORIES[this.currentCategory] || [];

    for (const itemId of items) {
      const def = WEAPONS[itemId] || GEAR_ITEMS[itemId];
      if (!def) continue;

      const el = document.createElement('div');
      const owned = this._isOwned(def);
      const affordable = money >= def.price;

      el.className = 'buy-item ' + (owned ? 'owned' : affordable ? 'affordable' : 'unaffordable');
      el.innerHTML = `
        <div class="buy-item-name">${def.name || def.id.toUpperCase()}</div>
        <div class="buy-item-stats">${this._getStatString(def)}</div>
        <div class="buy-item-price">$${def.price.toLocaleString()} ${owned ? '(OWNED)' : ''}</div>
      `;

      if (affordable && !owned) {
        el.addEventListener('click', () => {
          this._buyItem(def);
        });
      }

      grid.appendChild(el);
    }
  }

  _getStatString(def) {
    if (!def.damage) return def.desc || '';
    return `DMG:${def.damage} | MAG:${def.magSize} | ROF:${(def.fireRate||0).toFixed(0)}/s`;
  }

  _isOwned(def) {
    if (def.id === 'armor') return this.player.armor >= 90;
    if (def.id === 'defuse_kit') return this.player.hasDefuseKit;
    for (const w of this.player.weapons) {
      if (w && w.def.id === def.id) return true;
    }
    return false;
  }

  _buyItem(def) {
    const money = this.economy.getMoney();
    if (money < def.price) return;

    if (def.id === 'armor') {
      this.economy.spendMoney(def.price);
      this.player.armor = 100;
      this.audio?.playMenuClick();
    } else if (def.id === 'defuse_kit') {
      if (this.player.team !== 'defender') return; // only defenders
      this.economy.spendMoney(def.price);
      this.player.hasDefuseKit = true;
      this.audio?.playMenuClick();
    } else {
      // Weapon
      const weapon = WEAPONS[def.id];
      if (!weapon) return;
      this.economy.spendMoney(weapon.price);
      this.player.weapons[weapon.slot - 1] = new WeaponState(weapon);
      this.player.activeSlot = weapon.slot - 1;
      this.audio?.playMenuClick();
    }

    document.getElementById('buy-money-val').textContent = this.economy.getMoney().toLocaleString();
    this._renderItems();
    this._renderLoadout();
  }

  _renderLoadout() {
    const container = document.getElementById('loadout-display');
    if (!container) return;
    container.innerHTML = '';

    for (const w of this.player.weapons) {
      if (!w) continue;
      const el = document.createElement('div');
      el.className = 'loadout-item';
      el.textContent = w.def.name;
      container.appendChild(el);
    }
    if (this.player.armor > 0) {
      const el = document.createElement('div');
      el.className = 'loadout-item';
      el.textContent = `KEVLAR ${Math.round(this.player.armor)}`;
      container.appendChild(el);
    }
    if (this.player.hasDefuseKit) {
      const el = document.createElement('div');
      el.className = 'loadout-item';
      el.textContent = 'DEFUSE KIT';
      container.appendChild(el);
    }
    if (this.player.hasBomb) {
      const el = document.createElement('div');
      el.className = 'loadout-item';
      el.style.color = '#ff5e3a';
      el.textContent = '💣 DEVICE';
      container.appendChild(el);
    }
  }
}
