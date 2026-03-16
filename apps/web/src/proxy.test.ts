import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server";

import { proxy } from "./proxy";

test("redirects the legacy dashboard admin path to the admin catalog", () => {
    const response = proxy(new NextRequest("http://localhost/dashboard/admin"));

    assert.equal(response.status, 307);
    assert.equal(response.headers.get("location"), "http://localhost/admin/catalogo");
});

test("does not perform session fetches inside the proxy", () => {
    const originalFetch = globalThis.fetch;
    let fetchCalls = 0;

    globalThis.fetch = (async (...args: Parameters<typeof fetch>) => {
        fetchCalls += 1;
        return originalFetch(...args);
    }) as typeof fetch;

    try {
        proxy(
            new NextRequest("http://localhost/dashboard/admin/legacy", {
                headers: {
                    cookie: "better-auth.session_token=fake-token",
                },
            })
        );
    } finally {
        globalThis.fetch = originalFetch;
    }

    assert.equal(fetchCalls, 0);
});
