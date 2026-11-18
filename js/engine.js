/* Complete 2D HTML5 Canvas Game Engine + 11 Distinct Region Minigames
 * Slices real pixel-art props & tiles from assets/minigames/{maze_tile,memory_card,puzzle_board,hidden_objects}.png
 * Enforces:
 * - Each level teaches & reinforces ONLY its 3 target letters (and previously learned letters id <= level * 3)
 * - 3 difficulty modes (Easy, Normal, Challenge), child-friendly hints, no punishing game-overs
 */
LL.engine = {
  W: 960,
  H: 540,
  canvas: null,
  ctx: null,
  raf: null,
  lastTime: 0,
  lastDt: 0.016,
  paused: false,
  overlayPaused: false,

  level: null,
  levelLetters: [],
  learnedPool: [],
  allLetters: [],
  layers: null,
  sheets: null,
  props: {}, // Cropped pixel-art prop dataURLs from the 4 minigame atlases

  mode: 'dialogue',
  dialogueQueue: [],
  dialogueIndex: 0,
  onDialogueDone: null,

  player: null,
  iakob: null,
  monster: null,
  px: 210,
  py: 465,
  vx: 0,
  vy: 0,
  onGround: true,
  cameraX: 0,
  worldWidth: 1360,
  keys: { left: false, right: false, jump: false },

  pickups: [],
  platforms: [],
  clouds: [],
  goldenParticles: [],
  leaves: [],
  snowflakes: [],
  fireflies: [],
  floatingBooks: [],
  animClock: 0,
  mistakes: 0,
  flyingLetters: [],
  skyFinaleLetters: [],

  /* Crops a normalized [x, y, w, h] sub-rectangle from a sprite atlas into a crisp dataURL */
  cropProp(img, rx, ry, rw, rh, outW = 96, outH = 96) {
    if (!img) return '';
    const sw = Math.max(1, Math.round(img.width * rw));
    const sh = Math.max(1, Math.round(img.height * rh));
    const sx = Math.round(img.width * rx);
    const sy = Math.round(img.height * ry);
    const cv = document.createElement('canvas');
    cv.width = outW;
    cv.height = outH;
    const c = cv.getContext('2d');
    c.imageSmoothingEnabled = false;
    c.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);
    return cv.toDataURL('image/png');
  },

  async loadMinigameProps() {
    if (this.props._ready) return this.props;
    const m = LL.assets.manifest.minigames || {};
    const [mazeImg, memImg, puzImg, hidImg] = await Promise.all([
      LL.assets.load(m.maze),
      LL.assets.load(m.memory),
      LL.assets.load(m.puzzle),
      LL.assets.load(m.hidden)
    ]);

    this.props = {
      _ready: true,
      // From maze_tile.png
      stoneWall: this.cropProp(mazeImg, 0.015, 0.02, 0.105, 0.18, 64, 64),
      grassTile: this.cropProp(mazeImg, 0.34, 0.02, 0.105, 0.18, 64, 64),
      woodDoor: this.cropProp(mazeImg, 0.02, 0.21, 0.13, 0.19, 80, 96),
      ironGate: this.cropProp(mazeImg, 0.17, 0.21, 0.15, 0.19, 80, 96),
      goldKey: this.cropProp(mazeImg, 0.55, 0.42, 0.17, 0.12, 96, 56),
      chestClosed: this.cropProp(mazeImg, 0.74, 0.41, 0.11, 0.15, 84, 76),
      chestOpen: this.cropProp(mazeImg, 0.86, 0.41, 0.12, 0.15, 84, 76),
      sunTile: this.cropProp(mazeImg, 0.16, 0.60, 0.11, 0.17, 72, 72),
      gemTile: this.cropProp(mazeImg, 0.28, 0.60, 0.11, 0.17, 72, 72),
      scroll: this.cropProp(mazeImg, 0.35, 0.80, 0.09, 0.18, 64, 80),
      lantern: this.cropProp(mazeImg, 0.90, 0.80, 0.08, 0.18, 64, 80),

      // From memory_card.png
      cardBack: this.cropProp(memImg, 0.025, 0.03, 0.105, 0.29, 96, 132),
      cardFront: this.cropProp(memImg, 0.145, 0.03, 0.105, 0.29, 96, 132),
      woodRune: this.cropProp(memImg, 0.50, 0.03, 0.095, 0.17, 72, 72),

      // From puzzle_board.png
      slotTile: this.cropProp(puzImg, 0.02, 0.03, 0.095, 0.18, 72, 72),
      lockClosed: this.cropProp(puzImg, 0.34, 0.56, 0.075, 0.19, 64, 80),
      lockOpen: this.cropProp(puzImg, 0.43, 0.56, 0.08, 0.19, 64, 80),
      runeBlue: this.cropProp(puzImg, 0.91, 0.57, 0.07, 0.18, 64, 80),

      // From hidden_objects.png
      qvevri: this.cropProp(hidImg, 0.02, 0.65, 0.11, 0.32, 72, 96),
      horn: this.cropProp(hidImg, 0.15, 0.65, 0.11, 0.32, 72, 96),
      book: this.cropProp(hidImg, 0.47, 0.66, 0.10, 0.30, 72, 96),
      coin: this.cropProp(hidImg, 0.69, 0.68, 0.09, 0.28, 72, 72),
      compass: this.cropProp(hidImg, 0.88, 0.66, 0.10, 0.30, 72, 88)
    };
    return this.props;
  },

  getDiffConfig() {
    const diff = LL.getDifficulty ? LL.getDifficulty() : 'normal';
    const lvlScale = Math.min(4, Math.floor((this.level.n - 1) / 3));
    if (diff === 'easy') {
      return { id: 'easy', label: 'მარტივი', rounds: 6, decoys: 2, useTimer: false, timeSec: 0, autoHint: true };
    }
    if (diff === 'challenge') {
      return { id: 'challenge', label: 'რთული', rounds: 8 + Math.min(2, lvlScale), decoys: 5, useTimer: true, timeSec: Math.max(45, 70 - lvlScale * 6), autoHint: false };
    }
    return { id: 'normal', label: 'საშუალო', rounds: 7 + Math.min(1, lvlScale), decoys: 3, useTimer: this.level.n >= 6, timeSec: Math.max(60, 88 - lvlScale * 5), autoHint: false };
  },

  async startLevel(levelNum) {
    this.stop();
    const lvl = (LL.levelsData || []).find(l => l.n === levelNum) || LL.levelsData[0];
    if (!lvl) return;

    this.level = lvl;
    if (LL.audio) LL.audio.playMusic(LL.audio.musicForLevel(lvl.n));
    this.allLetters = await LL.loadAlphabet();
    this.levelLetters = lvl.letters.map(id => this.allLetters.find(l => l.id === id)).filter(Boolean);
    this.learnedPool = this.allLetters.filter(l => l.id <= lvl.n * 3);
    this.mistakes = 0;
    this.paused = false;
    this.overlayPaused = false;
    this.flyingLetters = [];
    this.skyFinaleLetters = [];

    let host = document.getElementById('gameStageHost');
    if (!host) {
      host = document.createElement('div');
      host.id = 'gameStageHost';
      document.body.appendChild(host);
    }
    host.hidden = false;

    const cfg = this.getDiffConfig();
    host.innerHTML = `
      <div class="game-shell">
        <div class="game-hud">
          <div class="hud-left">
            <button type="button" class="btn alt" id="hudBackMap">← რუკა</button>
            <span class="hud-title">${lvl.n}. ${lvl.region} (${cfg.label})</span>
          </div>
          <div class="hud-letters" id="hudLetters"></div>
          <div class="hud-right">
            <button type="button" class="btn" id="hudChallengeBtn">🎯 დავალება</button>
            <button type="button" class="btn alt" id="hudMuteBtn">${LL.audio?.settings?.muted || !LL.audio?.settings?.sfx ? '🔇' : '🔊'}</button>
            <button type="button" class="btn alt" id="hudBookBtn">📖 წიგნი</button>
            <button type="button" class="btn alt" id="hudPauseBtn">⏸</button>
          </div>
        </div>
        <div class="canvas-frame">
          <canvas id="playCanvas" width="${this.W}" height="${this.H}"></canvas>
          <div id="minigameOverlay" class="mg-overlay" hidden></div>
          <div id="dialogueBar" class="dlg-bar" hidden>
            <b id="dlgWho"></b>
            <p id="dlgText"></p>
            <div class="dlg-btns">
              <button type="button" class="btn" id="dlgNextBtn">შემდეგი ▶</button>
            </div>
          </div>
          <div id="pauseModal" class="pause-modal" hidden>
            <div class="panel">
              <h3>თამაში დაპაუზებულია</h3>
              <label>სირთულის შეცვლა
                <select id="pauseDiffSel">
                  <option value="easy" ${cfg.id === 'easy' ? 'selected' : ''}>მარტივი</option>
                  <option value="normal" ${cfg.id === 'normal' ? 'selected' : ''}>საშუალო</option>
                  <option value="challenge" ${cfg.id === 'challenge' ? 'selected' : ''}>რთული</option>
                </select>
              </label>
              <div class="actions">
                <button type="button" class="btn" id="resumeBtn">გაგრძელება</button>
                <button type="button" class="btn alt" id="retryBtn">თავიდან დაწყება</button>
                <button type="button" class="btn alt" id="bookPauseBtn">📖 ანბანის წიგნი</button>
                <button type="button" class="btn alt" id="exitMapBtn">რუკაზე დაბრუნება</button>
              </div>
            </div>
          </div>
        </div>
        <div class="touch-controls" id="touchControls">
          <div class="touch-dpad">
            <button type="button" class="btn alt touch-btn" data-key="left" aria-label="მარცხნივ">◀</button>
            <button type="button" class="btn alt touch-btn" data-key="right" aria-label="მარჯვნივ">▶</button>
          </div>
          <div class="touch-actions">
            <button type="button" class="btn touch-btn" data-key="jump">ახტომა ▲</button>
            <button type="button" class="btn touch-btn" id="touchActionBtn">დავალება ★</button>
          </div>
        </div>
      </div>
    `;

    this.canvas = document.getElementById('playCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;

    this.bindUI();
    this.renderHudLetters([]);

    const [layers, sheets] = await Promise.all([
      LL.assets.preloadScene(lvl.id),
      LL.assets.preloadSheets(),
      this.loadMinigameProps()
    ]);
    this.layers = layers;
    this.sheets = sheets;

    this.player = LL.sprites.createActor('player', 'idle', 8);
    this.iakob = LL.sprites.createActor('iakob', 'talk', 6);
    this.monster = LL.sprites.createActor('monster', 'idle', 7);

    this.setupWorldForLevel();
    this.startDialogue(lvl.intro, () => {
      if (this.level.n === 1) this.mode = 'play';
      else this.launchLevelMinigame();
    });

    this.lastTime = performance.now();
    const tick = now => {
      const dt = Math.min(0.05, (now - this.lastTime) / 1000);
      this.lastTime = now;
      this.lastDt = dt;
      if (!this.paused && !this.overlayPaused) this.update(dt);
      this.render();
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  },

  stop() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = null;
    if (this._onKeyDown) window.removeEventListener('keydown', this._onKeyDown);
    if (this._onKeyUp) window.removeEventListener('keyup', this._onKeyUp);
  },

  pauseForOverlay() { this.overlayPaused = true; },
  resumeFromOverlay() { this.overlayPaused = false; this.lastTime = performance.now(); },

  togglePause(forceState) {
    this.paused = typeof forceState === 'boolean' ? forceState : !this.paused;
    const pm = document.getElementById('pauseModal');
    if (pm) pm.hidden = !this.paused;
    if (!this.paused) this.lastTime = performance.now();
  },

  bindUI() {
    document.getElementById('hudBackMap').onclick = () => {
      this.stop();
      document.getElementById('gameStageHost').hidden = true;
      if (LL.audio) LL.audio.playMusic('map');
      LL.map.render(document.getElementById('mapBox'));
    };
    document.getElementById('hudChallengeBtn').onclick = () => {
      document.getElementById('dialogueBar').hidden = true;
      this.launchLevelMinigame();
    };
    document.getElementById('hudMuteBtn').onclick = e => {
      const nextMuted = !LL.audio.settings.muted;
      LL.audio.saveSettings({ muted: nextMuted, sfx: !nextMuted });
      e.target.textContent = nextMuted ? '🔇' : '🔊';
    };
    document.getElementById('hudBookBtn').onclick = () => LL.alphabetBook.open();
    document.getElementById('hudPauseBtn').onclick = () => this.togglePause();
    document.getElementById('resumeBtn').onclick = () => this.togglePause(false);
    document.getElementById('retryBtn').onclick = () => this.startLevel(this.level.n);
    document.getElementById('bookPauseBtn').onclick = () => LL.alphabetBook.open();
    document.getElementById('exitMapBtn').onclick = () => document.getElementById('hudBackMap').click();
    document.getElementById('pauseDiffSel').onchange = e => {
      LL.setDifficulty(e.target.value);
      this.startLevel(this.level.n);
    };

    this._onKeyDown = e => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') this.keys.left = true;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') this.keys.right = true;
      if (e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'Space') {
        if (this.mode === 'dialogue') { e.preventDefault(); this.advanceDialogue(); }
        else this.keys.jump = true;
      }
      if (e.code === 'Escape') this.togglePause();
    };
    this._onKeyUp = e => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') this.keys.left = false;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') this.keys.right = false;
      if (e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'Space') this.keys.jump = false;
    };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);

    document.querySelectorAll('#touchControls [data-key]').forEach(btn => {
      const k = btn.dataset.key;
      const set = val => e => { e.preventDefault(); this.keys[k] = val; };
      btn.addEventListener('pointerdown', set(true));
      btn.addEventListener('pointerup', set(false));
      btn.addEventListener('pointerleave', set(false));
      btn.addEventListener('pointercancel', set(false));
    });
    document.getElementById('touchActionBtn').onclick = () => {
      if (this.mode === 'dialogue') this.advanceDialogue();
      else this.launchLevelMinigame();
    };
  },

  renderHudLetters(foundIds) {
    const box = document.getElementById('hudLetters');
    if (!box) return;
    const set = new Set(foundIds);
    box.innerHTML = this.levelLetters.map(l => {
      const got = set.has(l.id);
      return `<span class="hud-pill ${got ? 'got' : ''}">${got ? `${l.char} (${l.name})` : '?'}</span>`;
    }).join('');
  },

  startDialogue(lines, onDone) {
    this.mode = 'dialogue';
    this.dialogueQueue = lines || [];
    this.dialogueIndex = 0;
    this.onDialogueDone = onDone;
    const bar = document.getElementById('dialogueBar');
    bar.hidden = false;
    document.getElementById('dlgNextBtn').onclick = () => this.advanceDialogue();
    this.showCurrentDialogue();
  },

  showCurrentDialogue() {
    const line = this.dialogueQueue[this.dialogueIndex];
    if (!line) {
      document.getElementById('dialogueBar').hidden = true;
      if (this.onDialogueDone) this.onDialogueDone();
      return;
    }
    if (LL.audio && LL.audio.play) LL.audio.play('click');
    document.getElementById('dlgWho').textContent = line.who;
    document.getElementById('dlgText').textContent = line.text;
    if (line.who.includes('იაკობ')) this.iakob.setAnim(line.anim || 'talk');
    if (line.who.includes('ასოყლაპია')) this.monster.setAnim(line.anim || 'talk');
  },

  advanceDialogue() {
    this.dialogueIndex++;
    this.showCurrentDialogue();
  },

  setupWorldForLevel() {
    this.px = 210;
    this.py = 465;
    this.vx = 0;
    this.vy = 0;
    this.cameraX = 0;
    this.worldWidth = 1360;
    this.animClock = 0;

    const platsByLevel = {
      1: [[340, 395, 130], [540, 345, 130], [730, 395, 130]],
      2: [[330, 385, 140], [520, 325, 140], [720, 375, 140]],
      3: [[350, 405, 125], [530, 330, 135], [715, 285, 130]],
      4: [[340, 380, 150], [550, 380, 150], [750, 335, 140]],
      5: [[330, 370, 120], [510, 310, 120], [690, 365, 120]],
      6: [[340, 400, 130], [535, 355, 130], [725, 310, 130]],
      7: [[320, 390, 115], [495, 325, 115], [670, 270, 120]],
      8: [[335, 380, 120], [515, 315, 120], [695, 260, 125]],
      9: [[340, 395, 140], [540, 340, 140], [740, 395, 140]],
      10: [[325, 375, 115], [500, 310, 115], [680, 260, 120]],
      11: [[330, 385, 130], [520, 320, 130], [710, 265, 135]]
    };

    const plats = platsByLevel[this.level.n] || platsByLevel[1];
    this.platforms = plats.map(([x, y, w]) => ({ x, y, w, h: 16 }));

    this.clouds = Array.from({ length: 5 }, (_, i) => ({
      x: i * 230, y: 34 + (i % 3) * 26, speed: 10 + (i % 3) * 5, scale: 0.85 + (i % 2) * 0.35
    }));
    this.goldenParticles = Array.from({ length: 22 }, () => ({
      x: Math.random() * this.W, y: Math.random() * (this.H - 85),
      vx: -10 + Math.random() * 20, vy: -14 - Math.random() * 18, phase: Math.random() * Math.PI * 2
    }));
    this.leaves = (this.level.n === 3 || this.level.n === 6)
      ? Array.from({ length: 18 }, () => ({
          x: Math.random() * this.W, y: Math.random() * this.H,
          vy: 28 + Math.random() * 26, sway: Math.random() * Math.PI * 2,
          color: Math.random() > 0.45 ? '#e07a22' : '#4a9e38'
        }))
      : [];
    this.snowflakes = this.level.n === 8
      ? Array.from({ length: 36 }, () => ({
          x: Math.random() * this.W, y: Math.random() * this.H,
          r: 2 + Math.random() * 2.5, vy: 32 + Math.random() * 34, drift: Math.random() * Math.PI * 2
        }))
      : [];
    this.fireflies = (this.level.n === 3 || this.level.n === 7 || this.level.n === 11)
      ? Array.from({ length: 18 }, () => ({
          x: Math.random() * this.W, y: 180 + Math.random() * 270,
          vx: -18 + Math.random() * 36, vy: -12 + Math.random() * 24, phase: Math.random() * Math.PI * 2
        }))
      : [];
    this.floatingBooks = this.level.n === 4
      ? Array.from({ length: 5 }, (_, i) => ({ x: 160 + i * 175, y: 120 + (i % 2) * 55, phase: i * 1.3 }))
      : [];

    this.pickups = this.levelLetters.map((l, idx) => {
      const plat = this.platforms[idx];
      return {
        letter: l,
        x: plat ? plat.x + plat.w / 2 : 380 + idx * 180,
        y: plat ? plat.y - 36 : 380,
        collected: false,
        bob: idx * 1.4
      };
    });
  },

  collectWorldPickup(p) {
    if (p.collected) return;
    p.collected = true;
    if (LL.audio) LL.audio.play('collect');
    this.player.setAnim('celebrate');
    const gotIds = this.pickups.filter(x => x.collected).map(x => x.letter.id);
    this.renderHudLetters(gotIds);
    if (gotIds.length === 3) setTimeout(() => this.launchLevelMinigame(), 350);
  },

  update(dt) {
    this.player.update(dt);
    this.iakob.update(dt);
    this.monster.update(dt);

    if (this.mode === 'play') {
      const speed = 260;
      if (this.keys.left) { this.vx = -speed; this.player.flipX = true; }
      else if (this.keys.right) { this.vx = speed; this.player.flipX = false; }
      else this.vx = 0;

      if (this.keys.jump && this.onGround) {
        this.vy = -520;
        this.onGround = false;
        if (LL.audio) LL.audio.play('jump');
      }

      this.vy += 1280 * dt;
      this.px = Math.max(70, Math.min(this.worldWidth - 90, this.px + this.vx * dt));

      if (this.vy >= 0 && this.platforms) {
        for (const pl of this.platforms) {
          if (this.px >= pl.x - 14 && this.px <= pl.x + pl.w + 14 && this.py <= pl.y + 10 && this.py + this.vy * dt >= pl.y) {
            this.py = pl.y;
            this.vy = 0;
            this.onGround = true;
          }
        }
      }

      this.py += this.vy * dt;
      if (this.py >= 465) { this.py = 465; this.vy = 0; this.onGround = true; }

      if (!this.onGround) this.player.setAnim('run');
      else if (Math.abs(this.vx) > 5) this.player.setAnim('walk');
      else if (this.player.anim !== 'celebrate') this.player.setAnim('idle');

      const targetCam = Math.max(0, Math.min(this.worldWidth - this.W, this.px - this.W * 0.35));
      this.cameraX += (targetCam - this.cameraX) * Math.min(1, dt * 8);

      for (const p of this.pickups) {
        p.bob += dt * 3;
        if (!p.collected && Math.abs(this.px - p.x) < 58 && Math.abs((this.py - 50) - p.y) < 75) {
          this.collectWorldPickup(p);
        }
      }
      if (this.px >= 820) this.launchLevelMinigame();
    }

    if (this.mode === 'reward' || this.mode === 'finale') {
      for (const fl of this.flyingLetters) {
        fl.t = Math.min(1, fl.t + dt * 0.65);
        const ease = 1 - Math.pow(1 - fl.t, 3);
        fl.x = fl.sx + (fl.tx - fl.sx) * ease;
        fl.y = fl.sy + (fl.ty - fl.sy) * ease - Math.sin(fl.t * Math.PI) * 90;
      }
      for (const sl of this.skyFinaleLetters) {
        sl.angle += dt * 0.7;
        sl.y = Math.max(sl.targetY, sl.y - dt * 110);
      }
    }
  },

  drawEnvironmentalFX(ctx, dt) {
    this.animClock = (this.animClock || 0) + dt;
    const n = this.level.n;

    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
    for (const c of (this.clouds || [])) {
      c.x = (c.x + c.speed * dt) % (this.W + 160);
      const cx = c.x - 80, s = c.scale;
      ctx.fillRect(Math.round(cx), Math.round(c.y), Math.round(76 * s), Math.round(16 * s));
      ctx.fillRect(Math.round(cx + 14 * s), Math.round(c.y - 10 * s), Math.round(46 * s), Math.round(12 * s));
    }
    ctx.restore();

    if (n === 7 || n === 8 || n === 10) {
      const wx = Math.round(740 - this.cameraX * 0.45);
      ctx.save();
      ctx.fillStyle = 'rgba(175, 232, 255, 0.32)';
      ctx.fillRect(wx, 185, 34, 280);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
      for (let i = 0; i < 10; i++) {
        const sy = 190 + ((i * 28 + this.animClock * 130) % 270);
        ctx.fillRect(wx + (i % 3) * 10 + 3, Math.round(sy), 4, 14);
      }
      ctx.restore();
    }

    if (n === 11) {
      const pulse = 0.45 + 0.35 * Math.sin(this.animClock * 3);
      ctx.save();
      ctx.fillStyle = `rgba(255, 212, 72, ${pulse.toFixed(2)})`;
      [[420, 210], [490, 195], [560, 210], [630, 225]].forEach(([wx, wy]) => {
        ctx.fillRect(Math.round(wx - this.cameraX * 0.5), wy, 14, 22);
      });
      ctx.restore();
    }

    for (const fb of (this.floatingBooks || [])) {
      const fy = fb.y + Math.sin(this.animClock * 2.2 + fb.phase) * 10;
      ctx.save();
      ctx.fillStyle = '#7c3414';
      ctx.fillRect(Math.round(fb.x - 16), Math.round(fy), 32, 8);
      ctx.fillStyle = '#fff8e3';
      ctx.fillRect(Math.round(fb.x - 14), Math.round(fy - 4), 13, 6);
      ctx.fillRect(Math.round(fb.x + 1), Math.round(fy - 4), 13, 6);
      ctx.restore();
    }

    if (n === 6) {
      ctx.save();
      ctx.fillStyle = 'rgba(36, 138, 196, 0.45)';
      ctx.fillRect(0, 472, this.W, 68);
      ctx.fillStyle = 'rgba(205, 244, 255, 0.6)';
      for (let i = 0; i < 16; i++) {
        const rx = ((i * 68 + this.animClock * 95) % (this.W + 40)) - 20;
        ctx.fillRect(Math.round(rx), 482 + (i % 4) * 14, 28, 3);
      }
      ctx.restore();
    } else {
      ctx.fillStyle = 'rgba(20, 14, 8, 0.28)';
      ctx.fillRect(0, 466, this.W, 74);
    }

    if (n === 1) {
      ctx.save();
      ctx.fillStyle = '#4e9c38';
      const sway = Math.round(Math.sin(this.animClock * 3) * 3);
      for (let gx = 10; gx < this.W; gx += 26) {
        ctx.fillRect(gx + sway, 456, 3, 12);
        ctx.fillRect(gx + 8 - sway, 459, 3, 9);
      }
      ctx.restore();
    }

    for (const pl of (this.platforms || [])) {
      const sx = Math.round(pl.x - this.cameraX);
      ctx.fillStyle = '#3a2714';
      ctx.fillRect(sx - 2, pl.y - 2, pl.w + 4, pl.h + 4);
      ctx.fillStyle = '#d99b26';
      ctx.fillRect(sx, pl.y, pl.w, pl.h);
    }

    ctx.save();
    for (const gp of (this.goldenParticles || [])) {
      gp.x = (gp.x + gp.vx * dt + this.W) % this.W;
      gp.y = (gp.y + gp.vy * dt + (this.H - 85)) % (this.H - 85);
      const a = 0.45 + 0.4 * Math.sin(this.animClock * 3 + gp.phase);
      ctx.fillStyle = `rgba(255, 224, 102, ${a.toFixed(2)})`;
      ctx.fillRect(Math.round(gp.x), Math.round(gp.y), 3, 3);
    }
    ctx.restore();

    for (const lf of (this.leaves || [])) {
      lf.y = (lf.y + lf.vy * dt) % (this.H - 60);
      lf.x = (lf.x + Math.sin(this.animClock * 2 + lf.sway) * 22 * dt + this.W) % this.W;
      ctx.fillStyle = lf.color;
      ctx.fillRect(Math.round(lf.x), Math.round(lf.y), 6, 4);
    }

    if (this.snowflakes && this.snowflakes.length) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      for (const sf of this.snowflakes) {
        sf.y = (sf.y + sf.vy * dt) % (this.H - 50);
        sf.x = (sf.x + Math.sin(this.animClock * 1.8 + sf.drift) * 18 * dt + this.W) % this.W;
        ctx.fillRect(Math.round(sf.x), Math.round(sf.y), Math.round(sf.r), Math.round(sf.r));
      }
    }

    for (const ff of (this.fireflies || [])) {
      ff.x = (ff.x + ff.vx * dt + this.W) % this.W;
      ff.y = Math.max(150, Math.min(450, ff.y + ff.vy * dt));
      const glow = 0.35 + 0.65 * Math.max(0, Math.sin(this.animClock * 4 + ff.phase));
      ctx.fillStyle = `rgba(185, 255, 110, ${glow.toFixed(2)})`;
      ctx.fillRect(Math.round(ff.x), Math.round(ff.y), 4, 4);
    }
  },

  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.W, this.H);

    if (this.layers) {
      const order = [
        { img: this.layers.sky, factor: 0.1 },
        { img: this.layers.far, factor: 0.25 },
        { img: this.layers.mid, factor: 0.55 },
        { img: this.layers.fore, factor: 1.0 }
      ];
      for (const layer of order) {
        if (!layer.img) continue;
        const scale = this.H / layer.img.height;
        const tileW = Math.round(layer.img.width * scale);
        const scroll = ((this.cameraX * layer.factor) % tileW + tileW) % tileW;
        for (let px = -scroll; px < this.W; px += tileW) {
          ctx.drawImage(layer.img, Math.round(px), 0, tileW, this.H);
        }
      }
    }

    this.drawEnvironmentalFX(ctx, this.paused || this.overlayPaused ? 0 : this.lastDt);

    const iakobScreenX = 110 - this.cameraX;
    if (iakobScreenX > -120 && iakobScreenX < this.W + 120) {
      this.iakob.draw(ctx, this.sheets, iakobScreenX, 465, 2.2);
    }

    for (const p of this.pickups) {
      if (p.collected) continue;
      const sx = p.x - this.cameraX;
      const sy = p.y + Math.sin(p.bob) * 8;
      if (sx < -80 || sx > this.W + 80) continue;
      ctx.save();
      ctx.fillStyle = 'rgba(242, 182, 50, 0.28)';
      ctx.beginPath();
      ctx.arc(sx, sy, 32, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f2b632';
      ctx.strokeStyle = '#2a1d10';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(sx, sy, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#2a1d10';
      ctx.font = 'bold 24px "Noto Sans Georgian", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.letter.char, sx, sy + 2);
      ctx.restore();
    }

    const monsterScreenX = 850 - this.cameraX;
    if (monsterScreenX > -140 && monsterScreenX < this.W + 140) {
      this.monster.flipX = true;
      this.monster.draw(ctx, this.sheets, monsterScreenX, 465, 2.4);
    }

    const playerScreenX = this.px - this.cameraX;
    this.player.draw(ctx, this.sheets, playerScreenX, this.py, 2.2);

    for (const fl of this.flyingLetters) {
      ctx.save();
      ctx.fillStyle = '#ffd859';
      ctx.strokeStyle = '#2a1d10';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(fl.x, fl.y, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#2a1d10';
      ctx.font = 'bold 26px "Noto Sans Georgian", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(fl.char, fl.x, fl.y + 2);
      ctx.restore();
    }

    if (this.skyFinaleLetters.length) {
      ctx.save();
      ctx.fillStyle = 'rgba(10, 16, 38, 0.55)';
      ctx.fillRect(0, 0, this.W, 290);
      for (const sl of this.skyFinaleLetters) {
        const glowY = sl.y + Math.sin(sl.angle) * 6;
        ctx.fillStyle = 'rgba(242, 182, 50, 0.35)';
        ctx.beginPath();
        ctx.arc(sl.x, glowY, 20, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffe27a';
        ctx.font = 'bold 24px "Noto Sans Georgian", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(sl.char, sl.x, glowY);
      }
      ctx.restore();
    }
  },

  pickLearnedDecoys(excludeIds, count) {
    const candidates = this.learnedPool.filter(l => !excludeIds.includes(l.id));
    return candidates.sort(() => Math.random() - 0.5).slice(0, count);
  },

  /* Builds a distinct, region-specific multi-stage curriculum (6-10 stages) for each of the 11 regions */
  buildCurriculumForLevel(cfg) {
    const L = this.levelLetters;
    const n = this.level.n;

    // Each region starts with its signature pixel-art minigame, followed by tailored reinforcement stages!
    const plans = {
      1: [ // Kakheti: Qvevri Treasure Jars + Sound Recognition
        { kind: 'qvevri_jars' },
        { kind: 'recognize', target: L[0] }, { kind: 'recognize', target: L[1] }, { kind: 'recognize', target: L[2] },
        { kind: 'missing', target: L[0] }, { kind: 'build', target: L[1] }
      ],
      2: [ // Tbilisi: Carved Wooden Rune Board Word Builder
        { kind: 'wood_board', target: L[0] }, { kind: 'wood_board', target: L[1] }, { kind: 'wood_board', target: L[2] },
        { kind: 'missing', target: L[0] }, { kind: 'missing', target: L[1] }, { kind: 'recognize', target: L[2] }
      ],
      3: [ // Borjomi: Hidden Relics in the Forest (Lantern, Compass, Horn, Qvevri, Book)
        { kind: 'hidden_relics' },
        { kind: 'recognize', target: L[0] }, { kind: 'missing', target: L[1] }, { kind: 'wood_board', target: L[2] },
        { kind: 'recognize', target: L[1] }, { kind: 'missing', target: L[2] }
      ],
      4: [ // Mtskheta: Ornate Carved Wooden Card Memory Match
        { kind: 'ornate_memory' },
        { kind: 'recognize', target: L[0] }, { kind: 'recognize', target: L[1] }, { kind: 'wood_board', target: L[2] },
        { kind: 'missing', target: L[0] }, { kind: 'wood_board', target: L[1] }
      ],
      5: [ // Vardzia: Locked Doors & Golden Keys Cipher
        { kind: 'key_locks' },
        { kind: 'missing', target: L[0] }, { kind: 'missing', target: L[1] }, { kind: 'missing', target: L[2] },
        { kind: 'wood_board', target: L[0] }, { kind: 'wood_board', target: L[2] }
      ],
      6: [ // Racha: Flowing River Scrolls & Lantern Catch
        { kind: 'river_scrolls' },
        { kind: 'recognize', target: L[0] }, { kind: 'missing', target: L[1] }, { kind: 'wood_board', target: L[2] },
        { kind: 'recognize', target: L[2] }, { kind: 'wood_board', target: L[0] }
      ],
      7: [ // Tusheti: Stone-Wall & Grass Dungeon Tile Maze
        { kind: 'stone_maze' },
        { kind: 'key_locks' },
        { kind: 'recognize', target: L[0] }, { kind: 'missing', target: L[1] }, { kind: 'wood_board', target: L[2] },
        { kind: 'missing', target: L[2] }
      ],
      8: [ // Svaneti: Glowing Runestone & Sun/Gem Pressure Plates
        { kind: 'runestone_plates', target: L[0] }, { kind: 'runestone_plates', target: L[1] }, { kind: 'runestone_plates', target: L[2] },
        { kind: 'ornate_memory' },
        { kind: 'wood_board', target: L[1] }, { kind: 'missing', target: L[2] }
      ],
      9: [ // Adjara: 3-Lock Treasure Chest Forging
        { kind: 'treasure_chest' },
        { kind: 'wood_board', target: L[0] }, { kind: 'wood_board', target: L[1] }, { kind: 'wood_board', target: L[2] },
        { kind: 'missing', target: L[0] }, { kind: 'recognize', target: L[2] }
      ],
      10: [ // Javakheti: Paravani Compass & Multi-Skill Gauntlet
        { kind: 'hidden_relics' }, { kind: 'key_locks' }, { kind: 'ornate_memory' },
        { kind: 'wood_board', target: L[0] }, { kind: 'wood_board', target: L[1] }, { kind: 'wood_board', target: L[2] }
      ],
      11: [ // Final Fortress: 3 Seals of Asotsqlapia's Saddlebag
        { kind: 'treasure_chest' }, { kind: 'runestone_plates', target: L[0] }, { kind: 'runestone_plates', target: L[1] },
        { kind: 'runestone_plates', target: L[2] }, { kind: 'wood_board', target: L[1] }, { kind: 'wood_board', target: L[2] }
      ]
    };

    const list = [...(plans[n] || plans[1])];
    while (list.length < cfg.rounds) {
      const pick = L[list.length % 3];
      list.push({ kind: list.length % 2 === 0 ? 'wood_board' : 'missing', target: pick });
    }
    return list.slice(0, cfg.rounds);
  },

  launchLevelMinigame() {
    if (this.mode === 'minigame') return;
    this.mode = 'minigame';
    this.keys = { left: false, right: false, jump: false };
    const box = document.getElementById('minigameOverlay');
    box.hidden = false;

    const cfg = this.getDiffConfig();
    const stages = this.buildCurriculumForLevel(cfg);
    const P = this.props;

    let stageIdx = 0;
    let timeLeft = cfg.timeSec;
    let timerIv = null;

    if (cfg.useTimer && timeLeft > 0) {
      timerIv = setInterval(() => {
        if (this.mode !== 'minigame') { clearInterval(timerIv); return; }
        timeLeft--;
        const cEl = box.querySelector('#mgClock');
        if (cEl) cEl.textContent = `⏱ ${timeLeft} წმ`;
        if (timeLeft <= 0) {
          timeLeft = 25;
          const fb = box.querySelector('#mgFeedback');
          if (fb) fb.textContent = '🌟 არ იჩქარო! იაკობმა დამატებითი 25 წამი გაჩუქა.';
        }
      }, 1000);
    }

    const advanceStage = () => {
      stageIdx++;
      this.renderHudLetters(this.levelLetters.slice(0, Math.min(3, Math.ceil(stageIdx / 2))).map(x => x.id));
      if (stageIdx >= stages.length) {
        if (timerIv) clearInterval(timerIv);
        this.finishMinigame();
      } else {
        renderStage();
      }
    };

    const renderStage = () => {
      const st = stages[stageIdx];
      const headerHTML = `
        <div class="mg-top">
          <span>${this.level.region} · ეტაპი ${stageIdx + 1} / ${stages.length} (${cfg.label})</span>
          ${cfg.useTimer ? `<span id="mgClock">⏱ ${timeLeft} წმ</span>` : '<span>🌿 თავისუფალი დრო</span>'}
          <button type="button" class="btn alt sm" id="mgHintBtn">💡 მინიშნება</button>
        </div>
      `;

      // 1. QVEVRI JARS (Kakheti)
      if (st.kind === 'qvevri_jars') {
        const opened = new Set();
        const items = [
          { letter: this.levelLetters[0], real: true },
          { letter: this.levelLetters[1], real: true },
          { letter: this.levelLetters[2], real: true },
          ...this.pickLearnedDecoys(this.level.letters, 2).map(l => ({ letter: l, real: false }))
        ].sort(() => Math.random() - 0.5);

        const paint = () => {
          box.innerHTML = `
            <div class="panel mg-card rpg-box">
              ${headerHTML}
              <p>გახსენი ქვევრები და იპოვე კახეთის სამი ასო: <b>${this.levelLetters.map(l => `${l.char} (${l.name})`).join(', ')}</b></p>
              <div class="prop-shelf">
                ${items.map((it, i) => `
                  <button type="button" class="prop-item-btn ${opened.has(i) ? 'opened' : ''}" data-qi="${i}">
                    ${P.qvevri ? `<img src="${P.qvevri}" alt="ქვევრი" class="px-prop">` : '🏺'}
                    <span class="prop-badge">${opened.has(i) ? it.letter.char : '?'}</span>
                  </button>
                `).join('')}
              </div>
              <p class="note" id="mgHintBox"></p>
              <p class="err" id="mgFeedback"></p>
            </div>
          `;
          box.querySelector('#mgHintBtn').onclick = () => {
            box.querySelector('#mgHintBox').textContent = `💡 კახეთის ასოებია: ${this.levelLetters.map(l => `${l.char} (${l.name})`).join(', ')}`;
          };
          box.querySelectorAll('[data-qi]').forEach(b => {
            b.onclick = () => {
              const i = Number(b.dataset.qi);
              if (opened.has(i)) return;
              opened.add(i);
              const it = items[i];
              if (it.real) {
                if (LL.audio) LL.audio.play('collect');
                const foundCount = [...opened].filter(idx => items[idx].real).length;
                if (foundCount >= 3) setTimeout(advanceStage, 350);
                else paint();
              } else {
                if (LL.audio) LL.audio.play('click');
                paint();
                box.querySelector('#mgFeedback').textContent = `ამ ქვევრში „${it.letter.char}“ იყო — განაგრძე ძებნა!`;
              }
            };
          });
        };
        paint();
        return;
      }

      // 2. CARVED WOODEN RUNE BOARD (Tbilisi & Word Construction)
      if (st.kind === 'wood_board' || st.kind === 'build') {
        const t = st.target;
        const letters = t.word.split('');
        const extra = this.pickLearnedDecoys([t.id], Math.max(1, cfg.decoys - 1)).map(x => x.char);
        const bank = [...letters, ...extra].sort(() => Math.random() - 0.5);
        let current = [];

        const paintBoard = () => {
          box.innerHTML = `
            <div class="panel mg-card rpg-box">
              ${headerHTML}
              <p>მოჩუქურთმებულ დაფაზე ააწყვე სიტყვა: <b>${t.hint}</b> (${letters.length} ასო)</p>
              <div class="wood-slots-row">
                ${letters.map((_, i) => `
                  <div class="wood-slot" style="${P.slotTile ? `background-image:url('${P.slotTile}')` : ''}">
                    <span>${current[i] ? current[i].ch : ''}</span>
                  </div>
                `).join('')}
              </div>
              <div class="mg-choices">
                ${bank.map((ch, idx) => `
                  <button type="button" class="rune-tile-btn" style="${P.woodRune ? `background-image:url('${P.woodRune}')` : ''}" data-bidx="${idx}" ${current.some(c => c.idx === idx) ? 'disabled' : ''}>
                    ${ch}
                  </button>
                `).join('')}
                <button type="button" class="btn alt sm" id="mgClear">↺</button>
              </div>
              <p class="note" id="mgHintBox">${cfg.autoHint ? `💡 დამარცვლა: ${t.syllables}` : ''}</p>
              <p class="err" id="mgFeedback"></p>
            </div>
          `;
          box.querySelector('#mgHintBtn').onclick = () => {
            box.querySelector('#mgHintBox').textContent = `💡 მინიშნება: ${t.syllables} (${t.word})`;
          };
          box.querySelector('#mgClear').onclick = () => { current = []; paintBoard(); };
          box.querySelectorAll('[data-bidx]').forEach(b => {
            b.onclick = () => {
              if (LL.audio) LL.audio.play('click');
              const idx = Number(b.dataset.bidx);
              current.push({ idx, ch: bank[idx] });
              const wordNow = current.map(c => c.ch).join('');
              if (wordNow.length === letters.length) {
                if (wordNow === t.word) {
                  if (LL.audio) LL.audio.play('correct');
                  setTimeout(advanceStage, 260);
                } else {
                  this.mistakes++;
                  if (LL.audio) LL.audio.play('wrong');
                  current = [];
                  paintBoard();
                  box.querySelector('#mgFeedback').textContent = `სცადე თავიდან — დამარცვლა: ${t.syllables}`;
                }
              } else {
                paintBoard();
              }
            };
          });
        };
        paintBoard();
        return;
      }

      // 3. HIDDEN RELICS IN FOREST (Borjomi & Javakheti)
      if (st.kind === 'hidden_relics') {
        const found = new Set();
        const decoys = this.pickLearnedDecoys(this.level.letters, 2);
        const relics = [
          { left: '15%', top: '32%', img: P.lantern, letter: this.levelLetters[0], real: true },
          { left: '48%', top: '65%', img: P.compass, letter: this.levelLetters[1], real: true },
          { left: '82%', top: '34%', img: P.horn, letter: this.levelLetters[2], real: true },
          { left: '30%', top: '70%', img: P.book, letter: decoys[0] || this.levelLetters[0], real: !decoys[0] },
          { left: '68%', top: '26%', img: P.coin, letter: decoys[1] || this.levelLetters[1], real: !decoys[1] }
        ];

        const paintRelics = () => {
          box.innerHTML = `
            <div class="panel mg-card rpg-box">
              ${headerHTML}
              <p>იპოვე ნივთებში დამალული ასოები: <b>${this.levelLetters.map(l => `${l.char} (${l.name})`).join(', ')}</b></p>
              <div class="mg-forest">
                ${relics.map((r, i) => `
                  <button type="button" class="relic-spot ${found.has(i) ? 'found' : ''}" style="left:${r.left};top:${r.top}" data-ri="${i}">
                    ${r.img ? `<img src="${r.img}" alt="ნივთი" class="px-prop sm">` : '✨'}
                    <span class="prop-badge">${found.has(i) ? r.letter.char : r.letter.char}</span>
                  </button>
                `).join('')}
              </div>
              <p class="note" id="mgHintBox"></p>
              <p class="err" id="mgFeedback"></p>
            </div>
          `;
          box.querySelector('#mgHintBtn').onclick = () => {
            box.querySelector('#mgHintBox').textContent = `💡 აირჩიე ნივთები ასოებით: ${this.levelLetters.map(l => l.char).join(', ')}`;
          };
          box.querySelectorAll('[data-ri]').forEach(btn => {
            btn.onclick = () => {
              const i = Number(btn.dataset.ri);
              const r = relics[i];
              if (found.has(i)) return;
              if (!r.real) {
                this.mistakes++;
                if (LL.audio) LL.audio.play('wrong');
                box.querySelector('#mgFeedback').textContent = `„${r.letter.char}“ წინა კუთხის ასოა! ახლა ვეძებთ: ${this.levelLetters.map(l => l.char).join(', ')}`;
                return;
              }
              found.add(i);
              if (LL.audio) LL.audio.play('collect');
              if (found.size >= 3) setTimeout(advanceStage, 300);
              else paintRelics();
            };
          });
        };
        paintRelics();
        return;
      }

      // 4. ORNATE WOODEN MEMORY CARDS (Mtskheta)
      if (st.kind === 'ornate_memory') {
        const cards = [];
        this.levelLetters.forEach(l => {
          cards.push({ pair: l.id, text: l.char, isBig: true });
          cards.push({ pair: l.id, text: l.name, isBig: false });
        });
        cards.sort(() => Math.random() - 0.5);
        const matched = new Set();
        let flipped = [];

        const paintCards = () => {
          box.innerHTML = `
            <div class="panel mg-card rpg-box">
              ${headerHTML}
              <p>გადააბრუნე ხის ბანქოები და დააწყვილე ასო მის სახელთან (${matched.size}/3):</p>
              <div class="ornate-cards-grid">
                ${cards.map((c, idx) => {
                  const open = matched.has(c.pair) || flipped.includes(idx);
                  const bg = open ? P.cardFront : P.cardBack;
                  return `<button type="button" class="ornate-card ${open ? 'open' : ''}" style="${bg ? `background-image:url('${bg}')` : ''}" data-cidx="${idx}">
                    <span>${open ? c.text : ''}</span>
                  </button>`;
                }).join('')}
              </div>
              <p class="note" id="mgHintBox"></p>
            </div>
          `;
          box.querySelector('#mgHintBtn').onclick = () => {
            box.querySelector('#mgHintBox').textContent = `💡 ${this.levelLetters.map(l => `${l.char} = ${l.name}`).join(' · ')}`;
          };
          box.querySelectorAll('[data-cidx]').forEach(btn => {
            btn.onclick = () => {
              const idx = Number(btn.dataset.cidx);
              if (flipped.length >= 2 || flipped.includes(idx) || matched.has(cards[idx].pair)) return;
              if (LL.audio) LL.audio.play('click');
              flipped.push(idx);
              paintCards();
              if (flipped.length === 2) {
                const [a, b] = flipped;
                if (cards[a].pair === cards[b].pair) {
                  if (LL.audio) LL.audio.play('collect');
                  matched.add(cards[a].pair);
                  flipped = [];
                  if (matched.size === 3) setTimeout(advanceStage, 300);
                  else paintCards();
                } else {
                  setTimeout(() => { flipped = []; paintCards(); }, 550);
                }
              }
            };
          });
        };
        paintCards();
        return;
      }

      // 5. LOCKED GATES & ORNATE KEYS (Vardzia)
      if (st.kind === 'key_locks') {
        let lockIdx = 0;
        const paintLocks = () => {
          if (lockIdx >= 3) return advanceStage();
          const target = this.levelLetters[lockIdx];
          const decoys = this.pickLearnedDecoys([target.id], Math.min(3, cfg.decoys));
          const keys = [target, ...decoys].sort(() => Math.random() - 0.5);

          box.innerHTML = `
            <div class="panel mg-card rpg-box">
              ${headerHTML}
              <p>გახსენი კლდის კარიბჭე (${lockIdx + 1}/3): რომელი გასაღები ავსებს სიტყვას <b>„_${target.word.slice(1)}“</b>?</p>
              <div class="locks-row">
                ${this.levelLetters.map((l, i) => `
                  <div class="lock-box">
                    <img src="${i < lockIdx ? P.lockOpen : P.lockClosed}" alt="ბოქლომი" class="px-prop">
                    <span>${i < lockIdx ? l.word : `_${l.word.slice(1)}`}</span>
                  </div>
                `).join('')}
              </div>
              <div class="keys-row">
                ${keys.map(k => `
                  <button type="button" class="key-btn" data-kid="${k.id}">
                    ${P.goldKey ? `<img src="${P.goldKey}" alt="გასაღები" class="px-prop wide">` : '🗝️'}
                    <b>${k.char}</b>
                  </button>
                `).join('')}
              </div>
              <p class="note" id="mgHintBox">${cfg.autoHint ? `💡 გასაღები: „${target.name}“` : ''}</p>
              <p class="err" id="mgFeedback"></p>
            </div>
          `;
          box.querySelector('#mgHintBtn').onclick = () => {
            box.querySelector('#mgHintBox').textContent = `💡 მინიშნება: სიტყვაა „${target.word}“ — აირჩიე გასაღები „${target.char}“ (${target.name})`;
          };
          box.querySelectorAll('[data-kid]').forEach(btn => {
            btn.onclick = () => {
              if (Number(btn.dataset.kid) === target.id) {
                if (LL.audio) LL.audio.play('unlock');
                lockIdx++;
                paintLocks();
              } else {
                this.mistakes++;
                if (LL.audio) LL.audio.play('wrong');
                box.querySelector('#mgFeedback').textContent = 'ეს გასაღები ამ ბოქლომს არ ერგება — სცადე სხვა!';
              }
            };
          });
        };
        paintLocks();
        return;
      }

      // 6. STONE-TILE DUNGEON MAZE (Tusheti)
      if (st.kind === 'stone_maze') {
        const grid = [
          [0, 0, 1, 2, 0, 0, 3],
          [1, 0, 1, 1, 1, 0, 1],
          [0, 0, 0, 0, 0, 0, 0],
          [0, 1, 1, 0, 1, 1, 0],
          [0, 0, 0, 0, 1, 4, 0]
        ];
        let r = 0, c = 0;
        const collected = new Set();

        const paintMaze = () => {
          box.innerHTML = `
            <div class="panel mg-card rpg-box">
              ${headerHTML}
              <p>გაიარე ქვის კოშკების ლაბირინთი და შეაგროვე სამივე გრაგნილი (${collected.size}/3):</p>
              <div class="maze-grid">
                ${grid.map((row, ri) => row.map((cell, ci) => {
                  const isPlayer = ri === r && ci === c;
                  const letterObj = cell >= 2 ? this.levelLetters[cell - 2] : null;
                  const got = letterObj && collected.has(letterObj.id);
                  const tileBg = cell === 1 ? P.stoneWall : P.grassTile;
                  return `<div class="maze-cell" style="${tileBg ? `background-image:url('${tileBg}');background-size:cover;` : ''}">
                    ${isPlayer ? '🧭' : (letterObj && !got ? `<span class="maze-letter">${letterObj.char}</span>` : '')}
                  </div>`;
                }).join('')).join('')}
              </div>
              <div class="maze-pad">
                <button type="button" class="btn alt sm" data-mv="-1,0">▲</button>
                <div>
                  <button type="button" class="btn alt sm" data-mv="0,-1">◀</button>
                  <button type="button" class="btn alt sm" data-mv="1,0">▼</button>
                  <button type="button" class="btn alt sm" data-mv="0,1">▶</button>
                </div>
              </div>
              <p class="note" id="mgHintBox"></p>
            </div>
          `;
          box.querySelector('#mgHintBtn').onclick = () => {
            box.querySelector('#mgHintBox').textContent = '💡 გამოიყენე ისრები ბალახის ბილიკზე გადასაადგილებლად.';
          };
          box.querySelectorAll('[data-mv]').forEach(b => {
            b.onclick = () => {
              const [dr, dc] = b.dataset.mv.split(',').map(Number);
              const nr = r + dr, nc = c + dc;
              if (nr < 0 || nr >= grid.length || nc < 0 || nc >= grid[0].length || grid[nr][nc] === 1) return;
              if (LL.audio) LL.audio.play('click');
              r = nr; c = nc;
              const val = grid[r][c];
              if (val >= 2) {
                const lObj = this.levelLetters[val - 2];
                if (!collected.has(lObj.id)) {
                  collected.add(lObj.id);
                  if (LL.audio) LL.audio.play('collect');
                }
              }
              if (collected.size === 3) setTimeout(advanceStage, 260);
              else paintMaze();
            };
          });
        };
        paintMaze();
        return;
      }

      // 7. RUNESTONE & PRESSURE PLATES (Svaneti & Final Boss)
      if (st.kind === 'runestone_plates') {
        const t = st.target;
        const decoys = this.pickLearnedDecoys([t.id], cfg.decoys);
        const opts = [t, ...decoys].sort(() => Math.random() - 0.5);

        box.innerHTML = `
          <div class="panel mg-card rpg-box">
            ${headerHTML}
            <p>გაააქტიურე სწორი ქვის რუნა ასოსთვის: <b>„${t.name}“</b> (${t.pronunciation})</p>
            <div class="mg-choices">
              ${opts.map((o, i) => {
                const plate = i % 2 === 0 ? P.sunTile : P.gemTile;
                return `<button type="button" class="plate-btn" style="${plate ? `background-image:url('${plate}')` : ''}" data-oid="${o.id}">
                  <span>${o.char}</span>
                </button>`;
              }).join('')}
            </div>
            <p class="note" id="mgHintBox">${cfg.autoHint ? `💡 სიტყვა: ${t.word}` : ''}</p>
            <p class="err" id="mgFeedback"></p>
          </div>
        `;
        box.querySelector('#mgHintBtn').onclick = () => {
          box.querySelector('#mgHintBox').textContent = `💡 „${t.name}“ იწყებს სიტყვას „${t.word}“ — აირჩიე „${t.char}“`;
        };
        box.querySelectorAll('[data-oid]').forEach(btn => {
          btn.onclick = () => {
            if (Number(btn.dataset.oid) === t.id) {
              if (LL.audio) LL.audio.play('correct');
              advanceStage();
            } else {
              this.mistakes++;
              if (LL.audio) LL.audio.play('wrong');
              box.querySelector('#mgFeedback').textContent = 'ეს რუნა სხვა ბგერას ეკუთვნის — სცადე კიდევ ერთხელ!';
            }
          };
        });
        return;
      }

      // 8. TREASURE CHEST 3-LOCK FORGING (Adjara & Final Fortress)
      if (st.kind === 'treasure_chest') {
        let step = 0;
        const paintChest = () => {
          if (step >= 3) return advanceStage();
          const t = this.levelLetters[step];
          const decoys = this.pickLearnedDecoys([t.id], cfg.decoys);
          const opts = [t, ...decoys].sort(() => Math.random() - 0.5);

          box.innerHTML = `
            <div class="panel mg-card rpg-box">
              ${headerHTML}
              <div class="chest-showcase">
                <img src="${step === 2 ? P.chestOpen : P.chestClosed}" alt="სკივრი" class="px-prop lg">
                <p>სკივრის საკეტი ${step + 1}/3: რომელი ასო აკლია სიტყვას <b>„_${t.word.slice(1)}“</b> (${t.hint})?</p>
              </div>
              <div class="mg-choices">
                ${opts.map(o => `<button type="button" class="btn big" data-oid="${o.id}">${o.char}</button>`).join('')}
              </div>
              <p class="note" id="mgHintBox">${cfg.autoHint ? `💡 ასო: ${t.name}` : ''}</p>
              <p class="err" id="mgFeedback"></p>
            </div>
          `;
          box.querySelector('#mgHintBtn').onclick = () => {
            box.querySelector('#mgHintBox').textContent = `💡 სრული სიტყვაა „${t.word}“ (${t.syllables})`;
          };
          box.querySelectorAll('[data-oid]').forEach(btn => {
            btn.onclick = () => {
              if (Number(btn.dataset.oid) === t.id) {
                if (LL.audio) LL.audio.play('unlock');
                step++;
                paintChest();
              } else {
                this.mistakes++;
                if (LL.audio) LL.audio.play('wrong');
                box.querySelector('#mgFeedback').textContent = 'საკეტი არ გაიხსნა — სცადე სხვა ასო!';
              }
            };
          });
        };
        paintChest();
        return;
      }

      // 9. FALLING RIVER SCROLLS (Racha)
      if (st.kind === 'river_scrolls') {
        let caughtCount = 0;
        const needed = 6;
        const pool = [...this.levelLetters, ...this.pickLearnedDecoys(this.level.letters, 4)];

        box.innerHTML = `
          <div class="panel mg-card rpg-box">
            ${headerHTML}
            <p>დაიჭირე მდინარეზე მოცურავე გრაგნილები: <b>${this.levelLetters.map(t => `${t.char} (${t.name})`).join(', ')}</b> (<span id="catchCnt">0</span>/${needed})</p>
            <div class="mg-sky-catch" id="catchZone"></div>
            <p class="note" id="mgHintBox"></p>
            <p class="err" id="mgFeedback"></p>
          </div>
        `;
        box.querySelector('#mgHintBtn').onclick = () => {
          box.querySelector('#mgHintBox').textContent = `💡 დააკლიკე ასოებს: ${this.levelLetters.map(l => l.char).join(', ')}`;
        };
        const zone = box.querySelector('#catchZone');
        const spawner = setInterval(() => {
          if (caughtCount >= needed || this.mode !== 'minigame') {
            clearInterval(spawner);
            return;
          }
          const item = pool[Math.floor(Math.random() * pool.length)];
          const drop = document.createElement('button');
          drop.type = 'button';
          drop.className = 'scroll-drop-btn';
          drop.innerHTML = `${P.scroll ? `<img src="${P.scroll}" alt="გრაგნილი" class="px-prop sm">` : ''}<span>${item.char}</span>`;
          drop.style.left = (10 + Math.random() * 78) + '%';
          drop.onclick = () => {
            if (this.levelLetters.some(t => t.id === item.id)) {
              caughtCount++;
              if (LL.audio) LL.audio.play('collect');
              drop.remove();
              const cEl = box.querySelector('#catchCnt');
              if (cEl) cEl.textContent = caughtCount;
              if (caughtCount >= needed) {
                clearInterval(spawner);
                setTimeout(advanceStage, 260);
              }
            } else {
              this.mistakes++;
              if (LL.audio) LL.audio.play('wrong');
              drop.remove();
              box.querySelector('#mgFeedback').textContent = `„${item.char}“ სხვა კუთხის ასოა! დაიჭირე: ${this.levelLetters.map(t => t.char).join(', ')}`;
            }
          };
          zone.appendChild(drop);
          setTimeout(() => drop.remove(), 3300);
        }, 780);
        return;
      }

      // 10. STANDARD RECOGNIZE / MISSING FALLBACK STAGES
      const t = st.target;
      const isMissing = st.kind === 'missing';
      const decoys = this.pickLearnedDecoys([t.id], cfg.decoys);
      const opts = [t, ...decoys].sort(() => Math.random() - 0.5);

      box.innerHTML = `
        <div class="panel mg-card rpg-box">
          ${headerHTML}
          <p>${isMissing
            ? `ჩასვი გამოტოვებული ასო სიტყვაში: <b class="big-word">_${t.word.slice(1)}</b> (${t.hint})`
            : `იპოვე ასო: <b>„${t.name}“</b> — სიტყვაში <b>„${t.word}“</b>`}</p>
          <div class="mg-choices">
            ${opts.map(o => `<button type="button" class="btn big" data-oid="${o.id}">${o.char}</button>`).join('')}
          </div>
          <p class="note" id="mgHintBox">${cfg.autoHint ? `💡 ${t.pronunciation}` : ''}</p>
          <p class="err" id="mgFeedback"></p>
        </div>
      `;
      box.querySelector('#mgHintBtn').onclick = () => {
        box.querySelector('#mgHintBox').textContent = `💡 „${t.char}“ (${t.name}) — ${t.word} (${t.syllables})`;
      };
      box.querySelectorAll('[data-oid]').forEach(btn => {
        btn.onclick = () => {
          const chosen = opts.find(x => x.id === Number(btn.dataset.oid));
          if (chosen.id === t.id) {
            if (LL.audio) LL.audio.play('correct');
            advanceStage();
          } else {
            this.mistakes++;
            if (LL.audio) LL.audio.play('wrong');
            box.querySelector('#mgFeedback').textContent = `ეს არის „${chosen.char}“ (${chosen.name}). სცადე კიდევ ერთხელ!`;
          }
        };
      });
    };

    renderStage();
  },

  async finishMinigame() {
    document.getElementById('minigameOverlay').hidden = true;
    this.mode = 'reward';
    this.monster.setAnim('openbag');
    this.player.setAnim('celebrate');
    this.iakob.setAnim('celebrate');

    const stars = this.mistakes === 0 ? 3 : this.mistakes <= 3 ? 2 : 1;
    const { state, rewardIds } = await LL.progress.completeLevel(this.level.n, stars);
    this.renderHudLetters(rewardIds);

    const isFinal = this.level.n === 11;
    if (LL.audio) {
      LL.audio.play(isFinal ? 'grand_finale' : 'win');
      if (isFinal) LL.audio.playMusic('ending');
    }

    const videoKey = isFinal ? 'final_ending' : 'victory_rescue';
    const videoUrl = await LL.assets.checkVideo(videoKey);
    const restoredImg = isFinal ? await LL.assets.load(LL.assets.manifest.library.restored) : null;

    if (videoUrl) {
      const box = document.getElementById('minigameOverlay');
      box.hidden = false;
      box.innerHTML = `
        <div class="panel mg-card rpg-box">
          <h3>${isFinal ? '✨ ბიბლიოთეკა კვლავ განათდა!' : '🎉 ასოყლაპიამ სამი ასო გაათავისუფლა!'}</h3>
          <video class="vn-video" style="max-height:300px;border:2px solid var(--ink)" src="${videoUrl}" autoplay muted playsinline preload="metadata"></video>
          <div class="actions">
            <button type="button" class="btn big" id="skipRewardVidBtn">გაგრძელება ▶</button>
          </div>
        </div>
      `;
      const vid = box.querySelector('video');
      const nextStep = () => {
        box.hidden = true;
        this.startDialogue(this.level.outro, () => this.showLevelCompleteCard(stars, state, restoredImg));
      };
      vid.onended = nextStep;
      box.querySelector('#skipRewardVidBtn').onclick = nextStep;
      return;
    }

    const startX = Math.max(200, Math.min(820, 850 - this.cameraX));
    this.flyingLetters = this.levelLetters.map((l, idx) => ({
      char: l.char, sx: startX + (idx - 1) * 28, sy: 400, tx: 810, ty: 36, x: startX, y: 400, t: -idx * 0.2
    }));

    if (isFinal) {
      this.mode = 'finale';
      this.skyFinaleLetters = this.allLetters.map((l, idx) => {
        const col = idx % 11, row = Math.floor(idx / 11);
        return { char: l.char, x: 90 + col * 78, y: 420 + row * 30, targetY: 65 + row * 68, angle: idx * 0.4 };
      });
    }

    this.startDialogue(this.level.outro, () => {
      this.showLevelCompleteCard(stars, state, restoredImg);
    });
  },

  showLevelCompleteCard(stars, state, restoredImg = null) {
    const box = document.getElementById('minigameOverlay');
    box.hidden = false;
    const isFinal = this.level.n === 11;

    box.innerHTML = `
      <div class="panel mg-card complete-card rpg-box">
        <h2>${isFinal ? '🎉 შენ 33 ასო გადაარჩინე! ქართული ანბანი ისევ ცოცხალია!' : `დონე ${this.level.n} დასრულებულია!`}</h2>
        ${isFinal && restoredImg ? `<img src="${restoredImg.src}" alt="აღდგენილი ბიბლიოთეკა" class="finale-art">` : ''}
        ${isFinal ? `<p class="finale-lesson">„ცოდნა მაშინ არის ნამდვილი სიმდიდრე, როდესაც მას სხვებსაც ვუზიარებთ.“</p>` : ''}
        <p class="stars-row">${'⭐'.repeat(stars)}${'☆'.repeat(3 - stars)}</p>
        <p>ანბანის წიგნში დაემატა: <b>${this.levelLetters.map(l => `${l.char} (${l.name})`).join(' · ')}</b></p>
        <p>შეგროვებული ასოები: <b>${state.letters.length} / 33</b></p>
        <div class="actions">
          <button type="button" class="btn alt" id="openBookAfterBtn">📖 ასოების ნახვა წიგნში</button>
          <button type="button" class="btn alt" id="replayLevelBtn">↻ თავიდან თამაში</button>
          <button type="button" class="btn big" id="toMapAfterBtn">🗺️ საქართველოს რუკაზე დაბრუნება ▶</button>
        </div>
      </div>
    `;

    box.querySelector('#openBookAfterBtn').onclick = () => LL.alphabetBook.open(this.levelLetters[0].id);
    box.querySelector('#replayLevelBtn').onclick = () => this.startLevel(this.level.n);
    box.querySelector('#toMapAfterBtn').onclick = () => {
      if (LL.audio) LL.audio.play('unlock');
      document.getElementById('hudBackMap').click();
    };
  }
};