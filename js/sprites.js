/* Sprite Animator & Boy/Girl Character Switcher.
 * Uses player_sheet.png for Boy and girl_character_sheet.png for Girl (both 6x8 grids).
 */
LL.sprites = {
  COLS: 6,
  ROWS: 8,
  rows: ['idle', 'walk', 'run', 'talk', 'celebrate', 'surprised', 'sad', 'openbag'],
  frames: { idle: 4, walk: 6, run: 6, talk: 4, celebrate: 6, surprised: 3, sad: 4, openbag: 6 },
  processedCache: new WeakMap(),
  customCache: new Map(),

  options: {
    genders: [
      { id: 'boy', label: 'ბიჭი' },
      { id: 'girl', label: 'გოგო' }
    ],
    outfits: [
      { id: 'default', label: 'ორიგინალი სამოსი', rgb: null },
      { id: 'mountain', label: 'მთიულური ლურჯი', rgb: [54, 88, 128] },
      { id: 'forest', label: 'ტყის მწვანე', rgb: [46, 108, 68] },
      { id: 'wine', label: 'კახური შინდისფერი', rgb: [122, 48, 72] }
    ],
    scarves: [
      { id: 'default', label: 'წითელი (ორიგინალი)', rgb: null },
      { id: 'gold', label: 'ოქროსფერი', rgb: [236, 174, 38] },
      { id: 'sky', label: 'ცისფერი', rgb: [58, 156, 218] },
      { id: 'white', label: 'თეთრი', rgb: [238, 238, 242] }
    ]
  },

  defaultAppearance() {
    return { gender: 'boy', outfit: 'default', scarf: 'default' };
  },

  getAppearance() {
    try {
      const raw = JSON.parse(localStorage.getItem('ll_appearance') || 'null');
      return Object.assign(this.defaultAppearance(), raw || {});
    } catch (_) {
      return this.defaultAppearance();
    }
  },

  saveAppearance(next) {
    const clean = Object.assign(this.defaultAppearance(), next);
    localStorage.setItem('ll_appearance', JSON.stringify(clean));
    this.customCache.clear();
    return clean;
  },

  getActiveHeroSheetKey() {
    return this.getAppearance().gender === 'girl' ? 'girl' : 'player';
  },

  appearanceSummary(ap = this.getAppearance()) {
    const g = ap.gender === 'girl' ? 'გოგო' : 'ბიჭი';
    const out = (this.options.outfits.find(x => x.id === ap.outfit) || this.options.outfits[0]).label;
    const sc = (this.options.scarves.find(x => x.id === ap.scarf) || this.options.scarves[0]).label;
    return `${g} · ${out} · ${sc}`;
  },

  prepareSheet(img, appearance = null) {
    if (!img) return null;
    const hasTint = appearance && (appearance.outfit !== 'default' || appearance.scarf !== 'default');
    const key = hasTint ? `${img.src}::${appearance.outfit}::${appearance.scarf}` : img.src;

    if (!hasTint && this.processedCache.has(img)) return this.processedCache.get(img);
    if (hasTint && this.customCache.has(key)) return this.customCache.get(key);

    const rawW = img.naturalWidth || img.width;
    const rawH = img.naturalHeight || img.height;
    if (!rawW || !rawH) return null;

    const cellW = Math.min(128, Math.floor(rawW / this.COLS));
    const cellH = Math.min(128, Math.floor(rawH / this.ROWS));
    const w = cellW * this.COLS;
    const h = cellH * this.ROWS;

    const off = document.createElement('canvas');
    off.width = w;
    off.height = h;
    const ctx = off.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0, w, h);

    try {
      const imgData = ctx.getImageData(0, 0, w, h);
      const data = imgData.data;

      if (data[3] >= 250) {
        const isBgPixel = idx => {
          const r = data[idx], g = data[idx + 1], b = data[idx + 2], a = data[idx + 3];
          if (a === 0) return true;
          const isWhite = r > 235 && g > 235 && b > 235;
          const isGridGrey = Math.abs(r - g) < 12 && Math.abs(g - b) < 12 && r > 165;
          return isWhite || isGridGrey;
        };
        const visited = new Uint8Array(w * h);
        const queue = new Int32Array(w * h);

        for (let row = 0; row < this.ROWS; row++) {
          for (let col = 0; col < this.COLS; col++) {
            const x0 = col * cellW, y0 = row * cellH;
            const x1 = x0 + cellW - 1, y1 = y0 + cellH - 1;
            let head = 0, tail = 0;
            const push = (px, py) => {
              if (px < x0 || px > x1 || py < y0 || py > y1) return;
              const p = py * w + px;
              if (visited[p]) return;
              visited[p] = 1;
              if (isBgPixel(p * 4)) queue[tail++] = p;
            };
            for (let bx = x0; bx <= x1; bx++) { push(bx, y0); push(bx, y1); }
            for (let by = y0; by <= y1; by++) { push(x0, by); push(x1, by); }
            while (head < tail) {
              const p = queue[head++];
              data[p * 4 + 3] = 0;
              const px = p % w, py = (p / w) | 0;
              push(px + 1, py); push(px - 1, py); push(px, py + 1); push(px, py - 1);
            }
          }
        }
      }

      if (hasTint) {
        const outOpt = this.options.outfits.find(x => x.id === appearance.outfit);
        const scOpt = this.options.scarves.find(x => x.id === appearance.scarf);
        const oc = outOpt && outOpt.rgb;
        const sc = scOpt && scOpt.rgb;

        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] < 128) continue;
          const r = data[i], g = data[i + 1], b = data[i + 2];
          if (sc && r > 145 && g < 85 && b < 85) {
            const shade = r / 200;
            data[i] = Math.min(255, Math.round(sc[0] * shade));
            data[i + 1] = Math.min(255, Math.round(sc[1] * shade));
            data[i + 2] = Math.min(255, Math.round(sc[2] * shade));
          } else if (oc && g > r + 8 && b > r + 5 && r < 95 && g < 130) {
            const shade = Math.max(g, b) / 115;
            data[i] = Math.min(255, Math.round(oc[0] * shade));
            data[i + 1] = Math.min(255, Math.round(oc[1] * shade));
            data[i + 2] = Math.min(255, Math.round(oc[2] * shade));
          }
        }
      }

      ctx.putImageData(imgData, 0, 0);
    } catch (_) {}

    const result = { canvas: off, fw: cellW, fh: cellH };
    if (hasTint) this.customCache.set(key, result);
    else this.processedCache.set(img, result);
    return result;
  },

  createActor(sheetKey, anim = 'idle', fps = 8) {
    return {
      sheetKey,
      anim,
      fps,
      timer: 0,
      frame: 0,
      flipX: false,
      setAnim(next) {
        if (this.anim !== next && LL.sprites.frames[next]) {
          this.anim = next;
          this.frame = 0;
          this.timer = 0;
        }
      },
      update(dt) {
        const count = LL.sprites.frames[this.anim] || 1;
        this.timer += dt;
        const step = 1 / this.fps;
        while (this.timer >= step) {
          this.timer -= step;
          this.frame = (this.frame + 1) % count;
        }
      },
      draw(ctx, sheets, x, y, scale = 2) {
        const effectiveKey = this.sheetKey === 'player' ? LL.sprites.getActiveHeroSheetKey() : this.sheetKey;
        const rawImg = sheets && (sheets[effectiveKey] || sheets[this.sheetKey]);
        const ap = this.sheetKey === 'player' ? LL.sprites.getAppearance() : null;
        const sheet = LL.sprites.prepareSheet(rawImg, ap);
        const row = Math.max(0, LL.sprites.rows.indexOf(this.anim));
        const maxFrames = LL.sprites.frames[this.anim] || 1;
        const col = this.frame % maxFrames;
        const targetH = 68 * scale;

        if (!sheet) return;

        const aspect = sheet.fw / sheet.fh;
        const dh = Math.round(targetH);
        const dw = Math.round(dh * aspect);
        const pad = 2;

        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.translate(Math.round(x), Math.round(y));
        if (this.flipX) ctx.scale(-1, 1);
        ctx.drawImage(
          sheet.canvas,
          col * sheet.fw + pad,
          row * sheet.fh + pad,
          Math.max(1, sheet.fw - pad * 2),
          Math.max(1, sheet.fh - pad * 2),
          Math.round(-dw / 2),
          Math.round(-dh),
          dw,
          dh
        );
        ctx.restore();
      }
    };
  },

  async mount() {
    for (const c of document.querySelectorAll('canvas[data-sprite]')) {
      const requestedKey = c.dataset.sprite;
      const effectiveKey = requestedKey === 'player' ? this.getActiveHeroSheetKey() : requestedKey;
      const s = LL.assets.manifest.sheets[effectiveKey] || LL.assets.manifest.sheets[requestedKey];
      const rawImg = s && await LL.assets.load(s.src);
      if (!rawImg) {
        const p = document.createElement('div');
        p.className = 'pending';
        p.textContent = 'ილუსტრაცია მოსალოდნელია: ' + requestedKey;
        c.replaceWith(p);
        continue;
      }

      const ap = requestedKey === 'player' ? this.getAppearance() : null;
      const sheet = this.prepareSheet(rawImg, ap);
      const px = +c.dataset.px || 3;
      const displayH = 64 * px;
      const displayW = Math.round(displayH * (sheet.fw / sheet.fh));

      c.width = sheet.fw;
      c.height = sheet.fh;
      c.style.width = displayW + 'px';
      c.style.height = displayH + 'px';
      c.className = 'sprite';

      const x = c.getContext('2d');
      x.imageSmoothingEnabled = false;
      let f = 0;

      if (c._animTimer) clearInterval(c._animTimer);
      c._animTimer = setInterval(() => {
        const activeAp = requestedKey === 'player' ? this.getAppearance() : null;
        const activeSheet = this.prepareSheet(rawImg, activeAp);
        const curAnim = c.dataset.anim || 'idle';
        const curRow = Math.max(0, this.rows.indexOf(curAnim));
        const curN = this.frames[curAnim] || 4;
        const pad = 2;
        x.clearRect(0, 0, activeSheet.fw, activeSheet.fh);
        x.drawImage(
          activeSheet.canvas,
          (f++ % curN) * activeSheet.fw + pad,
          curRow * activeSheet.fh + pad,
          Math.max(1, activeSheet.fw - pad * 2),
          Math.max(1, activeSheet.fh - pad * 2),
          0, 0, activeSheet.fw, activeSheet.fh
        );
      }, 145);
    }
  }
};