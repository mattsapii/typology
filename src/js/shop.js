import { initTester, lazyFonts } from '/js/tester.js';
const main = document.querySelector('main');
initTester(main, { page: 'shop', size: 72 });
lazyFonts(main);

const grid = document.querySelector('[data-grid]');
const cards = [...grid.querySelectorAll('[data-card]')];
const q = document.querySelector('[data-q]');
const sortSel = document.querySelector('[data-sort]');
const chips = [...document.querySelectorAll('[data-cat-chip]')];
const count = document.querySelector('[data-count]');
const empty = document.querySelector('[data-empty]');
const clearBtns = [...document.querySelectorAll('[data-clear]')];
const viewBtns = [...document.querySelectorAll('[data-view]')];
const st = { q: '', cat: 'all', sort: 'newest', view: 'grid' };

const params = new URLSearchParams(location.search);
st.q = params.get('q') || '';
st.cat = chips.some((c) => c.dataset.catChip === params.get('category')) ? params.get('category') : 'all';
if (['newest', 'popular', 'price-asc', 'price-desc', 'name'].includes(params.get('sort'))) st.sort = params.get('sort');
if (params.get('view') === 'list') st.view = 'list';

const sorters = {
  newest: (a, b) => b.dataset.date.localeCompare(a.dataset.date),
  popular: (a, b) => b.dataset.pop - a.dataset.pop,
  'price-asc': (a, b) => a.dataset.price - b.dataset.price,
  'price-desc': (a, b) => b.dataset.price - a.dataset.price,
  name: (a, b) => a.dataset.name.localeCompare(b.dataset.name),
};

function render() {
  const term = st.q.trim().toLowerCase();
  let n = 0;
  [...cards].sort(sorters[st.sort]).forEach((c) => {
    const ok = (st.cat === 'all' || c.dataset.cat === st.cat) && (!term || c.dataset.name.includes(term));
    c.hidden = !ok; if (ok) n++;
    grid.appendChild(c);
  });
  grid.hidden = n === 0;
  empty.hidden = n !== 0;
  count.textContent = n === 1 ? '1 font' : n + ' fonts';
  chips.forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.catChip === st.cat)));
  viewBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === st.view)));
  grid.classList.toggle('list', st.view === 'list');
  const active = st.q || st.cat !== 'all';
  clearBtns.forEach((b) => (b.hidden = !active));
  q.value = st.q; sortSel.value = st.sort;
  const p = new URLSearchParams();
  if (st.q) p.set('q', st.q);
  if (st.cat !== 'all') p.set('category', st.cat);
  if (st.sort !== 'newest') p.set('sort', st.sort);
  if (st.view === 'list') p.set('view', 'list');
  history.replaceState(null, '', location.pathname + (p.toString() ? '?' + p : ''));
}
q.addEventListener('input', () => { st.q = q.value; render(); });
sortSel.addEventListener('change', () => { st.sort = sortSel.value; render(); });
chips.forEach((c) => c.addEventListener('click', () => { st.cat = c.dataset.catChip; render(); }));
viewBtns.forEach((b) => b.addEventListener('click', () => { st.view = b.dataset.view; render(); }));
clearBtns.forEach((b) => b.addEventListener('click', () => { st.q = ''; st.cat = 'all'; render(); q.focus(); }));
render();
