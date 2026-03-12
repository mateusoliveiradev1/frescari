import type { ReactNode } from "react";

type FrescariIconProps = {
  className?: string;
  title?: string;
};

const forest = "#0d3321";
const sage = "#e3ecdd";
const cream = "#f9f6f0";
const ember = "#e84c1e";

function FeatureGlyph({
  className,
  title,
  children,
}: FrescariIconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      <title>{title}</title>
      <path
        d="M18 10.5H43L54 21.5V42L43 53.5H18L8 42V21.5L18 10.5Z"
        fill={sage}
        stroke={forest}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {children}
    </svg>
  );
}

export function NightHarvestIcon({
  className,
  title = "Colheita noturna",
}: FrescariIconProps) {
  return (
    <FeatureGlyph className={className} title={title}>
      <path
        d="M14 25L31 35L48 25"
        stroke={forest}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M31 35V50"
        stroke={forest}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle
        cx="39.5"
        cy="20.5"
        r="6"
        fill={cream}
        stroke={forest}
        strokeWidth="2"
      />
      <circle cx="42.5" cy="18.5" r="5.2" fill={sage} />
      <circle cx="23" cy="18.5" r="2.75" fill={ember} />
    </FeatureGlyph>
  );
}

export function DirectProducerIcon({
  className,
  title = "Direto do produtor",
}: FrescariIconProps) {
  return (
    <FeatureGlyph className={className} title={title}>
      <path
        d="M15 30L23 25L31 30V39L23 44L15 39V30Z"
        fill={cream}
        stroke={forest}
        strokeWidth="2.25"
        strokeLinejoin="round"
      />
      <path
        d="M31 23L39 18L47 23V32L39 37L31 32V23Z"
        fill={cream}
        stroke={forest}
        strokeWidth="2.25"
        strokeLinejoin="round"
      />
      <path
        d="M23 34L39 27"
        stroke={forest}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle cx="31" cy="30.5" r="2.75" fill={ember} />
    </FeatureGlyph>
  );
}

export function LowCarbonIcon({
  className,
  title = "Rota curta com menor emissao",
}: FrescariIconProps) {
  return (
    <FeatureGlyph className={className} title={title}>
      <path
        d="M15 44C19 39 23 36.5 28 36.5C32.5 36.5 36.5 34.2 39.5 30L43 25.5"
        stroke={forest}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="15" cy="44" r="3" fill={ember} />
      <path
        d="M42.5 19C42.5 19 35 23.5 35 30.2C35 35.4 38.6 38.9 42.9 38.9C47.2 38.9 50.8 35.4 50.8 30.2C50.8 23.5 42.5 19 42.5 19Z"
        fill={cream}
        stroke={forest}
        strokeWidth="2.25"
      />
      <path
        d="M42.9 38.9V28.5"
        stroke={forest}
        strokeWidth="2.25"
        strokeLinecap="round"
      />
      <path
        d="M16 49H48"
        stroke={forest}
        strokeWidth="2.25"
        strokeLinecap="round"
        opacity="0.45"
      />
      <path
        d="M20 54H44"
        stroke={forest}
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.28"
      />
    </FeatureGlyph>
  );
}

export function HarvestSignalIllustration({
  className,
  title = "Frescari harvest signal",
}: FrescariIconProps) {
  return (
    <svg
      viewBox="0 0 160 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      <title>{title}</title>
      <path
        d="M44 18H106L132 44V106L106 132H44L18 106V44L44 18Z"
        fill={sage}
        stroke={forest}
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <path
        d="M40 60L80 84L120 60"
        stroke={forest}
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M80 84V118"
        stroke={forest}
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        d="M49 96C54 82 64 74 76 74C86 74 95 69 103 57L112 43"
        stroke={forest}
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="49" cy="96" r="5.5" fill={ember} />
      <path
        d="M105 34C105 34 90 42.5 90 55.5C90 65.7 97.1 72.5 105.7 72.5C114.3 72.5 121.5 65.7 121.5 55.5C121.5 42.5 105 34 105 34Z"
        fill={cream}
        stroke={forest}
        strokeWidth="3.5"
      />
      <path
        d="M105.8 72.5V52.5"
        stroke={forest}
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <path
        d="M46 126H114"
        stroke={forest}
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.35"
      />
    </svg>
  );
}
