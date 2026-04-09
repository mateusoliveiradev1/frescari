import assert from "node:assert/strict";
import test from "node:test";

import { getRequestOrigins } from "./auth-origin";

test("collects browser and forwarded origins from the request", () => {
  const request = new Request(
    "http://localhost:3000/api/auth/request-password-reset",
    {
      headers: {
        origin: "http://192.168.0.24:3000",
        referer: "http://192.168.0.24:3000/auth/forgot-password",
        "x-forwarded-host": "preview.frescari.dev",
        "x-forwarded-proto": "https",
        host: "localhost:3000",
      },
      method: "POST",
    },
  );

  assert.deepEqual(getRequestOrigins(request), [
    "http://localhost:3000",
    "http://192.168.0.24:3000",
    "https://preview.frescari.dev",
  ]);
});

test("falls back to the request protocol when only host is available", () => {
  const request = new Request(
    "http://10.0.0.15:3000/api/auth/request-password-reset",
    {
      headers: {
        host: "10.0.0.15:3000",
      },
      method: "POST",
    },
  );

  assert.deepEqual(getRequestOrigins(request), ["http://10.0.0.15:3000"]);
});
