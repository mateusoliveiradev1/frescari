import { createBrandIconResponse } from "@/lib/brand-icon";

export const size = {
  width: 180,
  height: 180,
};

export const contentType = "image/png";

export default function AppleIcon() {
  return createBrandIconResponse({
    background: "#f9f6f0",
    cardBackground: "#0d3321",
    cardInset: 20,
    cardRadius: 34,
    detailLevel: "compact",
    markScale: 0.76,
    size: 180,
  });
}
