import { createBrandIconResponse } from "@/lib/brand-icon";

export const size = {
  width: 64,
  height: 64,
};

export const contentType = "image/png";

export default function Icon() {
  return createBrandIconResponse({
    cardBackground: "#0d3321",
    cardInset: 4,
    cardRadius: 16,
    detailLevel: "compact",
    markScale: 0.74,
    size: 64,
  });
}
