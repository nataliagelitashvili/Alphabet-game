/* Single source of truth for routes. Alphabet Book is now active on every screen. */
LL.routes = [
  { id: 'home', href: 'index.html', label: 'მთავარი' },
  { id: 'map', href: 'game.html', label: 'რუკა' },
  { id: 'profile', href: 'profile.html', label: 'პროფილი' },
  { id: 'book', href: '#book', label: '📖 ანბანის წიგნი', book: true }
];

LL.renderNav = function (active) {
  const n = document.getElementById('nav');
  if (!n) return;
  n.innerHTML = LL.routes.map(r =>
    r.book
      ? `<button type="button" class="btn alt" id="navBookBtn">${r.label}</button>`
      : `<a class="btn${r.id === active ? '' : ' alt'}" href="${r.href}">${r.label}</a>`
  ).join('');

  const bookBtn = document.getElementById('navBookBtn');
  if (bookBtn && LL.alphabetBook) {
    bookBtn.onclick = () => LL.alphabetBook.open();
  }
};