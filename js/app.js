/* App bootstrap, Video + Illustrated Library Intro Cutscenes, Character Creator & Settings. */
LL._alphabetCache = null;
LL.loadAlphabet = async () => {
  if (LL._alphabetCache) return LL._alphabetCache;
  try {
    LL._alphabetCache = (await (await fetch('data/alphabet.json')).json()).letters;
    return LL._alphabetCache;
  } catch (e) {
    return 'აბგდევზთიკლმნოპჟრსტუფქღყშჩცძწჭხჯჰ'.split('').map((c, i) => ({
      id: i + 1, char: c, name: c, pronunciation: '', world: Math.floor(i / 3) + 1, word: c, syllables: c, hint: ''
    }));
  }
};

LL.getDifficulty = () => localStorage.getItem('ll_difficulty') || 'normal';
LL.setDifficulty = mode => {
  const valid = ['easy', 'normal', 'challenge'].includes(mode) ? mode : 'normal';
  localStorage.setItem('ll_difficulty', valid);
  return valid;
};

LL.floatLetters = async () => {
  const sky = document.querySelector('.sky');
  if (!sky) return;
  (await LL.loadAlphabet()).forEach((l, i) => {
    const s = document.createElement('span');
    s.textContent = l.char;
    s.style.left = (i * 3.1) % 100 + '%';
    s.style.animationDuration = 14 + (i % 7) * 3 + 's';
    s.style.animationDelay = -(i % 9) * 2 + 's';
    sky.appendChild(s);
  });
};

/* 4-Part Cinematic Intro using your Videos + Library Artwork */
LL.intro = async (goToSetupAfter = true) => {
  const el = document.getElementById('intro');
  if (!el) return;

  if (LL.audio) LL.audio.playMusic('library');

  const [vVillage, vMystery, vSteal, imgVillage, imgMainLib, imgDesk, imgStolen] = await Promise.all([
    LL.assets.checkVideo('village_intro'),
    LL.assets.checkVideo('iakob_mystery'),
    LL.assets.checkVideo('asotsqlapia_steal'),
    LL.assets.load(LL.assets.manifest.home),
    LL.assets.load(LL.assets.manifest.library.main),
    LL.assets.load(LL.assets.manifest.library.desk),
    LL.assets.load(LL.assets.manifest.library.stolen)
  ]);

  const seenBefore = localStorage.getItem('ll_intro_seen') === '1';
  const parts = [
    {
      who: 'მთხრობელი',
      video: vVillage,
      fallbackImg: imgVillage || imgMainLib,
      iakobAnim: 'idle',
      showPortrait: false,
      text: 'მშვიდ ქართულ სოფელში ოქროსფერი ასოები ჰაერში ლივლივებენ და უძველესი ბიბლიოთეკისკენ მიგვიძღვებიან...'
    },
    {
      who: 'იაკობ გოგებაშვილი',
      video: vMystery,
      fallbackImg: imgDesk || imgMainLib,
      iakobAnim: 'openbag',
      showPortrait: true,
      text: 'ბიბლიოთეკაში იაკობ გოგებაშვილი მაგიდასთან ზის, გადაშლილ „დედა ენას“ ფურცლავს... უეცრად უცნაურ ხმას იგებს და მაღლა იხედება!'
    },
    {
      who: 'ასოყლაპია!',
      video: vSteal,
      fallbackImg: imgStolen || imgMainLib,
      iakobAnim: 'surprised',
      showPortrait: false,
      heistAnim: true,
      text: 'მწვანე ასოყლაპია ელვის სისწრაფით შემოვარდა! წიგნებიდან 33-ვე ჯადოსნური ასო ამოფრინდა და მის დიდ ჩანთაში ჩაიმალა!'
    },
    {
      who: 'იაკობ გოგებაშვილი',
      video: null,
      fallbackImg: imgStolen || imgDesk || imgMainLib,
      iakobAnim: 'talk',
      showPortrait: true,
      askHelp: true,
      text: 'მან ასოები მოიპარა! დამეხმარები დაბრუნებაში?'
    }
  ];

  let part = 0;
  el.classList.add('on');

  const finish = () => {
    localStorage.setItem('ll_intro_seen', '1');
    el.classList.remove('on');
    el.innerHTML = '';
    if (goToSetupAfter) LL.openHeroCreator();
  };

  const renderPart = () => {
    const p = parts[part];
    if (LL.audio) LL.audio.play('click');

    const bgSrc = p.fallbackImg ? p.fallbackImg.src : '';
    el.innerHTML = `
      <div class="vn-frame">
        <div class="vn-sidebar">
          <div class="vn-menu-title">პროლოგი</div>
          <div class="vn-menu-item ${part === 0 ? 'active' : ''}">1. ჯადოსნური სოფელი</div>
          <div class="vn-menu-item ${part === 1 ? 'active' : ''}">2. იაკობის აღმოჩენა</div>
          <div class="vn-menu-item ${part === 2 ? 'active' : ''}">3. ასოების გატაცება</div>
          <div class="vn-menu-item ${part === 3 ? 'active' : ''}">4. იაკობის თხოვნა</div>
          ${seenBefore ? `<button type="button" class="btn alt sm" id="vnSkipBtn" style="margin-top:auto">გამოტოვება ⏭</button>` : ''}
        </div>

        <div class="vn-viewport" style="${bgSrc ? `background-image:url('${bgSrc}');background-size:cover;background-position:center;` : ''}">
          ${p.video ? `
            <video class="vn-video" src="${p.video}" autoplay muted playsinline preload="metadata"></video>
          ` : `
            ${p.heistAnim ? `
              <div class="vn-heist-layer">
                <div class="vn-sucked-letters">ა ბ გ დ ე ვ ზ თ ი კ ლ მ ნ ო პ ჟ რ ს ტ უ ფ ქ ღ ყ შ ჩ ც ძ წ ჭ ხ ჯ ჰ</div>
                <div class="vn-monster-dash"><canvas data-sprite="monster" data-anim="run" data-px="3"></canvas></div>
              </div>
            ` : ''}
          `}
          ${p.showPortrait ? `
            <div class="vn-portrait-card">
              <canvas data-sprite="iakob" data-anim="${p.iakobAnim}" data-px="3"></canvas>
            </div>
          ` : ''}
        </div>

        <div class="vn-dialog-box">
          <div class="vn-speaker">${p.who}</div>
          <p class="vn-text">${p.text}</p>
          <div class="vn-actions">
            ${p.askHelp
              ? `<button type="button" class="btn big" id="vnAcceptBtn">კი, დაგეხმარები! ▶</button>`
              : `<button type="button" class="btn" id="vnNextBtn">შემდეგი ▶</button>`}
          </div>
        </div>
      </div>
    `;

    LL.sprites.mount();

    const skip = el.querySelector('#vnSkipBtn');
    if (skip) skip.onclick = finish;

    const next = el.querySelector('#vnNextBtn');
    if (next) next.onclick = () => { part++; renderPart(); };

    const accept = el.querySelector('#vnAcceptBtn');
    if (accept) accept.onclick = finish;
  };

  renderPart();
};

/* Clean Boy/Girl Character Creator & Account Setup */
LL.openHeroCreator = () => {
  let dlg = document.getElementById('heroCreatorDlg');
  if (!dlg) {
    dlg = document.createElement('dialog');
    dlg.id = 'heroCreatorDlg';
    dlg.className = 'hero-creator-dlg';
    document.body.appendChild(dlg);
  }

  let ap = LL.sprites.getAppearance();
  let diff = LL.getDifficulty();

  const renderCreator = () => {
    LL.sprites.saveAppearance(ap);
    const savedNick = localStorage.getItem('ll_nickname') || '';

    dlg.innerHTML = `
      <div class="panel hero-creator-panel">
        <h2>შექმენი შენი გმირი და აირჩიე სირთულე</h2>
        <div class="hc-grid">
          <div class="hc-preview">
            <div class="hc-stage">
              <canvas data-sprite="player" data-anim="celebrate" data-px="3"></canvas>
            </div>
            <p class="hc-style-name">${LL.sprites.appearanceSummary(ap)}</p>
            <div class="hc-gender-row">
              ${LL.sprites.options.genders.map(g => `<button type="button" class="btn sm ${ap.gender === g.id ? '' : 'alt'}" data-gender="${g.id}">${g.label}</button>`).join('')}
            </div>
          </div>

          <form id="heroAccountForm" class="hc-form" novalidate>
            <div class="hc-custom-grid">
              <label>სამოსი
                <select id="selOutfit">
                  ${LL.sprites.options.outfits.map(o => `<option value="${o.id}" ${ap.outfit === o.id ? 'selected' : ''}>${o.label}</option>`).join('')}
                </select>
              </label>
              <label>ყელსახვევი
                <select id="selScarf">
                  ${LL.sprites.options.scarves.map(s => `<option value="${s.id}" ${ap.scarf === s.id ? 'selected' : ''}>${s.label}</option>`).join('')}
                </select>
              </label>
              <label style="grid-column:1/-1">სირთულის დონე
                <select id="selDiff">
                  <option value="easy" ${diff === 'easy' ? 'selected' : ''}>მარტივი (დროის გარეშე + მინიშნებები)</option>
                  <option value="normal" ${diff === 'normal' ? 'selected' : ''}>საშუალო (დაბალანსებული)</option>
                  <option value="challenge" ${diff === 'challenge' ? 'selected' : ''}>რთული (მეტი ასო და სწრაფი დრო)</option>
                </select>
              </label>
            </div>

            <label>გმირის მეტსახელი (სავალდებულო)
              <input name="nickname" required maxlength="20" placeholder="მაგ: ნიკა ან მარიამი" value="${savedNick}">
            </label>
            <label>ელფოსტა (ანგარიშის შესაქმნელად — არასავალდებულო)
              <input name="email" type="email" placeholder="name@example.com">
            </label>
            <label>პაროლი (მინ. 6 სიმბოლო, თუ ელფოსტას უთითებთ)
              <input name="password" type="password" placeholder="••••••">
            </label>
            <p class="err" id="hcErr"></p>
            <div class="actions">
              <button type="submit" class="btn big">მოგზაურობის დაწყება ▶</button>
              <button type="button" class="btn alt" id="hcCloseBtn">დახურვა</button>
            </div>
          </form>
        </div>
      </div>
    `;

    LL.sprites.mount();

    dlg.querySelectorAll('[data-gender]').forEach(b => {
      b.onclick = () => { ap.gender = b.dataset.gender; renderCreator(); };
    });
    dlg.querySelector('#selOutfit').onchange = e => { ap.outfit = e.target.value; renderCreator(); };
    dlg.querySelector('#selScarf').onchange = e => { ap.scarf = e.target.value; renderCreator(); };
    dlg.querySelector('#selDiff').onchange = e => { diff = LL.setDifficulty(e.target.value); };
    dlg.querySelector('#hcCloseBtn').onclick = () => dlg.close();

    dlg.querySelector('#heroAccountForm').onsubmit = async e => {
      e.preventDefault();
      const fd = Object.fromEntries(new FormData(e.target));
      const nick = (fd.nickname || '').trim();
      const errEl = dlg.querySelector('#hcErr');

      if (nick.length < 2 || nick.length > 20) {
        errEl.textContent = 'მეტსახელი უნდა იყოს 2–20 სიმბოლო';
        return;
      }

      localStorage.setItem('ll_nickname', nick);
      LL.sprites.saveAppearance(ap);
      LL.setDifficulty(diff);

      if (fd.email && fd.email.trim()) {
        if (!fd.password || fd.password.length < 6) {
          errEl.textContent = 'პაროლი მინიმუმ 6 სიმბოლო უნდა იყოს';
          return;
        }
        if (LL.sb) {
          const { error } = await LL.sb.auth.signUp({
            email: fd.email.trim(),
            password: fd.password,
            options: { data: { nickname: nick, appearance: ap } }
          });
          if (error) {
            errEl.textContent = 'რეგისტრაციის შეცდომა: ' + error.message;
            return;
          }
        }
      }

      if (LL.audio) LL.audio.play('win');
      location.href = 'game.html';
    };
  };

  renderCreator();
  if (!dlg.open) dlg.showModal();
};

LL.initAuthUI = () => {
  const dlg = document.getElementById('authDlg');
  if (!dlg) return;
  let mode = 'login';
  const set = m => {
    mode = m;
    dlg.querySelector('h2').textContent = m === 'login' ? 'შესვლა' : 'რეგისტრაცია';
    dlg.querySelectorAll('.reg').forEach(e => e.hidden = m === 'login');
    dlg.querySelector('.err').textContent = '';
  };
  document.getElementById('openLogin').onclick = () => { set('login'); dlg.showModal(); };
  document.getElementById('openReg').onclick = () => { LL.openHeroCreator(); };
  dlg.querySelector('.close').onclick = () => dlg.close();
  dlg.querySelector('form').onsubmit = async e => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    const r = await (mode === 'login' ? LL.auth.login(f) : LL.auth.register(f));
    const er = dlg.querySelector('.err');
    if (!r.ok) { er.textContent = r.error; return; }
    if (mode === 'login') location.reload();
  };
};

LL.initSettingsUI = () => {
  const dlg = document.getElementById('setDlg');
  if (!dlg || !LL.audio) return;
  const diff = LL.getDifficulty();
  dlg.querySelector('.panel').innerHTML = `
    <h2>პარამეტრები</h2>
    <label>სირთულის რეჟიმი
      <select id="setDiffMode">
        <option value="easy" ${diff === 'easy' ? 'selected' : ''}>მარტივი (Easy — დროის გარეშე + მეტი მინიშნება)</option>
        <option value="normal" ${diff === 'normal' ? 'selected' : ''}>საშუალო (Normal — დაბალანსებული)</option>
        <option value="challenge" ${diff === 'challenge' ? 'selected' : ''}>რთული (Challenge — მეტი ასო და სწრაფი დრო)</option>
      </select>
    </label>
    <label class="chk-row"><input type="checkbox" id="setMute" ${LL.audio.settings.muted ? 'checked' : ''}> ყველა ხმის გათიშვა (Mute)</label>
    <label class="chk-row"><input type="checkbox" id="setSfx" ${LL.audio.settings.sfx ? 'checked' : ''}> ხმოვანი ეფექტები (SFX)</label>
    <label class="chk-row"><input type="checkbox" id="setMusic" ${LL.audio.settings.music ? 'checked' : ''}> ფონური მუსიკა</label>
    <label>ხმის სიმძლავრე <input type="range" id="setVol" min="0" max="1" step="0.05" value="${LL.audio.settings.volume}"></label>
    <form method="dialog"><button class="btn">შენახვა და დახურვა</button></form>
  `;
  dlg.querySelector('#setDiffMode').onchange = e => LL.setDifficulty(e.target.value);
  dlg.querySelector('#setMute').onchange = e => LL.audio.saveSettings({ muted: e.target.checked });
  dlg.querySelector('#setSfx').onchange = e => LL.audio.saveSettings({ sfx: e.target.checked });
  dlg.querySelector('#setMusic').onchange = e => LL.audio.saveSettings({ music: e.target.checked });
  dlg.querySelector('#setVol').oninput = e => LL.audio.saveSettings({ volume: Number(e.target.value) });
};

LL.initHome = async () => {
  if (LL.audio) LL.audio.playMusic('main');
  LL.initAuthUI();
  LL.initSettingsUI();

  document.getElementById('startBtn').onclick = () => {
    if (LL.audio) LL.audio.play('click');
    LL.intro(true);
  };

  const storyBtn = document.getElementById('storyBtn');
  if (storyBtn) {
    storyBtn.onclick = () => {
      if (LL.audio) LL.audio.play('click');
      LL.intro(false);
    };
  }

  document.getElementById('contBtn').onclick = () => {
    if (LL.audio) LL.audio.play('click');
    location.href = 'game.html';
  };
  document.getElementById('settingsBtn').onclick = () => document.getElementById('setDlg').showModal();
  document.getElementById('contBtn').hidden = !(await LL.progress.hasSave());
};

LL.initProfile = async () => {
  if (LL.audio) LL.audio.playMusic('map');
  const [u, state, letters] = await Promise.all([
    LL.auth.user(),
    LL.progress.getState(true),
    LL.loadAlphabet()
  ]);
  const panel = document.querySelector('main .panel');
  const unlockedSet = new Set(state.letters || []);
  const nick = (u && u.user_metadata?.nickname) || localStorage.getItem('ll_nickname') || 'მოგზაური';
  const diffNames = { easy: 'მარტივი', normal: 'საშუალო', challenge: 'რთული' };
  panel.innerHTML = `
    <canvas data-sprite="player" data-px="3" aria-label="ავატარი"></canvas>
    <h2 id="nick">${nick}</h2>
    <p class="note">${LL.sprites.appearanceSummary()} · სირთულე: <b>${diffNames[LL.getDifficulty()]}</b></p>
    <p>გავლილი კუთხეები: <b>${state.levels_completed} / 11</b></p>
    <p>შეგროვებული ასოები: <b>${unlockedSet.size} / ${letters.length}</b></p>
    <div class="profile-letters">
      ${letters.map(l => `<span class="hud-pill ${unlockedSet.has(l.id) ? 'got' : ''}">${unlockedSet.has(l.id) ? l.char : '?'}</span>`).join('')}
    </div>
    <div class="actions">
      <button type="button" class="btn alt" id="changeCharBtn">🎨 გმირის გარეგნობის შეცვლა</button>
      <button type="button" class="btn" id="profBookBtn">📖 ანბანის წიგნის გახსნა</button>
      ${u ? '<button type="button" class="btn alt" id="logoutBtn">გამოსვლა</button>' : ''}
    </div>
  `;
  LL.sprites.mount();
  panel.querySelector('#changeCharBtn').onclick = () => LL.openHeroCreator();
  panel.querySelector('#profBookBtn').onclick = () => LL.alphabetBook.open();
  const lo = panel.querySelector('#logoutBtn');
  if (lo) lo.onclick = async () => { await LL.auth.logout(); location.href = 'index.html'; };
};

LL.init = page => {
  LL.renderNav(page);
  LL.sprites.mount();
  LL.floatLetters();
  if (page === 'home') LL.initHome();
  if (page === 'profile') LL.initProfile();
  if (page === 'map') {
    if (LL.audio) LL.audio.playMusic('map');
    LL.map.render(document.getElementById('mapBox'));
  }
};