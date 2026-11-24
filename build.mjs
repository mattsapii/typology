// Typology static site generator. No dependencies. Run: node build.mjs  ->  dist/
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(ROOT, 'dist');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const readJSON = (p) => JSON.parse(read(p));

const site = readJSON('data/site.json');
const catalog = readJSON('data/products.json');
const report = fs.existsSync(path.join(ROOT, 'data/font-report.json')) ? readJSON('data/font-report.json') : {};
const SITE = site.url.replace(/\/$/, '');
const cats = catalog.categories;
const catName = (slug) => cats.find((c) => c.slug === slug)?.name ?? slug;
const money = (p) => `${site.currencySymbol}${p.price}`;
const products = catalog.products;

// ---------- validation (fail early on bad data) ----------
{
  const need = ['id', 'slug', 'name', 'category', 'description', 'price', 'previewFont', 'previewFontFile', 'productImage', 'specimenImages', 'gumroadUrl', 'fontStyles', 'glyphInformation', 'languageSupport', 'features', 'releaseDate', 'featured', 'bestSeller'];
  const slugs = new Set();
  for (const p of products) {
    for (const k of need) if (!(k in p)) throw new Error(`Product "${p.slug ?? p.id}" is missing "${k}"`);
    if (slugs.has(p.slug)) throw new Error(`Duplicate slug ${p.slug}`);
    slugs.add(p.slug);
    if (!cats.some((c) => c.slug === p.category)) throw new Error(`Unknown category "${p.category}" in ${p.slug}`);
    if (!fs.existsSync(path.join(ROOT, p.previewFontFile.replace(/^\//, '')))) throw new Error(`Missing preview font ${p.previewFontFile}`);
    if (!/^https:\/\//.test(p.gumroadUrl)) throw new Error(`gumroadUrl must be https in ${p.slug}`);
  }
}

// ---------- helpers ----------
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const json = (o) => JSON.stringify(o).replace(/</g, '\\u003c');
const hash = (s) => { let h = 5381; for (const c of s) h = ((h << 5) + h + c.charCodeAt(0)) >>> 0; return h.toString(36); };
const ver = hash(read('src/css/main.css') + fs.readdirSync(path.join(ROOT, 'src/js')).map((f) => read('src/js/' + f)).join(''));
const heroProduct = products.find((p) => p.slug === site.heroSlug) || products.find((p) => p.featured) || products[0];
const placeholders = products.some((p) => p.placeholder);

const FEATURE_LABELS = { liga: 'Standard ligatures', calt: 'Contextual alternates', frac: 'Fractions', swsh: 'Swashes', salt: 'Stylistic alternates', dlig: 'Discretionary ligatures', onum: 'Oldstyle figures', init: 'Initial forms', fina: 'Terminal forms', medi: 'Medial forms', locl: 'Localized forms', ccmp: 'Glyph composition', case: 'Case-sensitive forms', ordn: 'Ordinals' };
const featuresFor = (p) => {
  const out = new Map();
  for (const f of p.features) out.set(f.tag, f.label || FEATURE_LABELS[f.tag] || f.tag);
  for (const t of report[p.slug]?.features ?? []) if (!out.has(t)) out.set(t, FEATURE_LABELS[t] || t);
  // only features that change how typed text looks are offered as toggles
  return [...out].map(([tag, label]) => ({ tag, label, toggle: !['locl', 'ccmp'].includes(tag) }));
};

// ---------- components ----------
const icons = {
  left: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M3 5h14M3 10h9M3 15h12"/></svg>',
  center: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M3 5h14M6 10h8M4 15h12"/></svg>',
  right: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M3 5h14M8 10h9M5 15h12"/></svg>',
  grid: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="3" y="3" width="6" height="6"/><rect x="11" y="3" width="6" height="6"/><rect x="3" y="11" width="6" height="6"/><rect x="11" y="11" width="6" height="6"/></svg>',
  list: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M3 5h14M3 10h14M3 15h14"/></svg>',
};

const TEXT_COLORS = [['#1C1B18', 'Ink'], ['#4A5733', 'Olive'], ['#8A3B22', 'Rust'], ['#1F3A5F', 'Navy'], ['#F2EEE3', 'Paper']];
const BG_COLORS = [['#F2EEE3', 'Paper'], ['#E8E3D3', 'Bone'], ['#DDE2CB', 'Sage'], ['#EBCFC0', 'Blush'], ['#1C1B18', 'Ink']];
const swatches = (kind, list) => list.map(([v, n]) => `<button type="button" class="sw" style="--c:${v}" data-t="${kind}" data-value="${v}" aria-pressed="false" aria-label="${n}" title="${n}"></button>`).join('');

function testerControls({ id, min = 24, max = 200, textLabel = 'Type your own words', placeholder = site.defaultTesterText, withText = true }) {
  return `<div class="tester" role="group" aria-label="Font tester controls">
  ${withText ? `<div class="field t-text"><label for="${id}-text">${textLabel}</label><input type="text" id="${id}-text" data-t="text" placeholder="${esc(placeholder)}" autocomplete="off" spellcheck="false" maxlength="240"></div>` : ''}
  <div class="field"><label for="${id}-size">Size</label><div class="size-row"><input type="range" id="${id}-size" data-t="size" min="${min}" max="${max}" step="1" value="96"><output data-t="size-out" for="${id}-size">96 px</output></div></div>
  <div class="field"><span class="label" id="${id}-c">Text color</span><div class="swatches" role="group" aria-labelledby="${id}-c">${swatches('color', TEXT_COLORS)}<input type="color" data-t="color-custom" value="#1C1B18" aria-label="Custom text color"></div></div>
  <div class="field"><span class="label" id="${id}-b">Background</span><div class="swatches" role="group" aria-labelledby="${id}-b">${swatches('bg', BG_COLORS)}<input type="color" data-t="bg-custom" value="#F2EEE3" aria-label="Custom background color"></div></div>
  <div class="field"><span class="label" id="${id}-a">Alignment</span><div class="seg" role="group" aria-labelledby="${id}-a">
    <button type="button" data-t="align" data-value="left" aria-pressed="true" aria-label="Align left">${icons.left}</button>
    <button type="button" data-t="align" data-value="center" aria-pressed="false" aria-label="Align center">${icons.center}</button>
    <button type="button" data-t="align" data-value="right" aria-pressed="false" aria-label="Align right">${icons.right}</button></div></div>
  <div class="field"><span class="label">&nbsp;</span><button type="button" class="btn ghost" data-t="reset">Reset controls</button></div>
</div>`;
}

function card(p, { near = false } = {}) {
  return `<article class="card" data-card data-name="${esc(p.name.toLowerCase())}" data-cat="${p.category}" data-price="${p.price}" data-date="${p.releaseDate}" data-pop="${p.popularity ?? 0}">
  <header class="card-head"><h3><a href="/fonts/${p.slug}/">${esc(p.name)}</a></h3><span class="cat">${esc(catName(p.category))}</span></header>
  <div class="specimen${near ? ' is-near' : ''}" style="--ff:'${esc(p.previewFont)}'" data-default="${esc(p.name)}" ><span data-sp-text>${esc(p.name)}</span></div>
  <footer class="card-foot"><span class="price">${money(p)}</span><a class="link" href="/fonts/${p.slug}/" aria-label="View details for ${esc(p.name)}">View details</a></footer>
</article>`;
}

const nav = [['/shop/', 'Fonts'], ['/licensing/', 'Licensing'], ['/about/', 'About'], ['/faq/', 'FAQ'], ['/contact/', 'Contact']];
const header = (cur) => `<a class="skip" href="#main">Skip to content</a>
<header class="site-head"><div class="wrap"><a class="brand" href="/" aria-label="${site.name} home">${site.name}</a>
<nav class="nav" aria-label="Main">${nav.map(([h, t]) => `<a href="${h}"${cur === h ? ' aria-current="page"' : ''}>${t}</a>`).join('')}</nav></div></header>`;

const footer = () => `<footer class="site-foot"><div class="wrap">
<div class="foot-grid">
  <div class="foot-brand"><a class="brand" href="/">${site.name}</a><p>${esc(site.tagline)}. Every font is previewed live before you buy.</p></div>
  <div><h2>Fonts</h2><ul><li><a href="/shop/">All fonts</a></li>${cats.map((c) => `<li><a href="/shop/?category=${c.slug}">${esc(c.name)}</a></li>`).join('')}</ul></div>
  <div><h2>Studio</h2><ul><li><a href="/about/">About</a></li><li><a href="/contact/">Contact</a></li><li><a href="/faq/">FAQ</a></li>${site.instagram ? `<li><a href="${esc(site.instagram)}" rel="noopener">Instagram</a></li>` : ''}</ul></div>
  <div><h2>Legal</h2><ul><li><a href="/licensing/">Licensing</a></li><li><a href="/privacy/">Privacy</a></li><li><a href="/terms/">Terms</a></li></ul></div>
</div>
<div class="foot-base"><span>© ${new Date().getFullYear()} ${site.name}</span><span>Checkout and delivery by Gumroad</span></div></div></footer>`;

function layout({ title, desc, path: p, cur = '', body, ld = [], scripts = [], preload = [], ogImage, ogType = 'website', noindex = false, head = '' }) {
  const url = SITE + p;
  const img = SITE + (ogImage || (heroProduct ? heroProduct.productImage : '/favicon.svg'));
  const fullTitle = p === '/' ? title : `${title} | ${site.name}`;
  return `<!doctype html>
<html lang="en" class="no-js">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
${noindex ? '<meta name="robots" content="noindex">' : ''}
<meta property="og:site_name" content="${site.name}">
<meta property="og:type" content="${ogType}">
<meta property="og:title" content="${esc(fullTitle)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${img}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#F2EEE3">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preload" href="/fonts/ui/instrument-sans-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/ui/instrument-sans-latin-600-normal.woff2" as="font" type="font/woff2" crossorigin>
${preload.map((f) => `<link rel="preload" href="${f}" as="font" type="font/woff2" crossorigin>`).join('\n')}
<link rel="stylesheet" href="/css/main.css?v=${ver}">
<link rel="stylesheet" href="/css/fonts.css?v=${ver}">
<script>document.documentElement.className='js'</script>
<noscript><style>.specimen{font-family:var(--ff),var(--ui)!important}.specimen>span{opacity:1!important}</style></noscript>
${head}
${ld.map((o) => `<script type="application/ld+json">${json(o)}</script>`).join('\n')}
</head>
<body>
${header(cur)}
<main id="main">
${body}
</main>
${footer()}
${scripts.map((s) => `<script type="module" src="/js/${s}.js?v=${ver}"></script>`).join('\n')}
</body>
</html>
`;
}

const breadcrumbLD = (items) => ({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items.map(([n, u], i) => ({ '@type': 'ListItem', position: i + 1, name: n, item: SITE + u })) });
const orgLD = { '@context': 'https://schema.org', '@type': 'Organization', name: site.name, url: SITE, logo: SITE + '/favicon.svg', description: site.tagline };

function newsletter() {
  const action = site.newsletterAction ? ` action="${esc(site.newsletterAction)}" method="post"` : '';
  return `<section class="news on-ink" aria-labelledby="news-h"><div class="wrap">
  <div><h2 id="news-h">New releases, in your inbox</h2><p>One short email when a new typeface is released. No schedule, no filler.</p></div>
  <form data-news data-to="${esc(site.email)}"${action}>
    <label for="news-email">Email address</label>
    <input type="email" id="news-email" name="email" required autocomplete="email" placeholder="you@example.com">
    <button class="btn" type="submit">Subscribe</button>
  </form></div></section>`;
}

// ---------- pages ----------
const pages = [];
const add = (p, html) => pages.push([p, html]);

// HOME
{
  const featured = products.filter((p) => p.featured);
  const newest = [...products].sort((a, b) => b.releaseDate.localeCompare(a.releaseDate)).slice(0, 4);
  const best = products.filter((p) => p.bestSeller);
  const count = (c) => products.filter((p) => p.category === c).length;
  const gallery = products.slice(0, 6);
  const showcase = products.flatMap((p) => p.specimenImages.map((i) => ({ ...i, name: p.name, slug: p.slug }))).slice(0, 6);

  const body = `
<section class="hero" aria-labelledby="hero-h"><div class="wrap">
  <h1 id="hero-h" class="sr">Handwritten fonts by ${site.name}</h1>
  <div class="hero-specimen is-near specimen-hero" style="--ff:'${esc(heroProduct.previewFont)}';font-family:'${esc(heroProduct.previewFont)}',var(--ui)" aria-hidden="true">Letters with a pulse</div>
  <div class="hero-grid">
    <p>${site.name} is an independent foundry for handwritten typefaces: signatures, brush scripts, monolines and everyday hands. Type your own words and test every font before you buy.</p>
    <div><div class="hero-cta"><a class="btn lg" href="/shop/">Explore fonts</a><a class="btn lg ghost" href="#tester">Try the tester</a></div>
    <p class="hero-note">Hero set in ${esc(heroProduct.name)}.</p></div>
  </div>
</div></section>

<section class="section" id="tester" aria-labelledby="tester-h"><div class="wrap">
  <div class="sec-head"><h2 id="tester-h">Test every font with your own words</h2><p>One field updates every specimen on this page, set in each font's real file.</p></div>
  ${testerControls({ id: 'home' })}
  <p class="tester-note" id="tester-note">Leave the field empty to see each font's name. Your settings carry over to the shop and font pages.</p>
  <div class="chips" role="group" aria-label="Filter specimens by category" style="margin:1.5rem 0">
    <button type="button" class="chip" data-filter="all" aria-pressed="true">All</button>
    ${cats.map((c) => `<button type="button" class="chip" data-filter="${c.slug}" aria-pressed="false">${esc(c.name)}</button>`).join('')}
  </div>
  <div class="cards list" data-gallery>${gallery.map((p, i) => card(p, { near: i === 0 })).join('')}</div>
  <div class="empty" data-gallery-empty hidden><h3>No fonts in this category yet</h3><p>Choose another category, or browse the full catalog.</p><a class="btn" href="/shop/">See all fonts</a></div>
  <p style="margin-top:1.5rem"><a class="link" href="/shop/">Browse the full catalog</a></p>
</div></section>

${featured.length ? `<section class="section" aria-labelledby="feat-h"><div class="wrap">
  <div class="sec-head"><h2 id="feat-h">Featured typefaces</h2><a class="link" href="/shop/">All fonts</a></div>
  <div class="featured-grid${featured.length === 1 ? ' one' : ''}">${featured.map((p) => card(p)).join('')}</div>
</div></section>` : ''}

<section class="section" aria-labelledby="cat-h"><div class="wrap">
  <div class="sec-head"><h2 id="cat-h">Browse by category</h2><p>Six kinds of handwriting, from fast signatures to playful lettering.</p></div>
  <ul class="cat-list">${cats.map((c) => count(c.slug) ? `<li><a href="/shop/?category=${c.slug}"><span>${esc(c.name)}</span><span class="count">${count(c.slug)} ${count(c.slug) === 1 ? 'font' : 'fonts'}</span></a></li>` : `<li><span class="soon"><span>${esc(c.name)}</span><span class="count">Coming soon</span></span></li>`).join('')}</ul>
</div></section>

<section class="section" aria-labelledby="new-h"><div class="wrap">
  <div class="sec-head"><h2 id="new-h">New releases</h2><a class="link" href="/shop/?sort=newest">See newest first</a></div>
  <div class="cards">${newest.map((p) => card(p)).join('')}</div>
</div></section>

${best.length ? `<section class="section" aria-labelledby="best-h"><div class="wrap">
  <div class="sec-head"><h2 id="best-h">Best sellers</h2><a class="link" href="/shop/?sort=popular">See most popular</a></div>
  <div class="cards">${best.map((p) => card(p)).join('')}</div>
</div></section>` : ''}

<section class="section" aria-labelledby="show-h"><div class="wrap">
  <div class="sec-head"><h2 id="show-h">Specimens</h2><p>The fonts at work, set large.</p></div>
  <div class="showcase">${showcase.map((s) => `<figure><a href="/fonts/${s.slug}/"><img src="${s.src}" alt="${esc(s.alt)}" width="1200" height="800" loading="lazy" decoding="async"></a><figcaption>${esc(s.name)}</figcaption></figure>`).join('')}</div>
</div></section>

<section class="section" aria-labelledby="about-h"><div class="wrap split">
  <h2 id="about-h" style="font-size:clamp(1.75rem,3.4vw,2.75rem)">About ${site.name}</h2>
  <div class="prose"><p class="lede">We make handwritten fonts that keep the irregularity of a real hand and still set cleanly on screen and in print.</p>
  <p>${site.name} is an independent foundry. Each typeface is drawn, spaced and kerned in-house, then checked in real words and sentences, not only in alphabets.</p>
  <p><a class="link" href="/about/">Read more about the studio</a></p></div>
</div></section>

${newsletter()}`;

  add('/', layout({
    title: `${site.name} | Handwritten fonts, signatures and brush scripts`,
    desc: 'Independent handwritten font foundry. Test signature fonts, brush scripts, casual handwriting and elegant scripts with your own text, then license instantly.',
    path: '/', cur: '/', body, scripts: ['home', 'news'],
    preload: [heroProduct.previewFontFile],
    ld: [orgLD, { '@context': 'https://schema.org', '@type': 'WebSite', name: site.name, url: SITE }],
  }));
}

// SHOP
{
  const counts = (c) => products.filter((p) => p.category === c).length;
  const body = `
<div class="wrap page-title"><h1>Fonts</h1><p>Type once and every font below updates. Filter by category, search by name, and sort by newest, popularity or price.</p></div>
<div class="toolbar" role="region" aria-label="Catalog controls"><div class="wrap">
  <div class="row">
    <div class="field"><label for="q">Search by font name</label><input type="search" id="q" data-q placeholder="Search fonts" autocomplete="off"></div>
    <div class="field"><label for="sort">Sort by</label><select id="sort" data-sort><option value="newest">Newest</option><option value="popular">Popularity</option><option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option><option value="name">Name</option></select></div>
    <div class="field"><span class="label" id="v-l">View</span><div class="seg" role="group" aria-labelledby="v-l"><button type="button" data-view="grid" aria-pressed="true" aria-label="Grid view">${icons.grid}</button><button type="button" data-view="list" aria-pressed="false" aria-label="List view">${icons.list}</button></div></div>
    <div class="field"><span class="label">&nbsp;</span><button type="button" class="btn ghost" data-clear hidden>Clear filters</button></div>
  </div>
  <div class="chips" role="group" aria-label="Filter by category" style="margin-top:.9rem">
    <button type="button" class="chip" data-cat-chip="all" aria-pressed="true">All<span class="n">${products.length}</span></button>
    ${cats.map((c) => `<button type="button" class="chip" data-cat-chip="${c.slug}" aria-pressed="false">${esc(c.name)}<span class="n">${counts(c.slug)}</span></button>`).join('')}
  </div>
</div></div>
<div class="wrap">
  <details open class="preview-panel" style="margin-top:1rem"><summary>Preview text and style</summary>${testerControls({ id: 'shop', max: 160 })}</details>
  <div class="result-bar"><p class="muted" style="margin:0" role="status" aria-live="polite"><span data-count>${products.length} fonts</span></p><button type="button" class="link" style="background:none;border:0;cursor:pointer;font:inherit" data-clear hidden>Clear filters</button></div>
  <h2 class="sr">Catalog</h2>
  <div class="cards" data-grid>${products.map((p, i) => card(p, { near: i < 2 })).join('')}</div>
  <div class="empty" data-empty hidden><h2>No fonts match</h2><p>Try a shorter name or another category. You can also clear the filters and see the whole catalog.</p><button type="button" class="btn" data-clear>Clear filters</button></div>
  <div style="height:clamp(3rem,6vw,5rem)"></div>
</div>
${newsletter()}`;
  add('/shop/', layout({
    title: 'Handwritten fonts: shop and live tester',
    desc: 'Browse every Typology handwritten font. Type your own text and preview signature, brush script, casual, monoline, elegant and playful fonts side by side.',
    path: '/shop/', cur: '/shop/', body, scripts: ['shop', 'news'],
    ld: [breadcrumbLD([['Home', '/'], ['Fonts', '/shop/']]), { '@context': 'https://schema.org', '@type': 'ItemList', name: 'Typology fonts', itemListElement: products.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE}/fonts/${p.slug}/`, name: p.name })) }],
  }));
}

// DETAIL
const UP = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', LOW = 'abcdefghijklmnopqrstuvwxyz', NUM = '0123456789', PUN = '.,;:!?\'"‘’“”()[]{}@#&%*+-–—=/\\<>_$€£¥©®™';
for (const p of products) {
  const r = report[p.slug] || {};
  const feats = featuresFor(p);
  const related = products.filter((x) => x.slug !== p.slug).sort((a, b) => (b.category === p.category) - (a.category === p.category)).slice(0, 3);
  const glyphs = r.chars ? [...r.chars] : [...(UP + LOW + NUM + PUN)];
  const gInfo = p.glyphInformation || {};
  const glyphCount = r.glyphCount ?? gInfo.count ?? glyphs.length;
  const buyAttrs = site.gumroadOverlay ? 'class="btn lg gumroad-button"' : 'class="btn lg"';
  const buy = (label = 'Buy now') => `<a ${buyAttrs} href="${esc(p.gumroadUrl)}" target="_blank" rel="noopener" data-buy>${label}<span class="sr"> ${esc(p.name)} on Gumroad (opens in a new tab)</span></a>`;
  const body = `
<div class="wrap" style="--ff:'${esc(p.previewFont)}'">
  <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/shop/">Fonts</a> / <a href="/shop/?category=${p.category}">${esc(catName(p.category))}</a> / <span aria-current="page">${esc(p.name)}</span></nav>
  ${p.placeholder ? `<p class="placeholder-note" style="margin-top:1rem"><strong>Placeholder product.</strong> Replace this entry in <code>data/products.json</code> with a real font, price and Gumroad link.</p>` : ''}
  <div class="d-head">
    <div><h1>${esc(p.name)}</h1><p class="meta">${esc(catName(p.category))} · ${p.fontStyles.length} ${p.fontStyles.length === 1 ? 'style' : 'styles'} · ${glyphCount} glyphs</p></div>
    <div class="d-buy"><span class="price">${money(p)}</span>${buy()}</div>
  </div>
  <div class="d-stage"><div class="specimen is-near" style="--ff:'${esc(p.previewFont)}'" data-default="${esc(p.name)}"><span data-sp-text>${esc(p.name)}</span></div></div>
  <div class="d-tools" role="region" aria-label="Specimen controls">${testerControls({ id: 'd', textLabel: `Type to preview ${p.name}`, placeholder: `Try “${site.defaultTesterText}”`, max: 240 })}</div>

  <section class="d-section" aria-labelledby="chars-h"><h2 id="chars-h">Characters</h2>
    <div class="glyph-row">${UP}</div>
    <div class="glyph-row">${LOW}</div>
  </section>
  <section class="d-section" aria-labelledby="num-h"><h2 id="num-h">Numbers and punctuation</h2>
    <div class="glyph-row">${esc(NUM)}</div>
    <div class="glyph-row">${esc(PUN)}</div>
  </section>
  <section class="d-section" aria-labelledby="gl-h"><h2 id="gl-h">Available glyphs and alternates</h2>
    <p class="hint">${glyphCount} glyphs in the web preview${r.alternateCount ? `, including ${r.alternateCount} alternate forms` : ''}. Select a character to inspect it.${gInfo.note ? ' ' + esc(gInfo.note) : ''}</p>
    <div class="glyph-layout">
      <div class="glyph-grid" role="group" aria-label="All characters in ${esc(p.name)}">${glyphs.map((g) => `<button type="button" data-glyph="${esc(g)}" aria-pressed="false" aria-label="Character ${esc(g)}">${esc(g)}</button>`).join('')}</div>
      <div class="glyph-view" aria-live="polite"><div><div class="big" data-glyph-big aria-hidden="true">${esc(glyphs.find((g) => /[A-Za-z]/.test(g)) || glyphs[0])}</div><div class="code" data-glyph-code>Select a character</div></div></div>
    </div>
    ${gInfo.alternates ? `<p class="muted" style="margin-top:1rem">${esc(gInfo.alternates)}</p>` : ''}
  </section>
  <section class="d-section" aria-labelledby="ot-h"><h2 id="ot-h">OpenType features</h2>
    ${feats.length ? `<p class="hint">Switch features on and off and watch the specimen above change. Features apply only where the font file supports them.</p>
    <ul class="feat-list">${feats.map((f) => f.toggle ? `<li><label><input type="checkbox" data-feature="${f.tag}"${['liga', 'calt'].includes(f.tag) ? ' checked' : ''}><span>${esc(f.label)}</span><code>${f.tag}</code></label></li>` : `<li><label style="cursor:default"><span style="width:1.25rem"></span><span>${esc(f.label)}</span><code>${f.tag}</code></label></li>`).join('')}</ul>`
      : `<p class="muted" style="max-width:36rem">This preview file contains no optional OpenType features. Letters connect and kern by default.</p>`}
  </section>
  <section class="d-section" aria-labelledby="spec-h"><h2 id="spec-h">Font specifications</h2>
    <dl class="specs">
      <dt>Category</dt><dd>${esc(catName(p.category))}</dd>
      <dt>Styles</dt><dd>${esc(p.fontStyles.join(', '))}</dd>
      <dt>Glyphs</dt><dd>${glyphCount}</dd>
      <dt>Languages</dt><dd>${esc(p.languageSupport.join(', '))}</dd>
      <dt>File formats</dt><dd>${esc((p.formats || ['OTF', 'TTF']).join(', '))}</dd>
      <dt>Released</dt><dd><time datetime="${p.releaseDate}">${new Date(p.releaseDate + 'T00:00:00Z').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })}</time></dd>
    </dl>
    <p class="hint" style="margin-top:1rem">${esc(p.description)}</p>
  </section>
  <section class="d-section" aria-labelledby="lic-h"><h2 id="lic-h">License</h2>
    <ul class="prose"><li>${site.licenseSummary.map(esc).join('</li><li>')}</li></ul>
    <p><a class="link" href="/licensing/">Read the full licensing terms</a></p>
  </section>
  <section class="d-section" aria-labelledby="buy-h"><h2 id="buy-h">Pricing and purchase</h2>
    <div class="price-box"><div><div class="price">${money(p)}</div><p class="muted" style="margin:.25rem 0 0">One-time purchase. Checkout and download are handled by Gumroad.</p></div>${buy('Buy now')}</div>
  </section>
  <section class="d-section related" aria-labelledby="rel-h"><h2 id="rel-h">Related fonts</h2>
    <div class="cards">${related.map((x) => card(x)).join('')}</div>
  </section>
  <div style="height:3rem"></div>
</div>
${newsletter()}`;

  const url = `/fonts/${p.slug}/`;
  add(url, layout({
    title: `${p.name}: ${catName(p.category)} handwritten font`,
    desc: `${p.name} is a ${catName(p.category).toLowerCase()} handwritten font by ${site.name}. Test it with your own text, inspect every glyph, then license it for ${money(p)}.`,
    path: url, body, scripts: ['detail', 'news'], preload: [p.previewFontFile], ogImage: p.productImage, ogType: 'product',
    head: site.gumroadOverlay ? '<script src="https://gumroad.com/js/gumroad.js" async></script>' : '',
    ld: [breadcrumbLD([['Home', '/'], ['Fonts', '/shop/'], [p.name, url]]), {
      '@context': 'https://schema.org', '@type': 'Product', name: p.name, description: p.description, sku: p.id, category: catName(p.category),
      image: [SITE + p.productImage, ...p.specimenImages.map((i) => SITE + i.src)], brand: { '@type': 'Brand', name: site.name },
      offers: { '@type': 'Offer', price: p.price, priceCurrency: p.currency || 'USD', availability: 'https://schema.org/InStock', url: p.gumroadUrl, itemCondition: 'https://schema.org/NewCondition' },
    }],
  }));
}

// STATIC PAGES
const prose = (title, lead, inner) => `<div class="wrap page-title"><h1>${title}</h1>${lead ? `<p>${lead}</p>` : ''}</div><div class="wrap" style="padding-bottom:clamp(3rem,7vw,6rem)"><div class="prose">${inner}</div></div>`;
const stamp = `<p class="stamp">Last updated ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}.</p>`;

add('/licensing/', layout({
  title: 'Font licensing', desc: `How ${site.name} font licenses work: what you can do with a purchased font, and when you need an extended license.`, path: '/licensing/', cur: '/licensing/',
  ld: [breadcrumbLD([['Home', '/'], ['Licensing', '/licensing/']])],
  body: prose('Licensing', 'Plain terms for using a font you have bought.', `
<h2>What every purchase includes</h2>
<ul>${site.licenseSummary.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>
<h2>What is not allowed</h2>
<ul><li>Sharing, reselling or redistributing the font files.</li><li>Uploading the font to a public font library or a font-generator service.</li><li>Editing the files and selling the result as a new font.</li></ul>
<h2>Need something different?</h2>
<p>If you need broader rights, such as embedding the font in an app, a game or a product you sell, <a href="/contact/">contact us</a> and describe the use.</p>
<h2>Web previews</h2>
<p>The previews on this site are for testing only. They do not grant any right to use the font elsewhere.</p>
${stamp}`),
}));

add('/about/', layout({
  title: 'About', desc: `${site.name} is an independent foundry that designs handwritten fonts: signatures, brush scripts, casual handwriting and monoline lettering.`, path: '/about/', cur: '/about/',
  ld: [breadcrumbLD([['Home', '/'], ['About', '/about/']]), orgLD],
  body: `<div class="wrap page-title"><h1>About ${site.name}</h1></div>
<div class="wrap" style="padding-bottom:clamp(3rem,7vw,6rem)"><div class="split"><p class="lede">${site.name} is an independent foundry for handwritten typefaces.</p>
<div class="prose"><p>Each font starts as real handwriting. We draw the letters, build the connections, then spend most of the time on spacing and kerning, because a handwritten font only feels human when the rhythm between letters is right.</p>
<p>We test every release in whole words and sentences, in the same live tester you can use on this site, so you see how a font behaves with your text before you buy.</p>
<p>Fonts are sold directly through Gumroad. You pay once, download the files and use them under a clear license.</p>
<p><a class="btn" href="/shop/">Explore fonts</a></p></div></div></div>${newsletter()}`,
  scripts: ['news'],
}));

const faqs = [
  ['How do I buy a font?', 'Open a font page and choose Buy now. You go to the matching Gumroad checkout, pay there and download the files straight away.'],
  ['What do I receive after purchase?', 'The full font files in OTF and TTF format, ready to install on Windows, macOS and Linux.'],
  ['Are the previews the real fonts?', 'Yes. The tester uses a web version of each font, so spacing, connections and alternates match the files you will download.'],
  ['Can I use the fonts on a website or in an app?', 'Check the licensing page for what a standard purchase covers. For app, game or product embedding, contact us and we will help.'],
  ['Do you offer refunds?', 'Refunds are handled through Gumroad. If something is wrong with your files, contact us and we will fix it.'],
  ['A character is missing. What now?', 'Look at the glyph grid on the font page before you buy. If you need a character that is missing, contact us.'],
  ['Where is my receipt or download link?', 'Gumroad emails both after payment. You can also use the link in the receipt to download again.'],
];
add('/faq/', layout({
  title: 'FAQ', desc: `Answers about buying, licensing and using ${site.name} handwritten fonts.`, path: '/faq/', cur: '/faq/',
  ld: [breadcrumbLD([['Home', '/'], ['FAQ', '/faq/']]), { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqs.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) }],
  body: `<div class="wrap page-title"><h1>Questions</h1><p>Short answers about buying and using our fonts.</p></div><div class="wrap" style="padding-bottom:clamp(3rem,7vw,6rem)"><div class="faq">${faqs.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</div></div>`,
}));

add('/contact/', layout({
  title: 'Contact', desc: `Contact ${site.name} about licensing, custom work or help with a purchase.`, path: '/contact/', cur: '/contact/', scripts: ['contact'],
  ld: [breadcrumbLD([['Home', '/'], ['Contact', '/contact/']])],
  body: `<div class="wrap page-title"><h1>Contact</h1><p>Questions about a font, a license or an order? Write to us and we will reply by email.</p></div>
<div class="wrap" style="padding-bottom:clamp(3rem,7vw,6rem)"><form class="form-grid" data-contact data-to="${esc(site.email)}">
<div class="field"><label for="c-name">Your name</label><input type="text" id="c-name" name="name" required autocomplete="name"></div>
<div class="field"><label for="c-email">Email address</label><input type="email" id="c-email" name="email" required autocomplete="email"></div>
<div class="field"><label for="c-topic">Topic</label><select id="c-topic" name="topic"><option>Licensing question</option><option>Help with an order</option><option>Missing character</option><option>Something else</option></select></div>
<div class="field"><label for="c-msg">Message</label><textarea id="c-msg" name="message" required></textarea></div>
<div><button class="btn lg" type="submit">Write email</button></div>
<p class="status" data-status role="status" aria-live="polite"></p>
<p class="muted small">This button opens your email app with the message filled in. You can also write directly to <a href="mailto:${esc(site.email)}">${esc(site.email)}</a>.</p>
</form></div>`,
}));

add('/privacy/', layout({
  title: 'Privacy policy', desc: `How ${site.name} handles data: no accounts, no tracking cookies, payments handled by Gumroad.`, path: '/privacy/',
  body: prose('Privacy', `What ${site.name} does and does not collect.`, `
<h2>Short version</h2><p>This website has no accounts and no advertising trackers. We do not take payments or store payment details.</p>
<h2>What stays in your browser</h2><p>The font tester saves your last text, size, colors and alignment in your browser's local storage so they carry over between pages. This data never leaves your device. You can clear it from your browser settings.</p>
<h2>Purchases</h2><p>When you choose Buy now, you leave this site and go to Gumroad. Gumroad collects your payment details and email address under its own privacy policy and delivers the files. We receive the sales information Gumroad shares with sellers.</p>
<h2>Email</h2><p>If you subscribe to the newsletter or write to us, we use your email address only to reply or to send releases. You can unsubscribe at any time.</p>
<h2>Hosting</h2><p>The site is hosted on Cloudflare Pages, which may process standard request logs such as IP address and browser type to deliver and protect the site.</p>
<h2>Contact</h2><p>Questions about this policy: <a href="mailto:${esc(site.email)}">${esc(site.email)}</a>.</p>${stamp}`),
}));

add('/terms/', layout({
  title: 'Terms of service', desc: `Terms for using the ${site.name} website and purchasing fonts through Gumroad.`, path: '/terms/',
  body: prose('Terms', 'The rules for using this site and our fonts.', `
<h2>Using the site</h2><p>You may browse the site and use the tester freely. Do not copy the preview font files or use them outside testing.</p>
<h2>Purchases</h2><p>Purchases are made through Gumroad and are subject to Gumroad's terms. Your license starts when Gumroad confirms payment.</p>
<h2>Font license</h2><p>Fonts are licensed, not sold. Your rights are described on the <a href="/licensing/">licensing page</a>.</p>
<h2>Refunds</h2><p>Refunds follow Gumroad's refund process. Contact us first if there is a problem with your files.</p>
<h2>Liability</h2><p>Fonts and previews are provided as they are. To the extent the law allows, ${site.name} is not liable for indirect or consequential losses.</p>
<h2>Changes</h2><p>We may update these terms. The date below shows the latest version.</p>${stamp}`),
}));

// ---------- write output ----------
fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });
const out = (rel, data) => { const f = path.join(DIST, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, data); };
const copyDir = (from, to) => fs.cpSync(path.join(ROOT, from), path.join(DIST, to), { recursive: true });

for (const [p, html] of pages) out(p === '/' ? 'index.html' : p.slice(1) + 'index.html', html);
out('404.html', layout({
  title: 'Page not found', desc: 'This page does not exist.', path: '/404.html', noindex: true,
  body: `<div class="wrap page-title"><h1>Page not found</h1><p>The link may be old or mistyped. Try the font catalog instead.</p><p><a class="btn" href="/shop/">Explore fonts</a></p></div>`,
}));

copyDir('src/css', 'css'); copyDir('src/js', 'js'); copyDir('src/images', 'images');
copyDir('fonts/previews', 'fonts/previews'); copyDir('fonts/ui', 'fonts/ui');
fs.readdirSync(path.join(ROOT, 'public')).forEach((f) => {
  let d = fs.readFileSync(path.join(ROOT, 'public', f));
  if (f === 'robots.txt') d = d.toString().replace('__SITE_URL__', SITE);
  out(f, d);
});
out('css/fonts.css', products.map((p) => `@font-face{font-family:"${p.previewFont}";src:url(${p.previewFontFile}) format("woff2");font-display:swap;font-weight:400;font-style:normal}`).join('\n') + '\n');
out('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.map(([p]) => `  <url><loc>${SITE}${p}</loc><lastmod>${new Date().toISOString().slice(0, 10)}</lastmod></url>`).join('\n')}\n</urlset>\n`);

console.log(`Built ${pages.length + 1} pages -> dist/ (${products.length} fonts)`);
if (placeholders) console.warn('Note: catalog still contains placeholder products. Edit data/products.json.');
if (/example\.(com|gumroad)/.test(JSON.stringify(site) + JSON.stringify(products))) console.warn('Note: example.com addresses found. Replace site url/email and Gumroad URLs before launch.');
