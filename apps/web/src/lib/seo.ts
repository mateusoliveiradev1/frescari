import type { Metadata } from "next";

import { getAppUrl } from "./app-url";
import { serializeJsonLd } from "./catalog-seo";
import { sanitizeEnvValue } from "./env";

export const SITE_NAME = "Frescari";
export const SITE_DEFAULT_TITLE =
  "Frescari | Marketplace B2B de hortifruti direto do produtor";
export const SITE_DEFAULT_DESCRIPTION =
  "Conecte restaurantes, varejo e distribuicao a produtores locais com catalogo vivo, pedido digital e oferta direta no atacado.";

const SITE_LOCALE = "pt_BR";
const SITE_LANGUAGE = "pt-BR";
const DEFAULT_OG_IMAGE_PATH = "/opengraph-image";
const DEFAULT_SUPPORT_EMAIL =
  sanitizeEnvValue(process.env.NEXT_PUBLIC_LEGAL_SUPPORT_EMAIL) ||
  "suporte@frescari.com.br";
const TWITTER_HANDLE = sanitizeEnvValue(process.env.NEXT_PUBLIC_TWITTER_HANDLE);

type SeoImage = {
  alt?: string;
  url: string;
};

type BuildSeoMetadataOptions = {
  canonical?: string;
  description: string;
  follow?: boolean;
  images?: SeoImage[];
  index?: boolean;
  path?: string;
  title: string;
  type?: "article" | "website";
};

function isAbsoluteUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function shouldIndexCurrentEnvironment(): boolean {
  const vercelEnvironment = sanitizeEnvValue(process.env.VERCEL_ENV);

  if (
    vercelEnvironment === "preview" ||
    process.env.NODE_ENV === "development"
  ) {
    return false;
  }

  return true;
}

export function buildCanonicalUrl(path = "/"): string {
  return new URL(path, getAppUrl()).toString();
}

function normalizeImageUrl(value: string): string {
  return isAbsoluteUrl(value) ? value : buildCanonicalUrl(value);
}

export function getDefaultOpenGraphImage(): SeoImage {
  return {
    alt: "Frescari - marketplace B2B de hortifruti direto do produtor",
    url: buildCanonicalUrl(DEFAULT_OG_IMAGE_PATH),
  };
}

function normalizeImages(images?: SeoImage[]): SeoImage[] {
  const sourceImages = images?.length ? images : [getDefaultOpenGraphImage()];

  return sourceImages.map((image) => ({
    ...image,
    url: normalizeImageUrl(image.url),
  }));
}

function buildRobotsMetadata(
  index: boolean,
  follow: boolean,
): Metadata["robots"] {
  return {
    follow,
    googleBot: {
      follow,
      index,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
    index,
  };
}

export function buildSeoMetadata({
  canonical,
  description,
  follow = true,
  images,
  index = true,
  path = "/",
  title,
  type = "website",
}: BuildSeoMetadataOptions): Metadata {
  const canIndex = index && shouldIndexCurrentEnvironment();
  const canFollow = follow && shouldIndexCurrentEnvironment();
  const canonicalUrl = canonical
    ? normalizeImageUrl(canonical)
    : buildCanonicalUrl(path);
  const normalizedImages = normalizeImages(images);
  const normalizedTwitterHandle = TWITTER_HANDLE
    ? `@${TWITTER_HANDLE.replace(/^@/, "")}`
    : undefined;

  return {
    alternates: {
      canonical: canonicalUrl,
    },
    applicationName: SITE_NAME,
    authors: [{ name: SITE_NAME }],
    creator: SITE_NAME,
    description,
    metadataBase: new URL(getAppUrl()),
    openGraph: {
      description,
      images: normalizedImages,
      locale: SITE_LOCALE,
      siteName: SITE_NAME,
      title,
      type,
      url: canonicalUrl,
    },
    publisher: SITE_NAME,
    robots: buildRobotsMetadata(canIndex, canFollow),
    title,
    twitter: {
      card: "summary_large_image",
      creator: normalizedTwitterHandle,
      description,
      images: normalizedImages.map((image) => image.url),
      site: normalizedTwitterHandle,
      title,
    },
  };
}

export function buildNoIndexMetadata(
  options: Omit<BuildSeoMetadataOptions, "follow" | "index">,
): Metadata {
  return buildSeoMetadata({
    ...options,
    follow: false,
    index: false,
  });
}

export function getOrganizationJsonLd() {
  const organization: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@id": `${buildCanonicalUrl("/")}#organization`,
    "@type": "Organization",
    areaServed: "BR",
    availableLanguage: [SITE_LANGUAGE],
    description: SITE_DEFAULT_DESCRIPTION,
    image: [buildCanonicalUrl(DEFAULT_OG_IMAGE_PATH)],
    logo: buildCanonicalUrl("/icon"),
    name: SITE_NAME,
    url: buildCanonicalUrl("/"),
  };

  if (DEFAULT_SUPPORT_EMAIL) {
    organization.contactPoint = [
      {
        "@type": "ContactPoint",
        areaServed: "BR",
        availableLanguage: [SITE_LANGUAGE],
        contactType: "customer support",
        email: DEFAULT_SUPPORT_EMAIL,
      },
    ];
    organization.email = DEFAULT_SUPPORT_EMAIL;
  }

  return organization;
}

export function getWebSiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@id": `${buildCanonicalUrl("/")}#website`,
    "@type": "WebSite",
    description: SITE_DEFAULT_DESCRIPTION,
    inLanguage: SITE_LANGUAGE,
    name: SITE_NAME,
    publisher: {
      "@id": `${buildCanonicalUrl("/")}#organization`,
    },
    url: buildCanonicalUrl("/"),
  };
}

export function getHomePageJsonLd() {
  return {
    "@context": "https://schema.org",
    "@id": `${buildCanonicalUrl("/")}#webpage`,
    "@type": "WebPage",
    about: {
      "@id": `${buildCanonicalUrl("/")}#organization`,
    },
    description: SITE_DEFAULT_DESCRIPTION,
    inLanguage: SITE_LANGUAGE,
    isPartOf: {
      "@id": `${buildCanonicalUrl("/")}#website`,
    },
    name: SITE_DEFAULT_TITLE,
    url: buildCanonicalUrl("/"),
  };
}

export function getHomeJsonLd(): unknown[] {
  return [getOrganizationJsonLd(), getWebSiteJsonLd(), getHomePageJsonLd()];
}

export function serializeSeoJsonLd(payload: unknown): string {
  return serializeJsonLd(payload);
}
