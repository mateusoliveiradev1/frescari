import { test } from "node:test";
import { strict as assert } from "node:assert";

import nextConfig from "./next.config";

type RemotePattern = {
  protocol?: string;
  hostname?: string;
  port?: string;
  pathname?: string;
};

function hostnameMatches(pattern: string | undefined, hostname: string): boolean {
  if (!pattern) return false;
  if (pattern === hostname) return true;
  if (pattern.startsWith("**.")) {
    const suffix = pattern.slice(3);
    return hostname === suffix || hostname.endsWith(`.${suffix}`);
  }
  if (pattern.startsWith("*.")) {
    const suffix = pattern.slice(2);
    const parts = hostname.split(".");
    return parts.length > suffix.split(".").length && hostname.endsWith(`.${suffix}`);
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

test("allows UploadThing CDN hosts used by stored product images", () => {
  const remotePatterns = nextConfig.images?.remotePatterns ?? [];
  const uploadThingUrl = "https://nswecz312k.ufs.sh/f/UpQ5mQiOI7A96aZIvOeJEDL1XUMWKPiZ0cn74Ce8Nl9VuwYm";

  assert.equal(
    remotePatterns.some((pattern) => matchesRemotePattern(pattern, uploadThingUrl)),
    true,
  );
});

test("allows Unsplash fallback images used in seed data", () => {
  const remotePatterns = nextConfig.images?.remotePatterns ?? [];
  const unsplashUrl = "https://images.unsplash.com/photo-1466814314367-45caeebcbddc?w=800&q=80";

  assert.equal(
    remotePatterns.some((pattern) => matchesRemotePattern(pattern, unsplashUrl)),
    true,
  );
});
