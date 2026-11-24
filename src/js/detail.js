import { initTester, lazyFonts } from '/js/tester.js';
const main = document.querySelector('main');
initTester(main, { page: 'detail', size: 120 });
lazyFonts(main);

// OpenType feature toggles
const boxes = [...document.querySelectorAll('[data-feature]')];
const applyFeatures = () => {
  const v = boxes.map((b) => `"${b.dataset.feature}" ${b.checked ? 1 : 0}`).join(', ');
  main.style.setProperty('--feat', v || 'normal');
};
boxes.forEach((b) => b.addEventListener('change', applyFeatures));
applyFeatures();

// glyph inspector
const btns = [...document.querySelectorAll('[data-glyph]')];
const big = document.querySelector('[data-glyph-big]');
const code = document.querySelector('[data-glyph-code]');
btns.forEach((b) => b.addEventListener('click', () => {
  btns.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  big.textContent = b.dataset.glyph;
  code.textContent = 'U+' + b.dataset.glyph.codePointAt(0).toString(16).toUpperCase().padStart(4, '0');
}));
