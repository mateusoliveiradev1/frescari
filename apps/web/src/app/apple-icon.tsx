import { ImageResponse } from "next/og";
import { BrandMarkSvg } from "@/components/brand-mark-svg";

export const size = {
  width: 180,
  height: 180,
};

export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f9f6f0",
        }}
      >
        <div
          style={{
            width: 140,
            height: 140,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 34,
            background: "#0d3321",
          }}
        >
          <BrandMarkSvg
            detailLevel="compact"
            style={{ width: "76%", height: "76%" }}
          />
        </div>
      </div>
    ),
    size,
  );
}
