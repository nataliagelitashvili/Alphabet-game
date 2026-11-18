/* Audio Manager: plays recorded Georgian letter audio from assets/audio/ when available,
 * plus crisp Web Audio API sound effects. Never uses synthetic Georgian TTS.
 */
LL.audio = {
  ctx: null,
  activeVoice: null,
  musicTimer: null,
  settings: { sfx: true, music: false, volume: 0.8 },

  init() {
    try {
      const saved = JSON.parse(localStorage.getItem('ll_settings') || 'null');
      if (saved) Object.assign(this.settings, saved);
    } catch (_) {}
  },

  saveSettings(patch) {
    Object.assign(this.settings, patch);
    localStorage.setItem('ll_settings', JSON.stringify(this.settings));
    if (!this.settings.music) this.stopMusic();
    if (LL.progress && LL.progress.saveSettings) {
      LL.progress.saveSettings(this.settings);
    }
  },

  ensureCtx() {
    if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  },

  tone(freq, dur = 0.12, type = 'triangle', gain = 0.14, delay = 0) {
    if (!this.settings.sfx) return;
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(gain * this.settings.volume, now + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  },

  play(name) {
    if (!this.settings.sfx) return;
    switch (name) {
      case 'click':
        this.tone(520, 0.07, 'square', 0.08);
        break;
      case 'jump':
        this.tone(280, 0.09, 'triangle', 0.12, 0);
        this.tone(420, 0.11, 'triangle', 0.12, 0.05);
        break;
      case 'collect':
        this.tone(587.33, 0.1, 'triangle', 0.14, 0);
        this.tone(880, 0.18, 'triangle', 0.14, 0.08);
        break;
      case 'wrong':
        this.tone(220, 0.14, 'sawtooth', 0.1, 0);
        this.tone(175, 0.18, 'sawtooth', 0.1, 0.1);
        break;
      case 'book':
        this.tone(392, 0.08, 'sine', 0.1, 0);
        this.tone(523.25, 0.12, 'sine', 0.1, 0.06);
        break;
      case 'win':
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
          this.tone(f, 0.22, 'triangle', 0.15, i * 0.11);
        });
        break;
      case 'grand_finale':
        [523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98].forEach((f, i) => {
          this.tone(f, 0.35, 'triangle', 0.16, i * 0.13);
        });
        break;
    }
  },

  /* Plays recorded Georgian audio file if supplied in assets/audio/letters/XX.mp3 */
  playLetter(letterObj, onFallbackNotice) {
    this.play('collect');
    if (!letterObj || !letterObj.audio) {
      if (onFallbackNotice) onFallbackNotice();
      return;
    }
    try {
      if (this.activeVoice) {
        this.activeVoice.pause();
        this.activeVoice = null;
      }
      const audio = new Audio(letterObj.audio);
      audio.volume = this.settings.volume;
      this.activeVoice = audio;
      audio.play().catch(() => {
        if (onFallbackNotice) onFallbackNotice();
      });
    } catch (_) {
      if (onFallbackNotice) onFallbackNotice();
    }
  },

  startMusic() {
    if (!this.settings.music || this.musicTimer) return;
    const notes = [293.66, 349.23, 440.0, 392.0, 349.23, 329.63, 293.66, 261.63];
    let step = 0;
    this.musicTimer = setInterval(() => {
      if (!this.settings.music) return;
      const ctx = this.ensureCtx();
      if (!ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(notes[step % notes.length], now);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.035 * this.settings.volume, now + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.45);
      step++;
    }, 520);
  },

  stopMusic() {
    if (this.musicTimer) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }
};
LL.audio.init();