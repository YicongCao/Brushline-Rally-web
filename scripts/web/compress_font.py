"""Losslessly repackage the complete variable CJK font as WOFF2; no subsetting.
Requires fonttools[woff]==4.68.0 and brotli==1.2.1.
"""
from pathlib import Path
from fontTools.ttLib import TTFont
root=Path(__file__).resolve().parents[2]
source=root/'assets/fonts/NotoSansSC-Variable.ttf'
target=source.with_suffix('.woff2')
original=TTFont(source);original.flavor='woff2';original.save(target)
restored=TTFont(target)
assert original.getBestCmap()==restored.getBestCmap()
assert original.getGlyphOrder()==restored.getGlyphOrder()
assert original['hmtx'].metrics==restored['hmtx'].metrics
assert [(a.axisTag,a.minValue,a.defaultValue,a.maxValue) for a in original['fvar'].axes]==[(a.axisTag,a.minValue,a.defaultValue,a.maxValue) for a in restored['fvar'].axes]
print(f'Complete font: {source.stat().st_size} -> {target.stat().st_size} bytes; {len(original.getBestCmap())} codepoints preserved')
