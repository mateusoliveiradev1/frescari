const HTML_TAG_PATTERN = /<[^>]+>/g;
const SCRIPT_TAG_PATTERN = /<script[\s\S]*?>[\s\S]*?<\/script>/gi;
const STYLE_TAG_PATTERN = /<style[\s\S]*?>[\s\S]*?<\/style>/gi;
const CONTROL_CHARS_PATTERN = /[\u0000-\u001f\u007f]+/g;
const WHITESPACE_PATTERN = /\s+/g;
const EDGE_HYPHENS_PATTERN = /^-+|-+$/g;
const NON_ALPHANUMERIC_PATTERN = /[^a-z0-9]+/g;

export function getSiteUrl(): string {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (configuredUrl) {
    return configuredUrl.replace(/\/+$/, "");
  }

  return process.env.NODE_ENV === "production"
    ? "https://frescari.com.br"
    : "http://localhost:3000";
}

export function slugifySegment(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(NON_ALPHANUMERIC_PATTERN, "-")
    .replace(EDGE_HYPHENS_PATTERN, "");
}

export function sanitizeText(value: string | null | undefined, maxLength?: number): string {
  const sanitized = String(value ?? "")
    .replace(SCRIPT_TAG_PATTERN, " ")
    .replace(STYLE_TAG_PATTERN, " ")
    .replace(HTML_TAG_PATTERN, " ")
    .replace(CONTROL_CHARS_PATTERN, " ")
    .replace(WHITESPACE_PATTERN, " ")
    .trim();

  if (!maxLength || sanitized.length <= maxLength) {
    return sanitized;
  }

  return `${sanitized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

export function serializeJsonLd(payload: unknown): string {
  return JSON.stringify(payload)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export function buildCategoryPath(categorySlug: string): string {
  return `/catalogo/${categorySlug}`;
}

export function buildProductPath(categorySlug: string, productSlug: string): string {
  return `${buildCategoryPath(categorySlug)}/${productSlug}`;
}
