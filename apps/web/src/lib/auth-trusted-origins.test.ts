import assert from "node:assert/strict";
import test from "node:test";

import { getLocalDevelopmentTrustedOrigins } from "./auth-trusted-origins";

test("includes localhost, hostname and external network addresses", () => {
  const trustedOrigins = getLocalDevelopmentTrustedOrigins("Frescari-PC", {
    Ethernet: [
      {
        address: "192.168.3.118",
        netmask: "255.255.255.0",
        family: "IPv4",
        mac: "00:11:22:33:44:55",
        internal: false,
        cidr: "192.168.3.118/24",
      },
      {
        address: "fe80::abcd",
        netmask: "ffff:ffff:ffff:ffff::",
        family: "IPv6",
        mac: "00:11:22:33:44:55",
        internal: false,
        cidr: "fe80::abcd/64",
        scopeid: 12,
      },
    ],
    Loopback: [
      {
        address: "127.0.0.1",
        netmask: "255.0.0.0",
        family: "IPv4",
        mac: "00:00:00:00:00:00",
        internal: true,
        cidr: "127.0.0.1/8",
      },
    ],
  });

  assert.ok(trustedOrigins.includes("http://localhost:*"));
  assert.ok(trustedOrigins.includes("https://localhost:*"));
  assert.ok(trustedOrigins.includes("http://127.0.0.1:*"));
  assert.ok(trustedOrigins.includes("https://127.0.0.1:*"));
  assert.ok(trustedOrigins.includes("http://frescari-pc:*"));
  assert.ok(trustedOrigins.includes("https://frescari-pc:*"));
  assert.ok(trustedOrigins.includes("http://192.168.3.118:*"));
  assert.ok(trustedOrigins.includes("https://192.168.3.118:*"));
  assert.ok(trustedOrigins.includes("http://[fe80::abcd]:*"));
  assert.ok(trustedOrigins.includes("https://[fe80::abcd]:*"));
});
