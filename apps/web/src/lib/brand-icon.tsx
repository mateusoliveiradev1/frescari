/* eslint-disable @next/next/no-img-element */

import { ImageResponse } from "next/og";

import { BRAND_IMAGE_DIMENSIONS } from "@/lib/brand-assets";
import { getBrandImageDataUrl } from "@/lib/brand-image-data";

type BrandIconResponseOptions = {
  background?: string;
  markInset?: number;
  size: number;
};

function resolveMarkInset(size: number, explicitInset?: number) {
  return explicitInset ?? Math.max(6, Math.round(size * 0.14));
}

export function createBrandIconResponse({
  background = "transparent",
  markInset,
  size,
}: BrandIconResponseOptions) {
  const inset = resolveMarkInset(size, markInset);
  const markWidth = size - inset * 2;
  const markHeight = Math.round(
    markWidth *
      (BRAND_IMAGE_DIMENSIONS.mark.height / BRAND_IMAGE_DIMENSIONS.mark.width),
  );

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
      <img
        alt="Frescari"
        height={markHeight}
        src={getBrandImageDataUrl("mark")}
        style={{
          width: `${markWidth}px`,
          height: `${markHeight}px`,
        }}
        width={markWidth}
      />
    </div>,
    {
      width: size,
      height: size,
    },
  );
}
