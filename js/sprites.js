/* Sprite-sheet animator & canvas drawer (fast downscaled sheet prep + 6x8 grid). */
LL.sprites = {
  COLS: 6,
  ROWS: 8,
  rows: ['idle', 'walk', 'run', 'talk', 'celebrate', 'surprised', 'sad', 'openbag'],
  frames: {
    idle: 4,
    walk: 6,
    run: 6,
    talk: 4,
    celebrate: 6,
    surprised: 3,
    sad: 4,
    openbag: 6
  },
  processedCache: new WeakMap(),

  prepareSheet(img) {
    if (!img) return null;
    if (this.processedCache.has(img)) return this.processedCache.get(img);

    const rawW = img.naturalWidth || img.width;
    const rawH = img.naturalHeight || img.height;
    if (!rawW || !rawH) return null;

    // Cap cell size to 128x128 so 4MB HD sheets process in <5ms instead of freezing
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

      // Only key out background if top-left corner is opaque (JPG or white-backed PNG)
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
            const x0 = col * cellW;
            const y0 = row * cellH;
            const x1 = x0 + cellW - 1;
            const y1 = y0 + cellH - 1;
            let head = 0, tail = 0;

            const push = (px, py) => {
              if (px < x0 || px > x1 || py < y0 || py > y1) return;
              const p = py * w + px;
              if (visited[p]) return;
              visited[p] = 1;
              if (isBgPixel(p * 4)) queue[tail++] = p;
            };

            for (let bx = x0; bx <= x1; bx++) {
              push(bx, y0);
              push(bx, y1);
            }
            for (let by = y0; by <= y1; by++) {
              push(x0, by);
              push(x1, by);
            }

            while (head < tail) {
              const p = queue[head++];
              data[p * 4 + 3] = 0;
              const px = p % w;
              const py = (p / w) | 0;
              push(px + 1, py);
              push(px - 1, py);
              push(px, py + 1);
              push(px, py - 1);
            }
          }
        }
        ctx.putImageData(imgData, 0, 0);
      }
    } catch (_) {}

    const result = { canvas: off, fw: cellW, fh: cellH };
    this.processedCache.set(img, result);
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
        const rawImg = sheets && sheets[this.sheetKey];
        const sheet = LL.sprites.prepareSheet(rawImg);
        const row = Math.max(0, LL.sprites.rows.indexOf(this.anim));
        const maxFrames = LL.sprites.frames[this.anim] || 1;
        const col = this.frame % maxFrames;
        const targetH = 68 * scale;

        if (!sheet) {
          ctx.save();
          ctx.fillStyle = '#f2b632';
          ctx.fillRect(Math.round(x - targetH * 0.35), Math.round(y - targetH), Math.round(targetH * 0.7), Math.round(targetH));
          ctx.restore();
          return;
        }

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
      const s = LL.assets.manifest.sheets[c.dataset.sprite];
      const rawImg = s && await LL.assets.load(s.src);
      if (!rawImg) {
        const p = document.createElement('div');
        p.className = 'pending';
        p.textContent = 'ილუსტრაცია მოსალოდნელია: ' + c.dataset.sprite;
        c.replaceWith(p);
        continue;
      }

      const sheet = this.prepareSheet(rawImg);
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
        const curAnim = c.dataset.anim || 'idle';
        const curRow = Math.max(0, this.rows.indexOf(curAnim));
        const curN = this.frames[curAnim] || 4;
        const pad = 2;
        x.clearRect(0, 0, sheet.fw, sheet.fh);
        x.drawImage(
          sheet.canvas,
          (f++ % curN) * sheet.fw + pad,
          curRow * sheet.fh + pad,
          Math.max(1, sheet.fw - pad * 2),
          Math.max(1, sheet.fh - pad * 2),
          0, 0, sheet.fw, sheet.fh
        );
      }, 145);
    }
  }
};