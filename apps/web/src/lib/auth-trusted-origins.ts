import { hostname as getHostname, networkInterfaces } from "node:os";

type NetworkInterfaces = ReturnType<typeof networkInterfaces>;

function toWildcardOrigin(host: string): string[] {
  const normalizedHost = host.trim().toLowerCase();

  if (!normalizedHost) {
    return [];
  }

  const formattedHost =
    normalizedHost.includes(":") && !normalizedHost.startsWith("[")
      ? `[${normalizedHost}]`
      : normalizedHost;

  return [`http://${formattedHost}:*`, `https://${formattedHost}:*`];
}

function getAddressFamily(family: string | number): "IPv4" | "IPv6" | null {
  if (family === "IPv4" || family === 4) {
    return "IPv4";
  }

  if (family === "IPv6" || family === 6) {
    return "IPv6";
  }

  return null;
}

export function getLocalDevelopmentTrustedOrigins(
  hostname = getHostname(),
  interfaces: NetworkInterfaces = networkInterfaces(),
): string[] {
  const values = new Set<string>([
    ...toWildcardOrigin("localhost"),
    ...toWildcardOrigin("127.0.0.1"),
    ...toWildcardOrigin("::1"),
    ...toWildcardOrigin(hostname),
  ]);

  for (const addressList of Object.values(interfaces)) {
    for (const address of addressList ?? []) {
      if (address.internal) {
        continue;
      }

      const family = getAddressFamily(address.family);

      if (!family) {
        continue;
      }

      for (const origin of toWildcardOrigin(address.address)) {
        values.add(origin);
      }
    }
  }

  return Array.from(values);
}
