from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
PUBLIC_DIR = ROOT / "web" / "public"
ICONS_DIR = PUBLIC_DIR / "icons"
FONT_PATH = Path("C:/Windows/Fonts/segoeuib.ttf")


def make_background(size: int) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), "#08111d")
    draw = ImageDraw.Draw(canvas)

    for y in range(size):
      blend = y / max(size - 1, 1)
      r = int(8 + (18 - 8) * blend)
      g = int(17 + (38 - 17) * blend)
      b = int(29 + (58 - 29) * blend)
      draw.line((0, y, size, y), fill=(r, g, b, 255))

    orb = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    orb_draw = ImageDraw.Draw(orb)
    orb_draw.ellipse(
        (
            size * 0.12,
            size * 0.08,
            size * 0.88,
            size * 0.84,
        ),
        fill=(47, 149, 255, 120),
    )
    orb = orb.filter(ImageFilter.GaussianBlur(radius=size * 0.08))
    canvas.alpha_composite(orb)

    accent = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    accent_draw = ImageDraw.Draw(accent)
    accent_draw.ellipse(
        (
            size * 0.18,
            size * 0.52,
            size * 0.92,
            size * 1.04,
        ),
        fill=(16, 185, 129, 80),
    )
    accent = accent.filter(ImageFilter.GaussianBlur(radius=size * 0.1))
    canvas.alpha_composite(accent)

    return canvas


def add_shell_grid(image: Image.Image) -> None:
    draw = ImageDraw.Draw(image)
    size = image.size[0]
    inset = size * 0.16
    step = size * 0.11
    line_color = (176, 216, 255, 28)

    x = inset
    while x < size - inset:
        draw.line((x, inset, x, size - inset), fill=line_color, width=max(1, int(size * 0.004)))
        x += step

    y = inset
    while y < size - inset:
        draw.line((inset, y, size - inset, y), fill=line_color, width=max(1, int(size * 0.004)))
        y += step


def add_chip(image: Image.Image, *, maskable: bool) -> None:
    size = image.size[0]
    chip_size = size * (0.56 if maskable else 0.52)
    chip_left = (size - chip_size) / 2
    chip_top = (size - chip_size) / 2
    chip_right = chip_left + chip_size
    chip_bottom = chip_top + chip_size
    radius = chip_size * 0.24

    glow = Image.new("RGBA", image.size, (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    glow_draw.rounded_rectangle(
        (chip_left, chip_top, chip_right, chip_bottom),
        radius=radius,
        fill=(77, 163, 255, 160),
    )
    glow = glow.filter(ImageFilter.GaussianBlur(radius=size * 0.06))
    image.alpha_composite(glow)

    chip = Image.new("RGBA", image.size, (0, 0, 0, 0))
    chip_draw = ImageDraw.Draw(chip)
    chip_draw.rounded_rectangle(
        (chip_left, chip_top, chip_right, chip_bottom),
        radius=radius,
        fill=(9, 22, 39, 240),
        outline=(139, 211, 255, 120),
        width=max(2, int(size * 0.01)),
    )
    image.alpha_composite(chip)

    draw = ImageDraw.Draw(image)
    inner_pad = chip_size * 0.18
    inner_left = chip_left + inner_pad
    inner_top = chip_top + inner_pad
    inner_right = chip_right - inner_pad
    inner_bottom = chip_bottom - inner_pad
    stroke = max(4, int(size * 0.028))

    # Stylized F mark.
    draw.rounded_rectangle(
        (inner_left, inner_top, inner_left + stroke * 1.35, inner_bottom),
        radius=stroke * 0.45,
        fill=(234, 247, 255, 255),
    )
    draw.rounded_rectangle(
        (inner_left, inner_top, inner_right, inner_top + stroke * 0.92),
        radius=stroke * 0.45,
        fill=(234, 247, 255, 255),
    )
    draw.rounded_rectangle(
        (
            inner_left,
            inner_top + (inner_bottom - inner_top) * 0.44,
            inner_left + (inner_right - inner_left) * 0.72,
            inner_top + (inner_bottom - inner_top) * 0.44 + stroke * 0.9,
        ),
        radius=stroke * 0.45,
        fill=(234, 247, 255, 255),
    )

    # Nerve pulse accent.
    pulse_y = inner_bottom - stroke * 0.7
    pulse_start = inner_left + (inner_right - inner_left) * 0.1
    pulse_width = (inner_right - inner_left) * 0.82
    pulse = [
        (pulse_start, pulse_y),
        (pulse_start + pulse_width * 0.22, pulse_y),
        (pulse_start + pulse_width * 0.38, pulse_y - stroke * 1.25),
        (pulse_start + pulse_width * 0.52, pulse_y + stroke * 0.42),
        (pulse_start + pulse_width * 0.68, pulse_y - stroke * 0.8),
        (pulse_start + pulse_width, pulse_y - stroke * 0.8),
    ]
    draw.line(pulse, fill=(52, 211, 153, 255), width=max(3, int(size * 0.018)), joint="curve")


def add_wordmark_hint(image: Image.Image) -> None:
    size = image.size[0]
    if size < 256:
        return

    try:
        font = ImageFont.truetype(str(FONT_PATH), size=int(size * 0.07))
    except OSError:
        return

    draw = ImageDraw.Draw(image)
    label = "FactoryNerve"
    bbox = draw.textbbox((0, 0), label, font=font)
    text_width = bbox[2] - bbox[0]
    x = (size - text_width) / 2
    y = size * 0.82
    draw.text((x, y), label, font=font, fill=(212, 236, 255, 180))


def build_icon(size: int, *, maskable: bool) -> Image.Image:
    image = make_background(size)
    add_shell_grid(image)
    add_chip(image, maskable=maskable)
    add_wordmark_hint(image)
    return image.convert("RGBA")


def save_icon(name: str, size: int, *, maskable: bool) -> None:
    image = build_icon(size, maskable=maskable)
    ICONS_DIR.mkdir(parents=True, exist_ok=True)
    image.save(ICONS_DIR / name, format="PNG")


def main() -> None:
    save_icon("icon-192.png", 192, maskable=False)
    save_icon("icon-512.png", 512, maskable=False)
    save_icon("icon-maskable-192.png", 192, maskable=True)
    save_icon("icon-maskable-512.png", 512, maskable=True)
    save_icon("apple-touch-icon.png", 180, maskable=False)
    save_icon("shortcut-96.png", 96, maskable=False)
    print("Generated PWA icons in", ICONS_DIR)


if __name__ == "__main__":
    main()
