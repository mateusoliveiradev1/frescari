import { ImageResponse } from "next/og";
import { BrandMarkSvg } from "@/components/brand-mark-svg";

export const size = {
  width: 64,
  height: 64,
};

export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "transparent",
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 16,
            background: "#0d3321",
          }}
        >
          <BrandMarkSvg
            detailLevel="compact"
            style={{ width: "74%", height: "74%" }}
          />
        </div>
      </div>
    ),
    size,
  );
}
