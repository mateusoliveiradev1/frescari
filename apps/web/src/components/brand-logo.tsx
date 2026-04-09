import Image from "next/image";
import { cn } from "@frescari/ui";

import {
  BRAND_IMAGE_DIMENSIONS,
  BRAND_IMAGE_PATHS,
  type BrandImageKey,
} from "@/lib/brand-assets";

type BrandLogoProps = {
  className?: string;
  markClassName?: string;
  showWordmark?: boolean;
  showDescriptor?: boolean;
  size?: "sm" | "md" | "lg";
  variant?: "default" | "inverse";
};

const sizeStyles = {
  sm: {
    image: "h-8 w-auto",
    inversePlate: "rounded-xl px-2.5 py-1.5",
  },
  md: {
    image: "h-10 w-auto",
    inversePlate: "rounded-2xl px-3 py-2",
  },
  lg: {
    image: "h-12 w-auto",
    inversePlate: "rounded-[1.35rem] px-3.5 py-2.5",
  },
} as const;

function resolveAssetKey(
  showWordmark: boolean,
  showDescriptor: boolean,
): BrandImageKey {
  if (!showWordmark) {
    return "mark";
  }

  return showDescriptor ? "full" : "compact";
}

export function BrandLogo({
  className,
  markClassName,
  showWordmark = true,
  showDescriptor = false,
  size = "md",
  variant = "default",
}: BrandLogoProps) {
  const assetKey = resolveAssetKey(showWordmark, showDescriptor);
  const assetDimensions = BRAND_IMAGE_DIMENSIONS[assetKey];
  const assetPath = BRAND_IMAGE_PATHS[assetKey];
  const currentSize = sizeStyles[size];
  const usesInversePlate = variant === "inverse";

  return (
    <span className={cn("inline-flex items-center", className)}>
      <span
        className={cn(
          "inline-flex shrink-0 items-center justify-center transition-transform duration-200",
          usesInversePlate
            ? [
                "bg-cream/94 ring-1 ring-forest/10",
                "shadow-[0_18px_44px_-26px_rgba(13,51,33,0.45)]",
                currentSize.inversePlate,
              ]
            : null,
          markClassName,
        )}
      >
        <Image
          alt="Frescari"
          className={cn("block select-none", currentSize.image)}
          draggable={false}
          height={assetDimensions.height}
          src={assetPath}
          width={assetDimensions.width}
        />
      </span>
    </span>
  );
}
