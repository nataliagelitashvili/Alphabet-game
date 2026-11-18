/* Audio Manager:
 * - Plays real MP3 music tracks per screen/region (main, library, map, level, forest, mountain, boss, ending)
 * - Plays real MP3 SFX (button, collect, correct, wrong, book_open, level_unlock, level_complete) with Web Audio fallback
 * - Plays all 33 Georgian letter recordings (assets/audio/letters/01.mp3..33.mp3)
 * - Respects mobile browser autoplay rules (unlocks on first user gesture, never blasts loud audio)
 */
LL.audio = {
  ctx: null,
  bgmEl: null,
  currentTrack: null,
  desiredTrack: null,
  activeVoice: null,
  unlocked: false,
  settings: { sfx: true, music: true, muted: false, volume: 0.65 },

  init() {
    try {
      const saved = JSON.parse(localStorage.getItem('ll_settings') || 'null');
      if (saved) Object.assign(this.settings, saved);
    } catch (_) {}

    const unlock = () => {
      this.unlocked = true;
      this.ensureCtx();
      if (this.desiredTrack && !this.bgmEl) {
        this.playMusic(this.desiredTrack);
      }
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock, { passive: true });
  },

  saveSettings(patch) {
    Object.assign(this.settings, patch);
    localStorage.setItem('ll_settings', JSON.stringify(this.settings));
    if (this.bgmEl) {
      if (this.settings.muted || !this.settings.music) {
        this.bgmEl.pause();
      } else {
        this.bgmEl.volume = Math.max(0, Math.min(1, this.settings.volume * 0.45));
        this.bgmEl.play().catch(() => {});
      }
    } else if (!this.settings.muted && this.settings.music && this.desiredTrack && this.unlocked) {
      this.playMusic(this.desiredTrack);
    }
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

  /* Switches background music smoothly between homepage, intro, map, regions, boss, and ending */
  playMusic(trackKey) {
    this.desiredTrack = trackKey;
    if (this.settings.muted || !this.settings.music) return;
    if (!this.unlocked) return; // Wait for first tap/click on mobile browsers
    if (this.currentTrack === trackKey && this.bgmEl && !this.bgmEl.paused) return;

    const rel = LL.assets?.manifest?.audio?.music?.[trackKey];
    if (!rel) return;

    if (this.bgmEl) {
      this.bgmEl.pause();
      this.bgmEl = null;
    }

    const audio = new Audio(LL.assets.url(rel));
    audio.loop = true;
    audio.preload = 'metadata';
    audio.volume = Math.max(0, Math.min(1, this.settings.volume * 0.45));
    this.currentTrack = trackKey;
    this.bgmEl = audio;
    audio.play().catch(() => {
      // Missing MP3 file or blocked by browser: fail silently without breaking gameplay
      this.bgmEl = null;
    });
  },

  musicForLevel(levelNum) {
    if (levelNum === 3) return 'forest'; // Borjomi
    if (levelNum === 7 || levelNum === 8) return 'mountain'; // Tusheti & Svaneti
    if (levelNum === 11) return 'boss'; // Final fortress
    return 'level';
  },

  tone(freq, dur = 0.12, type = 'triangle', gain = 0.12, delay = 0) {
    if (this.settings.muted || !this.settings.sfx) return;
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

  playFallbackTone(name) {
    switch (name) {
      case 'click': this.tone(520, 0.06, 'square', 0.07); break;
      case 'jump': this.tone(280, 0.08, 'triangle', 0.1, 0); this.tone(420, 0.1, 'triangle', 0.1, 0.05); break;
      case 'collect':
      case 'correct': this.tone(587.33, 0.09, 'triangle', 0.12, 0); this.tone(880, 0.16, 'triangle', 0.12, 0.07); break;
      case 'wrong': this.tone(220, 0.12, 'sawtooth', 0.09, 0); this.tone(180, 0.16, 'sawtooth', 0.09, 0.09); break;
      case 'book': this.tone(392, 0.08, 'sine', 0.09, 0); this.tone(523.25, 0.11, 'sine', 0.09, 0.06); break;
      case 'unlock':
      case 'win':
      case 'grand_finale':
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.tone(f, 0.2, 'triangle', 0.13, i * 0.1));
        break;
    }
  },

  play(name) {
    if (this.settings.muted || !this.settings.sfx) return;
    const rel = LL.assets?.manifest?.audio?.sfx?.[name];
    if (rel) {
      try {
        const sfx = new Audio(LL.assets.url(rel));
        sfx.volume = this.settings.volume;
        sfx.play().catch(() => this.playFallbackTone(name));
        return;
      } catch (_) {}
    }
    this.playFallbackTone(name);
  },

  playLetter(letterObj, onFallbackNotice) {
    if (!letterObj || !letterObj.id) {
      this.play('collect');
      if (onFallbackNotice) onFallbackNotice();
      return;
    }
    const src = `assets/audio/letters/${letterObj.id}.wav`;
    try {
      if (this.activeVoice) {
        this.activeVoice.pause();
        this.activeVoice = null;
      }
      const audio = new Audio(src);
      audio.volume = this.settings.muted ? 0 : this.settings.volume;
      this.activeVoice = audio;
      audio.play().catch(() => {
        this.play('collect');
        if (onFallbackNotice) onFallbackNotice();
      });
    } catch (_) {
      this.play('collect');
      if (onFallbackNotice) onFallbackNotice();
    }
  }
};
LL.audio.init();