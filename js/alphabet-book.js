/* Leather-Bound Two-Page Flipping Alphabet Book ("დედა ენა")
 * - Page 0: Illustrated Table of Contents (All 33 letters across left & right pages)
 * - Pages 1..33: Individual Letter Two-Page Spread with .wav Pronunciation,
 *   Animated Stroke Guide + Finger Tracing Canvas, Example Word, and Exercises.
 */
LL.alphabetBook = {
  el: null,
  tab: 'book',
  page: 0,
  guideRaf: null,

  ensureDOM() {
    if (this.el) return this.el;
    const dlg = document.createElement('dialog');
    dlg.id = 'bookDlg';
    dlg.className = 'book-dialog';
    dlg.innerHTML = `
      <div class="book-shell">
        <div class="book-head">
          <div class="book-title-group">
            <span class="book-emblem">📖</span>
            <div>
              <h2 class="book-main-title">დედა ენა — ანბანის წიგნი</h2>
              <span class="book-sub-count">შეგროვებული ასოები: <b id="bookCount">0 / 33</b></span>
            </div>
          </div>
          <div class="book-tabs">
            <button type="button" class="btn sm" data-btab="book">📖 ფურცლები</button>
            <button type="button" class="btn alt sm" data-btab="discoveries">📜 აღმოჩენები</button>
            <button type="button" class="btn alt sm" data-btab="achievements">🏆 მიღწევები</button>
            <button type="button" class="btn alt sm" id="closeBookBtn">✕</button>
          </div>
        </div>
        <div id="bookBody" class="book-body"></div>
      </div>
    `;
    document.body.appendChild(dlg);
    dlg.querySelector('#closeBookBtn').onclick = () => this.close();
    dlg.addEventListener('close', () => {
      if (this.guideRaf) cancelAnimationFrame(this.guideRaf);
      if (LL.engine && LL.engine.resumeFromOverlay) LL.engine.resumeFromOverlay();
    });
    dlg.querySelectorAll('[data-btab]').forEach(btn => {
      btn.onclick = () => {
        if (LL.audio) LL.audio.play('book');
        this.tab = btn.dataset.btab;
        this.render();
      };
    });
    this.el = dlg;
    return dlg;
  },

  async open(initialLetterId = null) {
    if (LL.engine && LL.engine.pauseForOverlay) LL.engine.pauseForOverlay();
    if (LL.audio) LL.audio.play('book');
    const dlg = this.ensureDOM();
    this.tab = 'book';
    if (initialLetterId && initialLetterId >= 1 && initialLetterId <= 33) {
      this.page = initialLetterId;
    }
    await this.render();
    if (!dlg.open) dlg.showModal();
  },

  close() {
    if (this.el && this.el.open) this.el.close();
  },

  async flipToPage(targetPage) {
    const target = Math.max(0, Math.min(33, targetPage));
    if (target === this.page) return;
    const dir = target > this.page ? 'flip-next' : 'flip-prev';
    const spread = this.el && this.el.querySelector('.book-spread');
    if (LL.audio) LL.audio.play('book');

    if (spread) {
      spread.classList.remove('flip-next', 'flip-prev');
      void spread.offsetWidth;
      spread.classList.add(dir);
      await new Promise(r => setTimeout(r, 260));
    }
    this.page = target;
    await this.render();
  },

  async render() {
    if (this.guideRaf) cancelAnimationFrame(this.guideRaf);
    const dlg = this.ensureDOM();
    const state = await LL.progress.getState();
    const letters = await LL.loadAlphabet();
    const unlockedSet = new Set(state.letters || []);

    dlg.querySelector('#bookCount').textContent = `${unlockedSet.size} / 33`;
    dlg.querySelectorAll('[data-btab]').forEach(b => {
      b.className = b.dataset.btab === this.tab ? 'btn sm' : 'btn alt sm';
    });

    const body = dlg.querySelector('#bookBody');

    if (this.tab === 'discoveries') {
      const completed = state.levels_completed || 0;
      body.innerHTML = `
        <div class="book-single-sheet">
          <div class="disc-list">
            ${LL.achievements.discoveriesCatalog.map((d, idx) => {
              const unlocked = completed >= idx + 1;
              return `<div class="disc-item ${unlocked ? 'got' : 'locked'}">
                <b>${unlocked ? '📜' : '🔒'} ${d.region} — ${d.title}</b>
                <p>${unlocked ? d.text : 'გაიარე შესაბამისი კუთხე ამ აღმოჩენის გასახსნელად.'}</p>
              </div>`;
            }).join('')}
          </div>
        </div>
      `;
      return;
    }

    if (this.tab === 'achievements') {
      const gotSet = new Set(state.achievements || []);
      body.innerHTML = `
        <div class="book-single-sheet">
          <div class="disc-list">
            ${LL.achievements.catalog.map(a => {
              const ok = gotSet.has(a.id);
              return `<div class="disc-item ${ok ? 'got' : 'locked'}">
                <b>${ok ? '🏆' : '🔒'} ${a.title}</b>
                <p>${a.desc}</p>
              </div>`;
            }).join('')}
          </div>
        </div>
      `;
      return;
    }

    // PAGE 0: Open Two-Page Table of Contents (Letters 1-18 on Left Page, 19-33 on Right Page)
    if (this.page === 0) {
      const leftList = letters.slice(0, 18);
      const rightList = letters.slice(18, 33);

      body.innerHTML = `
        <div class="book-spread" id="bookSpread">
          <div class="book-page left-page">
            <div>
              <div class="page-header"><span>სარჩევი · ა – ს</span><span>გვ. 1</span></div>
              <div class="toc-grid">
                ${leftList.map(l => {
                  const got = unlockedSet.has(l.id);
                  return `<button type="button" class="toc-tile ${got ? 'got' : 'locked'}" data-goto="${l.id}">
                    <span class="toc-num">${l.id}</span>
                    <span class="toc-ch">${got ? l.char : '🔒'}</span>
                    <span class="toc-name">${got ? l.name : '—'}</span>
                  </button>`;
                }).join('')}
              </div>
            </div>
            <div class="book-nav-bar">
              <span class="note">დააკლიკე ასოს გადასაშლელად</span>
              <span></span>
            </div>
          </div>

          <div class="book-spine"></div>

          <div class="book-page right-page">
            <div>
              <div class="page-header"><span>სარჩევი · ტ – ჰ</span><span>გვ. 2</span></div>
              <div class="toc-grid">
                ${rightList.map(l => {
                  const got = unlockedSet.has(l.id);
                  return `<button type="button" class="toc-tile ${got ? 'got' : 'locked'}" data-goto="${l.id}">
                    <span class="toc-num">${l.id}</span>
                    <span class="toc-ch">${got ? l.char : '🔒'}</span>
                    <span class="toc-name">${got ? l.name : '—'}</span>
                  </button>`;
                }).join('')}
              </div>
            </div>
            <div class="book-nav-bar">
              <span></span>
              <button type="button" class="btn sm" id="nextPageBtn">გვერდის გადაშლა (ა) ▶</button>
            </div>
          </div>
        </div>
      `;

      body.querySelectorAll('[data-goto]').forEach(btn => {
        btn.onclick = () => this.flipToPage(Number(btn.dataset.goto));
      });
      body.querySelector('#nextPageBtn').onclick = () => this.flipToPage(1);
      this.bindSwipe(body.querySelector('#bookSpread'));
      return;
    }

    // PAGES 1..33: Dedicated Two-Page Spread for One Letter
    const sel = letters.find(l => l.id === this.page) || letters[0];
    const isOpen = unlockedSet.has(sel.id);
    const lvl = (LL.levelsData || []).find(w => w.n === sel.world);

    body.innerHTML = `
      <div class="book-spread" id="bookSpread">
        <div class="book-page left-page">
          <div>
            <div class="page-header">
              <button type="button" class="btn alt sm" id="tocBtn">📑 სარჩევი</button>
              <span>ასო #${sel.id} / 33</span>
            </div>
            ${isOpen ? `
              <div class="letter-showcase">
                <div class="big-glyph">${sel.char}</div>
                <div class="glyph-meta">
                  <h3>${sel.char} — ${sel.name}</h3>
                  <p class="pron-text">${sel.pronunciation}</p>
                  <button type="button" class="btn sm" id="playLetterAudio">🔊 გამოთქმის მოსმენა</button>
                </div>
              </div>
              <div class="writing-box">
                <div class="writing-head">
                  <b>✍️ როგორ იწერება „${sel.char}“</b>
                  <button type="button" class="btn alt sm" id="clearTraceBtn">გასუფთავება</button>
                </div>
                <canvas id="writeCanvas" width="250" height="165"></canvas>
              </div>
            ` : `
              <div class="locked-spread">
                <div class="big-glyph locked">🔒</div>
                <h3>ასო #${sel.id} ჯერ დაკეტილია</h3>
                <p>იპოვე ეს ასო მე-${sel.world} კუთხეში: <b>${lvl ? `${lvl.region} — ${lvl.title}` : ''}</b></p>
              </div>
            `}
          </div>
          <div class="book-nav-bar">
            <button type="button" class="btn alt sm" id="prevPageBtn">◀ წინა გვერდი</button>
            <span>გვ. ${sel.id * 2 + 1}</span>
          </div>
        </div>

        <div class="book-spine"></div>

        <div class="book-page right-page">
          <div>
            <div class="page-header">
              <span>${lvl ? `${lvl.n}. ${lvl.region}` : ''}</span>
              <span>გვ. ${sel.id * 2 + 2}</span>
            </div>
            ${isOpen ? `
              <div class="word-example-card">
                <div class="ex-word">${sel.word}</div>
                <div class="ex-syllables">დამარცვლა: <b>${sel.syllables}</b></div>
                <div class="ex-hint">${sel.hint}</div>
              </div>
              <div class="ld-practice">
                <div class="prac-tabs">
                  <button type="button" class="btn alt sm" id="btnRecog">ამოცნობა</button>
                  <button type="button" class="btn alt sm" id="btnSpell">ჩასმა</button>
                  <button type="button" class="btn alt sm" id="btnBuild">სიტყვის აწყობა</button>
                </div>
                <div id="practiceBox" class="prac-box"></div>
              </div>
            ` : `
              <div class="locked-spread">
                <p>გაიარე შესაბამისი თავგადასავალი რუკაზე, რომ გაიხსნას ამ ასოს ხმა, კალიგრაფია და სავარჯიშოები!</p>
              </div>
            `}
          </div>
          <div class="book-nav-bar">
            <span></span>
            <button type="button" class="btn sm" id="nextPageBtn">${sel.id < 33 ? 'შემდეგი გვერდი ▶' : 'სარჩევი ↻'}</button>
          </div>
        </div>
      </div>
    `;

    body.querySelector('#tocBtn').onclick = () => this.flipToPage(0);
    body.querySelector('#prevPageBtn').onclick = () => this.flipToPage(sel.id - 1);
    body.querySelector('#nextPageBtn').onclick = () => this.flipToPage(sel.id < 33 ? sel.id + 1 : 0);
    this.bindSwipe(body.querySelector('#bookSpread'));

    if (isOpen) {
      body.querySelector('#playLetterAudio').onclick = () => {
        if (LL.audio) LL.audio.playLetter(sel);
      };
      body.querySelector('#btnRecog').onclick = () => this.renderPractice(body.querySelector('#practiceBox'), sel, letters, 'recog');
      body.querySelector('#btnSpell').onclick = () => this.renderPractice(body.querySelector('#practiceBox'), sel, letters, 'spell');
      body.querySelector('#btnBuild').onclick = () => this.renderPractice(body.querySelector('#practiceBox'), sel, letters, 'build');
      this.renderPractice(body.querySelector('#practiceBox'), sel, letters, 'recog');
      this.initWritingCanvas(body.querySelector('#writeCanvas'), body.querySelector('#clearTraceBtn'), sel.char);
    }
  },

  initWritingCanvas(cv, clearBtn, char) {
    if (!cv) return;
    const ctx = cv.getContext('2d');
    const W = cv.width, H = cv.height;

    const mask = document.createElement('canvas');
    mask.width = W;
    mask.height = H;
    const mctx = mask.getContext('2d');
    mctx.font = 'bold 122px "Noto Sans Georgian", serif';
    mctx.textAlign = 'center';
    mctx.textBaseline = 'middle';
    mctx.fillStyle = '#000';
    mctx.fillText(char, W / 2, H / 2 + 6);

    const img = mctx.getImageData(0, 0, W, H).data;
    const pts = [];
    for (let y = 10; y < H - 10; y += 5) {
      for (let x = 10; x < W - 10; x += 5) {
        if (img[(y * W + x) * 4 + 3] > 128) pts.push({ x, y });
      }
    }

    const userStrokes = [];
    let currentStroke = null;
    const getPos = e => {
      const r = cv.getBoundingClientRect();
      return { x: (e.clientX - r.left) * (W / r.width), y: (e.clientY - r.top) * (H / r.height) };
    };

    cv.onpointerdown = e => {
      e.preventDefault();
      cv.setPointerCapture(e.pointerId);
      currentStroke = [getPos(e)];
      userStrokes.push(currentStroke);
    };
    cv.onpointermove = e => {
      if (!currentStroke) return;
      e.preventDefault();
      currentStroke.push(getPos(e));
    };
    cv.onpointerup = () => { currentStroke = null; };
    cv.onpointercancel = () => { currentStroke = null; };

    if (clearBtn) {
      clearBtn.onclick = () => {
        userStrokes.length = 0;
        if (LL.audio) LL.audio.play('click');
      };
    }

    let step = 0;
    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(139, 90, 43, 0.25)';
      ctx.lineWidth = 1;
      [32, 64, 104, 136].forEach(ly => {
        ctx.beginPath();
        ctx.moveTo(14, ly);
        ctx.lineTo(W - 14, ly);
        ctx.stroke();
      });

      ctx.font = 'bold 122px "Noto Sans Georgian", serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(42, 29, 16, 0.16)';
      ctx.fillText(char, W / 2, H / 2 + 6);

      if (pts.length) {
        step = (step + 0.55) % pts.length;
        const p = pts[Math.floor(step)];
        ctx.fillStyle = 'rgba(242, 182, 50, 0.45)';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#c94a1a';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4.5, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.strokeStyle = '#1f5c2e';
      ctx.lineWidth = 7;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (const stroke of userStrokes) {
        if (stroke.length < 2) continue;
        ctx.beginPath();
        ctx.moveTo(stroke[0].x, stroke[0].y);
        for (let i = 1; i < stroke.length; i++) ctx.lineTo(stroke[i].x, stroke[i].y);
        ctx.stroke();
      }

      this.guideRaf = requestAnimationFrame(draw);
    };
    this.guideRaf = requestAnimationFrame(draw);
  },

  bindSwipe(el) {
    if (!el) return;
    let startX = null;
    el.addEventListener('touchstart', e => {
      if (e.target.closest('canvas')) return;
      startX = e.touches[0].clientX;
    }, { passive: true });
    el.addEventListener('touchend', e => {
      if (startX === null) return;
      const dx = e.changedTouches[0].clientX - startX;
      startX = null;
      if (Math.abs(dx) > 55) {
        if (dx < 0 && this.page < 33) this.flipToPage(this.page + 1);
        else if (dx > 0 && this.page > 0) this.flipToPage(this.page - 1);
      }
    }, { passive: true });
  },

  renderPractice(box, sel, letters, mode) {
    if (mode === 'recog') {
      const distractors = letters.filter(x => x.id !== sel.id).sort(() => Math.random() - 0.5).slice(0, 3);
      const opts = [sel, ...distractors].sort(() => Math.random() - 0.5);
      box.innerHTML = `
        <p>რომელი ასოა <b>„${sel.name}“</b>?</p>
        <div class="prac-row">
          ${opts.map(o => `<button type="button" class="btn sm" data-ans="${o.id}">${o.char}</button>`).join('')}
        </div>
        <p class="prac-msg"></p>
      `;
      box.querySelectorAll('[data-ans]').forEach(b => {
        b.onclick = () => {
          const ok = Number(b.dataset.ans) === sel.id;
          if (LL.audio) LL.audio.play(ok ? 'correct' : 'wrong');
          box.querySelector('.prac-msg').textContent = ok ? `სწორია! ${sel.char} — ${sel.name}` : 'სცადე კიდევ ერთხელ!';
        };
      });
    } else if (mode === 'spell') {
      const masked = '_' + sel.word.slice(1);
      const distractors = letters.filter(x => x.id !== sel.id).sort(() => Math.random() - 0.5).slice(0, 3);
      const opts = [sel, ...distractors].sort(() => Math.random() - 0.5);
      box.innerHTML = `
        <p>ჩასვი გამოტოვებული ასო: <b>${masked}</b></p>
        <div class="prac-row">
          ${opts.map(o => `<button type="button" class="btn sm" data-ans="${o.char}">${o.char}</button>`).join('')}
        </div>
        <p class="prac-msg"></p>
      `;
      box.querySelectorAll('[data-ans]').forEach(b => {
        b.onclick = () => {
          const ok = b.dataset.ans === sel.char;
          if (LL.audio) LL.audio.play(ok ? 'correct' : 'wrong');
          box.querySelector('.prac-msg').textContent = ok ? `ყოჩაღ! ${sel.word}` : 'კიდევ სცადე!';
        };
      });
    } else if (mode === 'build') {
      const chars = sel.word.split('');
      const shuffled = [...chars].sort(() => Math.random() - 0.5);
      let built = '';
      box.innerHTML = `
        <p>ააწყვე სიტყვა: <b class="built-word">${'_ '.repeat(chars.length)}</b></p>
        <div class="prac-row">
          ${shuffled.map((c, idx) => `<button type="button" class="btn sm" data-idx="${idx}" data-ch="${c}">${c}</button>`).join('')}
          <button type="button" class="btn alt sm" id="resetBuild">↻</button>
        </div>
        <p class="prac-msg"></p>
      `;
      box.querySelectorAll('[data-ch]').forEach(b => {
        b.onclick = () => {
          if (LL.audio) LL.audio.play('click');
          built += b.dataset.ch;
          b.disabled = true;
          box.querySelector('.built-word').textContent = built;
          if (built === sel.word) {
            if (LL.audio) LL.audio.play('win');
            box.querySelector('.prac-msg').textContent = `ბრავო! „${sel.word}“ აწყობილია!`;
          }
        };
      });
      box.querySelector('#resetBuild').onclick = () => this.renderPractice(box, sel, letters, 'build');
    }
  }
};