import { sanitizeEnvValue } from "./env";

function toOrigin(value: string | null | undefined): string | null {
  const sanitized = sanitizeEnvValue(value);

  if (!sanitized) {
    return null;
  }

  try {
    return new URL(sanitized).origin;
  } catch {
    return null;
  }
}

function normalizeHeaderValue(value: string | null | undefined): string | null {
  const sanitized = sanitizeEnvValue(value);

  if (!sanitized) {
    return null;
  }

  const [firstValue] = sanitized.split(",");
  const trimmed = firstValue?.trim();

  return trimmed || null;
}

function buildOriginFromHost(
  hostValue: string | null | undefined,
  protocolValue: string | null | undefined,
): string | null {
  const host = normalizeHeaderValue(hostValue);
  const protocol = normalizeHeaderValue(protocolValue);

  if (!host || !protocol) {
    return null;
  }

  return toOrigin(`${protocol}://${host}`);
}

export function getRequestOrigins(request?: Request): string[] {
  if (!request) {
    return [];
  }

  const requestUrl = new URL(request.url);

  return Array.from(
    new Set(
      [
        requestUrl.origin,
        toOrigin(request.headers.get("origin")),
        toOrigin(request.headers.get("referer")),
        buildOriginFromHost(
          request.headers.get("x-forwarded-host"),
          request.headers.get("x-forwarded-proto"),
        ),
        buildOriginFromHost(request.headers.get("host"), requestUrl.protocol),
      ].filter((value): value is string => Boolean(value)),
    ),
  );
}
