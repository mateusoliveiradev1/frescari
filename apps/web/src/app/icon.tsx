import { createBrandIconResponse } from "@/lib/brand-icon";

export const size = {
  width: 64,
  height: 64,
};

export const contentType = "image/png";

export default function Icon() {
  return createBrandIconResponse({
    markInset: 8,
    size: 64,
  });
}
