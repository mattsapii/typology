import { initTester, lazyFonts } from '/js/tester.js';
const main = document.querySelector('main');
initTester(main, { page: 'home', size: 88 });
lazyFonts(main);

// category filter for the tester gallery
const gallery = document.querySelector('[data-gallery]');
if (gallery) {
  const chips = [...document.querySelectorAll('[data-filter]')];
  const cards = [...gallery.querySelectorAll('[data-card]')];
  const empty = document.querySelector('[data-gallery-empty]');
  chips.forEach((c) => c.addEventListener('click', () => {
    const v = c.dataset.filter;
    chips.forEach((x) => x.setAttribute('aria-pressed', String(x === c)));
    let n = 0;
    cards.forEach((card) => { const show = v === 'all' || card.dataset.cat === v; card.hidden = !show; if (show) n++; });
    gallery.hidden = n === 0;
    if (empty) empty.hidden = n !== 0;
  }));
}
