"""Draw the nSedo mark at several launcher sizes."""

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
RES = ROOT / "android/app/src/main/res"
LAUNCHER = {
    "mipmap-mdpi": 48,
    "mipmap-hdpi": 72,
    "mipmap-xhdpi": 96,
    "mipmap-xxhdpi": 144,
    "mipmap-xxxhdpi": 192,
}
FOREGROUND = {
    "mipmap-mdpi": 108,
    "mipmap-hdpi": 162,
    "mipmap-xhdpi": 216,
    "mipmap-xxhdpi": 324,
    "mipmap-xxxhdpi": 432,
}
SPLASH = {
    "drawable-port-mdpi": (320, 480),
    "drawable-port-hdpi": (480, 800),
    "drawable-port-xhdpi": (720, 1280),
    "drawable-port-xxhdpi": (960, 1600),
    "drawable-port-xxxhdpi": (1280, 1920),
    "drawable-land-mdpi": (480, 320),
    "drawable-land-hdpi": (800, 480),
    "drawable-land-xhdpi": (1280, 720),
    "drawable-land-xxhdpi": (1600, 960),
    "drawable-land-xxxhdpi": (1920, 1280),
    "drawable": (480, 800),
}


def draw(size: int) -> Image.Image:
    image = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    radius = int(size * 14 / 64)
    draw.rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=(20, 32, 43, 255))
    def box(x, y, w, h, color):
        r = max(2, int(size * 3 / 64))
        draw.rounded_rectangle((x, y, x + w, y + h), radius=r, fill=color)

    box(int(size * 11 / 64), int(size * 26 / 64), int(size * 22 / 64), int(size * 12 / 64), (36, 87, 230, 255))
    box(int(size * 35 / 64), int(size * 26 / 64), int(size * 18 / 64), int(size * 12 / 64), (110, 150, 255, 255))
    head_w = max(2, int(size * 3 / 64))
    head_x = int(size * 30.5 / 64)
    draw.rounded_rectangle(
        (head_x, int(size * 15 / 64), head_x + head_w, int(size * 49 / 64)),
        radius=head_w // 2,
        fill=(247, 248, 250, 255),
    )
    return image


def splash(width: int, height: int) -> Image.Image:
    image = Image.new("RGBA", (width, height), (20, 32, 43, 255))
    mark = draw(max(48, int(min(width, height) * 0.28)))
    image.alpha_composite(mark, ((width - mark.width) // 2, (height - mark.height) // 2))
    return image


def main() -> None:
    (ROOT / "public/icons").mkdir(parents=True, exist_ok=True)
    draw(192).save(ROOT / "public/icons/icon-192.png")
    draw(512).save(ROOT / "public/icons/icon-512.png")
    for folder, size in LAUNCHER.items():
        icon = draw(size)
        target = RES / folder
        target.mkdir(parents=True, exist_ok=True)
        icon.save(target / "ic_launcher.png")
        icon.save(target / "ic_launcher_round.png")
    for folder, size in FOREGROUND.items():
        canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        mark = draw(int(size * 0.62))
        canvas.alpha_composite(mark, ((size - mark.width) // 2, (size - mark.height) // 2))
        canvas.save(RES / folder / "ic_launcher_foreground.png")
    for folder, (width, height) in SPLASH.items():
        target = RES / folder
        target.mkdir(parents=True, exist_ok=True)
        splash(width, height).save(target / "splash.png")


if __name__ == "__main__":
    main()
