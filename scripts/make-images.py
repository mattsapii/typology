"""Generate OG / specimen images for each product from its preview WOFF2.
Usage: python3 scripts/make-images.py   (needs: pip install fonttools brotli pillow)
Reads data/products.json, writes src/images/products/<slug>-{og,specimen-1,specimen-2}.png"""
import json, io, pathlib
from fontTools.ttLib import TTFont
from PIL import Image, ImageDraw, ImageFont
root = pathlib.Path(__file__).resolve().parent.parent
prods = json.loads((root/'data/products.json').read_text())['products']
out = root/'src/images/products'; out.mkdir(parents=True, exist_ok=True)
PAPER=(242,238,227); INK=(28,27,24); OLIVE=(85,96,64); MUTED=(107,102,90)
ui = None
def ttf(path):
    f = TTFont(path); f.flavor=None; b=io.BytesIO(); f.save(b); b.seek(0); return b.getvalue()
def fit(draw, text, data, maxw, maxh, start=520):
    s=start
    while s>24:
        font=ImageFont.truetype(io.BytesIO(data), s)
        l,t,r,b=draw.textbbox((0,0),text,font=font)
        if r-l<=maxw and b-t<=maxh: return font,(l,t,r,b)
        s-=6
    return font,(l,t,r,b)
def card(size, bg, fg, text, data, pad, path):
    im=Image.new('RGB',size,bg); d=ImageDraw.Draw(im)
    font,(l,t,r,b)=fit(d,text,data,size[0]-2*pad,size[1]-2*pad)
    d.text(((size[0]-(r-l))/2-l,(size[1]-(b-t))/2-t),text,font=font,fill=fg)
    im.save(path,optimize=True)
for p in prods:
    data=ttf(root/p['previewFontFile'].lstrip('/'))
    s=p['slug']
    card((1200,630),PAPER,INK,p['name'],data,90,out/f'{s}-og.png')
    card((1200,800),INK,PAPER,'Made with Love',data,110,out/f'{s}-specimen-1.png')
    card((1200,800),(222,226,208),INK,'Every line has a pulse',data,110,out/f'{s}-specimen-2.png')
print('ok',len(prods))
