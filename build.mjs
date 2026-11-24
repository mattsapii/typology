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
const usd = (n) => `${site.currencySymbol}${n.toLocaleString('en-US')}`;
const LIC = [...site.licenses].sort((a, b) => a.price - b.price);
const fromPrice = (p) => `From ${money(p)}`;
const licSlug = (l) => 'lic-' + l.name.toLowerCase().replace(/ license$/, '').replace(/[^a-z]+/g, '-');
const licenseCards = (list = LIC) => `<ul class="lic-grid">${list.map((l) => `<li class="lic-card" id="${licSlug(l)}"><span class="lic-price">${usd(l.price)}</span><div><h3>${esc(l.name)}</h3><p>${esc(l.text)}</p></div></li>`).join('')}</ul>`;
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

const TEXT_COLORS = [['#1C1B18', 'Ink'], ['#4A5733', 'Olive'], ['#8A3B22', 'Rust'], ['#F2EEE3', 'Paper']];
const BG_COLORS = [['#F2EEE3', 'Paper'], ['#DDE2CB', 'Sage'], ['#EBCFC0', 'Blush'], ['#1C1B18', 'Ink']];
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
  <div class="field t-reset"><button type="button" class="btn link-btn" data-t="reset">Reset</button></div>
</div>`;
}

function card(p, { near = false } = {}) {
  return `<article class="card" data-card data-name="${esc(p.name.toLowerCase())}" data-cat="${p.category}" data-price="${p.price}" data-date="${p.releaseDate}" data-pop="${p.popularity ?? 0}">
  <header class="card-head"><h3><a href="/fonts/${p.slug}/">${esc(p.name)}</a></h3><span class="cat">${esc(catName(p.category))}</span></header>
  <div class="specimen${near ? ' is-near' : ''}" style="--ff:'${esc(p.previewFont)}'" data-default="${esc(p.name)}" ><span data-sp-text>${esc(p.name)}</span></div>
  <footer class="card-foot"><span class="price">${fromPrice(p)}</span><a class="link" href="/fonts/${p.slug}/" aria-label="View details for ${esc(p.name)}">View details</a></footer>
</article>`;
}

// "Best for" use cases on a font page. Each card shows its words in the font,
// or a mockup photo when bestFor[].image is set (path under /images/).
const hexOk = (v, d) => (/^#[0-9a-f]{6}$/i.test(v || '') ? v : d);
function bestFor(p) {
  const list = (p.bestFor || []).slice(0, 3);
  if (!list.length) return '';
  return `<section class="d-section best-for" aria-labelledby="bf-h">
    <div class="sec-head stack"><h2 id="bf-h">Best for</h2><p>Where ${esc(p.name)} looks its best. Select a card to load its words into the tester.</p></div>
    <ul class="bf-grid" role="list">${list.map((c) => {
      const style = `--bf-bg:${hexOk(c.bg, '#1C1B18')};--bf-fg:${hexOk(c.fg, '#F1EDE3')};--ff:'${esc(p.previewFont)}'`;
      const art = c.image
        ? `<img src="${esc(c.image)}" alt="${esc(c.imageAlt || `${p.name} on ${c.title.toLowerCase()}`)}" loading="lazy" decoding="async" width="1200" height="800">`
        : `<span class="bf-words" aria-hidden="true">${esc(c.words)}</span>`;
      return `<li class="bf-card" style="${style}">
        <div class="bf-art${c.image ? ' has-img' : ''}">${art}</div>
        <div class="bf-cap"><div class="bf-txt"><h3>${esc(c.title)}</h3><p>${esc(c.text)}</p></div>
        <button type="button" class="link-btn" data-try="${esc(c.words)}" aria-label="Try “${esc(c.words)}” in the tester">Try these words</button></div>
      </li>`;
    }).join('')}</ul>
  </section>`;
}

function fontRow(p, { near = false } = {}) {
  return `<article class="frow" data-card data-cat="${p.category}" data-name="${esc(p.name.toLowerCase())}" data-price="${p.price}" data-date="${p.releaseDate}" data-pop="${p.popularity ?? 0}">
  <header class="frow-head">
    <div class="frow-name"><h3><a class="frow-link" href="/fonts/${p.slug}/">${esc(p.name)}</a></h3><span class="badge">${esc(catName(p.category))}</span></div>
    <div class="frow-buy"><span class="price">${fromPrice(p)}</span><a class="link" href="/fonts/${p.slug}/" aria-label="Details for ${esc(p.name)}">Details</a><a class="btn sm" href="${esc(p.gumroadUrl)}" target="_blank" rel="noopener">Buy ${esc(p.name)}<span class="sr"> on Gumroad (opens in a new tab)</span></a></div>
  </header>
  <div class="specimen${near ? ' is-near' : ''}" style="--ff:'${esc(p.previewFont)}'" data-default="${esc(p.name)}"><span data-sp-text>${esc(p.name)}</span></div>
</article>`;
}

const nav = [['/shop/', 'Fonts'], ['/licensing/', 'Licensing'], ['/about/', 'About'], ['/faq/', 'FAQ'], ['/contact/', 'Contact']];
const header = (cur) => `<a class="skip" href="#main">Skip to content</a>
<header class="site-head"><div class="wrap"><a class="brand" href="/" aria-label="${site.name} home">${site.name}</a>
<div class="head-right"><nav class="nav" aria-label="Main">${nav.map(([h, t]) => `<a href="${h}"${cur === h ? ' aria-current="page"' : ''}>${t}</a>`).join('')}</nav>
<button type="button" class="theme-toggle" data-theme-toggle aria-pressed="false" aria-label="Switch to dark mode" title="Switch to dark mode"><svg class="moon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M16.5 12.5A7 7 0 0 1 7.5 3.5a7 7 0 1 0 9 9Z"/></svg><svg class="sun" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="10" cy="10" r="3.5"/><path d="M10 1.5v2M10 16.5v2M1.5 10h2M16.5 10h2M4 4l1.4 1.4M14.6 14.6 16 16M4 16l1.4-1.4M14.6 5.4 16 4"/></svg></button></div></div></header>`;

const footer = () => `<footer class="site-foot"><div class="wrap">
<div class="foot-grid">
  <div class="foot-brand"><a class="brand" href="/">${site.name}</a><p>${esc(site.tagline)}. Every font is previewed live before you buy.</p></div>
  <div><h2>Fonts</h2><ul><li><a href="/shop/">All fonts</a></li>${cats.filter((c) => products.some((p) => p.category === c.slug)).map((c) => `<li><a href="/shop/?category=${c.slug}">${esc(c.name)}</a></li>`).join('')}</ul></div>
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
<script src="/js/theme.js?v=${ver}"></script>
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

// ---------- pages ----------
const pages = [];
const add = (p, html) => pages.push([p, html]);

// HOME
{
  const count = (c) => products.filter((p) => p.category === c).length;
  const usedCats = cats.filter((c) => count(c.slug));
  const soonCats = cats.filter((c) => !count(c.slug));
  const list = [...products].sort((a, b) => b.releaseDate.localeCompare(a.releaseDate));
  const newest = list[0];
  const heroSvg = read('src/images/hero-your-words.svg').replace('<svg ', '<svg class="hero-svg" aria-hidden="true" focusable="false" ');
  const soonText = soonCats.length ? `${soonCats.map((c) => c.name.toLowerCase().replace(' handwritten', '')).join(', ').replace(/, ([^,]*)$/, ' and $1')} fonts are on the way.` : '';

  const body = `
<section class="hero" aria-labelledby="hero-h"><div class="wrap">
  <h1 id="hero-h" class="sr">Your words, handwritten: bubble, retro and handwritten fonts you can test before you buy</h1>
  <figure class="hero-art">${heroSvg}<figcaption>${esc(site.heroCaption || '')}</figcaption></figure>
  <div class="hero-intro">
    <p>Type your brand name, a quote or a wedding date and see it in every ${site.name} font before you pay. Signatures, brush scripts, monolines and playful lettering from an independent foundry.</p>
    <div class="hero-cta"><a class="btn" href="#tester">Try your words</a><a class="btn ghost" href="/shop/">Browse all fonts</a></div>
  </div>
</div></section>

<section class="section" id="tester" aria-labelledby="tester-h"><div class="wrap">
  <div class="sec-head stack"><h2 id="tester-h">Test every font with your own words</h2><p>Type once. Every specimen below changes, set in each font's real file.</p></div>
  ${testerControls({ id: 'home' })}
  <p class="tester-note" id="tester-note">Leave the field empty to see each font's name. Your settings carry over to the shop and font pages.</p>
  <div class="chip-row">
    <div class="chips" role="group" aria-label="Filter fonts by category">
      <button type="button" class="chip" data-filter="all" aria-pressed="true">All<span class="n">${products.length}</span></button>
      ${usedCats.map((c) => `<button type="button" class="chip" data-filter="${c.slug}" aria-pressed="false">${esc(c.name)}<span class="n">${count(c.slug)}</span></button>`).join('')}
    </div>
    ${soonText ? `<p class="muted small">${esc(soonText.charAt(0).toUpperCase() + soonText.slice(1))}</p>` : ''}
  </div>
  <div class="frows" data-gallery>${list.slice(0, 8).map((p, i) => fontRow(p, { near: i === 0 })).join('')}</div>
  ${products.length > 8 ? `<p style="margin-top:1.5rem"><a class="link" href="/shop/">See all ${products.length} fonts</a></p>` : `<div class="soon-row"><p>More handwritten fonts are on the way.</p></div>`}
</div></section>

${newest ? `<section class="section" aria-labelledby="show-h"><div class="wrap">
  <div class="sec-head stack"><h2 id="show-h">${esc(newest.name)} at work</h2><p>Our newest font, set large.</p></div>
  <div class="spec-panels" style="font-family:'${esc(newest.previewFont)}',var(--ui)">
    <div class="spec-panel dark"><p>Made with Love</p></div>
    <div class="spec-panel sage"><p>Every line<br>has a pulse</p></div>
  </div>
  <p class="spec-caption"><span>${esc(newest.name)}, ${esc(catName(newest.category))}</span><a class="link" href="/fonts/${newest.slug}/">See ${esc(newest.name)}</a></p>
</div></section>` : ''}

<section class="section" aria-labelledby="about-h"><div class="wrap about-one">
  <h2 id="about-h">About ${site.name}</h2>
  <p class="lede">We make handwritten fonts that keep the irregularity of a real hand and still set cleanly on screen and in print.</p>
  <p class="muted">${site.name} is an independent foundry. Each typeface is drawn, spaced and kerned in-house, then checked in real words and sentences, not only in alphabets.</p>
  <p><a class="link" href="/about/">Read more about the studio</a></p>
</div></section>
`;

  add('/', layout({
    title: `${site.name} | Bubble, retro and handwritten display fonts`,
    desc: `Independent foundry for bubble, retro and handwritten display fonts. Type your own words to test every font, then buy a license from ${usd(LIC[0].price)}.`,
    path: '/', cur: '/', body, scripts: ['home'],
    preload: newest ? [newest.previewFontFile] : [],
    ld: [orgLD, { '@context': 'https://schema.org', '@type': 'WebSite', name: site.name, url: SITE }],
  }));
}

// SHOP
{
  const counts = (c) => products.filter((p) => p.category === c).length;
  const usedCats = cats.filter((c) => counts(c.slug));
  const soonCats = cats.filter((c) => !counts(c.slug));
  const soonText = soonCats.length ? `${soonCats.map((c) => c.name.toLowerCase().replace(' handwritten', '')).join(', ').replace(/, ([^,]*)$/, ' and $1')} fonts are on the way.` : '';
  const big = products.length >= (site.shopControlsFrom || 6);
  const list = [...products].sort((a, b) => b.releaseDate.localeCompare(a.releaseDate));
  const body = `
<div class="wrap page-title"><h1>All fonts</h1><p>Type your words once and compare every font side by side.</p></div>
<div class="wrap shop">
  ${testerControls({ id: 'shop', max: 160 })}
  <p class="tester-note">Leave the field empty to see each font's name. Your settings carry over to the home and font pages.</p>
  ${big ? `<div class="shop-tools">
    <div class="field"><label for="q">Search by font name</label><input type="search" id="q" data-q placeholder="Search fonts" autocomplete="off"></div>
    <div class="field"><label for="sort">Sort by</label><select id="sort" data-sort><option value="newest">Newest</option><option value="popular">Popularity</option><option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option><option value="name">Name</option></select></div>
    <div class="field"><span class="label" id="v-l">View</span><div class="seg" role="group" aria-labelledby="v-l"><button type="button" data-view="list" aria-pressed="true" aria-label="List view">${icons.list}</button><button type="button" data-view="grid" aria-pressed="false" aria-label="Grid view">${icons.grid}</button></div></div>
  </div>` : ''}
  <div class="chip-row shop-bar">
    <div class="chips" role="group" aria-label="Filter by category">
      <button type="button" class="chip" data-cat-chip="all" aria-pressed="true">All<span class="n">${products.length}</span></button>
      ${usedCats.map((c) => `<button type="button" class="chip" data-cat-chip="${c.slug}" aria-pressed="false">${esc(c.name)}<span class="n">${counts(c.slug)}</span></button>`).join('')}
    </div>
    ${soonText ? `<p class="muted small">${esc(soonText.charAt(0).toUpperCase() + soonText.slice(1))}</p>` : ''}
    <p class="muted shop-count" role="status" aria-live="polite"><span data-count>${products.length === 1 ? '1 font' : products.length + ' fonts'}</span><button type="button" class="link-btn" data-clear hidden>Clear filters</button></p>
  </div>
  <h2 class="sr">Catalog</h2>
  <div class="frows" data-grid>${list.map((p, i) => fontRow(p, { near: i < 2 })).join('')}</div>
  <div class="empty" data-empty hidden><h2>No fonts match</h2><p>Try a shorter name or another category, or clear the filters to see every font.</p><button type="button" class="btn" data-clear>Clear filters</button></div>
  ${big ? '' : '<div class="soon-row"><p>More handwritten fonts are on the way.</p></div>'}
  <div style="height:clamp(3rem,6vw,5rem)"></div>
</div>`;
  add('/shop/', layout({
    title: 'All fonts: bubble, retro and handwritten',
    desc: `Browse every ${site.name} font: bubble, retro and handwritten display fonts. Type your words once and compare them side by side. Licenses from ${usd(LIC[0].price)}.`,
    path: '/shop/', cur: '/shop/', body, scripts: ['shop'],
    ld: [breadcrumbLD([['Home', '/'], ['Fonts', '/shop/']]), { '@context': 'https://schema.org', '@type': 'ItemList', name: 'Typology fonts', itemListElement: list.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE}/fonts/${p.slug}/`, name: p.name })) }],
  }));
}

// DETAIL
const SPECIMEN = 'Whereas disregard and contempt for human rights have resulted';
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
  const kindOf = (g) => (/[A-Z]/.test(g) ? 'upper' : /[a-z]/.test(g) ? 'lower' : /[0-9]/.test(g) ? 'num' : 'punct');
  const kindName = { upper: 'Uppercase', lower: 'Lowercase', num: 'Number', punct: 'Punctuation and symbols' };
  const order = { upper: 0, lower: 1, num: 2, punct: 3 };
  glyphs.sort((a, z) => order[kindOf(a)] - order[kindOf(z)]);
  const firstGlyph = glyphs.find((g) => /[A-Z]/.test(g)) || glyphs[0];
  const tabs = [['all', `All ${glyphCount}`], ['upper', 'Uppercase'], ['lower', 'Lowercase'], ['num', 'Numbers'], ['punct', 'Punctuation']];
  const presets = [['Pangram', SPECIMEN], ['Brand name', site.presetBrand || 'Maple & Moss Bakery'], ['Quote', 'Every line has a pulse'], ['A to Z', 'ABCDEFGHIJKLM NOPQRSTUVWXYZ abcdefghijklm nopqrstuvwxyz']];
  const released = new Date(p.releaseDate + 'T00:00:00Z').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
  const formats = (p.formats || ['OTF', 'TTF']).filter((f) => f !== 'WOFF2');
  const body = `
<div class="wrap" style="--ff:'${esc(p.previewFont)}'">
  <div class="fp-top">
    <div class="fp-title">
      <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/shop/">Fonts</a> / <a href="/shop/?category=${p.category}">${esc(catName(p.category))}</a> / <span aria-current="page">${esc(p.name)}</span></nav>
      <h1>${esc(p.name)}</h1>
      <ul class="badges" aria-label="Font facts"><li class="badge">${esc(catName(p.category))}</li><li class="badge">${p.fontStyles.length} ${p.fontStyles.length === 1 ? 'style' : 'styles'}</li><li class="badge">${glyphCount} glyphs</li>${formats.map((f) => `<li class="badge">${esc(f)}</li>`).join('')}</ul>
      <div class="fp-desc">${p.description.split(/\n\s*\n/).map((x) => `<p>${esc(x)}</p>`).join('')}</div>
    </div>
    <aside class="buy-panel" aria-label="Buy ${esc(p.name)}">
      <p class="bp-price"><span class="muted">From</span><span class="price">${money(p)}</span><span class="muted">${esc(LIC[0].name)}</span></p>
      <dl class="bp-rows"><dt>File</dt><dd>${esc(formats.join(', '))}, desktop install</dd><dt>Characters</dt><dd>${glyphCount} glyphs, ${esc(p.languageSupport.join(', '))}</dd><dt>Licenses</dt><dd>${LIC.length} options, ${usd(LIC[0].price)} to ${usd(LIC[LIC.length - 1].price)}</dd></dl>
      ${buy(`Buy ${esc(p.name)}`).replace('class="btn lg', 'class="btn block')}
      <p class="small muted">Choose your license on the Gumroad page. Pay once and download the files right after checkout.</p>
      <a class="link small" href="#lic-h">Compare licenses</a>
    </aside>
  </div>

  <div class="d-tester">
    <div class="d-tools" role="region" aria-label="Specimen controls">${testerControls({ id: 'd', textLabel: `Type to preview ${p.name}`, placeholder: 'Type a name, a quote or a date', max: 240 })}
      <div class="presets" role="group" aria-label="Sample text"><span class="small muted">Try:</span>${presets.map(([n, t], k) => `<button type="button" class="chip sm" data-preset="${esc(t)}" aria-pressed="${k === 0}">${esc(n)}</button>`).join('')}</div>
    </div>
    <div class="d-stage"><div class="specimen is-near" style="--ff:'${esc(p.previewFont)}'" data-default="${esc(SPECIMEN)}"><span data-sp-text>${esc(SPECIMEN)}</span></div></div>
  </div>

  ${bestFor(p)}
  <section class="d-section" aria-labelledby="chars-h">
    <div class="sec-head stack"><h2 id="chars-h">Characters</h2><p>${glyphCount} glyphs. Select one to see it large.</p></div>
    <div class="tabs" role="tablist" aria-label="Character groups">${tabs.map(([k, l], n) => `<button type="button" role="tab" data-tab="${k}" aria-selected="${n === 0}">${esc(l)}</button>`).join('')}</div>
    <div class="glyph-layout">
      <div class="glyph-grid" role="group" aria-label="Characters in ${esc(p.name)}">${glyphs.map((g) => `<button type="button" data-glyph="${esc(g)}" data-kind="${kindOf(g)}" aria-pressed="${g === firstGlyph}" aria-label="${kindName[kindOf(g)]} ${esc(g)}">${esc(g)}</button>`).join('')}</div>
      <div class="glyph-view" aria-live="polite"><div><div class="big" data-glyph-big aria-hidden="true">${esc(firstGlyph)}</div><div class="code" data-glyph-code>${kindName[kindOf(firstGlyph)]} ${esc(firstGlyph)}&nbsp;&nbsp; U+${firstGlyph.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}</div></div></div>
    </div>
  </section>

  ${feats.some((f) => f.toggle) ? `<section class="d-section" aria-labelledby="ot-h"><h2 id="ot-h">OpenType features</h2>
    <p class="hint">Switch features on and off and watch the specimen above change.</p>
    <ul class="feat-list">${feats.filter((f) => f.toggle).map((f) => `<li><label><input type="checkbox" data-feature="${f.tag}"${['liga', 'calt'].includes(f.tag) ? ' checked' : ''}><span>${esc(f.label)}</span><code>${f.tag}</code></label></li>`).join('')}</ul>
  </section>` : ''}

  <div class="d-section fp-two">
    <section aria-labelledby="spec-h"><h2 id="spec-h">Specifications</h2>
      <dl class="specs">
        <dt>Category</dt><dd>${esc(catName(p.category))}</dd>
        <dt>Styles</dt><dd>${esc(p.fontStyles.join(', '))}</dd>
        <dt>Glyphs</dt><dd>${glyphCount}</dd>
        <dt>Languages</dt><dd>${esc(p.languageSupport.join(', '))}</dd>
        <dt>File format</dt><dd>${esc(formats.join(', '))}</dd>
        <dt>Released</dt><dd><time datetime="${p.releaseDate}">${released}</time></dd>
      </dl>
    </section>
    <section aria-labelledby="lic-h"><h2 id="lic-h">Licenses</h2>
      <p class="muted">Pick the license that matches how you will use ${esc(p.name)}. Prices are one-time, per font.</p>
      <dl class="lic-mini">${LIC.map((l) => `<dt>${esc(l.name)}</dt><dd>${usd(l.price)}</dd>`).join('')}</dl>
      <p><a class="link" href="/licensing/">What each license covers</a></p>
    </section>
  </div>

  <section class="related" aria-labelledby="rel-h">
    ${related.length ? `<h2 id="rel-h" class="d-h2">Related fonts</h2><div class="frows">${related.map((x) => fontRow(x)).join('')}</div>` : `<h2 id="rel-h" class="sr">More fonts</h2><div class="more-row"><p>${esc(p.name)} is our first release. More handwritten fonts are on the way.</p><a class="link" href="/shop/">Browse all fonts</a></div>`}
  </section>
</div>
`;

  const url = `/fonts/${p.slug}/`;
  add(url, layout({
    title: p.seoTitle || `${p.name}: ${catName(p.category)} font`,
    desc: p.seoDescription || `${p.name} is a ${catName(p.category).toLowerCase()} font by ${site.name}. Test it with your own text, inspect every glyph, then license it from ${money(p)}.`,
    path: url, body, scripts: ['detail'], preload: [p.previewFontFile], ogImage: p.productImage, ogType: 'product',
    head: site.gumroadOverlay ? '<script src="https://gumroad.com/js/gumroad.js" async></script>' : '',
    ld: [breadcrumbLD([['Home', '/'], ['Fonts', '/shop/'], [p.name, url]]), {
      '@context': 'https://schema.org', '@type': 'Product', name: p.name, description: p.description, sku: p.id, category: catName(p.category),
      image: [SITE + p.productImage, ...p.specimenImages.map((i) => SITE + i.src)], brand: { '@type': 'Brand', name: site.name },
      offers: { '@type': 'AggregateOffer', lowPrice: p.price, highPrice: LIC[LIC.length - 1].price, offerCount: LIC.length, priceCurrency: p.currency || 'USD', availability: 'https://schema.org/InStock', url: p.gumroadUrl },
    }],
  }));
}

// STATIC PAGES
const prose = (title, lead, inner) => `<div class="wrap page-title"><h1>${title}</h1>${lead ? `<p>${lead}</p>` : ''}</div><div class="wrap" style="padding-bottom:clamp(3rem,7vw,6rem)"><div class="prose">${inner}</div></div>`;
const stamp = `<p class="stamp">Last updated ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}.</p>`;

add('/licensing/', layout({
  title: 'Font licenses and pricing', desc: `${site.name} font licenses from ${usd(LIC[0].price)}: desktop, webfont, social media, ads, logo, merchandise, apps, broadcast and corporate use.`, path: '/licensing/', cur: '/licensing/',
  ld: [breadcrumbLD([['Home', '/'], ['Licensing', '/licensing/']])],
  body: `<div class="wrap page-title"><h1>Pick the license for how you'll use the font</h1><p>Every ${site.name} font has the same nine licenses. You pay once per font, in US dollars, and choose the license on the Gumroad checkout page.</p></div>
<div class="wrap" style="padding-bottom:clamp(3rem,7vw,6rem)">
  <section class="lic-finder" aria-labelledby="find-h">
    <h2 id="find-h">Find your license</h2>
    <table><thead><tr><th scope="col">You want to use the font for</th><th scope="col">License</th><th scope="col">Price</th></tr></thead>
    <tbody>${LIC.map((l) => `<tr><td>${esc(l.useCase)}</td><td><a href="#${licSlug(l)}">${esc(l.name.replace(/ License$/, ''))}</a></td><td>${usd(l.price)}</td></tr>`).join('')}</tbody></table>
  </section>
  <h2 class="lic-h2">What each license covers</h2>
  ${licenseCards()}
  <div class="prose lic-rules">
    <h2>How licenses work</h2>
    <ul><li>One payment per font. No subscription and no renewals.</li><li>A license covers only the use on its card. A second kind of use needs a second license.</li></ul>
    <h2>What no license allows</h2>
    <ul><li>Sharing, reselling or giving away the font files.</li><li>Uploading the font to a public font library or a font-generator service.</li><li>Editing the files and selling the result as a new font.</li></ul>
    <h2>Not sure which one fits?</h2>
    <p>Tell us what you are making and where it will appear. We will reply with the license you need. <a href="/contact/">Ask which license fits</a></p>
    <h2>Previews on this site</h2>
    <p>The live previews are for testing only. They do not give you the right to use the font anywhere else.</p>
    ${stamp}
  </div>
</div>`,
}));

add('/about/', layout({
  title: 'About', desc: `${site.name} is an independent foundry that designs handwritten fonts: signatures, brush scripts, casual handwriting and monoline lettering.`, path: '/about/', cur: '/about/',
  ld: [breadcrumbLD([['Home', '/'], ['About', '/about/']]), orgLD],
  body: `<div class="wrap page-title"><h1>About ${site.name}</h1></div>
<div class="wrap" style="padding-bottom:clamp(3rem,7vw,6rem)"><div class="split"><p class="lede">${site.name} is an independent foundry for handwritten typefaces.</p>
<div class="prose"><p>Each font starts as real handwriting. We draw the letters, build the connections, then spend most of the time on spacing and kerning, because a handwritten font only feels human when the rhythm between letters is right.</p>
<p>We test every release in whole words and sentences, in the same live tester you can use on this site, so you see how a font behaves with your text before you buy.</p>
<p>Fonts are sold directly through Gumroad. You pay once, download the files and use them under a clear license.</p>
<p><a class="btn" href="/shop/">Explore fonts</a></p></div></div></div>`,
}));

const faqs = [
  ['How do I buy a font?', 'Open a font page and choose Buy. On the Gumroad page, pick the license you need, pay there and download the files straight away.'],
  ['What do I receive after purchase?', 'The font files in the formats listed on each font page, ready to install on Windows, macOS and Linux.'],
  ['Are the previews the real fonts?', 'Yes. The tester uses a web version of each font file, so letter shapes and spacing match what you download.'],
  ['Can I use the fonts on a website or in an app?', 'Yes, with the right license. A website needs the Webfont License. Apps and games need the Ads and Platform License. The licensing page lists every option and price.'],
  ['Do you offer refunds?', 'Refunds are handled through Gumroad. If something is wrong with your files, contact us and we will fix it.'],
  ['A character is missing. What now?', 'Look at the glyph grid on the font page before you buy. If you need a character that is missing, contact us.'],
  ['Where is my receipt or download link?', 'Gumroad emails both after payment. You can also use the link in the receipt to download again.'],
];
add('/faq/', layout({
  title: 'Font buying and licensing FAQ', desc: `Answers about buying, licensing and using ${site.name} handwritten fonts.`, path: '/faq/', cur: '/faq/',
  ld: [breadcrumbLD([['Home', '/'], ['FAQ', '/faq/']]), { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqs.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) }],
  body: `<div class="wrap page-title"><h1>Font buying and licensing FAQ</h1><p>Short answers about buying and using our fonts.</p></div><div class="wrap" style="padding-bottom:clamp(3rem,7vw,6rem)"><div class="faq">${faqs.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</div></div>`,
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
<div><button class="btn lg" type="submit">Open my email app</button></div>
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
<h2>Email</h2><p>If you write to us, we use your email address only to reply.</p>
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
const newestRelease = products.map((p) => p.updated || p.releaseDate).sort().pop();
const lastmod = (path) => {
  const f = products.find((p) => path === `/fonts/${p.slug}/`);
  if (f) return f.updated || f.releaseDate;
  if (path === '/' || path === '/shop/') return [newestRelease, site.pagesUpdated].sort().pop();
  return site.pagesUpdated || newestRelease;
};
out('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.map(([p]) => `  <url><loc>${SITE}${p}</loc><lastmod>${lastmod(p)}</lastmod></url>`).join('\n')}\n</urlset>\n`);

console.log(`Built ${pages.length + 1} pages -> dist/ (${products.length} fonts)`);
if (placeholders) console.warn('Note: catalog still contains placeholder products. Edit data/products.json.');
if (/example\.(com|gumroad)/.test(JSON.stringify(site) + JSON.stringify(products))) console.warn('Note: example.com addresses found. Replace site url/email and Gumroad URLs before launch.');
