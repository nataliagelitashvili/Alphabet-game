/* Interactive Illustrated Atlas of Georgia (map_georgia.png) with all 11 regions,
 * unlocked/completed status, star ratings, collected letter indicators, and level launcher.
 */
LL.map = {
  bounds: { lon: [40, 46.9], lat: [40.9, 43.7] },
  coords: {
    1: { lon: 45.8, lat: 41.9 },
    2: { lon: 44.8, lat: 41.7 },
    3: { lon: 43.4, lat: 41.85 },
    4: { lon: 44.65, lat: 42.05 },
    5: { lon: 43.3, lat: 41.38 },
    6: { lon: 43.5, lat: 42.65 },
    7: { lon: 45.6, lat: 42.5 },
    8: { lon: 42.7, lat: 43.0 },
    9: { lon: 41.8, lat: 41.65 },
    10: { lon: 43.75, lat: 41.4 },
    11: { lon: 45.15, lat: 42.65 }
  },

  pct(n) {
    const c = this.coords[n];
    const b = this.bounds;
    return [
      ((c.lon - b.lon[0]) / (b.lon[1] - b.lon[0])) * 100,
      ((b.lat[1] - c.lat) / (b.lat[1] - b.lat[0])) * 100
    ];
  },

  levelStatus(n, state) {
    if (n <= state.levels_completed) return 'completed';
    if (n === state.levels_completed + 1) return 'available';
    return 'locked';
  },

  async render(el) {
    if (!el) return;
    const [img, state, allLetters] = await Promise.all([
      LL.assets.load(LL.assets.manifest.map),
      LL.progress.getState(),
      LL.loadAlphabet()
    ]);

    if (!img) {
      el.innerHTML = '<div class="pending">საქართველოს რუკის ილუსტრაცია მოსალოდნელია: ' + LL.assets.manifest.map + '</div>';
      return;
    }

    const levels = LL.levelsData;
    const pts = levels.map(l => this.pct(l.n));
    const d = pts.map((p, i) => {
      if (!i) return 'M' + p;
      const q = pts[i - 1], k = i % 2 ? 3 : -3;
      return `Q${(p[0] + q[0]) / 2 + k},${(p[1] + q[1]) / 2 - k} ${p}`;
    }).join(' ');

    const unlockedLetters = new Set(state.letters || []);

    el.innerHTML = `
      <div class="map-summary panel">
        <span>შეგროვებული ასოები: <b>${unlockedLetters.size} / 33</b></span>
        <span>გავლილი კუთხეები: <b>${state.levels_completed} / 11</b></span>
        <button type="button" class="btn alt" id="mapBookBtn">📖 ანბანის წიგნი</button>
      </div>
      <div class="stage" style="aspect-ratio:${img.width}/${img.height}">
        <img src="${LL.assets.base + LL.assets.manifest.map}" alt="საქართველოს რუკა">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none"><path d="${d}" vector-effect="non-scaling-stroke"/></svg>
        ${levels.map((l, i) => {
          const st = this.levelStatus(l.n, state);
          const stars = Number(state.level_stars?.[String(l.n)] || 0);
          return `<button type="button" class="marker ${st}" style="left:${pts[i][0]}%;top:${pts[i][1]}%" data-n="${l.n}" ${st === 'locked' ? 'aria-disabled="true"' : ''}>
            <b>${st === 'completed' ? '✓' : st === 'locked' ? '🔒' : l.n}</b>
            <span>${l.region}</span>
            ${stars ? `<small class="m-stars">${'⭐'.repeat(stars)}</small>` : ''}
          </button>`;
        }).join('')}
      </div>
    `;

    el.querySelector('#mapBookBtn').onclick = () => LL.alphabetBook.open();

    const showInfo = l => {
      const st = this.levelStatus(l.n, state);
      const stars = Number(state.level_stars?.[String(l.n)] || 0);
      const lObjs = l.letters.map(id => allLetters.find(x => x.id === id));
      const lettersStr = lObjs.map(o => unlockedLetters.has(o.id) ? `${o.char} (${o.name})` : o.char).join(', ');

      document.getElementById('locInfo').innerHTML = `
        <div class="loc-card">
          <div>
            <b>${l.n}. ${l.region} — ${l.title}</b> ${stars ? `<span>${'⭐'.repeat(stars)}</span>` : ''}<br>
            <span>${l.desc}</span><br>
            <span class="note">ასოები: <b>${lettersStr}</b> · გამოწვევა: ${l.mechanicLabel}</span>
          </div>
          <div>
            ${st === 'locked'
              ? `<span class="note">🔒 ჯერ გაიარე მე-${l.n - 1} კუთხე</span>`
              : `<button type="button" class="btn big" id="playLvlBtn">${st === 'completed' ? '↻ თავიდან თამაში' : '▶ თამაშის დაწყება'}</button>`}
          </div>
        </div>
      `;
      const playBtn = document.getElementById('playLvlBtn');
      if (playBtn) {
        playBtn.onclick = () => {
          LL.audio.play('click');
          LL.engine.startLevel(l.n);
        };
      }
    };

    el.querySelectorAll('.marker').forEach(m => {
      m.onclick = () => {
        LL.audio.play('click');
        showInfo(levels[Number(m.dataset.n) - 1]);
      };
    });

    // Auto-select the next playable level in the info panel
    const nextN = Math.min(11, state.levels_completed + 1);
    showInfo(levels[nextN - 1]);
  }
};