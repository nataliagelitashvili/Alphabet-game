/* App bootstrap. Every page calls LL.init(pageId). */
LL.story = [
  { who: 'იაკობ გოგებაშვილი', t: 'გამარჯობა, მოგზაურო! ეს არის ჩემი წიგნი „დედა ენა“. მშვიდ ქართულ ბიბლიოთეკაში ანბანის 33 ასო ცხოვრობს.' },
  { who: 'იაკობ გოგებაშვილი', t: 'უჰ! ასოყლაპია ბიბლიოთეკაში შემოძვრა, ყველა 33 ასო მოიპარა და თავის დიდ ტყავის ჩანთაში ჩააწყო!' },
  { who: 'ასოყლაპია', t: 'ხი-ხი-ხი! ეს ლამაზი ასოები ახლა ჩემს ჩანთაშია!' },
  { who: 'იაკობ გოგებაშვილი', t: 'დამეხმარე! საქართველოს 11 კუთხეში უნდა ვიმოგზაუროთ და თითოეულ კუთხეში 3-3 ასო დავიბრუნოთ.' }
];

LL._alphabetCache = null;
LL.loadAlphabet = async () => {
  if (LL._alphabetCache) return LL._alphabetCache;
  try {
    LL._alphabetCache = (await (await fetch('data/alphabet.json')).json()).letters;
    return LL._alphabetCache;
  } catch (e) {
    return 'აბგდევზთიკლმნოპჟრსტუფქღყშჩცძწჭხჯჰ'.split('').map((c, i) => ({
      id: i + 1,
      char: c,
      name: c,
      pronunciation: '',
      world: Math.floor(i / 3) + 1,
      word: c,
      syllables: c,
      hint: ''
    }));
  }
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

LL.intro = (goToMapAfter = true) => {
  const el = document.getElementById('intro');
  if (!el) return;
  let i = 0;
  el.classList.add('on');
  const monsterBox = el.querySelector('.monster');
  if (monsterBox) monsterBox.classList.remove('run');

  const finish = () => {
    el.classList.remove('on');
    localStorage.setItem('ll_intro', '1');
    if (goToMapAfter) location.href = 'game.html';
  };

  const say = () => {
    const s = LL.story[i];
    el.querySelector('.who').textContent = s.who;
    el.querySelector('.txt').textContent = s.t;
    if (monsterBox) monsterBox.classList.toggle('run', i >= 2);
  };

  el.querySelector('.next').onclick = () => {
    if (LL.audio && LL.audio.play) LL.audio.play('click');
    i++;
    if (i < LL.story.length) say();
    else finish();
  };
  el.querySelector('.skip').onclick = finish;
  say();
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
  document.getElementById('openReg').onclick = () => { set('register'); dlg.showModal(); };
  dlg.querySelector('.close').onclick = () => dlg.close();
  dlg.querySelector('form').onsubmit = async e => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    const r = await (mode === 'login' ? LL.auth.login(f) : LL.auth.register(f));
    const er = dlg.querySelector('.err');
    if (!r.ok) { er.textContent = r.error; return; }
    er.textContent = mode === 'register' ? 'შეამოწმეთ ელფოსტა დასადასტურებლად' : '';
    if (mode === 'login') location.reload();
  };
};

LL.initSettingsUI = () => {
  const dlg = document.getElementById('setDlg');
  if (!dlg || !LL.audio) return;
  dlg.querySelector('.panel').innerHTML = `
    <h2>პარამეტრები</h2>
    <label class="chk-row"><input type="checkbox" id="setSfx" ${LL.audio.settings.sfx ? 'checked' : ''}> ხმოვანი ეფექტები (SFX)</label>
    <label class="chk-row"><input type="checkbox" id="setMusic" ${LL.audio.settings.music ? 'checked' : ''}> ფონური მუსიკა</label>
    <label>ხმის სიმძლავრე <input type="range" id="setVol" min="0" max="1" step="0.1" value="${LL.audio.settings.volume}"></label>
    <form method="dialog"><button class="btn">შენახვა და დახურვა</button></form>
  `;
  dlg.querySelector('#setSfx').onchange = e => LL.audio.saveSettings({ sfx: e.target.checked });
  dlg.querySelector('#setMusic').onchange = e => {
    LL.audio.saveSettings({ music: e.target.checked });
    if (e.target.checked) LL.audio.startMusic();
  };
  dlg.querySelector('#setVol').oninput = e => LL.audio.saveSettings({ volume: Number(e.target.value) });
};

LL.initHome = async () => {
  LL.initAuthUI();
  LL.initSettingsUI();

  document.getElementById('startBtn').onclick = () => {
    if (LL.audio && LL.audio.play) LL.audio.play('click');
    LL.intro(true);
  };

  const storyBtn = document.getElementById('storyBtn');
  if (storyBtn) {
    storyBtn.onclick = () => {
      if (LL.audio && LL.audio.play) LL.audio.play('click');
      LL.intro(false);
    };
  }

  document.getElementById('contBtn').onclick = () => {
    if (LL.audio && LL.audio.play) LL.audio.play('click');
    location.href = 'game.html';
  };
  document.getElementById('settingsBtn').onclick = () => document.getElementById('setDlg').showModal();
  document.getElementById('contBtn').hidden = !(await LL.progress.hasSave());
};

LL.initProfile = async () => {
  const [u, state, letters] = await Promise.all([
    LL.auth.user(),
    LL.progress.getState(true),
    LL.loadAlphabet()
  ]);
  const panel = document.querySelector('main .panel');
  const unlockedSet = new Set(state.letters || []);
  panel.innerHTML = `
    <canvas data-sprite="player" data-px="3" aria-label="ავატარი"></canvas>
    <h2 id="nick">${u ? (u.user_metadata.nickname || u.email) : 'სტუმარი'}</h2>
    <p class="note">${u ? 'სინქრონიზებული პროფილი' : 'ლოკალური პროგრესი შენახულია ბრაუზერში'}</p>
    <p>გავლილი კუთხეები: <b>${state.levels_completed} / 11</b></p>
    <p>შეგროვებული ასოები: <b>${unlockedSet.size} / ${letters.length}</b></p>
    <div class="profile-letters">
      ${letters.map(l => `<span class="hud-pill ${unlockedSet.has(l.id) ? 'got' : ''}">${unlockedSet.has(l.id) ? l.char : '?'}</span>`).join('')}
    </div>
    <div class="actions">
      <button type="button" class="btn" id="profBookBtn">📖 ანბანის წიგნის გახსნა</button>
      ${u ? '<button type="button" class="btn alt" id="logoutBtn">გამოსვლა</button>' : ''}
    </div>
  `;
  LL.sprites.mount();
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
  if (page === 'map') LL.map.render(document.getElementById('mapBox'));
};