/* Centralized Asset Manifest & Preloader.
 * Includes girl_character_sheet.png and excludes unused ambient Foley files.
 */
LL.assets = {
  base: 'assets/',
  manifest: {
    home: 'backgrounds/home_hero.png',
    map: 'backgrounds/map_georgia.png',

    library: {
      main: 'library/main_library.png',
      desk: 'library/iakob_desk.png',
      stolen: 'library/stolen_library.png',
      restored: 'library/restored_library.png'
    },

    items: {
      bag: 'items/asotsqlapia_bag.png',
      book: 'items/magic_book.png',
      letter: 'items/collectible_letter.png',
      chest: 'items/treasure_chest.png',
      scroll: 'items/clue_scroll.png',
      key: 'items/magic_key.png'
    },

    minigames: {
      puzzle: 'minigames/puzzle_board.png',
      memory: 'minigames/memory_card.png',
      maze: 'minigames/maze_tile.png',
      hidden: 'minigames/hidden_objects.png'
    },

    videos: {
      village_intro: 'videos/village_intro.mp4',
      iakob_mystery: 'videos/iakob_mystery.mp4',
      asotsqlapia_steal: 'videos/asotsqlapia_steal.mp4',
      victory_rescue: 'videos/victory_rescue.mp4',
      final_ending: 'videos/final_ending.mp4'
    },

    audio: {
      music: {
        main: 'audio/music/main_theme.mp3',
        library: 'audio/music/library_theme.mp3',
        map: 'audio/music/map_theme.mp3',
        level: 'audio/music/level_theme.mp3',
        forest: 'audio/music/forest_theme.mp3',
        mountain: 'audio/music/mountain_theme.mp3',
        boss: 'audio/music/boss_theme.mp3',
        ending: 'audio/music/ending_theme.mp3'
      },
      sfx: {
        click: 'audio/sfx/button.mp3',
        collect: 'audio/sfx/collect.mp3',
        correct: 'audio/sfx/correct.mp3',
        wrong: 'audio/sfx/wrong.mp3',
        book: 'audio/sfx/book_open.mp3',
        unlock: 'audio/sfx/level_unlock.mp3',
        win: 'audio/sfx/level_complete.mp3'
      }
    },

    scenes: {
      kakheti: { sky: 'backgrounds/kakheti_sky.png', far: 'backgrounds/kakheti_far.png', mid: 'backgrounds/kakheti_mid.png', fore: 'backgrounds/kakheti_fore.png' },
      tbilisi: { sky: 'environments/tbilisi_sky.png', far: 'environments/tbilisi_far.png', mid: 'environments/tbilisi_mid.png', fore: 'environments/tbilisi_fore.png' },
      borjomi: { sky: 'environments/borjomi_sky.png', far: 'environments/borjomi_far.png', mid: 'environments/borjomi_mid.png', fore: 'environments/borjomi_fore.png' },
      mtskheta: { sky: 'environments/Mtskheta_sky.png', far: 'environments/Mtskheta_far.png', mid: 'environments/Mtskheta_mid.png', fore: 'environments/Mtskheta_fore.png' },
      vardzia: { sky: 'environments/vardzia_sky.png', far: 'environments/vardzia_far.png', mid: 'environments/vardzia_mid.png', fore: 'environments/vardzia_fore.png' },
      racha: { sky: 'environments/racha_sky.png', far: 'environments/racha_far.png', mid: 'environments/racha_mid.png', fore: 'environments/racha_fore.png' },
      tusheti: { sky: 'environments/tusheti_sky.png', far: 'environments/tusheti_far.png', mid: 'environments/tusheti_mid.png', fore: 'environments/tusheti_fore.png' },
      svaneti: { sky: 'environments/svaneti_sky.png', far: 'environments/svaneti_far.png', mid: 'environments/svaneti_mid.png', fore: 'environments/svaneti_fore.png' },
      adjara: { sky: 'environments/adjara_sky.png', far: 'environments/adjara_far.png', mid: 'environments/adjara_mid.png', fore: 'environments/adjara_fore.png' },
      javakheti: { sky: 'environments/javakheti_sky.png', far: 'environments/javakheti_far.png', mid: 'environments/javakheti_mid.png', fore: 'environments/javakheti_fore.png' },
      fortress: { sky: 'environments/final_fortress_sky.png', far: 'environments/final_fortress_far.png', mid: 'environments/final_fortress_mid.png', fore: 'environments/final_fortress_fore.png' }
    },

    sheets: {
      player: { src: 'characters/player_sheet.png', fw: 64, fh: 64 },
      girl: { src: 'characters/girl_character_sheet.png', fw: 64, fh: 64 },
      iakob: { src: 'characters/iakob_sheet.png', fw: 64, fh: 64 },
      monster: { src: 'characters/asotsqlapia_sheet.png', fw: 64, fh: 64 }
    }
  },

  cache: {},
  videoStatus: {},
  pending: new Set(),

  url(rel) {
    return rel ? this.base + rel : '';
  },

  load(rel) {
    if (!rel) return Promise.resolve(null);
    if (!this.cache[rel]) {
      this.cache[rel] = new Promise(res => {
        const i = new Image();
        i.onload = () => res(i);
        i.onerror = () => {
          this.pending.add(rel);
          res(null);
        };
        i.src = this.base + rel;
      });
    }
    return this.cache[rel];
  },

  async checkVideo(key) {
    const rel = this.manifest.videos[key];
    if (!rel) return null;
    if (rel in this.videoStatus) return this.videoStatus[rel] ? this.base + rel : null;
    try {
      const resp = await fetch(this.base + rel, { method: 'HEAD' });
      this.videoStatus[rel] = resp.ok;
      return resp.ok ? this.base + rel : null;
    } catch (_) {
      this.videoStatus[rel] = false;
      return null;
    }
  },

  async preloadScene(sceneId) {
    const m = this.manifest.scenes[sceneId];
    if (!m) return null;
    const [sky, far, mid, fore] = await Promise.all([
      this.load(m.sky), this.load(m.far), this.load(m.mid), this.load(m.fore)
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