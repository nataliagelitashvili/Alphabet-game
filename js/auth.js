/* Auth: validation + Supabase calls with double-submit guard & friendly Georgian rate-limit handling. */
LL.auth = {
  busy: false,
  msg: {
    email: 'შეიყვანეთ სწორი ელფოსტა',
    pass: 'პაროლი მინიმუმ 6 სიმბოლო უნდა იყოს',
    match: 'პაროლები არ ემთხვევა',
    nick: 'მეტსახელი 2–20 სიმბოლოა',
    cfg: 'Supabase ჯერ არ არის გამართული (იხილეთ README)',
    rateLimit: 'ძალიან ბევრი მცდელობაა (429). სცადეთ 15 წუთში ან გამორთეთ Confirm Email Supabase-ში.',
    fail: 'ოპერაცია ვერ შესრულდა: '
  },

  validate(v, register) {
    if (!/^\S+@\S+\.\S+$/.test((v.email || '').trim())) return this.msg.email;
    if ((v.password || '').length < 6) return this.msg.pass;
    if (register) {
      if (v.confirm !== undefined && v.password !== v.confirm) return this.msg.match;
      const nick = (v.nickname || '').trim();
      if (nick.length < 2 || nick.length > 20) return this.msg.nick;
    }
    return null;
  },

  formatError(error) {
    if (!error) return this.msg.fail;
    const m = (error.message || '').toLowerCase();
    if (error.status === 429 || m.includes('rate limit') || m.includes('too many')) {
      return this.msg.rateLimit;
    }
    if (m.includes('already registered') || m.includes('already been registered')) {
      return 'ეს ელფოსტა უკვე რეგისტრირებულია — სცადეთ შესვლა.';
    }
    return this.msg.fail + error.message;
  },

  async register(v) {
    if (this.busy) return { ok: false, error: 'იგზავნება, გთხოვთ დაიცადოთ...' };
    const e = this.validate(v, true);
    if (e) return { ok: false, error: e };
    if (!LL.sb) return { ok: false, error: this.msg.cfg };

    this.busy = true;
    try {
      const nick = v.nickname.trim();
      const appearance = v.appearance || (LL.sprites && LL.sprites.getAppearance ? LL.sprites.getAppearance() : undefined);
      const { data, error } = await LL.sb.auth.signUp({
        email: v.email.trim(),
        password: v.password,
        options: { data: { nickname: nick, appearance } }
      });
      if (error) return { ok: false, error: this.formatError(error), status: error.status };
      localStorage.setItem('ll_nickname', nick);
      return { ok: true, session: data && data.session };
    } finally {
      this.busy = false;
    }
  },

  async login(v) {
    if (this.busy) return { ok: false, error: 'იგზავნება, გთხოვთ დაიცადოთ...' };
    const e = this.validate(v, false);
    if (e) return { ok: false, error: e };
    if (!LL.sb) return { ok: false, error: this.msg.cfg };

    this.busy = true;
    try {
      const { error } = await LL.sb.auth.signInWithPassword({
        email: v.email.trim(),
        password: v.password
      });
      return error ? { ok: false, error: this.formatError(error) } : { ok: true };
    } finally {
      this.busy = false;
    }
  },

  async logout() {
    if (LL.sb) await LL.sb.auth.signOut();
  },

  async user() {
    if (!LL.sb) return null;
    const { data } = await LL.sb.auth.getUser().catch(() => ({ data: {} }));
    return (data && data.user) || null;
  }
};