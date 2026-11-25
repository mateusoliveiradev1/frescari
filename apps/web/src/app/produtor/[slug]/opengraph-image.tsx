/* eslint-disable @next/next/no-img-element */

import { ImageResponse } from "next/og";
import { formatCurrencyBRL } from "@frescari/ui";

import { getBrandImageDataUrl } from "@/lib/brand-image-data";
import { getProducerStorefrontPageData } from "@/lib/catalog-public";
import { pickStorefrontHighlights } from "@/lib/producer-storefront";

// The card WhatsApp, Facebook and others show when the storefront link is
// pasted: producer, town and what is on sale with prices.
export const alt = "Vitrine do produtor na Frescari";
export const contentType = "image/png";
export const size = { height: 630, width: 1200 };
export const revalidate = 3600;

const brandLogoSrc = getBrandImageDataUrl("compact");

function truncate(value: string, max: number) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

export default async function StorefrontOpenGraphImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getProducerStorefrontPageData(slug);

  const name = truncate(data?.producer.name ?? "Produtor Frescari", 40);
  const place = [data?.producer.city, data?.producer.state]
    .filter(Boolean)
    .join(" - ");
  const { highlights, productCount } = pickStorefrontHighlights(
    data?.lots ?? [],
    formatCurrencyBRL,
    3,
  );
  const remaining = productCount - highlights.length;

  return new ImageResponse(
    <div
      style={{
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
          background: "rgba(249, 246, 240, 0.88)",
          border: "1px solid rgba(13, 51, 33, 0.12)",
          borderRadius: "36px",
          display: "flex",
          flex: 1,
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "44px 48px",
        }}
      >
        <div
          style={{
            alignItems: "center",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <img
            alt="Frescari"
            height={119}
            src={brandLogoSrc}
            style={{ height: "64px", width: "240px" }}
            width={445}
          />
          <span
            style={{
              background: "#0d3321",
              borderRadius: "999px",
              color: "#f9f6f0",
              fontSize: "20px",
              fontWeight: 700,
              letterSpacing: "0.18em",
              padding: "10px 22px",
              textTransform: "uppercase",
            }}
          >
            Vitrine do produtor
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <span
            style={{
              fontSize: name.length > 26 ? "60px" : "76px",
              fontWeight: 800,
              letterSpacing: "-0.02em",
              lineHeight: 1.05,
            }}
          >
            {name}
          </span>
          {place ? (
            <span style={{ color: "#3d5a47", fontSize: "32px" }}>{place}</span>
          ) : null}
        </div>

        {highlights.length > 0 ? (
          <div style={{ display: "flex", gap: "16px" }}>
            {highlights.map((item) => (
              <div
                key={item.name}
                style={{
                  background: "#ffffff",
                  border: "1px solid rgba(13, 51, 33, 0.12)",
                  borderRadius: "20px",
                  display: "flex",
                  flex: 1,
                  flexDirection: "column",
                  gap: "6px",
                  padding: "18px 22px",
                }}
              >
                <span style={{ fontSize: "26px", fontWeight: 700 }}>
                  {truncate(item.name, 22)}
                </span>
                <span
                  style={{
                    color: "#1f7a4a",
                    fontSize: "28px",
                    fontWeight: 700,
                  }}
                >
                  {item.priceLabel}
                </span>
              </div>
            ))}
            {remaining > 0 ? (
              <div
                style={{
                  alignItems: "center",
                  background: "#0d3321",
                  borderRadius: "20px",
                  color: "#f9f6f0",
                  display: "flex",
                  fontSize: "26px",
                  fontWeight: 700,
                  justifyContent: "center",
                  padding: "18px 26px",
                }}
              >
                +{remaining}
              </div>
            ) : null}
          </div>
        ) : (
          <span style={{ color: "#3d5a47", fontSize: "30px" }}>
            Produtos frescos direto de quem produz
          </span>
        )}
      </div>
    </div>,
    size,
  );
}
