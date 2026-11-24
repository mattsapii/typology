import { initTester, lazyFonts } from '/js/tester.js';
const main = document.querySelector('main');
const input = document.querySelector('[data-t=text]');
const presets = [...document.querySelectorAll('[data-preset]')];
const markPreset = (s) => {
  const t = s.text.trim();
  presets.forEach((b, i) => b.setAttribute('aria-pressed', String(t ? b.dataset.preset === s.text : i === 0)));
};
initTester(main, { page: 'detail', size: 120, onChange: markPreset });
lazyFonts(main);

// sample text presets fill the tester field
presets.forEach((b) => b.addEventListener('click', () => {
  input.value = b.dataset.preset;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}));

// "Best for" cards send their words to the tester
const stage = document.querySelector('.d-tester');
document.querySelectorAll('[data-try]').forEach((b) => b.addEventListener('click', () => {
  input.value = b.dataset.try;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  stage.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  input.focus({ preventScroll: true });
}));

// OpenType feature toggles
const boxes = [...document.querySelectorAll('[data-feature]')];
const applyFeatures = () => {
  const v = boxes.map((b) => `"${b.dataset.feature}" ${b.checked ? 1 : 0}`).join(', ');
  main.style.setProperty('--feat', v || 'normal');
};
boxes.forEach((b) => b.addEventListener('change', applyFeatures));
applyFeatures();

// character tabs
const tabs = [...document.querySelectorAll('[data-tab]')];
const glyphBtns = [...document.querySelectorAll('[data-glyph]')];
const showTab = (t) => {
  tabs.forEach((x) => x.setAttribute('aria-selected', String(x === t)));
  glyphBtns.forEach((g) => { g.hidden = t.dataset.tab !== 'all' && g.dataset.kind !== t.dataset.tab; });
};
tabs.forEach((t, i) => {
  t.addEventListener('click', () => showTab(t));
  t.addEventListener('keydown', (e) => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    const n = tabs[(i + d + tabs.length) % tabs.length]; n.focus(); showTab(n);
  });
});

// glyph inspector
const big = document.querySelector('[data-glyph-big]');
const code = document.querySelector('[data-glyph-code]');
glyphBtns.forEach((b) => b.addEventListener('click', () => {
  glyphBtns.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  big.textContent = b.dataset.glyph;
  const kind = b.getAttribute('aria-label').replace(/ \S+$/, '');
  code.textContent = `${kind} ${b.dataset.glyph}   U+${b.dataset.glyph.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`;
}));
