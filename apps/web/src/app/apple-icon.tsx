import { createBrandIconResponse } from "@/lib/brand-icon";

export const size = {
  width: 180,
  height: 180,
};

export const contentType = "image/png";

export default function AppleIcon() {
  return createBrandIconResponse({
    background: "#f9f6f0",
    markInset: 24,
    size: 180,
  });
}
