/* eslint-disable @next/next/no-img-element */

import { ImageResponse } from "next/og";
import { formatCurrencyBRL } from "@frescari/ui";

import { getBrandImageDataUrl } from "@/lib/brand-image-data";
import { getProducerStorefrontPageData } from "@/lib/catalog-public";
import {
  getProducerInitials,
  pickStorefrontHighlights,
} from "@/lib/producer-storefront";

// The card WhatsApp, Facebook and others show when the storefront link is
// pasted. WhatsApp's small preview crops a square from the middle of the
// image, so everything that matters (photo, name, town) sits in the centre
// column; the product prices underneath are a bonus for the large preview.
export const alt = "Vitrine do produtor na Frescari";
export const contentType = "image/png";
export const size = { height: 630, width: 1200 };
export const revalidate = 3600;

const brandLogoSrc = getBrandImageDataUrl("compact");
const PHOTO_FETCH_TIMEOUT_MS = 3000;

function truncate(value: string, max: number) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

// Inline the photo as a data URL: if the fetch fails or is slow, the card
// falls back to the initials instead of the whole image failing.
async function loadPhotoDataUrl(url: string | null | undefined) {
  if (!url) return null;
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(PHOTO_FETCH_TIMEOUT_MS),
    });
    const contentType = response.headers.get("content-type") ?? "";
    if (!response.ok || !/^image\/(png|jpe?g|webp|gif)/.test(contentType)) {
      return null;
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    return `data:${contentType};base64,${bytes.toString("base64")}`;
  } catch {
    return null;
  }
}

export default async function StorefrontOpenGraphImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getProducerStorefrontPageData(slug);

  const fullName = data?.producer.name ?? "Produtor Frescari";
  const name = truncate(fullName, 36);
  const place = [data?.producer.city, data?.producer.state]
    .filter(Boolean)
    .join(" - ");
  const photo = await loadPhotoDataUrl(data?.producer.photoUrl);
  const { highlights, productCount } = pickStorefrontHighlights(
    data?.lots ?? [],
    formatCurrencyBRL,
    3,
  );
  const remaining = productCount - highlights.length;

  return new ImageResponse(
    <div
      style={{
        alignItems: "center",
        background:
          "radial-gradient(circle at top, rgba(191,214,181,0.75), transparent 45%), linear-gradient(180deg, #f9f6f0 0%, #edf4e9 60%, #dbe8d3 100%)",
        color: "#0d3321",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        justifyContent: "space-between",
        padding: "36px 48px 40px",
        width: "100%",
      }}
    >
      <div style={{ alignItems: "center", display: "flex", gap: "16px" }}>
        <img
          alt="Frescari"
          height={119}
          src={brandLogoSrc}
          style={{ height: "48px", width: "180px" }}
          width={445}
        />
        <span
          style={{
            background: "#0d3321",
            borderRadius: "999px",
            color: "#f9f6f0",
            fontSize: "16px",
            letterSpacing: "0.18em",
            padding: "8px 16px",
            textTransform: "uppercase",
          }}
        >
          Vitrine do produtor
        </span>
      </div>

      <div
        style={{
          alignItems: "center",
          display: "flex",
          flexDirection: "column",
          gap: "14px",
          maxWidth: "620px",
        }}
      >
        {photo ? (
          <img
            alt=""
            height={150}
            src={photo}
            style={{
              border: "6px solid #ffffff",
              borderRadius: "999px",
              height: "150px",
              objectFit: "cover",
              width: "150px",
            }}
            width={150}
          />
        ) : (
          <div
            style={{
              alignItems: "center",
              background: "#0d3321",
              border: "6px solid #ffffff",
              borderRadius: "999px",
              color: "#f9f6f0",
              display: "flex",
              fontSize: "60px",
              height: "150px",
              justifyContent: "center",
              width: "150px",
            }}
          >
            {getProducerInitials(fullName)}
          </div>
        )}
        <span
          style={{
            fontSize: name.length > 22 ? "52px" : "66px",
            letterSpacing: "-0.02em",
            lineHeight: 1.05,
            textAlign: "center",
          }}
        >
          {name}
        </span>
        {place ? (
          <span style={{ color: "#3d5a47", fontSize: "28px" }}>{place}</span>
        ) : null}
      </div>

      {highlights.length > 0 ? (
        <div style={{ display: "flex", gap: "14px" }}>
          {highlights.map((item) => (
            <div
              key={item.name}
              style={{
                background: "#ffffff",
                border: "1px solid rgba(13, 51, 33, 0.12)",
                borderRadius: "18px",
                display: "flex",
                flexDirection: "column",
                gap: "4px",
                padding: "12px 20px",
                width: "300px",
              }}
            >
              <span style={{ fontSize: "22px" }}>
                {truncate(item.name, 24)}
              </span>
              <span style={{ color: "#1f7a4a", fontSize: "26px" }}>
                {item.priceLabel}
              </span>
            </div>
          ))}
          {remaining > 0 ? (
            <div
              style={{
                alignItems: "center",
                background: "#0d3321",
                borderRadius: "18px",
                color: "#f9f6f0",
                display: "flex",
                fontSize: "24px",
                justifyContent: "center",
                padding: "12px 22px",
              }}
            >
              +{remaining}
            </div>
          ) : null}
        </div>
      ) : (
        <span style={{ color: "#3d5a47", fontSize: "26px" }}>
          Produtos frescos direto de quem produz
        </span>
      )}
    </div>,
    size,
  );
}
