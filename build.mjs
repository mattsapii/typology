// Letter Moss static site generator. No dependencies. Run: node build.mjs  ->  dist/
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

// Two palettes that swap with the theme: same order, so the default is always first.
const TEXT_COLORS = { light: [['#1C1B18', 'Ink'], ['#4A5733', 'Olive'], ['#8A3B22', 'Rust'], ['#F2EEE3', 'Paper']], dark: [['#F2EEE3', 'Paper'], ['#DDE2CB', 'Sage'], ['#EBCFC0', 'Blush'], ['#1C1B18', 'Ink']] };
const BG_COLORS = { light: [['#F2EEE3', 'Paper'], ['#DDE2CB', 'Sage'], ['#EBCFC0', 'Blush'], ['#1C1B18', 'Ink']], dark: [['#1C1B18', 'Ink'], ['#2F3B24', 'Deep olive'], ['#4B2616', 'Deep rust'], ['#F2EEE3', 'Paper']] };
const swatches = (kind, lists) => ['light', 'dark'].map((set) => lists[set].map(([v, n]) => `<button type="button" class="sw" style="--c:${v}" data-t="${kind}" data-set="${set}" data-value="${v}" aria-pressed="false" aria-label="${n}" title="${n}"></button>`).join('')).join('');

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

const LOGO_PATHS = '<path d="M79.1796 64.4133C81.1623 53.5471 91.578 46.3457 102.444 48.3283C113.31 50.3111 120.512 60.7267 118.529 71.593L75.2762 308.638C73.4843 318.459 81.0277 327.503 91.0106 327.503C98.8978 327.503 105.608 321.753 106.816 313.959L112.091 279.939C113.783 269.024 124.004 261.547 134.919 263.239C145.834 264.932 153.31 275.152 151.618 286.068L146.344 320.088C142.113 347.374 118.623 367.503 91.0106 367.503C56.0615 367.503 29.6524 335.84 35.9257 301.458L79.1796 64.4133ZM206.895 48.0031C244.345 48.0032 272.643 81.9324 265.921 118.774L229.352 319.184C228.562 323.515 231.888 327.503 236.291 327.503C239.698 327.503 242.618 325.068 243.229 321.716L284.19 97.2326C289.393 68.7206 314.233 48.0033 343.216 48.0031H349.395C386.845 48.0032 415.143 81.9324 408.421 118.774L374.639 303.913C372.398 316.194 381.83 327.503 394.313 327.503H405.354C416.4 327.503 425.354 336.457 425.354 347.503C425.354 358.549 416.4 367.503 405.354 367.503H394.313C356.864 367.503 328.566 333.574 335.288 296.733L369.07 111.593C371.311 99.3127 361.878 88.0032 349.395 88.0031H343.216C333.555 88.0033 325.275 94.9094 323.541 104.413L282.58 328.896C278.5 351.255 259.02 367.503 236.291 367.503C206.922 367.503 184.73 340.895 190.002 312.003L226.57 111.593C228.811 99.3127 219.378 88.0032 206.895 88.0031H206.057C196.432 88.0032 188.172 94.8596 186.399 104.32L161.513 237.186C159.479 248.042 149.028 255.195 138.172 253.161C127.315 251.128 120.163 240.677 122.196 229.82L147.083 96.9562C152.399 68.573 177.181 48.0032 206.057 48.0031H206.895Z"/><path d="M745.481 311.552C736.521 311.552 729.401 309.752 724.121 306.152C718.841 302.552 715.961 297.592 715.481 291.272H731.561C731.961 293.992 733.321 296.072 735.641 297.512C738.041 298.872 741.321 299.552 745.481 299.552C749.241 299.552 751.961 299.032 753.641 297.992C755.401 296.872 756.281 295.312 756.281 293.312C756.281 291.792 755.761 290.632 754.721 289.832C753.761 288.952 751.961 288.232 749.321 287.672L739.481 285.632C732.201 284.112 726.841 281.832 723.401 278.792C719.961 275.672 718.241 271.672 718.241 266.792C718.241 260.872 720.521 256.272 725.081 252.992C729.641 249.632 736.001 247.952 744.161 247.952C752.241 247.952 758.681 249.592 763.481 252.872C768.281 256.072 770.921 260.552 771.401 266.312H755.321C755.001 264.232 753.881 262.672 751.961 261.632C750.041 260.512 747.321 259.952 743.801 259.952C740.601 259.952 738.201 260.432 736.601 261.392C735.081 262.272 734.321 263.552 734.321 265.232C734.321 266.672 734.961 267.832 736.241 268.712C737.521 269.512 739.641 270.232 742.601 270.872L753.641 273.152C759.801 274.432 764.441 276.832 767.561 280.352C770.761 283.792 772.361 287.872 772.361 292.592C772.361 298.592 770.001 303.272 765.281 306.632C760.641 309.912 754.041 311.552 745.481 311.552Z"/><path d="M686.474 311.552C677.514 311.552 670.394 309.752 665.114 306.152C659.834 302.552 656.954 297.592 656.474 291.272H672.554C672.954 293.992 674.314 296.072 676.634 297.512C679.034 298.872 682.314 299.552 686.474 299.552C690.234 299.552 692.954 299.032 694.634 297.992C696.394 296.872 697.274 295.312 697.274 293.312C697.274 291.792 696.754 290.632 695.714 289.832C694.754 288.952 692.954 288.232 690.314 287.672L680.474 285.632C673.194 284.112 667.834 281.832 664.394 278.792C660.954 275.672 659.234 271.672 659.234 266.792C659.234 260.872 661.514 256.272 666.074 252.992C670.634 249.632 676.994 247.952 685.154 247.952C693.234 247.952 699.674 249.592 704.474 252.872C709.274 256.072 711.914 260.552 712.394 266.312H696.314C695.994 264.232 694.874 262.672 692.954 261.632C691.034 260.512 688.314 259.952 684.794 259.952C681.594 259.952 679.194 260.432 677.594 261.392C676.074 262.272 675.314 263.552 675.314 265.232C675.314 266.672 675.954 267.832 677.234 268.712C678.514 269.512 680.634 270.232 683.594 270.872L694.634 273.152C700.794 274.432 705.434 276.832 708.554 280.352C711.754 283.792 713.354 287.872 713.354 292.592C713.354 298.592 710.994 303.272 706.274 306.632C701.634 309.912 695.034 311.552 686.474 311.552Z"/><path d="M620.421 311.552C613.701 311.552 607.781 310.232 602.661 307.592C597.621 304.872 593.661 301.112 590.781 296.312C587.981 291.432 586.581 285.832 586.581 279.512C586.581 273.192 587.981 267.672 590.781 262.952C593.661 258.232 597.621 254.552 602.661 251.912C607.781 249.272 613.701 247.952 620.421 247.952C627.221 247.952 633.141 249.272 638.181 251.912C643.301 254.552 647.261 258.232 650.061 262.952C652.861 267.672 654.261 273.192 654.261 279.512C654.261 285.832 652.821 291.432 649.941 296.312C647.141 301.112 643.181 304.872 638.061 307.592C633.021 310.232 627.141 311.552 620.421 311.552ZM620.421 297.392C623.221 297.392 625.741 296.672 627.981 295.232C630.301 293.792 632.141 291.752 633.501 289.112C634.861 286.392 635.541 283.152 635.541 279.392C635.541 273.872 634.061 269.632 631.101 266.672C628.221 263.632 624.661 262.112 620.421 262.112C616.181 262.112 612.581 263.632 609.621 266.672C606.741 269.712 605.301 273.952 605.301 279.392C605.301 283.152 605.981 286.392 607.341 289.112C608.701 291.752 610.501 293.792 612.741 295.232C615.061 296.672 617.621 297.392 620.421 297.392Z"/><path d="M485.354 310.352V223.952H514.154L538.154 307.232H527.714L551.714 223.952H580.634V310.352H562.394V229.112H565.514L542.114 310.352H523.034L499.874 229.832H502.874V310.352H485.354Z"/><path d="M776.195 190.352V129.152H793.835V143.552H794.195V190.352H776.195ZM794.195 158.432L792.635 143.912C794.075 138.712 796.435 134.752 799.715 132.032C802.995 129.312 807.075 127.952 811.955 127.952C813.475 127.952 814.595 128.112 815.315 128.432V145.232C814.915 145.072 814.355 144.992 813.635 144.992C812.915 144.912 812.035 144.872 810.995 144.872C805.235 144.872 800.995 145.912 798.275 147.992C795.555 149.992 794.195 153.472 794.195 158.432Z"/><path d="M738.489 191.552C731.689 191.552 725.769 190.232 720.729 187.592C715.689 184.872 711.769 181.112 708.969 176.312C706.249 171.512 704.889 165.992 704.889 159.752C704.889 153.432 706.249 147.912 708.969 143.192C711.769 138.392 715.649 134.672 720.609 132.032C725.569 129.312 731.329 127.952 737.889 127.952C744.209 127.952 749.689 129.232 754.329 131.792C758.969 134.352 762.569 137.912 765.129 142.472C767.689 147.032 768.969 152.392 768.969 158.552C768.969 159.832 768.929 161.032 768.849 162.152C768.769 163.192 768.649 164.192 768.489 165.152H715.449V153.272H753.969L750.849 155.432C750.849 150.472 749.649 146.832 747.249 144.512C744.929 142.112 741.729 140.912 737.649 140.912C732.929 140.912 729.249 142.512 726.609 145.712C724.049 148.912 722.769 153.712 722.769 160.112C722.769 166.352 724.049 170.992 726.609 174.032C729.249 177.072 733.169 178.592 738.369 178.592C741.249 178.592 743.729 178.112 745.809 177.152C747.889 176.192 749.449 174.632 750.489 172.472H767.409C765.409 178.392 761.969 183.072 757.089 186.512C752.289 189.872 746.089 191.552 738.489 191.552Z"/><path d="M692.73 191.672C684.89 191.672 679.05 189.792 675.21 186.032C671.45 182.192 669.57 176.392 669.57 168.632V115.472L687.57 108.752V169.232C687.57 171.952 688.33 173.992 689.85 175.352C691.37 176.712 693.73 177.392 696.93 177.392C698.13 177.392 699.25 177.272 700.29 177.032C701.33 176.792 702.37 176.512 703.41 176.192V189.872C702.37 190.432 700.89 190.872 698.97 191.192C697.13 191.512 695.05 191.672 692.73 191.672ZM658.17 142.832V129.152H703.41V142.832H658.17Z"/><path d="M644.388 191.672C636.548 191.672 630.708 189.792 626.868 186.032C623.108 182.192 621.228 176.392 621.228 168.632V115.472L639.228 108.752V169.232C639.228 171.952 639.988 173.992 641.508 175.352C643.028 176.712 645.388 177.392 648.588 177.392C649.788 177.392 650.908 177.272 651.948 177.032C652.988 176.792 654.028 176.512 655.068 176.192V189.872C654.028 190.432 652.548 190.872 650.628 191.192C648.788 191.512 646.708 191.672 644.388 191.672ZM609.828 142.832V129.152H655.068V142.832H609.828Z"/><path d="M579.282 191.552C572.482 191.552 566.562 190.232 561.522 187.592C556.482 184.872 552.562 181.112 549.762 176.312C547.042 171.512 545.682 165.992 545.682 159.752C545.682 153.432 547.042 147.912 549.762 143.192C552.562 138.392 556.442 134.672 561.402 132.032C566.362 129.312 572.122 127.952 578.682 127.952C585.002 127.952 590.482 129.232 595.122 131.792C599.762 134.352 603.362 137.912 605.922 142.472C608.482 147.032 609.762 152.392 609.762 158.552C609.762 159.832 609.723 161.032 609.643 162.152C609.563 163.192 609.443 164.192 609.283 165.152H556.242V153.272H594.762L591.642 155.432C591.642 150.472 590.442 146.832 588.042 144.512C585.722 142.112 582.522 140.912 578.442 140.912C573.722 140.912 570.042 142.512 567.402 145.712C564.842 148.912 563.562 153.712 563.562 160.112C563.562 166.352 564.842 170.992 567.402 174.032C570.042 177.072 573.962 178.592 579.162 178.592C582.042 178.592 584.522 178.112 586.603 177.152C588.682 176.192 590.242 174.632 591.282 172.472H608.202C606.202 178.392 602.762 183.072 597.882 186.512C593.082 189.872 586.882 191.552 579.282 191.552Z"/><path d="M485.354 190.352V103.952H503.834V190.352H485.354ZM493.994 190.352V176.192H545.354V190.352H493.994Z"/>';
const logo = (label) => `<a class="brand" href="/" aria-label="${site.name}${label ? ' home' : ''}"><svg class="brand-mark" viewBox="35 48 781 320" fill="currentColor" aria-hidden="true" focusable="false">${LOGO_PATHS}</svg></a>`;

const nav = [['/shop/', 'Fonts'], ['/licensing/', 'Licensing'], ['/about/', 'About'], ['/faq/', 'FAQ'], ['/contact/', 'Contact']];
const header = (cur) => `<a class="skip" href="#main">Skip to content</a>
<header class="site-head"><div class="wrap">${logo(true)}
<div class="head-right"><nav class="nav" aria-label="Main">${nav.map(([h, t]) => `<a href="${h}"${cur === h ? ' aria-current="page"' : ''}>${t}</a>`).join('')}</nav>
<button type="button" class="theme-toggle" data-theme-toggle aria-pressed="false" aria-label="Switch to dark mode" title="Switch to dark mode"><svg class="moon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M16.5 12.5A7 7 0 0 1 7.5 3.5a7 7 0 1 0 9 9Z"/></svg><svg class="sun" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="10" cy="10" r="3.5"/><path d="M10 1.5v2M10 16.5v2M1.5 10h2M16.5 10h2M4 4l1.4 1.4M14.6 14.6 16 16M4 16l1.4-1.4M14.6 5.4 16 4"/></svg></button></div></div></header>`;

const footer = () => `<footer class="site-foot"><div class="wrap">
<div class="foot-grid">
  <div class="foot-brand">${logo(false)}<p>${esc(site.slogan)} ${esc(site.tagline)}, previewed live before you buy.</p></div>
  <div><h2>Fonts</h2><ul><li><a href="/shop/">All fonts</a></li>${cats.filter((c) => products.some((p) => p.category === c.slug)).map((c) => `<li><a href="/shop/?category=${c.slug}">${esc(c.name)}</a></li>`).join('')}</ul></div>
  <div><h2>Studio</h2><ul><li><a href="/about/">About</a></li><li><a href="/contact/">Contact</a></li><li><a href="/faq/">FAQ</a></li>${site.instagram ? `<li><a href="${esc(site.instagram)}" rel="noopener">Instagram</a></li>` : ''}</ul></div>
  <div><h2>Legal</h2><ul><li><a href="/licensing/">Licensing</a></li><li><a href="/privacy/">Privacy</a></li><li><a href="/terms/">Terms</a></li></ul></div>
</div>
<div class="foot-base"><span>© ${new Date().getFullYear()} ${site.name}</span><span>Checkout and delivery by Gumroad</span></div></div></footer>`;

function layout({ title, desc, path: p, cur = '', body, ld = [], scripts = [], preload = [], ogImage, ogType = 'website', noindex = false, head = '' }) {
  const url = SITE + p;
  const img = SITE + (ogImage || '/og-image.png');
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
<link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
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
const orgLD = { '@context': 'https://schema.org', '@type': 'Organization', name: site.name, url: SITE, logo: SITE + '/icon-512.png', slogan: site.slogan, description: site.tagline };

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
    <p>Type your brand name, a quote or a wedding date and see it in every ${site.name} font before you pay. Handwritten, playful and bubble lettering from a small, independent foundry.</p>
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
  <p class="lede">We make handwritten fonts that keep the wobble of a real hand and still set cleanly on screen and in print.</p>
  <p class="muted">${site.name} is a small, independent foundry. Like moss, we grow slowly, one stroke at a time: every font is drawn, spaced and kerned in-house, then tested in real words and sentences, not only in alphabets.</p>
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
    ld: [breadcrumbLD([['Home', '/'], ['Fonts', '/shop/']]), { '@context': 'https://schema.org', '@type': 'ItemList', name: `${site.name} fonts`, itemListElement: list.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE}/fonts/${p.slug}/`, name: p.name })) }],
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
  title: 'About', desc: `${site.name} is a small, independent foundry for handwritten fonts: playful, bubble and casual lettering you can test with your own words. ${site.slogan}`, path: '/about/', cur: '/about/',
  ld: [breadcrumbLD([['Home', '/'], ['About', '/about/']]), orgLD],
  body: `<div class="wrap page-title"><h1>About ${site.name}</h1></div>
<div class="wrap" style="padding-bottom:clamp(3rem,7vw,6rem)"><div class="split"><p class="lede">${site.name} is a small, independent foundry for handwritten typefaces. ${esc(site.slogan)}</p>
<div class="prose"><p>The name comes from moss, which grows slowly, stem by stem, all leaning the same way. Our mark is drawn as one line that rises and falls without lifting the pen, like joined-up handwriting, and ends with a tail that is ready for the next letter. That is how we make fonts: one stroke at a time, together with the people who write with them.</p>
<p>Each font starts as real handwriting. We draw the letters, build the connections, then spend most of the time on spacing and kerning, because a handwritten font only feels human when the rhythm between letters is right.</p>
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
