export const BRAND_IMAGE_PATHS = {
  compact: "/brand/logo-compact.png",
  full: "/brand/logo-full.png",
  mark: "/brand/logo-mark.png",
} as const;

export const BRAND_IMAGE_DIMENSIONS = {
  compact: {
    height: 119,
    width: 445,
  },
  full: {
    height: 119,
    width: 445,
  },
  mark: {
    height: 119,
    width: 127,
  },
} as const;

export type BrandImageKey = keyof typeof BRAND_IMAGE_PATHS;
