"""Read every preview WOFF2 and record what is really inside it.
Usage: python3 scripts/inspect-fonts.py   (needs: pip install fonttools brotli)
Writes data/font-report.json, which build.mjs uses for glyph grids and OpenType feature lists."""
import json, pathlib, unicodedata
from fontTools.ttLib import TTFont
root = pathlib.Path(__file__).resolve().parent.parent
prods = json.loads((root/'data/products.json').read_text())['products']
report = {}
for p in prods:
    f = TTFont(root/p['previewFontFile'].lstrip('/'))
    cmap = f.getBestCmap()
    chars = ''.join(chr(c) for c in sorted(cmap) if c > 32 and unicodedata.category(chr(c))[0] in 'LNPSM' and c != 0xAD)
    tags = sorted({r.FeatureTag for r in f['GSUB'].table.FeatureList.FeatureRecord}) if 'GSUB' in f else []
    names = f.getGlyphOrder()
    alts = [n for n in names if '.' in n and not n.startswith('.')]
    report[p['slug']] = {'glyphCount': len(names), 'chars': chars, 'features': tags,
                         'alternates': alts[:200], 'alternateCount': len(alts),
                         'hasKerning': 'GPOS' in f or 'kern' in f}
(root/'data/font-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=1))
for k,v in report.items(): print(k, v['glyphCount'], len(v['chars']), v['features'], v['alternateCount'])
