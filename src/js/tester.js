// Shared live font tester. One input drives every [data-sp-text] inside `scope`.
const KEY = 'typology.tester.v1';
const D = { text: '', color: '#1C1B18', bg: '#F2EEE3', align: 'left' };

const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
const write = (o) => { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch {} };

const hexRgb = (h) => { const v = h.replace('#', ''); return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16) / 255); };
const lum = (h) => { const [r, g, b] = hexRgb(h).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

export function initTester(scope, { page = 'page', size = 96, onChange } = {}) {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const saved = read();
  const sizeKey = 'size:' + page;
  const state = {
    text: saved.text ?? D.text,
    color: saved.color ?? D.color,
    bg: saved.bg ?? D.bg,
    align: saved.align ?? D.align,
    size: Number(saved[sizeKey]) || size,
  };
  const els = {
    text: $('[data-t=text]'), size: $('[data-t=size]'), out: $('[data-t=size-out]'),
    color: $$('[data-t=color]'), colorCustom: $('[data-t=color-custom]'),
    bg: $$('[data-t=bg]'), bgCustom: $('[data-t=bg-custom]'),
    align: $$('[data-t=align]'), reset: $('[data-t=reset]'),
  };
  let raf = 0;

  function paint() {
    const dark = lum(state.bg) < 0.35;
    scope.toggleAttribute('data-sp-dark', dark);
    scope.style.setProperty('--sp-size', state.size);
    scope.style.setProperty('--sp-color', state.color);
    scope.style.setProperty('--sp-bg', state.bg);
    scope.style.setProperty('--sp-align', state.align);
    $$('[data-sp-text]', scope).forEach((n) => {
      if (n.closest('[data-static]')) return;
      const t = state.text.trim() ? state.text : n.closest('[data-default]').dataset.default;
      if (n.textContent !== t) n.textContent = t;
    });
    if (onChange) onChange(state);
  }
  const schedule = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(paint); };
  const persist = () => { const s = read(); s.text = state.text; s.color = state.color; s.bg = state.bg; s.align = state.align; s[sizeKey] = state.size; write(s); };
  const sync = () => {
    if (els.text) els.text.value = state.text;
    if (els.size) els.size.value = state.size;
    if (els.out) els.out.textContent = state.size + ' px';
    els.color.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.value.toLowerCase() === state.color.toLowerCase())));
    els.bg.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.value.toLowerCase() === state.bg.toLowerCase())));
    if (els.colorCustom) els.colorCustom.value = state.color;
    if (els.bgCustom) els.bgCustom.value = state.bg;
    els.align.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.value === state.align)));
  };
  const set = (patch) => {
    // picking a background that hides the current text color flips the text to stay readable
    if (patch.bg && !patch.color && contrast(state.color, patch.bg) < 1.6) patch.color = lum(patch.bg) < 0.35 ? '#F2EEE3' : '#1C1B18';
    Object.assign(state, patch); sync(); persist(); schedule(); };

  els.text?.addEventListener('input', (e) => set({ text: e.target.value }));
  els.size?.addEventListener('input', (e) => set({ size: Number(e.target.value) }));
  els.color.forEach((b) => b.addEventListener('click', () => set({ color: b.dataset.value })));
  els.bg.forEach((b) => b.addEventListener('click', () => set({ bg: b.dataset.value })));
  els.colorCustom?.addEventListener('input', (e) => set({ color: e.target.value }));
  els.bgCustom?.addEventListener('input', (e) => set({ bg: e.target.value }));
  els.align.forEach((b) => b.addEventListener('click', () => set({ align: b.dataset.value })));
  els.reset?.addEventListener('click', () => { set({ ...D, size }); els.text?.focus(); });

  sync(); paint();
  return { state, set, paint };
}

// Load each preview font only when its specimen is near the viewport.
export function lazyFonts(root = document) {
  const targets = [...root.querySelectorAll('.specimen:not(.is-ready)')];
  const ready = (el) => el.classList.add('is-ready');
  const load = (el) => {
    el.classList.add('is-near');
    const ff = getComputedStyle(el).getPropertyValue('--ff').trim();
    if (!ff || !document.fonts) return ready(el);
    const sample = el.textContent || 'Aa';
    Promise.race([
      document.fonts.load(`48px ${ff}`, sample),
      new Promise((r) => setTimeout(r, 3000)),
    ]).then(() => ready(el), () => ready(el));
  };
  if (!('IntersectionObserver' in window)) return targets.forEach(load);
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { io.unobserve(e.target); load(e.target); } });
  }, { rootMargin: '700px 0px' });
  targets.forEach((t) => io.observe(t));
}
