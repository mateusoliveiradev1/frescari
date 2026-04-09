from __future__ import annotations

import argparse
import base64
import json
from collections import deque
from dataclasses import dataclass
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
PUBLIC_ROOT = ROOT / "apps" / "web" / "public"
APP_ROOT = ROOT / "apps" / "web" / "src" / "app"
BRAND_ROOT = PUBLIC_ROOT / "brand"
BRAND_IMAGE_DATA_MODULE = ROOT / "apps" / "web" / "src" / "lib" / "brand-image-data.ts"

NOISE_COMPONENT_MAX_PIXELS = 50
DESCRIPTOR_TOP_RATIO = 0.72
MARK_GAP_MIN_RATIO = 0.15
MARK_GAP_MAX_RATIO = 0.6


@dataclass
class Component:
    pixels: list[tuple[int, int]]
    bbox: tuple[int, int, int, int]

    @property
    def size(self) -> int:
        return len(self.pixels)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate Frescari brand assets from the provided PNG logo."
    )
    parser.add_argument(
        "--source",
        required=True,
        help="Path to the transparent PNG logo source.",
    )
    parser.add_argument(
        "--version",
        default="20260409d",
        help="Cache-busting version to embed in the web manifest.",
    )
    return parser.parse_args()


def alpha_mask(image: Image.Image) -> Image.Image:
    return image.convert("RGBA").getchannel("A")


def connected_components(mask: Image.Image) -> list[Component]:
    width, height = mask.size
    visited = [[False] * width for _ in range(height)]
    components: list[Component] = []

    for y in range(height):
        for x in range(width):
            if visited[y][x]:
                continue

            visited[y][x] = True
            if mask.getpixel((x, y)) == 0:
                continue

            queue = deque([(x, y)])
            pixels = [(x, y)]
            min_x = max_x = x
            min_y = max_y = y

            while queue:
                current_x, current_y = queue.popleft()
                for next_x, next_y in (
                    (current_x + 1, current_y),
                    (current_x - 1, current_y),
                    (current_x, current_y + 1),
                    (current_x, current_y - 1),
                ):
                    if not (0 <= next_x < width and 0 <= next_y < height):
                        continue
                    if visited[next_y][next_x]:
                        continue

                    visited[next_y][next_x] = True
                    if mask.getpixel((next_x, next_y)) == 0:
                        continue

                    queue.append((next_x, next_y))
                    pixels.append((next_x, next_y))
                    min_x = min(min_x, next_x)
                    max_x = max(max_x, next_x)
                    min_y = min(min_y, next_y)
                    max_y = max(max_y, next_y)

            components.append(
                Component(
                    pixels=pixels,
                    bbox=(min_x, min_y, max_x + 1, max_y + 1),
                )
            )

    return components


def erase_component_pixels(image: Image.Image, components: list[Component]) -> None:
    for component in components:
        for x, y in component.pixels:
            image.putpixel((x, y), (0, 0, 0, 0))


def trim_to_alpha(image: Image.Image) -> Image.Image:
    bbox = alpha_mask(image).getbbox()
    if bbox is None:
        raise ValueError("The source image does not contain visible pixels.")
    return image.crop(bbox)


def clean_logo(image: Image.Image) -> Image.Image:
    cleaned = image.convert("RGBA")
    components = connected_components(alpha_mask(cleaned))
    noise = [component for component in components if component.size < NOISE_COMPONENT_MAX_PIXELS]
    erase_component_pixels(cleaned, noise)
    return trim_to_alpha(cleaned)


def find_mark_split_x(image: Image.Image) -> int:
    mask = alpha_mask(image)
    width, height = mask.size
    column_counts = [
        sum(1 for y in range(height) if mask.getpixel((x, y)) > 0)
        for x in range(width)
    ]
    threshold = max(column_counts) * 0.08

    runs: list[tuple[int, int]] = []
    start: int | None = None
    for index, count in enumerate(column_counts):
        if count <= threshold:
            if start is None:
                start = index
        elif start is not None:
            runs.append((start, index - 1))
            start = None

    if start is not None:
        runs.append((start, width - 1))

    candidates = [
        run
        for run in runs
        if width * MARK_GAP_MIN_RATIO <= run[0] <= width * MARK_GAP_MAX_RATIO
    ]
    if not candidates:
        raise ValueError("Unable to find the separator between the mark and the wordmark.")

    best_run = max(candidates, key=lambda run: (run[1] - run[0], -run[0]))
    return best_run[1] + 1


def build_mark_image(image: Image.Image, split_x: int) -> Image.Image:
    mark = image.crop((0, 0, split_x, image.height))
    return trim_to_alpha(mark)


def build_compact_logo(image: Image.Image, split_x: int) -> Image.Image:
    compact = image.copy()
    threshold_y = round(image.height * DESCRIPTOR_TOP_RATIO)
    components = connected_components(alpha_mask(compact))
    descriptor_components = [
        component
        for component in components
        if component.size >= NOISE_COMPONENT_MAX_PIXELS
        and component.bbox[1] >= threshold_y
        and component.bbox[0] >= split_x
    ]
    erase_component_pixels(compact, descriptor_components)
    return trim_to_alpha(compact)


def paste_centered(
    base: Image.Image,
    overlay: Image.Image,
    *,
    padding: int,
) -> Image.Image:
    target = base.width - padding * 2
    scale = min(target / overlay.width, target / overlay.height)
    resized = overlay.resize(
        (round(overlay.width * scale), round(overlay.height * scale)),
        Image.LANCZOS,
    )
    offset_x = (base.width - resized.width) // 2
    offset_y = (base.height - resized.height) // 2
    base.alpha_composite(resized, (offset_x, offset_y))
    return base


def build_favicon(mark: Image.Image, size: int) -> Image.Image:
    return paste_centered(Image.new("RGBA", (size, size), (0, 0, 0, 0)), mark, padding=round(size * 0.12))


def build_app_icon(mark: Image.Image, size: int) -> Image.Image:
    return paste_centered(
        Image.new("RGBA", (size, size), (249, 246, 240, 255)),
        mark,
        padding=round(size * 0.14),
    )


def write_manifest(version: str) -> None:
    manifest = {
        "name": "Frescari",
        "short_name": "Frescari",
        "icons": [
            {
                "src": f"/web-app-manifest-192x192.png?v={version}",
                "sizes": "192x192",
                "type": "image/png",
                "purpose": "any",
            },
            {
                "src": f"/web-app-manifest-512x512.png?v={version}",
                "sizes": "512x512",
                "type": "image/png",
                "purpose": "any",
            },
        ],
        "theme_color": "#0d3321",
        "background_color": "#f9f6f0",
        "display": "standalone",
    }
    (PUBLIC_ROOT / "site.webmanifest").write_text(
        json.dumps(manifest, indent=2) + "\n",
        encoding="utf-8",
    )


def to_png_data_url(image_path: Path) -> str:
    encoded = base64.b64encode(image_path.read_bytes()).decode("ascii")
    return f"data:image/png;base64,{encoded}"


def write_brand_image_data_module() -> None:
    image_paths = {
        "compact": BRAND_ROOT / "logo-compact.png",
        "full": BRAND_ROOT / "logo-full.png",
        "mark": BRAND_ROOT / "logo-mark.png",
    }
    lines = [
        'import "server-only";',
        "",
        'import type { BrandImageKey } from "@/lib/brand-assets";',
        "",
        "// Generated by scripts/generate_brand_assets.py. Do not edit manually.",
        "const BRAND_IMAGE_DATA_URLS: Record<BrandImageKey, string> = {",
    ]

    for key, image_path in image_paths.items():
        lines.append(f'  {key}: "{to_png_data_url(image_path)}",')

    lines.extend(
        [
            "};",
            "",
            "export function getBrandImageDataUrl(key: BrandImageKey) {",
            "  return BRAND_IMAGE_DATA_URLS[key];",
            "}",
            "",
        ]
    )

    BRAND_IMAGE_DATA_MODULE.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    args = parse_args()
    source_path = Path(args.source).expanduser().resolve()
    if not source_path.exists():
        raise FileNotFoundError(f"Source logo not found: {source_path}")

    BRAND_ROOT.mkdir(parents=True, exist_ok=True)

    source_image = Image.open(source_path).convert("RGBA")
    full_logo = clean_logo(source_image)
    split_x = find_mark_split_x(full_logo)
    compact_logo = build_compact_logo(full_logo, split_x)
    mark_logo = build_mark_image(full_logo, split_x)

    full_logo.save(BRAND_ROOT / "logo-full.png")
    compact_logo.save(BRAND_ROOT / "logo-compact.png")
    mark_logo.save(BRAND_ROOT / "logo-mark.png")

    favicon = build_favicon(mark_logo, 96)
    favicon.save(PUBLIC_ROOT / "favicon-96x96.png")
    favicon_ico = build_favicon(mark_logo, 64)
    favicon_ico.save(APP_ROOT / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])

    apple_icon = build_app_icon(mark_logo, 180)
    apple_icon.save(PUBLIC_ROOT / "apple-touch-icon.png")
    build_app_icon(mark_logo, 192).save(PUBLIC_ROOT / "web-app-manifest-192x192.png")
    build_app_icon(mark_logo, 512).save(PUBLIC_ROOT / "web-app-manifest-512x512.png")

    write_manifest(args.version)
    write_brand_image_data_module()

    print(f"Generated brand assets from {source_path}")
    print(f"full: {full_logo.size}")
    print(f"compact: {compact_logo.size}")
    print(f"mark: {mark_logo.size}")


if __name__ == "__main__":
    main()
