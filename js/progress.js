/* Progress & Persistence Manager.
 * Works seamlessly in local mode (localStorage) AND syncs with Supabase RPC complete_level() when configured.
 */
LL.progress = {
  KEY: 'll_progress_v1',
  cache: null,

  defaultState() {
    return {
      levels_completed: 0,
      letters: [],
      level_stars: {},
      achievements: [],
      discoveries: []
    };
  },

  getLocal() {
    try {
      const raw = JSON.parse(localStorage.getItem(this.KEY) || 'null');
      return Object.assign(this.defaultState(), raw || {});
    } catch (_) {
      return this.defaultState();
    }
  },

  setLocal(state) {
    this.cache = Object.assign(this.defaultState(), state);
    localStorage.setItem(this.KEY, JSON.stringify(this.cache));
    return this.cache;
  },

  async getState(force = false) {
    if (this.cache && !force) return this.cache;
    const local = this.getLocal();
    const u = await LL.auth.user();
    if (!LL.sb || !u) {
      this.cache = local;
      return this.cache;
    }

    const { data, error } = await LL.sb
      .from('progress')
      .select('*')
      .eq('user_id', u.id)
      .maybeSingle();

    if (error || !data) {
      this.cache = local;
      return this.cache;
    }

    // Merge local & cloud non-destructively (never lose collected letters or stars)
    const mergedLetters = Array.from(new Set([...(local.letters || []), ...(data.letters || [])])).sort((a, b) => a - b);
    const mergedCompleted = Math.max(local.levels_completed || 0, data.levels_completed || 0);
    const mergedStars = { ...(local.level_stars || {}), ...(data.level_stars || {}) };
    for (let i = 1; i <= 11; i++) {
      const k = String(i);
      mergedStars[k] = Math.max(Number(local.level_stars?.[k] || 0), Number(data.level_stars?.[k] || 0));
      if (!mergedStars[k]) delete mergedStars[k];
    }

    const merged = {
      levels_completed: mergedCompleted,
      letters: mergedLetters,
      level_stars: mergedStars,
      achievements: Array.from(new Set([...(local.achievements || []), ...(data.achievements || [])])),
      discoveries: Array.from(new Set([...(local.discoveries || []), ...(data.discoveries || [])]))
    };
    return this.setLocal(merged);
  },

  async hasSave() {
    const s = await this.getState();
    return s.levels_completed > 0 || s.letters.length > 0;
  },

  /* Completes a level (1..11), awards exact 3 letters for that level, keeps best star rating,
   * never erases previously collected letters on replay.
   */
  async completeLevel(levelNum, stars = 3) {
    const cur = await this.getState();
    const cleanStars = Math.max(1, Math.min(3, Math.round(stars)));
    const rewardIds = [
      (levelNum - 1) * 3 + 1,
      (levelNum - 1) * 3 + 2,
      (levelNum - 1) * 3 + 3
    ];

    const nextLetters = Array.from(new Set([...cur.letters, ...rewardIds])).sort((a, b) => a - b);
    const nextCompleted = Math.max(cur.levels_completed, levelNum);
    const prevStars = Number(cur.level_stars[String(levelNum)] || 0);
    const nextStars = { ...cur.level_stars, [String(levelNum)]: Math.max(prevStars, cleanStars) };

    const updated = this.setLocal({
      ...cur,
      levels_completed: nextCompleted,
      letters: nextLetters,
      level_stars: nextStars
    });

    // Server-validated RPC update if logged in with Supabase
    const u = await LL.auth.user();
    if (LL.sb && u) {
      const { data, error } = await LL.sb.rpc('complete_level', {
        p_level: levelNum,
        p_stars: cleanStars
      });
      if (!error && data) {
        this.setLocal({
          ...updated,
          levels_completed: Math.max(updated.levels_completed, data.levels_completed || 0),
          letters: Array.from(new Set([...updated.letters, ...(data.letters || [])])).sort((a, b) => a - b),
          level_stars: { ...updated.level_stars, ...(data.level_stars || {}) }
        });
      }
    }

    if (LL.achievements) {
      await LL.achievements.evaluate(this.cache);
    }

    return { state: this.cache, rewardIds };
  },

  async addDiscovery(discoveryId) {
    const cur = await this.getState();
    if (cur.discoveries.includes(discoveryId)) return cur;
    const next = this.setLocal({
      ...cur,
      discoveries: [...cur.discoveries, discoveryId]
    });
    const u = await LL.auth.user();
    if (LL.sb && u) {
      await LL.sb.from('progress').update({ discoveries: next.discoveries }).eq('user_id', u.id);
    }
    return next;
  },

  async saveSettings(settings) {
    const u = await LL.auth.user();
    if (LL.sb && u) {
      await LL.sb.from('progress').update({ settings }).eq('user_id', u.id);
    }
  }
};