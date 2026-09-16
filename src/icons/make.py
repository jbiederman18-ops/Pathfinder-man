#!/usr/bin/env python3
"""Three directions for the home-screen icon.

Drawn at 4x and downsampled, which is cheaper than fighting Pillow's aliasing.
iOS applies its own rounded mask, so the art is full-bleed square.

Palette is the sheet's own Slate theme, and the background matches the manifest
background_color so the launch doesn't flash a different colour.
"""
import math
from PIL import Image, ImageDraw, ImageFont

S = 4096                 # working size
INK = (18, 21, 43)       # #12152b — same as the splash
INK_DEEP = (11, 13, 27)
PANEL = (34, 40, 52)     # #222834
BRASS = (214, 168, 60)   # #d6a83c
BRASS_HI = (245, 214, 133)
BRASS_LO = (150, 112, 30)
FONT = "/usr/share/fonts/truetype/google-fonts/Poppins-Bold.ttf"


def hexagon(cx, cy, r, rot=-90):
    return [(cx + r * math.cos(math.radians(rot + 60 * i)),
             cy + r * math.sin(math.radians(rot + 60 * i))) for i in range(6)]


def triangle(cx, cy, r, rot=-90):
    return [(cx + r * math.cos(math.radians(rot + 120 * i)),
             cy + r * math.sin(math.radians(rot + 120 * i))) for i in range(3)]


def background(d, grid=True):
    """Ink, the sheet's faint rule grid, and a vignette so the centre lifts."""
    d.rectangle([0, 0, S, S], fill=INK)
    if grid:
        step = S // 9
        for i in range(1, 9):
            d.line([(0, i * step), (S, i * step)], fill=(26, 30, 56), width=S // 340)
            d.line([(i * step, 0), (i * step, S)], fill=(24, 28, 52), width=S // 340)


def vignette(img):
    mask = Image.new("L", (S, S), 0)
    md = ImageDraw.Draw(mask)
    steps = 90
    for i in range(steps):
        t = i / steps
        r = S * (0.95 - 0.5 * t)
        md.ellipse([S / 2 - r, S / 2 - r, S / 2 + r, S / 2 + r], fill=int(90 * t))
    dark = Image.new("RGB", (S, S), INK_DEEP)
    return Image.composite(img, dark, mask.point(lambda v: 255 - v))


def finish(img, name):
    img = vignette(img)
    img.resize((1024, 1024), Image.LANCZOS).save("icons/%s-1024.png" % name)
    return img


# ---------------------------------------------------------------- A. facet
# The die as a shape: hexagon silhouette, one face caught in the light. No
# numerals, so it survives being 60 pixels wide on a home screen.
def facet():
    img = Image.new("RGB", (S, S), INK)
    d = ImageDraw.Draw(img)
    background(d)

    cx = cy = S / 2
    R = S * 0.335
    stroke = int(S * 0.030)

    outer = hexagon(cx, cy, R)
    d.polygon(outer, fill=PANEL)
    d.line(outer + [outer[0]], fill=BRASS, width=stroke, joint="curve")

    inner = triangle(cx, cy + R * 0.04, R * 0.55)
    d.polygon(inner, fill=BRASS)

    # Edges from the lit face out to the silhouette: the facet lines that make
    # a flat hexagon read as a solid.
    for a, b in ((inner[0], outer[0]), (inner[1], outer[2]), (inner[2], outer[4])):
        d.line([a, b], fill=BRASS, width=int(stroke * 0.82))

    # Hard highlight along the top-left edge, the way the sheet lights its die.
    d.line([outer[1], outer[0]], fill=BRASS_HI, width=int(stroke * 0.55))
    return finish(img, "facet")


# ---------------------------------------------------------------- B. twenty
# The number the whole table waits for, on the app's own die: a rounded plate
# with a brass rim and an inset highlight.
def twenty():
    img = Image.new("RGB", (S, S), INK)
    d = ImageDraw.Draw(img)
    background(d)

    pad = S * 0.19
    box = [pad, pad, S - pad, S - pad]
    rad = S * 0.15
    d.rounded_rectangle(box, radius=rad, fill=PANEL, outline=BRASS, width=int(S * 0.030))
    d.rounded_rectangle([box[0] + S * 0.028, box[1] + S * 0.028, box[2] - S * 0.028, box[3] - S * 0.028],
                        radius=rad * 0.85, outline=(44, 52, 68), width=int(S * 0.012))

    f = ImageFont.truetype(FONT, int(S * 0.40))
    text = "20"
    l, t, r, b = d.textbbox((0, 0), text, font=f)
    d.text(((S - (r - l)) / 2 - l, (S - (b - t)) / 2 - t + S * 0.012), text, font=f, fill=BRASS_LO)
    d.text(((S - (r - l)) / 2 - l, (S - (b - t)) / 2 - t), text, font=f, fill=BRASS)
    return finish(img, "twenty")


# ---------------------------------------------------------------- C. modifier
# What the sheet actually does: it hands you a number to add. A modifier on a
# die face says "dice, already worked out" in two glyphs.
def modifier():
    img = Image.new("RGB", (S, S), INK)
    d = ImageDraw.Draw(img)
    background(d)

    cx = cy = S / 2
    R = S * 0.345
    outer = hexagon(cx, cy, R)
    d.polygon(outer, fill=PANEL)
    d.line(outer + [outer[0]], fill=BRASS, width=int(S * 0.030), joint="curve")
    d.line([outer[1], outer[0]], fill=BRASS_HI, width=int(S * 0.018))

    f = ImageFont.truetype(FONT, int(S * 0.30))
    text = "+9"
    l, t, r, b = d.textbbox((0, 0), text, font=f)
    d.text(((S - (r - l)) / 2 - l, (S - (b - t)) / 2 - t), text, font=f, fill=BRASS)
    return finish(img, "modifier")


import os
os.makedirs("icons", exist_ok=True)
facet(); twenty(); modifier()
print("wrote icons/facet-1024.png, icons/twenty-1024.png, icons/modifier-1024.png")
