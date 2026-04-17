// HUD and UI manager
export class HUDManager {
  constructor() {
    this.hitMarkerTimeout = null;
    this.killMarkerTimeout = null;
    this.vignetteTimeout = null;
    this.killfeed = [];
    this.killfeedEl = document.getElementById('killfeed');
    this.crosshairStyle = 'default';

    this._cacheDom();
  }

  _cacheDom() {
    this.els = {
      health: document.getElementById('health-bar'),
      healthVal: document.getElementById('health-value'),
      armor: document.getElementById('armor-bar'),
      armorVal: document.getElementById('armor-value'),
      ammoClip: document.getElementById('ammo-clip'),
      ammoReserve: document.getElementById('ammo-reserve'),
      weaponName: document.getElementById('weapon-name-display'),
      money: document.getElementById('money-value'),
      buyMoney: document.getElementById('buy-money-val'),
      scoreAttacker: document.getElementById('score-attacker'),
      scoreDefender: document.getElementById('score-defender'),
      roundTimer: document.getElementById('round-timer'),
      roundPhase: document.getElementById('round-phase-label'),
      bombStatus: document.getElementById('bomb-status'),
      killFeed: document.getElementById('killfeed'),
      hitMarker: document.getElementById('hit-marker'),
      killMarker: document.getElementById('kill-marker'),
      vignette: document.getElementById('damage-vignette'),
      interactPrompt: document.getElementById('interact-prompt'),
      interactKey: document.getElementById('interact-key'),
      interactAction: document.getElementById('interact-action'),
      wslots: [
        document.getElementById('wslot-1'),
        document.getElementById('wslot-2'),
        document.getElementById('wslot-3'),
      ],
      teamateStatus: document.getElementById('teammate-status'),
      buyTimerVal: document.getElementById('buy-timer-val'),
    };
  }

  updateVitals(health, armor) {
    const h = Math.max(0, health);
    const a = Math.max(0, armor);
    this.els.health.style.width = h + '%';
    this.els.healthVal.textContent = Math.round(h);
    if (h < 30) this.els.health.style.background = '#ff2222';
    else if (h < 60) this.els.health.style.background = '#ff8800';
    else this.els.health.style.background = '#ff5e5e';
    this.els.armor.style.width = a + '%';
    this.els.armorVal.textContent = Math.round(a);
  }

  updateAmmo(clip, reserve, weaponName, isReloading, isMelee) {
    this.els.weaponName.textContent = weaponName;
    if (isMelee) {
      this.els.ammoClip.textContent = '—';
      this.els.ammoReserve.textContent = '';
    } else if (isReloading) {
      this.els.ammoClip.textContent = 'RELOADING';
      this.els.ammoClip.style.color = '#ffaa00';
      this.els.ammoReserve.textContent = '';
    } else {
      this.els.ammoClip.textContent = clip;
      this.els.ammoClip.style.color = clip <= 5 ? '#ff4444' : '#ffffff';
      this.els.ammoReserve.textContent = reserve;
    }
  }

  updateMoney(amount) {
    this.els.money.textContent = amount.toLocaleString();
    if (this.els.buyMoney) this.els.buyMoney.textContent = amount.toLocaleString();
  }

  updateScore(attackerScore, defenderScore) {
    this.els.scoreAttacker.textContent = attackerScore;
    this.els.scoreDefender.textContent = defenderScore;
  }

  updateTimer(timeStr, phase, isUrgent = false) {
    this.els.roundTimer.textContent = timeStr;
    this.els.roundPhase.textContent = phase;
    if (isUrgent) {
      this.els.roundTimer.classList.add('urgent');
    } else {
      this.els.roundTimer.classList.remove('urgent');
    }
  }

  updateWeaponSlots(weapons, activeSlot) {
    for (let i = 0; i < 3; i++) {
      const el = this.els.wslots[i];
      if (!el) continue;
      el.classList.toggle('active', i === activeSlot);
      if (weapons[i]) {
        el.textContent = weapons[i].def.name.slice(0, 6);
        el.style.opacity = '1';
      } else {
        el.textContent = i + 1;
        el.style.opacity = '0.3';
      }
    }
  }

  showBombStatus(show, text = '💣 DEVICE PLANTED') {
    const el = this.els.bombStatus;
    if (show) {
      el.classList.remove('hidden');
      el.textContent = text;
    } else {
      el.classList.add('hidden');
    }
  }

  showHitMarker(isKill = false) {
    if (isKill) {
      const el = this.els.killMarker;
      el.classList.remove('hidden');
      clearTimeout(this.killMarkerTimeout);
      this.killMarkerTimeout = setTimeout(() => el.classList.add('hidden'), 400);
    } else {
      const el = this.els.hitMarker;
      el.classList.remove('hidden');
      clearTimeout(this.hitMarkerTimeout);
      this.hitMarkerTimeout = setTimeout(() => el.classList.add('hidden'), 120);
    }
  }

  showDamageVignette() {
    const el = this.els.vignette;
    el.classList.add('active');
    clearTimeout(this.vignetteTimeout);
    this.vignetteTimeout = setTimeout(() => el.classList.remove('active'), 350);
  }

  addKillfeedEntry(killer, victim, weapon, isHeadshot, isPlayerKill) {
    const el = document.createElement('div');
    el.className = 'kill-entry' + (isPlayerKill ? ' player-kill' : '');
    el.innerHTML = `
      <span class="kf-killer">${killer}</span>
      <span class="kf-weapon">[${weapon}]</span>
      <span class="kf-victim">${victim}</span>
      ${isHeadshot ? '<span class="kf-hs">HS</span>' : ''}
    `;
    this.els.killFeed.appendChild(el);
    this.killfeed.push({ el, time: 5.0 });

    // Max 5 entries
    while (this.els.killFeed.children.length > 5) {
      this.els.killFeed.removeChild(this.els.killFeed.firstChild);
    }
  }

  showInteractPrompt(show, key = '[F]', action = 'Interact') {
    const el = this.els.interactPrompt;
    if (show) {
      el.classList.remove('hidden');
      this.els.interactKey.textContent = key;
      this.els.interactAction.textContent = action;
    } else {
      el.classList.add('hidden');
    }
  }

  updateTeammates(bots, playerTeam) {
    const teammates = bots.filter(b => b.team === playerTeam);
    const container = this.els.teamateStatus;
    if (!container) return;
    container.innerHTML = '';
    for (const bot of teammates) {
      const row = document.createElement('div');
      row.className = 'teammate-row' + (bot.alive ? '' : ' teammate-dead');
      row.innerHTML = `
        <span class="teammate-name">${bot.name.split('_')[0]}</span>
        <span class="teammate-hp">${bot.alive ? Math.round(bot.health) : '✗'}</span>
      `;
      container.appendChild(row);
    }
  }

  updateCrosshair(style, spread = 0) {
    const top    = document.getElementById('ch-top');
    const bottom = document.getElementById('ch-bottom');
    const left   = document.getElementById('ch-left');
    const right  = document.getElementById('ch-right');
    const dot    = document.getElementById('ch-dot');

    const gap = 4 + spread * 120;

    if (top)    { top.style.bottom    = gap + 'px'; top.style.display = style === 'dot' ? 'none' : ''; }
    if (bottom) { bottom.style.top    = gap + 'px'; bottom.style.display = style === 'dot' ? 'none' : ''; }
    if (left)   { left.style.right    = gap + 'px'; left.style.display = style === 'dot' ? 'none' : ''; }
    if (right)  { right.style.left    = gap + 'px'; right.style.display = style === 'dot' ? 'none' : ''; }
    if (dot)    { dot.style.display   = (style === 'cross') ? 'none' : ''; }

    // Circle style
    const container = document.getElementById('crosshair-container');
    if (container) {
      if (style === 'circle') {
        container.style.width = (gap * 2 + 4) + 'px';
        container.style.height = (gap * 2 + 4) + 'px';
        container.style.border = '1.5px solid rgba(255,255,255,0.85)';
        container.style.borderRadius = '50%';
        container.style.transform = 'translate(-50%, -50%)';
        if (top) top.style.display = 'none';
        if (bottom) bottom.style.display = 'none';
        if (left) left.style.display = 'none';
        if (right) right.style.display = 'none';
      } else {
        container.style.width = '0';
        container.style.height = '0';
        container.style.border = 'none';
        container.style.transform = '';
        if (top) top.style.display = '';
        if (bottom) bottom.style.display = '';
        if (left) left.style.display = '';
        if (right) right.style.display = '';
      }
    }
  }

  showRoundResult(title, reason, color) {
    const el = document.getElementById('round-result');
    const titleEl = document.getElementById('round-result-title');
    const reasonEl = document.getElementById('round-result-reason');
    el.classList.remove('hidden');
    titleEl.textContent = title;
    titleEl.style.color = color;
    reasonEl.textContent = reason;
    setTimeout(() => el.classList.add('hidden'), 3500);
  }

  showBuyPhaseNotice(show, timeLeft) {
    let el = document.getElementById('buy-phase-notice');
    if (!el && show) {
      el = document.createElement('div');
      el.id = 'buy-phase-notice';
      el.className = 'buy-phase-notice';
      document.getElementById('hud').appendChild(el);
    }
    if (!el) return;
    if (show) {
      el.textContent = `BUY PHASE — ${Math.ceil(timeLeft)}s REMAINING — [B] TO OPEN SHOP`;
      el.style.display = 'block';
    } else {
      el.style.display = 'none';
    }
    if (this.els.buyTimerVal) this.els.buyTimerVal.textContent = Math.ceil(timeLeft);
  }

  showPlantProgress(progress, isDefuse = false) {
    let el = document.getElementById('plant-progress-wrap');
    if (!el) {
      el = document.createElement('div');
      el.id = 'plant-progress-wrap';
      el.innerHTML = `
        <div class="progress-label" id="progress-label">PLANTING...</div>
        <div class="progress-bar-bg"><div class="progress-bar-fill" id="progress-fill"></div></div>
      `;
      document.getElementById('hud').appendChild(el);
    }
    el.style.display = 'block';
    const fill = document.getElementById('progress-fill');
    const label = document.getElementById('progress-label');
    if (fill) fill.style.width = (progress * 100) + '%';
    if (label) label.textContent = isDefuse ? 'DEFUSING...' : 'PLANTING...';
  }

  hidePlantProgress() {
    const el = document.getElementById('plant-progress-wrap');
    if (el) el.style.display = 'none';
  }
}
