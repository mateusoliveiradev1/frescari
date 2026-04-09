import { ImageResponse } from "next/og";

import { BrandMarkSvg } from "@/components/brand-mark-svg";

type BrandIconResponseOptions = {
  background?: string;
  cardBackground?: string;
  cardInset?: number;
  cardRadius?: number;
  detailLevel?: "full" | "compact";
  markScale?: number;
  size: number;
};

type SvgMarkupOptions = {
  cardBackground?: string;
  cardInset?: number;
  cardRadius?: number;
  detailLevel?: "full" | "compact";
  markScale?: number;
  size?: number;
};

const DEFAULT_CARD_BACKGROUND = "#0d3321";
const DEFAULT_MARK_SCALE = 0.74;

function resolveCardInset(size: number, explicitInset?: number) {
  return explicitInset ?? Math.max(4, Math.round(size * 0.0625));
}

function resolveCardRadius(cardSize: number, explicitRadius?: number) {
  return explicitRadius ?? Math.round(cardSize * 0.2857);
}

export function createBrandIconResponse({
  background = "transparent",
  cardBackground = DEFAULT_CARD_BACKGROUND,
  cardInset,
  cardRadius,
  detailLevel = "compact",
  markScale = DEFAULT_MARK_SCALE,
  size,
}: BrandIconResponseOptions) {
  const inset = resolveCardInset(size, cardInset);
  const tileSize = size - inset * 2;
  const radius = resolveCardRadius(tileSize, cardRadius);

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background,
      }}
    >
      <div
        style={{
          width: tileSize,
          height: tileSize,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: radius,
          background: cardBackground,
        }}
      >
        <BrandMarkSvg
          detailLevel={detailLevel}
          style={{
            width: `${markScale * 100}%`,
            height: `${markScale * 100}%`,
          }}
        />
      </div>
    </div>,
    {
      width: size,
      height: size,
    },
  );
}

export async function renderBrandIconPng(
  options: BrandIconResponseOptions,
): Promise<Uint8Array> {
  const response = createBrandIconResponse(options);
  return new Uint8Array(await response.arrayBuffer());
}

export function getBrandIconSvgMarkup({
  cardBackground = DEFAULT_CARD_BACKGROUND,
  cardInset = 4,
  cardRadius = 16,
  detailLevel = "compact",
  markScale = DEFAULT_MARK_SCALE,
  size = 64,
}: SvgMarkupOptions = {}) {
  const tileSize = size - cardInset * 2;
  const markSize = size * markScale;
  const markOffset = cardInset + (tileSize - markSize) / 2;
  const circleY = detailLevel === "compact" ? 18.5 : 17.5;
  const circleRadius = detailLevel === "compact" ? 3.5 : 3;

  const fullDetailMarkup =
    detailLevel === "full"
      ? `
    <path
      d="M32 40C32 40 24.5 36 20.5 28"
      stroke="#0d3321"
      stroke-width="2.25"
      stroke-linecap="round"
      opacity="0.45"
    />
    <path
      d="M32 34C32 34 39.5 29.5 43.5 21.5"
      stroke="#0d3321"
      stroke-width="2.25"
      stroke-linecap="round"
      opacity="0.35"
    />`
      : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg
  xmlns="http://www.w3.org/2000/svg"
  width="${size}"
  height="${size}"
  viewBox="0 0 ${size} ${size}"
  fill="none"
>
  <rect
    x="${cardInset}"
    y="${cardInset}"
    width="${tileSize}"
    height="${tileSize}"
    rx="${cardRadius}"
    fill="${cardBackground}"
  />
  <g transform="translate(${markOffset} ${markOffset}) scale(${markScale})">
    <path
      d="M32 10C32 10 15 19.5 15 34.5C15 45.5 22.8 53 32 53C41.2 53 49 45.5 49 34.5C49 19.5 32 10 32 10Z"
      fill="#e8f0e3"
    />
    <path
      d="M32 53V27"
      stroke="#0d3321"
      stroke-width="3"
      stroke-linecap="round"
    />${fullDetailMarkup}
    <circle
      cx="32"
      cy="${circleY}"
      r="${circleRadius}"
      fill="#e84c1e"
    />
  </g>
</svg>`;
}
