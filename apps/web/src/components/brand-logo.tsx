import { cn } from "@frescari/ui";
import { BrandMarkSvg } from "@/components/brand-mark-svg";

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
    mark: "h-8 w-8 rounded-[10px]",
    wordmark: "text-[1.18rem]",
    descriptor: "text-[8px] tracking-[0.22em]",
  },
  md: {
    mark: "h-10 w-10 rounded-[12px]",
    wordmark: "text-[1.6rem]",
    descriptor: "text-[9px] tracking-[0.2em]",
  },
  lg: {
    mark: "h-12 w-12 rounded-[14px]",
    wordmark: "text-[2rem]",
    descriptor: "text-[10px] tracking-[0.22em]",
  },
} as const;

const variantStyles = {
  default: {
    frame:
      "bg-forest border border-forest/35 shadow-[0_10px_20px_-16px_rgba(13,51,33,0.45),0_4px_10px_-8px_rgba(13,51,33,0.25)]",
    wordmark: "text-soil",
    descriptor: "text-bark/60",
  },
  inverse: {
    frame: "bg-cream/10 border border-cream/16 backdrop-blur-[2px]",
    wordmark: "text-cream",
    descriptor: "text-sage/70",
  },
} as const;

export function BrandLogo({
  className,
  markClassName,
  showWordmark = true,
  showDescriptor = false,
  size = "md",
  variant = "default",
}: BrandLogoProps) {
  const currentSize = sizeStyles[size];
  const currentVariant = variantStyles[variant];

  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span
        className={cn(
          "inline-flex shrink-0 items-center justify-center transition-all duration-200",
          currentSize.mark,
          currentVariant.frame,
          markClassName,
        )}
      >
        <BrandMarkSvg className="h-[78%] w-[78%]" />
      </span>

      {showWordmark ? (
        <span className="flex min-w-0 flex-col leading-none">
          <span
            className={cn(
              "font-display font-black italic tracking-[-0.035em]",
              currentSize.wordmark,
              currentVariant.wordmark,
            )}
          >
            Frescari
          </span>
          {showDescriptor ? (
            <span
              className={cn(
                "mt-1 font-sans font-bold uppercase",
                currentSize.descriptor,
                currentVariant.descriptor,
              )}
            >
              Direto da horta
            </span>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}
