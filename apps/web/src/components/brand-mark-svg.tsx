import type { CSSProperties } from "react";

type BrandMarkSvgProps = {
  className?: string;
  style?: CSSProperties;
  leafColor?: string;
  veinColor?: string;
  emberColor?: string;
  detailLevel?: "full" | "compact";
  title?: string;
};

export function BrandMarkSvg({
  className,
  style,
  leafColor = "#e8f0e3",
  veinColor = "#0d3321",
  emberColor = "#e84c1e",
  detailLevel = "full",
  title = "Frescari",
}: BrandMarkSvgProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
      style={style}
    >
      <title>{title}</title>
      <path
        d="M32 10C32 10 15 19.5 15 34.5C15 45.5 22.8 53 32 53C41.2 53 49 45.5 49 34.5C49 19.5 32 10 32 10Z"
        fill={leafColor}
      />
      <path
        d="M32 53V27"
        stroke={veinColor}
        strokeWidth="3"
        strokeLinecap="round"
      />
      {detailLevel === "full" ? (
        <>
          <path
            d="M32 40C32 40 24.5 36 20.5 28"
            stroke={veinColor}
            strokeWidth="2.25"
            strokeLinecap="round"
            opacity="0.45"
          />
          <path
            d="M32 34C32 34 39.5 29.5 43.5 21.5"
            stroke={veinColor}
            strokeWidth="2.25"
            strokeLinecap="round"
            opacity="0.35"
          />
        </>
      ) : null}
      <circle
        cx="32"
        cy={detailLevel === "compact" ? "18.5" : "17.5"}
        r={detailLevel === "compact" ? "3.5" : "3"}
        fill={emberColor}
      />
    </svg>
  );
}
