"""Make a labelled contact sheet (<= 2000 px per side) from screenshots.
usage: python tools/contact.py out.jpg cols width img1 img2 ...
"""
import sys
from PIL import Image, ImageDraw

out, cols, tw = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
paths = sys.argv[4:]
ims = [Image.open(p).convert("RGB") for p in paths]
th = round(tw * ims[0].height / ims[0].width)
rows = (len(ims) + cols - 1) // cols
sheet = Image.new("RGB", (cols * tw + (cols - 1) * 6, rows * (th + 18)), (18, 18, 18))
d = ImageDraw.Draw(sheet)
for i, (p, im) in enumerate(zip(paths, ims)):
    x = (i % cols) * (tw + 6)
    y = (i // cols) * (th + 18)
    sheet.paste(im.resize((tw, th), Image.LANCZOS), (x, y + 16))
    d.text((x + 4, y + 2), p.replace("\\", "/").split("/")[-1], fill=(230, 200, 120))
assert sheet.width <= 2000 and sheet.height <= 2000, sheet.size
sheet.save(out, quality=86)
print(out, sheet.size)
