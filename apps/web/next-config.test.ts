import { test } from "node:test";
import { strict as assert } from "node:assert";

import nextConfig from "./next.config";

type RemotePattern = {
  protocol?: string;
  hostname?: string;
  port?: string;
  pathname?: string;
};

function hostnameMatches(
  pattern: string | undefined,
  hostname: string,
): boolean {
  if (!pattern) return false;
  if (pattern === hostname) return true;
  if (pattern.startsWith("**.")) {
    const suffix = pattern.slice(3);
    return hostname === suffix || hostname.endsWith(`.${suffix}`);
  }
  if (pattern.startsWith("*.")) {
    const suffix = pattern.slice(2);
    const parts = hostname.split(".");
    return (
      parts.length > suffix.split(".").length && hostname.endsWith(`.${suffix}`)
    );
  }
  return false;
}

function matchesRemotePattern(pattern: RemotePattern, url: string): boolean {
  const parsed = new URL(url);
  const protocol = parsed.protocol.replace(":", "");

  return (
    (!pattern.protocol || pattern.protocol === protocol) &&
    hostnameMatches(pattern.hostname, parsed.hostname)
  );
}

async function getGlobalHeaders() {
  const headerRules = await nextConfig.headers?.();
  const globalRule = headerRules?.find((rule) => rule.source === "/(.*)");

  return new Map(
    globalRule?.headers.map((header) => [header.key, header.value]) ?? [],
  );
}

test("allows UploadThing CDN hosts used by stored product images", () => {
  const remotePatterns = nextConfig.images?.remotePatterns ?? [];
  const uploadThingUrl =
    "https://nswecz312k.ufs.sh/f/UpQ5mQiOI7A96aZIvOeJEDL1XUMWKPiZ0cn74Ce8Nl9VuwYm";

  assert.equal(
    remotePatterns.some((pattern) =>
      matchesRemotePattern(pattern, uploadThingUrl),
    ),
    true,
  );
});

test("allows approved Unsplash hosts when editorial images are configured", () => {
  const remotePatterns = nextConfig.images?.remotePatterns ?? [];
  const unsplashUrl =
    "https://images.unsplash.com/photo-1466814314367-45caeebcbddc?w=800&q=80";

  assert.equal(
    remotePatterns.some((pattern) =>
      matchesRemotePattern(pattern, unsplashUrl),
    ),
    true,
  );
});

test("applies critical security headers globally", async () => {
  const headers = await getGlobalHeaders();

  assert.equal(headers.get("X-Content-Type-Options"), "nosniff");
  assert.equal(headers.get("X-Frame-Options"), "DENY");
  assert.equal(
    headers.get("Referrer-Policy"),
    "strict-origin-when-cross-origin",
  );
  assert.equal(
    headers.get("Permissions-Policy"),
    "camera=(), microphone=(), geolocation=()",
  );
  assert.match(
    headers.get("Strict-Transport-Security") ?? "",
    /max-age=63072000/,
  );
});

test("content security policy allows the required Stripe and UploadThing surfaces", async () => {
  const headers = await getGlobalHeaders();
  const csp = headers.get("Content-Security-Policy") ?? "";

  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(
    csp,
    /frame-src 'self' https:\/\/js\.stripe\.com https:\/\/hooks\.stripe\.com https:\/\/checkout\.stripe\.com https:\/\/vercel\.live/,
  );
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /https:\/\/js\.stripe\.com/);
  assert.match(csp, /https:\/\/vercel\.live/);
  assert.match(csp, /connect-src 'self' https: https:\/\/vercel\.live/);
});
