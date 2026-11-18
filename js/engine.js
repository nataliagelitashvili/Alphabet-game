/* Complete 2D HTML5 Canvas Game Engine & 11 Progressive Georgian Alphabet Minigames. */
LL.engine = {
  W: 960,
  H: 540,
  canvas: null,
  ctx: null,
  raf: null,
  lastTime: 0,
  paused: false,
  overlayPaused: false,

  level: null,
  levelLetters: [],
  allLetters: [],
  layers: null,
  sheets: null,

  mode: 'dialogue',
  dialogueQueue: [],
  dialogueIndex: 0,
  onDialogueDone: null,

  player: null,
  iakob: null,
  monster: null,
  px: 230,
  py: 465,
  vx: 0,
  vy: 0,
  onGround: true,
  cameraX: 0,
  worldWidth: 1600,
  keys: { left: false, right: false, jump: false },

  pickups: [],
  mistakes: 0,
  flyingLetters: [],
  skyFinaleLetters: [],

  async startLevel(levelNum) {
    this.stop();
    const lvl = (LL.levelsData || []).find(l => l.n === levelNum) || LL.levelsData[0];
    if (!lvl) return;

    this.level = lvl;
    this.allLetters = await LL.loadAlphabet();
    this.levelLetters = lvl.letters.map(id => this.allLetters.find(l => l.id === id)).filter(Boolean);
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
    
    host.innerHTML = `
      <div class="game-shell">
        <div class="game-hud">
          <div class="hud-left">
            <button type="button" class="btn alt" id="hudBackMap">← რუკა</button>
            <span class="hud-title">${lvl.n}. ${lvl.region} — ${lvl.title}</span>
          </div>
          <div class="hud-letters" id="hudLetters"></div>
          <div class="hud-right">
            <button type="button" class="btn" id="hudChallengeBtn">🎯 გამოწვევა</button>
            <button type="button" class="btn alt" id="hudBookBtn">📖 წიგნი</button>
            <button type="button" class="btn alt" id="hudPauseBtn">⏸ პაუზა</button>
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
            <button type="button" class="btn touch-btn" id="touchActionBtn">გამოწვევა ★</button>
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
      LL.assets.preloadSheets()
    ]);
    this.layers = layers;
    this.sheets = sheets;

    this.player = LL.sprites.createActor('player', 'idle', 8);
    this.iakob = LL.sprites.createActor('iakob', 'talk', 6);
    this.monster = LL.sprites.createActor('monster', 'idle', 7);

    this.setupWorldForLevel();
    this.startDialogue(lvl.intro, () => {
      this.enterPlayOrMinigame();
    });

    this.lastTime = performance.now();
    const tick = now => {
      const dt = Math.min(0.05, (now - this.lastTime) / 1000);
      this.lastTime = now;
      if (!this.paused && !this.overlayPaused) {
        this.update(dt);
      }
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

  pauseForOverlay() {
    this.overlayPaused = true;
  },

  resumeFromOverlay() {
    this.overlayPaused = false;
    this.lastTime = performance.now();
  },

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
      LL.map.render(document.getElementById('mapBox'));
    };
    document.getElementById('hudChallengeBtn').onclick = () => {
      document.getElementById('dialogueBar').hidden = true;
      this.launchLevelMinigame();
    };
    document.getElementById('hudBookBtn').onclick = () => LL.alphabetBook.open();
    document.getElementById('hudPauseBtn').onclick = () => this.togglePause();
    document.getElementById('resumeBtn').onclick = () => this.togglePause(false);
    document.getElementById('retryBtn').onclick = () => this.startLevel(this.level.n);
    document.getElementById('bookPauseBtn').onclick = () => LL.alphabetBook.open();
    document.getElementById('exitMapBtn').onclick = () => document.getElementById('hudBackMap').click();

    this._onKeyDown = e => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') this.keys.left = true;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') this.keys.right = true;
      if (e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'Space') {
        if (this.mode === 'dialogue') {
          e.preventDefault();
          this.advanceDialogue();
        } else {
          this.keys.jump = true;
        }
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
    this.px = 230;
    this.py = 465;
    this.vx = 0;
    this.vy = 0;
    this.cameraX = 0;
    this.worldWidth = 1280;

    // Place the 3 glowing letter orbs directly visible inside the initial viewport
    this.pickups = this.levelLetters.map((l, idx) => ({
      letter: l,
      x: 370 + idx * 175,
      y: idx % 2 === 0 ? 415 : 355,
      collected: false,
      bob: idx * 1.4
    }));
  },

  enterPlayOrMinigame() {
    if (this.level.mechanic === 'collect_and_recognize') {
      this.mode = 'play';
    } else {
      this.launchLevelMinigame();
    }
  },

  collectWorldPickup(p) {
    if (p.collected) return;
    p.collected = true;
    if (LL.audio && LL.audio.play) LL.audio.play('collect');
    this.player.setAnim('celebrate');
    const gotIds = this.pickups.filter(x => x.collected).map(x => x.letter.id);
    this.renderHudLetters(gotIds);

    if (gotIds.length === 3) {
      setTimeout(() => this.launchLevelMinigame(), 350);
    }
  },

  update(dt) {
    this.player.update(dt);
    this.iakob.update(dt);
    this.monster.update(dt);

    if (this.mode === 'play') {
      const speed = 260;
      if (this.keys.left) {
        this.vx = -speed;
        this.player.flipX = true;
      } else if (this.keys.right) {
        this.vx = speed;
        this.player.flipX = false;
      } else {
        this.vx = 0;
      }

      if (this.keys.jump && this.onGround) {
        this.vy = -520;
        this.onGround = false;
        if (LL.audio && LL.audio.play) LL.audio.play('jump');
      }

      this.vy += 1280 * dt;
      this.px = Math.max(70, Math.min(this.worldWidth - 90, this.px + this.vx * dt));
      this.py += this.vy * dt;

      if (this.py >= 465) {
        this.py = 465;
        this.vy = 0;
        this.onGround = true;
      }

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

      if (this.px >= 820) {
        this.launchLevelMinigame();
      }
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

    ctx.fillStyle = 'rgba(20, 14, 8, 0.28)';
    ctx.fillRect(0, 466, this.W, 74);

    // Iakob Gogebashvili on left
    const iakobScreenX = 110 - this.cameraX;
    if (iakobScreenX > -120 && iakobScreenX < this.W + 120) {
      this.iakob.draw(ctx, this.sheets, iakobScreenX, 465, 2.2);
    }

    // Glowing letter pickups
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

    // Asotsqlapia visible on right side of stage
    const monsterScreenX = 850 - this.cameraX;
    if (monsterScreenX > -140 && monsterScreenX < this.W + 140) {
      this.monster.flipX = true;
      this.monster.draw(ctx, this.sheets, monsterScreenX, 465, 2.4);
    }

    // Player
    const playerScreenX = this.px - this.cameraX;
    this.player.draw(ctx, this.sheets, playerScreenX, this.py, 2.2);

    // 3 letters flying into the Alphabet Book
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

    // Level 11 Grand Finale: all 33 letters glowing in the sky
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

  launchLevelMinigame() {
    if (this.mode === 'minigame') return;
    this.mode = 'minigame';
    this.keys = { left: false, right: false, jump: false };
    const box = document.getElementById('minigameOverlay');
    box.hidden = false;

    const mech = this.level.mechanic;
    if (mech === 'collect_and_recognize') this.renderRecognitionMG(box);
    else if (mech === 'word_construction') this.renderWordBuildMG(box, false);
    else if (mech === 'object_discovery') this.renderDiscoveryMG(box);
    else if (mech === 'memory_match') this.renderMemoryMG(box);
    else if (mech === 'missing_letter') this.renderMissingLetterMG(box);
    else if (mech === 'falling_letters') this.renderFallingLettersMG(box);
    else if (mech === 'maze_challenge') this.renderMazeMG(box);
    else if (mech === 'timed_quiz') this.renderTimedQuizMG(box, false);
    else if (mech === 'fortress_spelling') this.renderWordBuildMG(box, true);
    else if (mech === 'plateau_gauntlet') this.renderTimedQuizMG(box, true);
    else if (mech === 'final_boss') this.renderFinalBossMG(box);
    else this.renderRecognitionMG(box);
  },

  renderRecognitionMG(box) {
    let step = 0;
    const renderStep = () => {
      const target = this.levelLetters[step];
      if (!target) return this.finishMinigame();
      const pool = this.allLetters.filter(x => x.id !== target.id).sort(() => Math.random() - 0.5).slice(0, 3);
      const choices = [target, ...pool].sort(() => Math.random() - 0.5);

      box.innerHTML = `
        <div class="panel mg-card">
          <h3>${this.level.mechanicLabel} (${step + 1}/3)</h3>
          <p>იპოვე ასო: <b>„${target.name}“</b> — სიტყვისთვის <b>„${target.word}“</b></p>
          <div class="mg-choices">
            ${choices.map(c => `<button type="button" class="btn big" data-id="${c.id}">${c.char}</button>`).join('')}
          </div>
          <p class="err" id="mgFeedback"></p>
        </div>
      `;
      box.querySelectorAll('[data-id]').forEach(btn => {
        btn.onclick = () => {
          if (Number(btn.dataset.id) === target.id) {
            if (LL.audio && LL.audio.play) LL.audio.play('collect');
            step++;
            this.renderHudLetters(this.levelLetters.slice(0, step).map(x => x.id));
            renderStep();
          } else {
            this.mistakes++;
            if (LL.audio && LL.audio.play) LL.audio.play('wrong');
            const picked = choices.find(x => x.id === Number(btn.dataset.id));
            box.querySelector('#mgFeedback').textContent = `ეს არის ${picked ? picked.char : ''}. სცადე კიდევ ერთხელ!`;
          }
        };
      });
    };
    renderStep();
  },

  renderWordBuildMG(box, hard = false) {
    let step = 0;
    const renderStep = () => {
      const target = this.levelLetters[step];
      if (!target) return this.finishMinigame();
      const letters = target.word.split('');
      const extra = hard ? [this.allLetters[(target.id + 4) % 33].char] : [];
      const bank = [...letters, ...extra].sort(() => Math.random() - 0.5);
      let current = [];

      const paint = () => {
        box.innerHTML = `
          <div class="panel mg-card">
            <h3>${this.level.mechanicLabel} (${step + 1}/3)</h3>
            <p>ააწყვე სიტყვა ასო <b>„${target.char}“ (${target.name})</b>-ით: <b>${target.hint}</b></p>
            <div class="mg-slots">${letters.map((_, i) => `<span class="mg-slot">${current[i] ? current[i].ch : '_'}</span>`).join('')}</div>
            <div class="mg-choices">
              ${bank.map((ch, idx) => `<button type="button" class="btn" data-bidx="${idx}" ${current.some(c => c.idx === idx) ? 'disabled' : ''}>${ch}</button>`).join('')}
              <button type="button" class="btn alt" id="mgClear">გასუფთავება</button>
            </div>
            <p class="err" id="mgFeedback"></p>
          </div>
        `;
        box.querySelectorAll('[data-bidx]').forEach(b => {
          b.onclick = () => {
            if (LL.audio && LL.audio.play) LL.audio.play('click');
            const idx = Number(b.dataset.bidx);
            current.push({ idx, ch: bank[idx] });
            const wordNow = current.map(c => c.ch).join('');
            if (wordNow.length === letters.length) {
              if (wordNow === target.word) {
                if (LL.audio && LL.audio.play) LL.audio.play('collect');
                step++;
                this.renderHudLetters(this.levelLetters.slice(0, step).map(x => x.id));
                setTimeout(renderStep, 300);
              } else {
                this.mistakes++;
                if (LL.audio && LL.audio.play) LL.audio.play('wrong');
                current = [];
                paint();
                box.querySelector('#mgFeedback').textContent = 'არასწორი თანმიმდევრობაა, სცადე თავიდან!';
              }
            } else {
              paint();
            }
          };
        });
        box.querySelector('#mgClear').onclick = () => { current = []; paint(); };
      };
      paint();
    };
    renderStep();
  },

  renderDiscoveryMG(box) {
    const found = new Set();
    const spots = [
      { left: '18%', top: '34%', letter: this.levelLetters[0], clue: 'მაღალი ფიჭვის ტოტებში' },
      { left: '52%', top: '62%', letter: this.levelLetters[1], clue: 'ხავსიან ქვასთან' },
      { left: '81%', top: '40%', letter: this.levelLetters[2], clue: 'ბილიკის ბოლოს' }
    ];
    const paint = () => {
      box.innerHTML = `
        <div class="panel mg-card">
          <h3>${this.level.mechanicLabel} (${found.size}/3)</h3>
          <p>დააკლიკე ტყეში დამალულ მანათობელ ასოებს!</p>
          <div class="mg-forest">
            ${spots.map((s, i) => `
              <button type="button" class="forest-spot ${found.has(i) ? 'found' : ''}" style="left:${s.left};top:${s.top}" data-spot="${i}" title="${s.clue}">
                ${found.has(i) ? `${s.letter.char} ✓` : '✨'}
              </button>
            `).join('')}
          </div>
        </div>
      `;
      box.querySelectorAll('[data-spot]').forEach(btn => {
        btn.onclick = () => {
          const i = Number(btn.dataset.spot);
          if (found.has(i)) return;
          found.add(i);
          if (LL.audio && LL.audio.play) LL.audio.play('collect');
          this.renderHudLetters([...found].map(idx => spots[idx].letter.id));
          if (found.size === 3) setTimeout(() => this.finishMinigame(), 450);
          else paint();
        };
      });
    };
    paint();
  },

  renderMemoryMG(box) {
    const cards = [];
    this.levelLetters.forEach(l => {
      cards.push({ pair: l.id, text: l.char });
      cards.push({ pair: l.id, text: l.name });
    });
    cards.sort(() => Math.random() - 0.5);
    const matched = new Set();
    let flipped = [];

    const paint = () => {
      box.innerHTML = `
        <div class="panel mg-card">
          <h3>${this.level.mechanicLabel} (${matched.size}/3 წყვილი)</h3>
          <p>დააწყვილე თითოეული ასო მის ტრადიციულ სახელთან!</p>
          <div class="mg-memory-grid">
            ${cards.map((c, idx) => {
              const open = matched.has(c.pair) || flipped.includes(idx);
              return `<button type="button" class="btn ${open ? '' : 'alt'} mem-card" data-cidx="${idx}">
                ${open ? c.text : '📜'}
              </button>`;
            }).join('')}
          </div>
        </div>
      `;
      box.querySelectorAll('[data-cidx]').forEach(btn => {
        btn.onclick = () => {
          const idx = Number(btn.dataset.cidx);
          if (flipped.length >= 2 || flipped.includes(idx) || matched.has(cards[idx].pair)) return;
          if (LL.audio && LL.audio.play) LL.audio.play('click');
          flipped.push(idx);
          paint();
          if (flipped.length === 2) {
            const [a, b] = flipped;
            if (cards[a].pair === cards[b].pair) {
              if (LL.audio && LL.audio.play) LL.audio.play('collect');
              matched.add(cards[a].pair);
              flipped = [];
              this.renderHudLetters([...matched]);
              if (matched.size === 3) setTimeout(() => this.finishMinigame(), 450);
              else paint();
            } else {
              this.mistakes++;
              if (LL.audio && LL.audio.play) LL.audio.play('wrong');
              setTimeout(() => { flipped = []; paint(); }, 650);
            }
          }
        };
      });
    };
    paint();
  },

  renderMissingLetterMG(box) {
    let step = 0;
    const renderStep = () => {
      const target = this.levelLetters[step];
      if (!target) return this.finishMinigame();
      const masked = '_' + target.word.slice(1);
      const distractors = this.allLetters.filter(x => x.id !== target.id).sort(() => Math.random() - 0.5).slice(0, 3);
      const opts = [target, ...distractors].sort(() => Math.random() - 0.5);

      box.innerHTML = `
        <div class="panel mg-card">
          <h3>${this.level.mechanicLabel} (${step + 1}/3)</h3>
          <p>კლდის წარწერა: <b class="big-word">${masked}</b> — ${target.hint}</p>
          <div class="mg-choices">
            ${opts.map(o => `<button type="button" class="btn big" data-oid="${o.id}">${o.char}</button>`).join('')}
          </div>
          <p class="err" id="mgFeedback"></p>
        </div>
      `;
      box.querySelectorAll('[data-oid]').forEach(btn => {
        btn.onclick = () => {
          if (Number(btn.dataset.oid) === target.id) {
            if (LL.audio && LL.audio.play) LL.audio.play('collect');
            step++;
            this.renderHudLetters(this.levelLetters.slice(0, step).map(x => x.id));
            renderStep();
          } else {
            this.mistakes++;
            if (LL.audio && LL.audio.play) LL.audio.play('wrong');
            box.querySelector('#mgFeedback').textContent = 'სხვა ასო სცადე!';
          }
        };
      });
    };
    renderStep();
  },

  renderFallingLettersMG(box) {
    const caught = new Set();
    const targets = this.levelLetters;
    const pool = [...targets, ...this.allLetters.slice(0, 6)];

    box.innerHTML = `
      <div class="panel mg-card">
        <h3>${this.level.mechanicLabel}</h3>
        <p>დაიჭირე მხოლოდ ამ დონის ასოები: <b>${targets.map(t => `${t.char} (${t.name})`).join(', ')}</b></p>
        <div class="mg-sky-catch" id="catchZone"></div>
        <p class="err" id="mgFeedback"></p>
      </div>
    `;
    const zone = box.querySelector('#catchZone');
    const spawner = setInterval(() => {
      if (caught.size >= 3 || this.mode !== 'minigame') {
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
        if (targets.some(t => t.id === item.id)) {
          caught.add(item.id);
          if (LL.audio && LL.audio.play) LL.audio.play('collect');
          drop.remove();
          this.renderHudLetters([...caught]);
          if (caught.size === 3) {
            clearInterval(spawner);
            setTimeout(() => this.finishMinigame(), 350);
          }
        } else {
          this.mistakes++;
          if (LL.audio && LL.audio.play) LL.audio.play('wrong');
          box.querySelector('#mgFeedback').textContent = `„${item.char}“ სხვა კუთხის ასოა! დაიჭირე: ${targets.map(t => t.char).join(', ')}`;
        }
      };
      zone.appendChild(drop);
      setTimeout(() => drop.remove(), 3400);
    }, 850);
  },

  renderMazeMG(box) {
    const grid = [
      [0, 0, 1, 2, 0, 0, 3],
      [1, 0, 1, 1, 1, 0, 1],
      [0, 0, 0, 0, 0, 0, 0],
      [0, 1, 1, 0, 1, 1, 0],
      [0, 0, 0, 0, 1, 4, 0]
    ];
    let r = 0, c = 0;
    const collected = new Set();

    const paint = () => {
      box.innerHTML = `
        <div class="panel mg-card">
          <h3>${this.level.mechanicLabel} (${collected.size}/3)</h3>
          <p>გაიკვლიე გზა ქვის კოშკებს შორის და შეაგროვე სამივე ასო!</p>
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
            <button type="button" class="btn alt" data-mv="-1,0">▲</button>
            <div>
              <button type="button" class="btn alt" data-mv="0,-1">◀</button>
              <button type="button" class="btn alt" data-mv="1,0">▼</button>
              <button type="button" class="btn alt" data-mv="0,1">▶</button>
            </div>
          </div>
        </div>
      `;
      box.querySelectorAll('[data-mv]').forEach(b => {
        b.onclick = () => {
          const [dr, dc] = b.dataset.mv.split(',').map(Number);
          const nr = r + dr, nc = c + dc;
          if (nr < 0 || nr >= grid.length || nc < 0 || nc >= grid[0].length || grid[nr][nc] === 1) {
            if (LL.audio && LL.audio.play) LL.audio.play('wrong');
            return;
          }
          if (LL.audio && LL.audio.play) LL.audio.play('click');
          r = nr; c = nc;
          const val = grid[r][c];
          if (val >= 2) {
            const lObj = this.levelLetters[val - 2];
            if (!collected.has(lObj.id)) {
              collected.add(lObj.id);
              if (LL.audio && LL.audio.play) LL.audio.play('collect');
              this.renderHudLetters([...collected]);
            }
          }
          if (collected.size === 3) setTimeout(() => this.finishMinigame(), 350);
          else paint();
        };
      });
    };
    paint();
  },

  renderTimedQuizMG(box, hard = false) {
    let step = 0;
    let timeLeft = hard ? 60 : 45;
    const iv = setInterval(() => {
      if (this.mode !== 'minigame') { clearInterval(iv); return; }
      timeLeft--;
      const tEl = box.querySelector('#mgClock');
      if (tEl) tEl.textContent = `⏱ ${timeLeft} წმ`;
      if (timeLeft <= 0) {
        clearInterval(iv);
        this.mistakes += 2;
        this.finishMinigame();
      }
    }, 1000);

    const renderStep = () => {
      const target = this.levelLetters[step];
      if (!target) {
        clearInterval(iv);
        return this.finishMinigame();
      }
      const pool = this.allLetters.filter(x => x.id !== target.id).sort(() => Math.random() - 0.5).slice(0, 3);
      const opts = [target, ...pool].sort(() => Math.random() - 0.5);

      box.innerHTML = `
        <div class="panel mg-card">
          <h3>${this.level.mechanicLabel} (${step + 1}/3) <span id="mgClock">⏱ ${timeLeft} წმ</span></h3>
          <p>რომელი ასო იწყებს სიტყვას <b>„${target.word}“</b> (სახელი: <b>${target.name}</b>)?</p>
          <div class="mg-choices">
            ${opts.map(o => `<button type="button" class="btn big" data-qid="${o.id}">${o.char}</button>`).join('')}
          </div>
          <p class="err" id="mgFeedback"></p>
        </div>
      `;
      box.querySelectorAll('[data-qid]').forEach(btn => {
        btn.onclick = () => {
          if (Number(btn.dataset.qid) === target.id) {
            if (LL.audio && LL.audio.play) LL.audio.play('collect');
            step++;
            this.renderHudLetters(this.levelLetters.slice(0, step).map(x => x.id));
            renderStep();
          } else {
            this.mistakes++;
            if (LL.audio && LL.audio.play) LL.audio.play('wrong');
            box.querySelector('#mgFeedback').textContent = 'კიდევ სცადე!';
          }
        };
      });
    };
    renderStep();
  },

  renderFinalBossMG(box) {
    let phase = 0;
    const renderPhase = () => {
      const target = this.levelLetters[phase];
      if (!target) return this.finishMinigame();
      const opts = [
        target,
        this.allLetters[(target.id + 5) % 30],
        this.allLetters[(target.id + 12) % 30],
        this.allLetters[(target.id + 19) % 30]
      ].sort(() => Math.random() - 0.5);

      box.innerHTML = `
        <div class="panel mg-card">
          <h3>ასოყლაპიას ჩანთის გახსნა — ფაზა ${phase + 1}/3</h3>
          <p>გაათავისუფლე ასო <b>„${target.name}“</b> — სიტყვა: <b>„${target.word}“</b> (${target.hint})</p>
          <div class="mg-choices">
            ${opts.map(o => `<button type="button" class="btn big" data-fid="${o.id}">${o.char}</button>`).join('')}
          </div>
          <p class="err" id="mgFeedback"></p>
        </div>
      `;
      box.querySelectorAll('[data-fid]').forEach(btn => {
        btn.onclick = () => {
          if (Number(btn.dataset.fid) === target.id) {
            if (LL.audio && LL.audio.play) LL.audio.play('collect');
            phase++;
            this.renderHudLetters(this.levelLetters.slice(0, phase).map(x => x.id));
            renderPhase();
          } else {
            this.mistakes++;
            if (LL.audio && LL.audio.play) LL.audio.play('wrong');
            box.querySelector('#mgFeedback').textContent = 'სცადე სხვა ასო!';
          }
        };
      });
    };
    renderPhase();
  },

  async finishMinigame() {
    document.getElementById('minigameOverlay').hidden = true;
    this.mode = 'reward';
    this.monster.setAnim('openbag');
    this.player.setAnim('celebrate');
    this.iakob.setAnim('celebrate');

    const stars = this.mistakes === 0 ? 3 : this.mistakes <= 2 ? 2 : 1;
    const { state, rewardIds } = await LL.progress.completeLevel(this.level.n, stars);
    this.renderHudLetters(rewardIds);

    const startX = Math.max(200, Math.min(820, 850 - this.cameraX));
    this.flyingLetters = this.levelLetters.map((l, idx) => ({
      char: l.char,
      sx: startX + (idx - 1) * 28,
      sy: 400,
      tx: 810,
      ty: 36,
      x: startX,
      y: 400,
      t: -idx * 0.2
    }));

    if (this.level.n === 11) {
      if (LL.audio && LL.audio.play) LL.audio.play('grand_finale');
      this.mode = 'finale';
      this.skyFinaleLetters = this.allLetters.map((l, idx) => {
        const col = idx % 11;
        const row = Math.floor(idx / 11);
        return {
          char: l.char,
          x: 90 + col * 78,
          y: 420 + row * 30,
          targetY: 65 + row * 68,
          angle: idx * 0.4
        };
      });
    } else if (LL.audio && LL.audio.play) {
      LL.audio.play('win');
    }

    this.startDialogue(this.level.outro, () => {
      this.showLevelCompleteCard(stars, state);
    });
  },

  showLevelCompleteCard(stars, state) {
    const box = document.getElementById('minigameOverlay');
    box.hidden = false;
    const isFinal = this.level.n === 11;
    const nextLvl = (LL.levelsData || []).find(l => l.n === this.level.n + 1);

    box.innerHTML = `
      <div class="panel mg-card complete-card">
        <h2>${isFinal ? '🎉 შენ 33 ასო გადაარჩინე! ქართული ანბანი ისევ ცოცხალია!' : `დონე ${this.level.n} დასრულებულია!`}</h2>
        ${isFinal ? `<p class="finale-lesson">„ცოდნა მაშინ არის ნამდვილი სიმდიდრე, როდესაც მას სხვებსაც ვუზიარებთ.“</p>` : ''}
        <p class="stars-row">${'⭐'.repeat(stars)}${'☆'.repeat(3 - stars)}</p>
        <p>გადარჩენილი ასოები: <b>${this.levelLetters.map(l => `${l.char} (${l.name})`).join(' · ')}</b></p>
        <p>ანბანის წიგნი: <b>${state.letters.length} / 33</b></p>
        <div class="actions">
          <button type="button" class="btn alt" id="openBookAfterBtn">📖 ასოების ნახვა წიგნში</button>
          <button type="button" class="btn alt" id="replayLevelBtn">↻ თავიდან თამაში</button>
          ${nextLvl ? `<button type="button" class="btn big" id="nextLevelBtn">შემდეგი: ${nextLvl.region} ▶</button>` : ''}
          <button type="button" class="btn alt" id="toMapAfterBtn">🗺️ საქართველოს რუკა</button>
        </div>
      </div>
    `;

    box.querySelector('#openBookAfterBtn').onclick = () => LL.alphabetBook.open(this.levelLetters[0].id);
    box.querySelector('#replayLevelBtn').onclick = () => this.startLevel(this.level.n);
    box.querySelector('#toMapAfterBtn').onclick = () => document.getElementById('hudBackMap').click();
    if (nextLvl) {
      box.querySelector('#nextLevelBtn').onclick = () => this.startLevel(nextLvl.n);
    }
  }
};