/* eslint-disable @next/next/no-img-element */

import { ImageResponse } from "next/og";

import { getBrandImageDataUrl } from "@/lib/brand-image-data";

export const alt =
  "Frescari - marketplace B2B de hortifruti direto do produtor";
export const contentType = "image/png";
export const size = {
  height: 630,
  width: 1200,
};

const audienceLabels = ["Restaurantes", "Varejo", "Distribuicao"];
const brandLogoSrc = getBrandImageDataUrl("compact");

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        alignItems: "stretch",
        background:
          "radial-gradient(circle at top right, rgba(191,214,181,0.7), transparent 38%), linear-gradient(135deg, #f9f6f0 0%, #edf4e9 52%, #dbe8d3 100%)",
        color: "#0d3321",
        display: "flex",
        height: "100%",
        padding: "44px",
        width: "100%",
      }}
    >
      <div
        style={{
          background: "rgba(249, 246, 240, 0.82)",
          border: "1px solid rgba(13, 51, 33, 0.12)",
          borderRadius: "36px",
          boxShadow: "0 24px 64px -36px rgba(13, 51, 33, 0.42)",
          display: "flex",
          flex: 1,
          justifyContent: "space-between",
          overflow: "hidden",
          padding: "40px",
        }}
      >
        <div
          style={{
            display: "flex",
            flex: 1,
            flexDirection: "column",
            justifyContent: "space-between",
            marginRight: "32px",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "18px",
            }}
          >
            <img
              alt="Frescari"
              height={119}
              src={brandLogoSrc}
              style={{
                height: "auto",
                width: "380px",
              }}
              width={445}
            />
            <span
              style={{
                color: "#1f5036",
                fontSize: "18px",
                fontWeight: 700,
                letterSpacing: "0.26em",
                textTransform: "uppercase",
              }}
            >
              Marketplace B2B
            </span>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "18px",
              marginTop: "24px",
            }}
          >
            <span
              style={{
                fontSize: "68px",
                fontWeight: 900,
                letterSpacing: "-0.07em",
                lineHeight: 1,
              }}
            >
              Hortifruti direto
            </span>
            <span
              style={{
                color: "#1a5c33",
                fontSize: "68px",
                fontStyle: "italic",
                fontWeight: 900,
                letterSpacing: "-0.07em",
                lineHeight: 1,
              }}
            >
              do produtor.
            </span>
            <span
              style={{
                color: "rgba(32, 38, 36, 0.82)",
                fontSize: "28px",
                lineHeight: 1.35,
                maxWidth: "680px",
              }}
            >
              Catalogo vivo, compra no atacado e operacao desenhada para
              restaurantes, varejo e distribuicao.
            </span>
          </div>

          <div
            style={{
              display: "flex",
              gap: "14px",
              marginTop: "28px",
            }}
          >
            {audienceLabels.map((label) => (
              <div
                key={label}
                style={{
                  background: "rgba(255,255,255,0.82)",
                  border: "1px solid rgba(13, 51, 33, 0.12)",
                  borderRadius: "999px",
                  color: "#244736",
                  display: "flex",
                  fontSize: "18px",
                  fontWeight: 700,
                  letterSpacing: "0.14em",
                  padding: "12px 18px",
                  textTransform: "uppercase",
                }}
              >
                {label}
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            alignItems: "stretch",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: "280px",
          }}
        >
          <div
            style={{
              background:
                "linear-gradient(180deg, rgba(13,51,33,0.97), rgba(26,92,51,0.92))",
              borderRadius: "30px",
              color: "#f9f6f0",
              display: "flex",
              flexDirection: "column",
              gap: "18px",
              padding: "28px",
            }}
          >
            <span
              style={{
                color: "#bfd6b5",
                fontSize: "18px",
                fontWeight: 700,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
              }}
            >
              Operacao
            </span>
            <span
              style={{
                fontSize: "34px",
                fontStyle: "italic",
                fontWeight: 900,
                letterSpacing: "-0.05em",
                lineHeight: 1.05,
              }}
            >
              Oferta regional com leitura rapida.
            </span>
          </div>

          <div
            style={{
              background: "rgba(232, 76, 30, 0.12)",
              border: "1px solid rgba(232, 76, 30, 0.2)",
              borderRadius: "26px",
              color: "#7a2d12",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
              padding: "24px",
            }}
          >
            <span
              style={{
                fontSize: "16px",
                fontWeight: 700,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
              }}
            >
              Compra flexivel
            </span>
            <span
              style={{
                fontSize: "28px",
                fontWeight: 800,
                letterSpacing: "-0.04em",
                lineHeight: 1.15,
              }}
            >
              Kg, caixa e unidade no mesmo fluxo.
            </span>
          </div>
        </div>
      </div>
    </div>,
    size,
  );
}
