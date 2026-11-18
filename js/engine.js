/* Complete 2D HTML5 Canvas Game Engine + Difficulty Modes + Pedagogically Isolated Multi-Stage Challenges.
 * Rules enforced:
 * - Each level has 6-10 multi-stage activities teaching and reinforcing ONLY its 3 target letters
 *   (plus previously learned letters from earlier levels — never unlearned letters from future levels).
 * - Three difficulty modes: EASY (no strict timer, more hints, fewer decoys), NORMAL, CHALLENGE.
 * - Child-friendly: unlimited retries, no punishing game-over screens, encouraging explanations & optional hints.
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
  learnedPool: [], // ONLY letters from levels 1..N (never unlearned future letters)
  allLetters: [],
  layers: null,
  sheets: null,
  mgArt: {},

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

  getDiffConfig() {
    const diff = LL.getDifficulty ? LL.getDifficulty() : 'normal';
    const lvlScale = Math.min(4, Math.floor((this.level.n - 1) / 3));
    if (diff === 'easy') {
      return { id: 'easy', label: 'მარტივი', rounds: 6, decoys: 2, useTimer: false, timeSec: 0, autoHint: true };
    }
    if (diff === 'challenge') {
      return { id: 'challenge', label: 'რთული', rounds: 8 + Math.min(2, lvlScale), decoys: 5, useTimer: true, timeSec: Math.max(42, 66 - lvlScale * 6), autoHint: false };
    }
    return { id: 'normal', label: 'საშუალო', rounds: 7 + Math.min(1, lvlScale), decoys: 3, useTimer: this.level.n >= 6, timeSec: Math.max(58, 84 - lvlScale * 5), autoHint: false };
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

    const mgManifest = LL.assets.manifest.minigames || {};
    const [layers, sheets, puzzleImg, memoryImg, mazeImg, hiddenImg] = await Promise.all([
      LL.assets.preloadScene(lvl.id),
      LL.assets.preloadSheets(),
      LL.assets.load(mgManifest.puzzle),
      LL.assets.load(mgManifest.memory),
      LL.assets.load(mgManifest.maze),
      LL.assets.load(mgManifest.hidden)
    ]);
    this.layers = layers;
    this.sheets = sheets;
    this.mgArt = { puzzle: puzzleImg, memory: memoryImg, maze: mazeImg, hidden: hiddenImg };

    this.player = LL.sprites.createActor('player', 'idle', 8);
    this.iakob = LL.sprites.createActor('iakob', 'talk', 6);
    this.monster = LL.sprites.createActor('monster', 'idle', 7);

    this.setupWorldForLevel();
    this.startDialogue(lvl.intro, () => {
      if (this.level.mechanic === 'collect_and_recognize') this.mode = 'play';
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

    // 1. Moving clouds (Every level)
    this.clouds = Array.from({ length: 5 }, (_, i) => ({
      x: i * 230,
      y: 34 + (i % 3) * 26,
      speed: 10 + (i % 3) * 5,
      scale: 0.85 + (i % 2) * 0.35
    }));

    // 2. Floating golden particles (All magical scenes)
    this.goldenParticles = Array.from({ length: 22 }, () => ({
      x: Math.random() * this.W,
      y: Math.random() * (this.H - 85),
      r: 1.5 + Math.random() * 2,
      vx: -10 + Math.random() * 20,
      vy: -14 - Math.random() * 18,
      phase: Math.random() * Math.PI * 2
    }));

    // 3. Falling leaves (Borjomi = 3, Racha = 6)
    this.leaves = (this.level.n === 3 || this.level.n === 6)
      ? Array.from({ length: 18 }, () => ({
          x: Math.random() * this.W,
          y: Math.random() * this.H,
          vy: 28 + Math.random() * 26,
          sway: Math.random() * Math.PI * 2,
          color: Math.random() > 0.45 ? '#e07a22' : '#4a9e38'
        }))
      : [];

    // 4. Falling snow (Svaneti = 8)
    this.snowflakes = this.level.n === 8
      ? Array.from({ length: 36 }, () => ({
          x: Math.random() * this.W,
          y: Math.random() * this.H,
          r: 1.5 + Math.random() * 2.5,
          vy: 32 + Math.random() * 34,
          drift: Math.random() * Math.PI * 2
        }))
      : [];

    // 5. Fireflies (Forest & night levels: Borjomi = 3, Tusheti = 7, Fortress = 11)
    this.fireflies = (this.level.n === 3 || this.level.n === 7 || this.level.n === 11)
      ? Array.from({ length: 18 }, () => ({
          x: Math.random() * this.W,
          y: 180 + Math.random() * 270,
          vx: -18 + Math.random() * 36,
          vy: -12 + Math.random() * 24,
          phase: Math.random() * Math.PI * 2
        }))
      : [];

    // 6. Floating books (Mtskheta Lost Library = 4)
    this.floatingBooks = this.level.n === 4
      ? Array.from({ length: 5 }, (_, i) => ({
          x: 160 + i * 175,
          y: 120 + (i % 2) * 55,
          phase: i * 1.3
        }))
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
    if (LL.audio && LL.audio.play) LL.audio.play('collect');
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
        if (LL.audio && LL.audio.play) LL.audio.play('jump');
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

    // 1. Moving clouds (Every level)
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
    for (const c of (this.clouds || [])) {
      c.x = (c.x + c.speed * dt) % (this.W + 160);
      const cx = c.x - 80;
      const s = c.scale;
      ctx.fillRect(Math.round(cx), Math.round(c.y), Math.round(76 * s), Math.round(16 * s));
      ctx.fillRect(Math.round(cx + 14 * s), Math.round(c.y - 10 * s), Math.round(46 * s), Math.round(12 * s));
    }
    ctx.restore();

    // 2. Waterfall movement (Mountain levels: Tusheti=7, Svaneti=8, Javakheti=10)
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

    // 3. Glowing castle windows (Final level = 11)
    if (n === 11) {
      const pulse = 0.45 + 0.35 * Math.sin(this.animClock * 3);
      ctx.save();
      ctx.fillStyle = `rgba(255, 212, 72, ${pulse.toFixed(2)})`;
      [[420, 210], [490, 195], [560, 210], [630, 225]].forEach(([wx, wy]) => {
        const sx = Math.round(wx - this.cameraX * 0.5);
        ctx.fillRect(sx, wy, 14, 22);
      });
      ctx.restore();
    }

    // 4. Floating books (Library level = 4)
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

    // 5. Moving river (Racha = 6) vs standard ground strip
    if (n === 6) {
      ctx.save();
      ctx.fillStyle = 'rgba(36, 138, 196, 0.45)';
      ctx.fillRect(0, 472, this.W, 68);
      ctx.fillStyle = 'rgba(205, 244, 255, 0.6)';
      for (let i = 0; i < 16; i++) {
        const rx = ((i * 68 + this.animClock * 95) % (this.W + 40)) - 20;
        const ry = 482 + (i % 4) * 14;
        ctx.fillRect(Math.round(rx), ry, 28, 3);
      }
      ctx.restore();
    } else {
      ctx.fillStyle = 'rgba(20, 14, 8, 0.28)';
      ctx.fillRect(0, 466, this.W, 74);
    }

    // 6. Gentle grass movement (Kakheti = 1)
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

    // 7. Elevated platforms
    for (const pl of (this.platforms || [])) {
      const sx = Math.round(pl.x - this.cameraX);
      ctx.fillStyle = '#3a2714';
      ctx.fillRect(sx - 2, pl.y - 2, pl.w + 4, pl.h + 4);
      ctx.fillStyle = '#d99b26';
      ctx.fillRect(sx, pl.y, pl.w, pl.h);
    }

    // 8. Floating golden particles (All magical scenes)
    ctx.save();
    for (const gp of (this.goldenParticles || [])) {
      gp.x = (gp.x + gp.vx * dt + this.W) % this.W;
      gp.y = (gp.y + gp.vy * dt + (this.H - 85)) % (this.H - 85);
      const a = 0.45 + 0.4 * Math.sin(this.animClock * 3 + gp.phase);
      ctx.fillStyle = `rgba(255, 224, 102, ${a.toFixed(2)})`;
      ctx.fillRect(Math.round(gp.x), Math.round(gp.y), 3, 3);
    }
    ctx.restore();

    // 9. Falling leaves (Borjomi = 3, Racha = 6)
    for (const lf of (this.leaves || [])) {
      lf.y = (lf.y + lf.vy * dt) % (this.H - 60);
      lf.x = (lf.x + Math.sin(this.animClock * 2 + lf.sway) * 22 * dt + this.W) % this.W;
      ctx.fillStyle = lf.color;
      ctx.fillRect(Math.round(lf.x), Math.round(lf.y), 6, 4);
    }

    // 10. Falling snow (Svaneti = 8)
    if (this.snowflakes && this.snowflakes.length) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      for (const sf of this.snowflakes) {
        sf.y = (sf.y + sf.vy * dt) % (this.H - 50);
        sf.x = (sf.x + Math.sin(this.animClock * 1.8 + sf.drift) * 18 * dt + this.W) % this.W;
        ctx.fillRect(Math.round(sf.x), Math.round(sf.y), Math.round(sf.r), Math.round(sf.r));
      }
    }

    // 11. Fireflies (Forest & night levels)
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

  /* Helper: returns decoys strictly from learnedPool (never future unlearned letters) */
  pickLearnedDecoys(excludeIds, count) {
    const candidates = this.learnedPool.filter(l => !excludeIds.includes(l.id));
    return candidates.sort(() => Math.random() - 0.5).slice(0, count);
  },

  cardBgStyle(kind) {
    const img = this.mgArt && this.mgArt[kind];
    if (!img) return '';
    return `background-image:linear-gradient(rgba(244,232,200,.88),rgba(232,214,166,.92)),url('${img.src}');background-size:cover;background-position:center;`;
  },

  /* Multi-Stage Level Curriculum (6 to 10 progressive stages reinforcing ONLY the 3 target letters) */
  launchLevelMinigame() {
    if (this.mode === 'minigame') return;
    this.mode = 'minigame';
    this.keys = { left: false, right: false, jump: false };
    const box = document.getElementById('minigameOverlay');
    box.hidden = false;

    const cfg = this.getDiffConfig();
    const stages = [];

    // Stage 1-3: Recognize each of the 3 target letters
    this.levelLetters.forEach(l => {
      stages.push({ kind: 'recognize', target: l });
    });

    // Stage 4-6: Region-specific activity + missing-letter & word-building reinforcement
    if (this.level.mechanic === 'maze_challenge') {
      stages.push({ kind: 'maze' });
      stages.push({ kind: 'missing', target: this.levelLetters[0] });
      stages.push({ kind: 'build', target: this.levelLetters[2] });
    } else if (this.level.mechanic === 'object_discovery') {
      stages.push({ kind: 'discovery' });
      stages.push({ kind: 'missing', target: this.levelLetters[1] });
      stages.push({ kind: 'build', target: this.levelLetters[2] });
    } else if (this.level.mechanic === 'falling_letters') {
      stages.push({ kind: 'falling' });
      stages.push({ kind: 'missing', target: this.levelLetters[0] });
      stages.push({ kind: 'build', target: this.levelLetters[1] });
    } else {
      this.levelLetters.forEach((l, idx) => {
        stages.push({ kind: idx % 2 === 0 ? 'missing' : 'build', target: l });
      });
    }

    // Stage 7+: Extra synthesis stages for Normal / Challenge difficulties
    if (cfg.rounds >= 7) stages.push({ kind: 'memory' });
    if (cfg.rounds >= 8) stages.push({ kind: 'build', target: this.levelLetters[2] });
    if (cfg.rounds >= 9) stages.push({ kind: 'recognize', target: this.levelLetters[1] });
    if (cfg.rounds >= 10) stages.push({ kind: 'build', target: this.levelLetters[0] });

    let stageIdx = 0;
    let timeLeft = cfg.timeSec;
    let timerIv = null;

    if (cfg.useTimer && timeLeft > 0) {
      timerIv = setInterval(() => {
        if (this.mode !== 'minigame') { clearInterval(timerIv); return; }
        timeLeft--;
        const cEl = box.querySelector('#mgClock');
        if (cEl) cEl.textContent = `⏱ ${timeLeft} წმ`;
        // Child-friendly: never fail permanently on timeout — grant encouraging +25s extension
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
          <span>ეტაპი ${stageIdx + 1} / ${stages.length} · ${cfg.label}</span>
          ${cfg.useTimer ? `<span id="mgClock">⏱ ${timeLeft} წმ</span>` : '<span>🌿 თავისუფალი დრო</span>'}
          <button type="button" class="btn alt sm" id="mgHintBtn">💡 მინიშნება</button>
        </div>
      `;

      if (st.kind === 'recognize') {
        const t = st.target;
        const decoys = this.pickLearnedDecoys([t.id], cfg.decoys);
        const opts = [t, ...decoys].sort(() => Math.random() - 0.5);

        box.innerHTML = `
          <div class="panel mg-card rpg-box" style="${this.cardBgStyle('puzzle')}">
            ${headerHTML}
            <p>იპოვე ასო: <b>„${t.name}“</b> — სიტყვაში <b>„${t.word}“</b></p>
            <div class="mg-choices">
              ${opts.map(o => `<button type="button" class="btn big" data-oid="${o.id}">${o.char}</button>`).join('')}
            </div>
            <p class="note" id="mgHintBox">${cfg.autoHint ? `💡 მინიშნება: ${t.pronunciation}` : ''}</p>
            <p class="err" id="mgFeedback"></p>
          </div>
        `;
        box.querySelector('#mgHintBtn').onclick = () => {
          box.querySelector('#mgHintBox').textContent = `💡 მინიშნება: ასო „${t.char}“ (${t.name}) — ${t.pronunciation}. ${t.hint}.`;
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
              box.querySelector('#mgFeedback').textContent = `ეს არის „${chosen.char}“ (${chosen.name}). ჩვენ ვეძებთ „${t.name}“-ს — სცადე კიდევ ერთხელ!`;
            }
          };
        });
        return;
      }

      if (st.kind === 'missing') {
        const t = st.target;
        const masked = '_' + t.word.slice(1);
        const decoys = this.pickLearnedDecoys([t.id], cfg.decoys);
        const opts = [t, ...decoys].sort(() => Math.random() - 0.5);

        box.innerHTML = `
          <div class="panel mg-card rpg-box" style="${this.cardBgStyle('puzzle')}">
            ${headerHTML}
            <p>ჩასვი გამოტოვებული ასო სიტყვაში: <b class="big-word">${masked}</b> (${t.hint})</p>
            <div class="mg-choices">
              ${opts.map(o => `<button type="button" class="btn big" data-oid="${o.id}">${o.char}</button>`).join('')}
            </div>
            <p class="note" id="mgHintBox">${cfg.autoHint ? `💡 სიტყვა იწყება ასოთი „${t.name}“` : ''}</p>
            <p class="err" id="mgFeedback"></p>
          </div>
        `;
        box.querySelector('#mgHintBtn').onclick = () => {
          box.querySelector('#mgHintBox').textContent = `💡 მინიშნება: სრული სიტყვაა „${t.word}“ (${t.syllables}) — პირველი ასოა „${t.char}“.`;
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
              box.querySelector('#mgFeedback').textContent = `„${chosen.char}“ აქ არ უხდება. მოუსმინე სიტყვის დასაწყისს: ${t.syllables}!`;
            }
          };
        });
        return;
      }

      if (st.kind === 'build') {
        const t = st.target;
        const letters = t.word.split('');
        const extraDecoys = this.pickLearnedDecoys([t.id], Math.max(1, cfg.decoys - 1)).map(x => x.char);
        const bank = [...letters, ...extraDecoys].sort(() => Math.random() - 0.5);
        let current = [];

        const paintBuild = () => {
          box.innerHTML = `
            <div class="panel mg-card rpg-box" style="${this.cardBgStyle('puzzle')}">
              ${headerHTML}
              <p>ააწყვე სიტყვა: <b>${t.hint}</b> (${letters.length} ასო)</p>
              <div class="mg-slots">${letters.map((_, i) => `<span class="mg-slot">${current[i] ? current[i].ch : '_'}</span>`).join('')}</div>
              <div class="mg-choices">
                ${bank.map((ch, idx) => `<button type="button" class="btn" data-bidx="${idx}" ${current.some(c => c.idx === idx) ? 'disabled' : ''}>${ch}</button>`).join('')}
                <button type="button" class="btn alt" id="mgClear">↺ გასუფთავება</button>
              </div>
              <p class="note" id="mgHintBox">${cfg.autoHint ? `💡 დამარცვლა: ${t.syllables}` : ''}</p>
              <p class="err" id="mgFeedback"></p>
            </div>
          `;
          box.querySelector('#mgHintBtn').onclick = () => {
            box.querySelector('#mgHintBox').textContent = `💡 მინიშნება: სიტყვა იწერება ასე — ${t.syllables} (${t.word}).`;
          };
          box.querySelector('#mgClear').onclick = () => { current = []; paintBuild(); };
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
                  paintBuild();
                  box.querySelector('#mgFeedback').textContent = `კარგი მცდელობაა! სცადე თავიდან — დამარცვლა დაგეხმარება: ${t.syllables}`;
                }
              } else {
                paintBuild();
              }
            };
          });
        };
        paintBuild();
        return;
      }

      if (st.kind === 'memory') {
        const cards = [];
        this.levelLetters.forEach(l => {
          cards.push({ pair: l.id, text: l.char });
          cards.push({ pair: l.id, text: l.name });
        });
        cards.sort(() => Math.random() - 0.5);
        const matched = new Set();
        let flipped = [];

        const paintMem = () => {
          box.innerHTML = `
            <div class="panel mg-card rpg-box" style="${this.cardBgStyle('memory')}">
              ${headerHTML}
              <p>დააწყვილე ამ კუთხის სამივე ასო მის სახელთან (${matched.size}/3):</p>
              <div class="mg-memory-grid">
                ${cards.map((c, idx) => {
                  const open = matched.has(c.pair) || flipped.includes(idx);
                  return `<button type="button" class="btn ${open ? '' : 'alt'} mem-card" data-cidx="${idx}">${open ? c.text : '📜'}</button>`;
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
              paintMem();
              if (flipped.length === 2) {
                const [a, b] = flipped;
                if (cards[a].pair === cards[b].pair) {
                  if (LL.audio) LL.audio.play('correct');
                  matched.add(cards[a].pair);
                  flipped = [];
                  if (matched.size === 3) setTimeout(advanceStage, 300);
                  else paintMem();
                } else {
                  setTimeout(() => { flipped = []; paintMem(); }, 550);
                }
              }
            };
          });
        };
        paintMem();
        return;
      }

      if (st.kind === 'discovery') {
        const found = new Set();
        const decoys = this.pickLearnedDecoys(this.level.letters, 2);
        const spots = [
          { left: '16%', top: '30%', letter: this.levelLetters[0], real: true },
          { left: '50%', top: '64%', letter: this.levelLetters[1], real: true },
          { left: '82%', top: '36%', letter: this.levelLetters[2], real: true }
        ];
        if (decoys[0]) spots.push({ left: '34%', top: '68%', letter: decoys[0], real: false });
        if (decoys[1]) spots.push({ left: '68%', top: '26%', letter: decoys[1], real: false });

        const paintDisc = () => {
          box.innerHTML = `
            <div class="panel mg-card rpg-box" style="${this.cardBgStyle('hidden')}">
              ${headerHTML}
              <p>აღმოაჩინე ამ კუთხის 3 ასო: <b>${this.levelLetters.map(l => `${l.char} (${l.name})`).join(', ')}</b></p>
              <div class="mg-forest">
                ${spots.map((s, i) => `
                  <button type="button" class="forest-spot ${found.has(i) ? 'found' : ''}" style="left:${s.left};top:${s.top}" data-spot="${i}">
                    ${found.has(i) ? `${s.letter.char} ✓` : s.letter.char}
                  </button>
                `).join('')}
              </div>
              <p class="note" id="mgHintBox"></p>
              <p class="err" id="mgFeedback"></p>
            </div>
          `;
          box.querySelector('#mgHintBtn').onclick = () => {
            box.querySelector('#mgHintBox').textContent = `💡 ვეძებთ მხოლოდ: ${this.levelLetters.map(l => l.char).join(', ')}`;
          };
          box.querySelectorAll('[data-spot]').forEach(btn => {
            btn.onclick = () => {
              const i = Number(btn.dataset.spot);
              const s = spots[i];
              if (found.has(i)) return;
              if (!s.real) {
                this.mistakes++;
                if (LL.audio) LL.audio.play('wrong');
                box.querySelector('#mgFeedback').textContent = `„${s.letter.char}“ (${s.letter.name}) უკვე ნასწავლი ასოა — ახლა ვეძებთ: ${this.levelLetters.map(l => l.char).join(', ')}`;
                return;
              }
              found.add(i);
              if (LL.audio) LL.audio.play('collect');
              if (found.size === 3) setTimeout(advanceStage, 300);
              else paintDisc();
            };
          });
        };
        paintDisc();
        return;
      }

      if (st.kind === 'falling') {
        let caughtCount = 0;
        const needed = 6;
        const pool = [...this.levelLetters, ...this.pickLearnedDecoys(this.level.letters, 4)];

        box.innerHTML = `
          <div class="panel mg-card rpg-box">
            ${headerHTML}
            <p>დაიჭირე მხოლოდ: <b>${this.levelLetters.map(t => `${t.char} (${t.name})`).join(', ')}</b> (<span id="catchCnt">0</span>/${needed})</p>
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
          drop.className = 'btn falling-btn';
          drop.textContent = item.char;
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

      if (st.kind === 'maze') {
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
            <div class="panel mg-card rpg-box" style="${this.cardBgStyle('maze')}">
              ${headerHTML}
              <p>გაიკვლიე გზა ქვის კოშკებში და შეაგროვე სამივე ასო (${collected.size}/3):</p>
              <div class="maze-grid">
                ${grid.map((row, ri) => row.map((cell, ci) => {
                  const isPlayer = ri === r && ci === c;
                  const letterObj = cell >= 2 ? this.levelLetters[cell - 2] : null;
                  const got = letterObj && collected.has(letterObj.id);
                  return `<div class="maze-cell ${cell === 1 ? 'wall' : 'path'}">
                    ${isPlayer ? '🧭' : (letterObj && !got ? letterObj.char : '')}
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
            box.querySelector('#mgHintBox').textContent = '💡 გამოიყენე ისრები ქვის კედლების შემოსავლელად.';
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
      }
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
    const bgStyle = restoredImg ? `background-image:linear-gradient(rgba(244,232,200,.88),rgba(232,214,166,.92)),url('${restoredImg.src}');background-size:cover;` : '';

    box.innerHTML = `
      <div class="panel mg-card complete-card rpg-box" style="${bgStyle}">
        <h2>${isFinal ? '🎉 შენ 33 ასო გადაარჩინე! ქართული ანბანი ისევ ცოცხალია!' : `დონე ${this.level.n} დასრულებულია!`}</h2>
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