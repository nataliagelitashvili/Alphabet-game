/* Central asset manager. ALL image paths live in this manifest. */
LL.assets = {
  base: 'assets/',
  manifest: {
    home: 'backgrounds/home_hero.png',
    map: 'backgrounds/map_georgia.png',
    scenes: {
      kakheti: {
        sky: 'backgrounds/kakheti_sky.png',
        far: 'backgrounds/kakheti_far.png',
        mid: 'backgrounds/kakheti_mid.png',
        fore: 'backgrounds/kakheti_fore.png'
      },
      tbilisi: {
        sky: 'environments/tbilisi_sky.png',
        far: 'environments/tbilisi_far.png',
        mid: 'environments/tbilisi_mid.png',
        fore: 'environments/tbilisi_fore.png'
      },
      borjomi: {
        sky: 'environments/borjomi_sky.png',
        far: 'environments/borjomi_far.png',
        mid: 'environments/borjomi_mid.png',
        fore: 'environments/borjomi_fore.png'
      },
      mtskheta: {
        sky: 'environments/Mtskheta_sky.png',
        far: 'environments/Mtskheta_far.png',
        mid: 'environments/Mtskheta_mid.png',
        fore: 'environments/Mtskheta_fore.png'
      },
      vardzia: {
        sky: 'environments/vardzia_sky.png',
        far: 'environments/vardzia_far.png',
        mid: 'environments/vardzia_mid.png',
        fore: 'environments/vardzia_fore.png'
      },
      racha: {
        sky: 'environments/racha_sky.png',
        far: 'environments/racha_far.png',
        mid: 'environments/racha_mid.png',
        fore: 'environments/racha_fore.png'
      },
      tusheti: {
        sky: 'environments/tusheti_sky.png',
        far: 'environments/tusheti_far.png',
        mid: 'environments/tusheti_mid.png',
        fore: 'environments/tusheti_fore.png'
      },
      svaneti: {
        sky: 'environments/svaneti_sky.png',
        far: 'environments/svaneti_far.png',
        mid: 'environments/svaneti_mid.png',
        fore: 'environments/svaneti_fore.png'
      },
      adjara: {
        sky: 'environments/adjara_sky.png',
        far: 'environments/adjara_far.png',
        mid: 'environments/adjara_mid.png',
        fore: 'environments/adjara_fore.png'
      },
      javakheti: {
        sky: 'environments/javakheti_sky.png',
        far: 'environments/javakheti_far.png',
        mid: 'environments/javakheti_mid.png',
        fore: 'environments/javakheti_fore.png'
      },
      fortress: {
        sky: 'environments/final_fortress_sky.png',
        far: 'environments/final_fortress_far.png',
        mid: 'environments/final_fortress_mid.png',
        fore: 'environments/final_fortress_fore.png'
      }
    },
    /* Sprite sheets: 384x512 = 6 columns x 8 rows of 64x64 frames */
    sheets: {
      player: { src: 'characters/player_sheet.png', fw: 64, fh: 64 },
      iakob: { src: 'characters/iakob_sheet.png', fw: 64, fh: 64 },
      monster: { src: 'characters/asotsqlapia_sheet.png', fw: 64, fh: 64 }
    }
  },
  cache: {},
  pending: new Set(),

  load(rel) {
    if (!rel) return Promise.resolve(null);
    if (!this.cache[rel]) {
      this.cache[rel] = new Promise(res => {
        const img = new Image();
        img.onload = () => res(img);
        img.onerror = () => {
          this.pending.add(rel);
          console.warn('[LL.assets] Missing asset:', this.base + rel);
          res(null);
        };
        img.src = this.base + rel;
      });
    }
    return this.cache[rel];
  },

  async preloadScene(sceneId) {
    const m = this.manifest.scenes[sceneId];
    if (!m) return null;
    const [sky, far, mid, fore] = await Promise.all([
      this.load(m.sky),
      this.load(m.far),
      this.load(m.mid),
      this.load(m.fore)
    ]);
    return { sky, far, mid, fore };
  },

  async preloadSheets() {
    const entries = Object.entries(this.manifest.sheets);
    const loaded = {};
    await Promise.all(entries.map(async ([k, v]) => {
      loaded[k] = await this.load(v.src);
    }));
    return loaded;
  },

  async backdrop() {
    const i = await this.load(this.manifest.home);
    if (i) {
      document.body.style.backgroundImage = `linear-gradient(rgba(12,18,38,.45), rgba(18,36,24,.55)), url(${this.base + this.manifest.home})`;
      document.body.style.backgroundSize = 'cover';
      document.body.style.backgroundPosition = 'center';
      document.body.style.backgroundAttachment = 'fixed';
      document.body.style.imageRendering = 'pixelated';
    }
  }
};
LL.assets.backdrop();