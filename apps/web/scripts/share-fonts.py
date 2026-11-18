"""
Static TTFs for the share images (next/og), made from the brand fonts in
src/app/fonts/. next/og reads ttf, otf and woff, not woff2, and draws a
variable font at its default instance, so each weight (and Bricolage's
optical size) the images use is pinned here, with latin and latin-ext merged
into one file. DECISIONS, "Share image and Open Graph tags".

Run from apps/web after changing the brand fonts or the image's type:

    python3 -m venv /tmp/fontenv
    /tmp/fontenv/bin/pip install fonttools==4.60.1 brotli==1.1.0
    /tmp/fontenv/bin/python -I scripts/share-fonts.py
"""

import os
import tempfile

from fontTools.merge import Merger
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

SRC = "src/app/fonts"
OUT = "src/server/share-image/fonts"

BRICOLAGE = ["bricolage-grotesque-latin-standard-normal.woff2",
             "bricolage-grotesque-latin-ext-standard-normal.woff2"]
INTER = ["inter-latin-wght-normal.woff2", "inter-latin-ext-wght-normal.woff2"]

# name: (sources, axis values). The wordmark is drawn at about 42px and the
# title at about 99px; a browser picks the optical size from the font size.
INSTANCES = {
    "bricolage-500-opsz42": (BRICOLAGE, {"wght": 500, "opsz": 42, "wdth": 100}),
    "bricolage-800-opsz42": (BRICOLAGE, {"wght": 800, "opsz": 42, "wdth": 100}),
    "bricolage-800-opsz96": (BRICOLAGE, {"wght": 800, "opsz": 96, "wdth": 100}),
    "inter-400": (INTER, {"wght": 400}),
    "inter-600": (INTER, {"wght": 600}),
    "inter-700": (INTER, {"wght": 700}),
}


def main():
    os.makedirs(OUT, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        for name, (sources, axes) in INSTANCES.items():
            parts = []
            for i, source in enumerate(sources):
                font = TTFont(os.path.join(SRC, source))
                static = instantiateVariableFont(font, axes)
                static.flavor = None
                part = os.path.join(tmp, f"{name}-{i}.ttf")
                static.save(part)
                parts.append(part)
            merged = Merger().merge(parts)
            merged.save(os.path.join(OUT, f"{name}.ttf"))
            print(name, os.path.getsize(os.path.join(OUT, f"{name}.ttf")))


if __name__ == "__main__":
    main()
