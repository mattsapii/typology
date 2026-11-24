"""Convert master OTF/TTF files into WOFF2 preview files.
Usage: python3 scripts/convert-fonts.py path/to/MyFont.otf fonts/previews/font-04.woff2
Needs: pip install fonttools brotli
Tip: keep the master files OUTSIDE this repository. Only WOFF2 previews belong in /fonts/previews/."""
import sys
from fontTools.ttLib import TTFont
src, dst = sys.argv[1], sys.argv[2]
f = TTFont(src); f.flavor = 'woff2'; f.save(dst)
print('wrote', dst)
