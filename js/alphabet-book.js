/* Interactive 33-Letter Alphabet Book Modal.
 * Accessible from BOTH navigation bar and active gameplay HUD without resetting game state.
 */
LL.alphabetBook = {
  el: null,
  tab: 'letters',
  selectedId: 1,
  practiceMode: null,

  ensureDOM() {
    if (this.el) return this.el;
    const dlg = document.createElement('dialog');
    dlg.id = 'bookDlg';
    dlg.className = 'book-dialog';
    dlg.innerHTML = `
      <div class="panel book-panel">
        <div class="book-head">
          <h2>დედა ენა — ანბანის წიგნი (<span id="bookCount">0/33</span>)</h2>
          <button type="button" class="btn alt" id="closeBookBtn">დახურვა ✕</button>
        </div>
        <div class="book-tabs">
          <button type="button" class="btn" data-btab="letters">33 ასო</button>
          <button type="button" class="btn alt" data-btab="discoveries">აღმოჩენები</button>
          <button type="button" class="btn alt" data-btab="achievements">მიღწევები</button>
        </div>
        <div id="bookBody" class="book-body"></div>
      </div>
    `;
    document.body.appendChild(dlg);
    dlg.querySelector('#closeBookBtn').onclick = () => this.close();
    dlg.addEventListener('close', () => {
      if (LL.engine && LL.engine.resumeFromOverlay) LL.engine.resumeFromOverlay();
    });
    dlg.querySelectorAll('[data-btab]').forEach(btn => {
      btn.onclick = () => {
        LL.audio.play('book');
        this.tab = btn.dataset.btab;
        this.practiceMode = null;
        this.render();
      };
    });
    this.el = dlg;
    return dlg;
  },

  async open(initialLetterId = null) {
    if (LL.engine && LL.engine.pauseForOverlay) LL.engine.pauseForOverlay();
    LL.audio.play('book');
    const dlg = this.ensureDOM();
    if (initialLetterId) {
      this.tab = 'letters';
      this.selectedId = initialLetterId;
    }
    await this.render();
    if (!dlg.open) dlg.showModal();
  },

  close() {
    if (this.el && this.el.open) this.el.close();
  },

  async render() {
    const dlg = this.ensureDOM();
    const state = await LL.progress.getState();
    const letters = await LL.loadAlphabet();
    const unlockedSet = new Set(state.letters || []);

    dlg.querySelector('#bookCount').textContent = `${unlockedSet.size}/33`;
    dlg.querySelectorAll('[data-btab]').forEach(b => {
      b.className = b.dataset.btab === this.tab ? 'btn' : 'btn alt';
    });

    const body = dlg.querySelector('#bookBody');

    if (this.tab === 'letters') {
      const sel = letters.find(l => l.id === this.selectedId) || letters[0];
      const isOpen = unlockedSet.has(sel.id);
      const lvl = LL.levelsData.find(w => w.n === sel.world);

      body.innerHTML = `
        <div class="book-layout">
          <div class="letter-grid" role="list">
            ${letters.map(l => {
              const got = unlockedSet.has(l.id);
              const active = l.id === sel.id ? ' active' : '';
              return `<button type="button" class="letter-tile ${got ? 'got' : 'locked'}${active}" data-lid="${l.id}">
                <span class="ch">${got ? l.char : '?'}</span>
                <small>${l.id}</small>
              </button>`;
            }).join('')}
          </div>
          <div class="letter-detail">
            ${isOpen ? `
              <div class="ld-top">
                <div class="ld-glyph">${sel.char}</div>
                <div>
                  <h3>${sel.char} — ${sel.name}</h3>
                  <p class="note">${sel.pronunciation}</p>
                  <button type="button" class="btn" id="playLetterAudio">🔊 გამოთქმის მოსმენა</button>
                  <p id="audioNotice" class="note"></p>
                </div>
              </div>
              <div class="ld-card">
                <p><b>მაგალითი:</b> ${sel.word} (${sel.syllables})</p>
                <p><b>განმარტება:</b> ${sel.hint}</p>
                <p><b>კუთხე:</b> ${lvl ? `${lvl.n}. ${lvl.region} — ${lvl.title}` : ''}</p>
              </div>
              <div class="ld-practice">
                <button type="button" class="btn alt" id="btnRecog">ამოცნობა</button>
                <button type="button" class="btn alt" id="btnSpell">მართლწერა</button>
                <button type="button" class="btn alt" id="btnBuild">სიტყვის აწყობა</button>
                <div id="practiceBox"></div>
              </div>
            ` : `
              <div class="ld-locked">
                <div class="ld-glyph locked">🔒</div>
                <h3>ასო #${sel.id} ჯერ დაკეტილია</h3>
                <p>იპოვე ეს ასო მე-${sel.world} დონეზე: <b>${lvl ? `${lvl.region} — ${lvl.title}` : ''}</b></p>
              </div>
            `}
          </div>
        </div>
      `;

      body.querySelectorAll('[data-lid]').forEach(btn => {
        btn.onclick = () => {
          LL.audio.play('click');
          this.selectedId = Number(btn.dataset.lid);
          this.practiceMode = null;
          this.render();
        };
      });

      if (isOpen) {
        const audioBtn = body.querySelector('#playLetterAudio');
        audioBtn.onclick = () => {
          LL.audio.playLetter(sel, () => {
            body.querySelector('#audioNotice').textContent = `ხმოვანი ფაილი (${sel.audio}) მზადაა ჩასაწერად — იხილეთ წარმოთქმა ზემოთ.`;
          });
        };
        body.querySelector('#btnRecog').onclick = () => this.renderPractice(body.querySelector('#practiceBox'), sel, letters, 'recog');
        body.querySelector('#btnSpell').onclick = () => this.renderPractice(body.querySelector('#practiceBox'), sel, letters, 'spell');
        body.querySelector('#btnBuild').onclick = () => this.renderPractice(body.querySelector('#practiceBox'), sel, letters, 'build');
      }
      return;
    }

    if (this.tab === 'discoveries') {
      const completed = state.levels_completed || 0;
      body.innerHTML = `
        <div class="disc-list">
          ${LL.achievements.discoveriesCatalog.map((d, idx) => {
            const unlocked = completed >= idx + 1;
            return `<div class="disc-item ${unlocked ? 'got' : 'locked'}">
              <b>${unlocked ? '📜' : '🔒'} ${d.region} — ${d.title}</b>
              <p>${unlocked ? d.text : 'გაიარე შესაბამისი კუთხე ამ აღმოჩენის გასახსნელად.'}</p>
            </div>`;
          }).join('')}
        </div>
      `;
      return;
    }

    if (this.tab === 'achievements') {
      const gotSet = new Set(state.achievements || []);
      body.innerHTML = `
        <div class="disc-list">
          ${LL.achievements.catalog.map(a => {
            const ok = gotSet.has(a.id);
            return `<div class="disc-item ${ok ? 'got' : 'locked'}">
              <b>${ok ? '🏆' : '🔒'} ${a.title}</b>
              <p>${a.desc}</p>
            </div>`;
          }).join('')}
        </div>
      `;
    }
  },

  renderPractice(box, sel, letters, mode) {
    LL.audio.play('click');
    if (mode === 'recog') {
      const distractors = letters.filter(x => x.id !== sel.id).sort(() => Math.random() - 0.5).slice(0, 3);
      const opts = [sel, ...distractors].sort(() => Math.random() - 0.5);
      box.innerHTML = `
        <p>რომელი ასოა <b>„${sel.name}“</b>?</p>
        <div class="prac-row">
          ${opts.map(o => `<button type="button" class="btn" data-ans="${o.id}">${o.char}</button>`).join('')}
        </div>
        <p class="prac-msg"></p>
      `;
      box.querySelectorAll('[data-ans]').forEach(b => {
        b.onclick = () => {
          const ok = Number(b.dataset.ans) === sel.id;
          LL.audio.play(ok ? 'collect' : 'wrong');
          box.querySelector('.prac-msg').textContent = ok ? `სწორია! ${sel.char} — ${sel.name}` : 'სცადე კიდევ ერთხელ!';
        };
      });
    } else if (mode === 'spell') {
      const masked = '_' + sel.word.slice(1);
      const distractors = letters.filter(x => x.id !== sel.id).sort(() => Math.random() - 0.5).slice(0, 3);
      const opts = [sel, ...distractors].sort(() => Math.random() - 0.5);
      box.innerHTML = `
        <p>შეავსე გამოტოვებული ასო: <b>${masked}</b> (${sel.hint})</p>
        <div class="prac-row">
          ${opts.map(o => `<button type="button" class="btn" data-ans="${o.char}">${o.char}</button>`).join('')}
        </div>
        <p class="prac-msg"></p>
      `;
      box.querySelectorAll('[data-ans]').forEach(b => {
        b.onclick = () => {
          const ok = b.dataset.ans === sel.char;
          LL.audio.play(ok ? 'collect' : 'wrong');
          box.querySelector('.prac-msg').textContent = ok ? `ყოჩაღ! სრული სიტყვაა: ${sel.word}` : 'კიდევ სცადე!';
        };
      });
    } else if (mode === 'build') {
      const chars = sel.word.split('');
      const shuffled = [...chars].sort(() => Math.random() - 0.5);
      let built = '';
      box.innerHTML = `
        <p>ააწყვე სიტყვა: <b>${sel.hint}</b></p>
        <p class="built-word">_ _ _</p>
        <div class="prac-row">
          ${shuffled.map((c, idx) => `<button type="button" class="btn" data-idx="${idx}" data-ch="${c}">${c}</button>`).join('')}
          <button type="button" class="btn alt" id="resetBuild">თავიდან</button>
        </div>
        <p class="prac-msg"></p>
      `;
      const updateBuilt = () => {
        box.querySelector('.built-word').textContent = built || '...';
        if (built === sel.word) {
          LL.audio.play('win');
          box.querySelector('.prac-msg').textContent = `ბრავო! სიტყვა „${sel.word}“ აწყობილია!`;
        }
      };
      box.querySelectorAll('[data-ch]').forEach(b => {
        b.onclick = () => {
          LL.audio.play('click');
          built += b.dataset.ch;
          b.disabled = true;
          updateBuilt();
        };
      });
      box.querySelector('#resetBuild').onclick = () => this.renderPractice(box, sel, letters, 'build');
    }
  }
};