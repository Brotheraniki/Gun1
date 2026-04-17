// Audio system - generates all sounds procedurally using Web Audio API
export class AudioSystem {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.volume = 0.7;
    this.initialized = false;
  }

  init() {
    if (this.initialized) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.volume;
      this.masterGain.connect(this.ctx.destination);
      this.initialized = true;
    } catch (e) {
      console.warn('Audio not available:', e);
    }
  }

  setVolume(v) {
    this.volume = v;
    if (this.masterGain) this.masterGain.gain.value = v;
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  _noise(duration = 0.1, freq = 200, type = 'sawtooth', envDecay = 0.1, gain = 0.3) {
    if (!this.initialized) return;
    try {
      const osc = this.ctx.createOscillator();
      const env = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();
      osc.type = type;
      osc.frequency.value = freq;
      env.gain.value = gain;
      env.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + envDecay);
      filter.type = 'lowpass';
      filter.frequency.value = freq * 3;
      osc.connect(filter);
      filter.connect(env);
      env.connect(this.masterGain);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch(e) {}
  }

  _buffer(fn) {
    if (!this.initialized) return;
    try {
      const rate = this.ctx.sampleRate;
      const dur = 0.15;
      const buf = this.ctx.createBuffer(1, Math.floor(rate * dur), rate);
      const data = buf.getChannelData(0);
      fn(data, rate);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.connect(this.masterGain);
      src.start();
    } catch(e) {}
  }

  playShot_rifle() {
    if (!this.initialized) return;
    // Sharp crack with low rumble
    try {
      const now = this.ctx.currentTime;
      // High crack
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const noise = this.ctx.createOscillator();
      const env1 = this.ctx.createGain();
      const env2 = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc1.type = 'sawtooth'; osc1.frequency.value = 180;
      osc2.type = 'square'; osc2.frequency.value = 90;
      noise.type = 'sawtooth'; noise.frequency.value = 800;

      env1.gain.setValueAtTime(0.5, now);
      env1.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      env2.gain.setValueAtTime(0.3, now);
      env2.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      filter.type = 'lowpass'; filter.frequency.value = 2000;

      osc1.connect(env1); osc2.connect(env2);
      noise.connect(filter); filter.connect(env1);
      env1.connect(this.masterGain); env2.connect(this.masterGain);

      osc1.start(now); osc1.stop(now + 0.15);
      osc2.start(now); osc2.stop(now + 0.3);
      noise.start(now); noise.stop(now + 0.08);
    } catch(e) {}
  }

  playShot_pistol() {
    if (!this.initialized) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const env = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();
      osc.type = 'sawtooth'; osc.frequency.value = 240;
      env.gain.setValueAtTime(0.4, now);
      env.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      filter.type = 'lowpass'; filter.frequency.value = 3000;
      osc.connect(filter); filter.connect(env); env.connect(this.masterGain);
      osc.start(now); osc.stop(now + 0.12);
    } catch(e) {}
  }

  playShot_smg() {
    if (!this.initialized) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const env = this.ctx.createGain();
      osc.type = 'sawtooth'; osc.frequency.value = 200;
      env.gain.setValueAtTime(0.35, now);
      env.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.connect(env); env.connect(this.masterGain);
      osc.start(now); osc.stop(now + 0.09);
    } catch(e) {}
  }

  playShot_sniper() {
    if (!this.initialized) return;
    try {
      const now = this.ctx.currentTime;
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const env1 = this.ctx.createGain();
      const env2 = this.ctx.createGain();
      osc1.type = 'sawtooth'; osc1.frequency.value = 120;
      osc2.type = 'sine'; osc2.frequency.value = 60;
      env1.gain.setValueAtTime(0.6, now);
      env1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      env2.gain.setValueAtTime(0.4, now);
      env2.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      osc1.connect(env1); osc2.connect(env2);
      env1.connect(this.masterGain); env2.connect(this.masterGain);
      osc1.start(now); osc1.stop(now + 0.4);
      osc2.start(now); osc2.stop(now + 0.55);
    } catch(e) {}
  }

  playShot_shotgun() {
    if (!this.initialized) return;
    try {
      const now = this.ctx.currentTime;
      for (let i = 0; i < 3; i++) {
        const osc = this.ctx.createOscillator();
        const env = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.value = 150 + Math.random() * 100;
        env.gain.setValueAtTime(0.25, now + i * 0.005);
        env.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.connect(env); env.connect(this.masterGain);
        osc.start(now + i * 0.005); osc.stop(now + 0.18);
      }
    } catch(e) {}
  }

  playReload() {
    if (!this.initialized) return;
    // Click sound
    const now = this.ctx.currentTime;
    this._playClick(now, 0.2);
    this._playClick(now + 0.3, 0.15);
    this._playClick(now + 0.6, 0.2);
  }

  _playClick(when, vol) {
    try {
      const osc = this.ctx.createOscillator();
      const env = this.ctx.createGain();
      osc.type = 'square'; osc.frequency.value = 1200;
      env.gain.setValueAtTime(vol, when);
      env.gain.exponentialRampToValueAtTime(0.001, when + 0.04);
      osc.connect(env); env.connect(this.masterGain);
      osc.start(when); osc.stop(when + 0.05);
    } catch(e) {}
  }

  playFootstep(surface = 'concrete', crouched = false) {
    if (!this.initialized) return;
    try {
      const now = this.ctx.currentTime;
      const vol = crouched ? 0.04 : 0.12;
      const freq = surface === 'metal' ? 600 : surface === 'dirt' ? 120 : 300;
      const osc = this.ctx.createOscillator();
      const env = this.ctx.createGain();
      osc.type = 'sawtooth'; osc.frequency.value = freq;
      env.gain.setValueAtTime(vol, now);
      env.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.connect(env); env.connect(this.masterGain);
      osc.start(now); osc.stop(now + 0.1);
    } catch(e) {}
  }

  playHitImpact(isHead = false) {
    if (!this.initialized) return;
    try {
      const now = this.ctx.currentTime;
      const freq = isHead ? 900 : 600;
      const osc = this.ctx.createOscillator();
      const env = this.ctx.createGain();
      osc.type = 'square'; osc.frequency.value = freq;
      env.gain.setValueAtTime(0.15, now);
      env.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.connect(env); env.connect(this.masterGain);
      osc.start(now); osc.stop(now + 0.06);
    } catch(e) {}
  }

  playWallImpact() {
    if (!this.initialized) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const env = this.ctx.createGain();
      osc.type = 'sawtooth'; osc.frequency.value = 400;
      env.gain.setValueAtTime(0.08, now);
      env.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      osc.connect(env); env.connect(this.masterGain);
      osc.start(now); osc.stop(now + 0.05);
    } catch(e) {}
  }

  playBombBeep() {
    if (!this.initialized) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const env = this.ctx.createGain();
      osc.type = 'sine'; osc.frequency.value = 880;
      env.gain.setValueAtTime(0.2, now);
      env.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      osc.connect(env); env.connect(this.masterGain);
      osc.start(now); osc.stop(now + 0.12);
    } catch(e) {}
  }

  playBombPlanted() {
    if (!this.initialized) return;
    try {
      const now = this.ctx.currentTime;
      for (let i = 0; i < 3; i++) {
        const osc = this.ctx.createOscillator();
        const env = this.ctx.createGain();
        osc.type = 'sine'; osc.frequency.value = 660 + i * 220;
        env.gain.setValueAtTime(0.25, now + i * 0.1);
        env.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.15);
        osc.connect(env); env.connect(this.masterGain);
        osc.start(now + i * 0.1); osc.stop(now + i * 0.1 + 0.18);
      }
    } catch(e) {}
  }

  playBombDefused() {
    if (!this.initialized) return;
    try {
      const now = this.ctx.currentTime;
      const notes = [440, 550, 660, 880];
      notes.forEach((f, i) => {
        const osc = this.ctx.createOscillator();
        const env = this.ctx.createGain();
        osc.type = 'sine'; osc.frequency.value = f;
        env.gain.setValueAtTime(0.2, now + i * 0.08);
        env.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.2);
        osc.connect(env); env.connect(this.masterGain);
        osc.start(now + i * 0.08); osc.stop(now + i * 0.08 + 0.25);
      });
    } catch(e) {}
  }

  playExplosion() {
    if (!this.initialized) return;
    try {
      const rate = this.ctx.sampleRate;
      const dur = 1.2;
      const buf = this.ctx.createBuffer(1, Math.floor(rate * dur), rate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        const t = i / rate;
        const env = Math.exp(-t * 4) * (0.5 + 0.5 * Math.exp(-t * 2));
        data[i] = (Math.random() * 2 - 1) * env;
      }
      const src = this.ctx.createBufferSource();
      const filter = this.ctx.createBiquadFilter();
      const env = this.ctx.createGain();
      filter.type = 'lowpass'; filter.frequency.value = 400;
      env.gain.setValueAtTime(0.8, this.ctx.currentTime);
      env.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
      src.buffer = buf;
      src.connect(filter); filter.connect(env); env.connect(this.masterGain);
      src.start();
    } catch(e) {}
  }

  playRoundStart() {
    if (!this.initialized) return;
    try {
      const now = this.ctx.currentTime;
      const freqs = [330, 440, 550];
      freqs.forEach((f, i) => {
        const osc = this.ctx.createOscillator();
        const env = this.ctx.createGain();
        osc.type = 'sine'; osc.frequency.value = f;
        env.gain.setValueAtTime(0.0, now + i * 0.12);
        env.gain.linearRampToValueAtTime(0.2, now + i * 0.12 + 0.05);
        env.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.3);
        osc.connect(env); env.connect(this.masterGain);
        osc.start(now + i * 0.12); osc.stop(now + i * 0.12 + 0.35);
      });
    } catch(e) {}
  }

  playRoundWin() {
    if (!this.initialized) return;
    try {
      const now = this.ctx.currentTime;
      const notes = [440, 550, 660, 770, 880];
      notes.forEach((f, i) => {
        const osc = this.ctx.createOscillator();
        const env = this.ctx.createGain();
        osc.type = 'sine'; osc.frequency.value = f;
        env.gain.setValueAtTime(0.15, now + i * 0.07);
        env.gain.exponentialRampToValueAtTime(0.001, now + i * 0.07 + 0.4);
        osc.connect(env); env.connect(this.masterGain);
        osc.start(now + i * 0.07); osc.stop(now + i * 0.07 + 0.45);
      });
    } catch(e) {}
  }

  playRoundLose() {
    if (!this.initialized) return;
    try {
      const now = this.ctx.currentTime;
      const notes = [440, 330, 220];
      notes.forEach((f, i) => {
        const osc = this.ctx.createOscillator();
        const env = this.ctx.createGain();
        osc.type = 'sine'; osc.frequency.value = f;
        env.gain.setValueAtTime(0.15, now + i * 0.15);
        env.gain.exponentialRampToValueAtTime(0.001, now + i * 0.15 + 0.5);
        osc.connect(env); env.connect(this.masterGain);
        osc.start(now + i * 0.15); osc.stop(now + i * 0.15 + 0.55);
      });
    } catch(e) {}
  }

  playDryFire() {
    if (!this.initialized) return;
    this._playClick(this.ctx.currentTime, 0.1);
  }

  playMenuClick() {
    if (!this.initialized) return;
    this._playClick(this.ctx.currentTime, 0.12);
  }

  playKnifeSwing() {
    if (!this.initialized) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const env = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(1200, now);
      osc.frequency.exponentialRampToValueAtTime(200, now + 0.15);
      env.gain.setValueAtTime(0.15, now);
      env.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.connect(env); env.connect(this.masterGain);
      osc.start(now); osc.stop(now + 0.18);
    } catch(e) {}
  }
}
