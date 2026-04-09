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
