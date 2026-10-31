"""Reuse original Godot menu art and its Chakra Petch wordmark in the web loader.
Requires cwebp and fonttools[woff]. Does not touch game assets or its export.
"""
from pathlib import Path
import re, subprocess, shutil
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
root=Path(__file__).resolve().parents[2]
assets=root/'web-host/site/loader-art';assets.mkdir(exist_ok=True)
for source,target in [('sunset_ridge.png','autumn.webp'),('F160.png','f160.webp')]:
 subprocess.run(['cwebp','-quiet','-q','82',str(root/'assets/ui/menu_models'/source),'-o',str(assets/target)],check=True)
font=TTFont(root/'assets/fonts/ChakraPetch-Bold.ttf');glyphs=font.getGlyphSet();cmap=font.getBestCmap();x=0;paths=[]
for i,char in enumerate('BRUSHLINE RALLY'):
 name=cmap[ord(char)];pen=SVGPathPen(glyphs);glyphs[name].draw(pen)
 if pen.getCommands():
  style='fill="#eb562b"' if i<9 else 'class="rally-ink"'
  paths.append(f'<path {style} transform="translate({x} 0)" d="{pen.getCommands()}"/>')
 x+=font['hmtx'][name][0]
mark=f'<svg class="wordmark" viewBox="0 0 {x+480} 830" aria-hidden="true"><g transform="translate(-40 780) scale(1 -1)">'+''.join(paths)+'</g>'
for i in range(3):
 at=x+45+i*115;mark+=f'<path fill="#f05a28" d="m{at} 65h68l-130 440h-68Z"/>'
mark+='</svg>'
p=root/'web-shell/index.html';html=p.read_text()
if 'WORDMARK' in html:html=html.replace('WORDMARK',mark)
else:html,n=re.subn(r'<svg class="wordmark".*?</svg>',lambda _:mark,html,flags=re.S);assert n==1
p.write_text(html)
font.flavor='woff2';font.save(assets/'chakra-bold.woff2')
shutil.copy(root/'assets/fonts/OFL-ChakraPetch.txt',assets/'OFL-ChakraPetch.txt')
print('Loader artwork bytes:',sum(p.stat().st_size for p in assets.iterdir()))
