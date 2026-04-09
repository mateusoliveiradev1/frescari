import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import React from "react";
import { ImageResponse } from "next/og.js";

const publicDir = path.resolve(process.cwd(), "public");

function brandMarkElement(detailLevel = "compact") {
  const children = [
    React.createElement("title", { key: "title" }, "Frescari"),
    React.createElement("path", {
      key: "leaf",
      d: "M32 10C32 10 15 19.5 15 34.5C15 45.5 22.8 53 32 53C41.2 53 49 45.5 49 34.5C49 19.5 32 10 32 10Z",
      fill: "#e8f0e3",
    }),
    React.createElement("path", {
      key: "vein",
      d: "M32 53V27",
      stroke: "#0d3321",
      strokeWidth: "3",
      strokeLinecap: "round",
    }),
  ];

  if (detailLevel === "full") {
    children.push(
      React.createElement("path", {
        key: "detail-left",
        d: "M32 40C32 40 24.5 36 20.5 28",
        stroke: "#0d3321",
        strokeWidth: "2.25",
        strokeLinecap: "round",
        opacity: "0.45",
      }),
      React.createElement("path", {
        key: "detail-right",
        d: "M32 34C32 34 39.5 29.5 43.5 21.5",
        stroke: "#0d3321",
        strokeWidth: "2.25",
        strokeLinecap: "round",
        opacity: "0.35",
      }),
    );
  }

  children.push(
    React.createElement("circle", {
      key: "ember",
      cx: "32",
      cy: detailLevel === "compact" ? "18.5" : "17.5",
      r: detailLevel === "compact" ? "3.5" : "3",
      fill: "#e84c1e",
    }),
  );

  return React.createElement(
    "svg",
    {
      viewBox: "0 0 64 64",
      fill: "none",
      xmlns: "http://www.w3.org/2000/svg",
      "aria-hidden": "true",
    },
    children,
  );
}

function createBrandIconResponse({
  size,
  background = "transparent",
  cardBackground = "#0d3321",
  cardInset,
  cardRadius,
  markScale = 0.74,
  detailLevel = "compact",
}) {
  const inset = cardInset ?? Math.max(4, Math.round(size * 0.0625));
  const tileSize = size - inset * 2;
  const radius = cardRadius ?? Math.round(tileSize * 0.2857);

  return new ImageResponse(
    React.createElement(
      "div",
      {
        style: {
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background,
        },
      },
      React.createElement(
        "div",
        {
          style: {
            width: tileSize,
            height: tileSize,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: radius,
            background: cardBackground,
          },
        },
        React.createElement(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: `${markScale * 100}%`,
              height: `${markScale * 100}%`,
            },
          },
          brandMarkElement(detailLevel),
        ),
      ),
    ),
    { width: size, height: size },
  );
}

async function renderBrandIconPng(options) {
  const response = createBrandIconResponse(options);
  return Buffer.from(await response.arrayBuffer());
}

function getBrandIconSvgMarkup({
  cardBackground = "#0d3321",
  cardInset = 4,
  cardRadius = 16,
  markScale = 0.74,
  size = 64,
}) {
  const tileSize = size - cardInset * 2;
  const markSize = size * markScale;
  const markOffset = cardInset + (tileSize - markSize) / 2;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg
  xmlns="http://www.w3.org/2000/svg"
  width="${size}"
  height="${size}"
  viewBox="0 0 ${size} ${size}"
  fill="none"
>
  <rect
    x="${cardInset}"
    y="${cardInset}"
    width="${tileSize}"
    height="${tileSize}"
    rx="${cardRadius}"
    fill="${cardBackground}"
  />
  <g transform="translate(${markOffset} ${markOffset}) scale(${markScale})">
    <path
      d="M32 10C32 10 15 19.5 15 34.5C15 45.5 22.8 53 32 53C41.2 53 49 45.5 49 34.5C49 19.5 32 10 32 10Z"
      fill="#e8f0e3"
    />
    <path
      d="M32 53V27"
      stroke="#0d3321"
      stroke-width="3"
      stroke-linecap="round"
    />
    <circle
      cx="32"
      cy="18.5"
      r="3.5"
      fill="#e84c1e"
    />
  </g>
</svg>`;
}

async function main() {
  await mkdir(publicDir, { recursive: true });

  const [favicon96, appleTouchIcon, manifest192, manifest512] =
    await Promise.all([
      renderBrandIconPng({
        cardBackground: "#0d3321",
        detailLevel: "compact",
        markScale: 0.74,
        size: 96,
      }),
      renderBrandIconPng({
        background: "#f9f6f0",
        cardBackground: "#0d3321",
        cardInset: 20,
        cardRadius: 34,
        detailLevel: "compact",
        markScale: 0.76,
        size: 180,
      }),
      renderBrandIconPng({
        cardBackground: "#0d3321",
        detailLevel: "compact",
        markScale: 0.74,
        size: 192,
      }),
      renderBrandIconPng({
        cardBackground: "#0d3321",
        detailLevel: "compact",
        markScale: 0.74,
        size: 512,
      }),
    ]);

  const manifest = JSON.stringify(
    {
      name: "Frescari",
      short_name: "Frescari",
      icons: [
        {
          src: "/web-app-manifest-192x192.png",
          sizes: "192x192",
          type: "image/png",
          purpose: "any",
        },
        {
          src: "/web-app-manifest-512x512.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "any",
        },
      ],
      theme_color: "#0d3321",
      background_color: "#f9f6f0",
      display: "standalone",
    },
    null,
    2,
  );

  await Promise.all([
    writeFile(path.join(publicDir, "favicon.svg"), getBrandIconSvgMarkup({})),
    writeFile(path.join(publicDir, "favicon-96x96.png"), favicon96),
    writeFile(path.join(publicDir, "apple-touch-icon.png"), appleTouchIcon),
    writeFile(
      path.join(publicDir, "web-app-manifest-192x192.png"),
      manifest192,
    ),
    writeFile(
      path.join(publicDir, "web-app-manifest-512x512.png"),
      manifest512,
    ),
    writeFile(path.join(publicDir, "site.webmanifest"), `${manifest}\n`),
  ]);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
