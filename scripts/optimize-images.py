"""
TrackClubFinder — Image Optimizer (one-off tool, NOT part of the build)

Reads /images/, writes /images/optimized/. Never overwrites or deletes originals.
Preserves aspect ratio, strips EXIF, idempotent.

Requirements:  pip install Pillow
Usage:         python scripts/optimize-images.py
"""

import os
import sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC_DIR = ROOT / "images"
OUT_DIR = ROOT / "images" / "optimized"

# ── Tier definitions ──────────────────────────────────────────────────────────
# Tier 1: CSS backgrounds — keep at original width (already 1500px), WebP q82
# Tier 2: Photo-strip thumbnails — 480px wide, WebP q80
# Tier 3: Gear-card thumbnails — 440px wide, WebP q80
# About section photo — 800px wide, WebP q80

TIER1_BACKGROUNDS = {
    "IMG_5760.JPG",  # hero-bg
    "IMG_9680.JPG",  # cta-section
}

TIER3_GEAR_ONLY = {
    # Gear cards on homepage or state pages that are NOT also in a photo strip
    "IMG_0747.JPG",  # spikes
    "IMG_0745.JPG",  # running shoes
    "IMG_0740.JPG",  # GPS watch
    "IMG_0735.JPG",  # uniforms
    "IMG_0723.JPG",  # recovery
    "IMG_0836.JPG",  # sunglasses
    "IMG_0825.JPG",  # bags (homepage gear only)
    "IMG_0732.JPG",  # resistance bands (homepage gear only)
    "IMG_0734.JPG",  # compression (homepage gear only)
    "IMG_0823.JPG",  # agility (homepage gear only)
}

ABOUT_PHOTO = {"IMG_5761.JPG"}

# All photo-strip images (some also double as gear cards — use 480px for those)
TIER2_PHOTO_STRIP = {
    "IMG_0724.JPG", "folding-tents.JPG", "IMG_0751.JPG", "binocular-view.JPG",
    "IMG_0805.JPG", "IMG_0827.JPG", "IMG_5766.JPG", "IMG_9683.JPG",
    "IMG_0690.JPG", "IMG_0754.JPG",
    "IMG_0695.JPG", "IMG_0701.JPG", "IMG_0706.JPG", "IMG_9696.JPG",
    "IMG_9070.jpg",
    "IMG_0714.JPG", "IMG_0715.JPG", "IMG_0718.JPG", "IMG_0778.JPG",
    "IMG_0797.JPG",
    "IMG_0699.JPG", "IMG_0708.JPG", "IMG_0780.JPG", "IMG_0781.JPG",
    "IMG_0709.JPG", "IMG_9748.JPG", "IMG_0736.JPG",
}

ALL_SITE_IMAGES = TIER1_BACKGROUNDS | TIER2_PHOTO_STRIP | TIER3_GEAR_ONLY | ABOUT_PHOTO


def optimize_image(src_path, out_path, max_width, quality):
    """Resize to max_width (maintaining aspect ratio), strip EXIF, save as WebP."""
    img = Image.open(src_path)
    img = img.convert("RGB")  # strip alpha / ensure RGB

    w, h = img.size
    if w > max_width:
        ratio = max_width / w
        new_size = (max_width, round(h * ratio))
        img = img.resize(new_size, Image.LANCZOS)

    img.save(out_path, "WEBP", quality=quality, method=4)
    return img.size  # return final (w, h) for width/height attributes


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    results = []
    total_before = 0
    total_after = 0

    for filename in sorted(ALL_SITE_IMAGES):
        src = SRC_DIR / filename
        if not src.exists():
            print(f"  WARNING: {filename} not found in /images/, skipping")
            continue

        stem = src.stem
        out = OUT_DIR / (stem + ".webp")

        # Determine tier
        if filename in TIER1_BACKGROUNDS:
            max_w, q = 1920, 82  # won't upscale — originals are 1500px
        elif filename in ABOUT_PHOTO:
            max_w, q = 800, 80
        elif filename in TIER2_PHOTO_STRIP:
            max_w, q = 480, 80
        else:  # TIER3_GEAR_ONLY
            max_w, q = 440, 80

        before = src.stat().st_size
        dims = optimize_image(src, out, max_w, q)
        after = out.stat().st_size

        total_before += before
        total_after += after
        tier = ("BG" if filename in TIER1_BACKGROUNDS
                else "ABOUT" if filename in ABOUT_PHOTO
                else "STRIP" if filename in TIER2_PHOTO_STRIP
                else "GEAR")
        results.append((filename, tier, before, after, dims))

    # Print table
    print(f"\n{'File':<40} {'Tier':<6} {'Before':>8} {'After':>8} {'Saved':>6} {'Dims':>10}")
    print("-" * 85)
    for name, tier, before, after, dims in results:
        saved = (1 - after / before) * 100 if before else 0
        print(f"{name:<40} {tier:<6} {before // 1024:>6} KB {after // 1024:>6} KB {saved:>5.0f}% {dims[0]}x{dims[1]}")

    print("-" * 85)
    print(f"{'TOTAL':<40} {'':6} {total_before // 1024:>6} KB {total_after // 1024:>6} KB {(1 - total_after / total_before) * 100:>5.1f}%")
    print(f"\nOutput: {OUT_DIR}")


if __name__ == "__main__":
    main()
