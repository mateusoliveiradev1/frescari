import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_LEGAL_ACCEPTANCE_SOURCE,
  extractIpAddress,
  extractLegalConsentPayload,
  extractUserAgent,
  isEmailPasswordSignUpRequest,
} from "@/lib/legal-consent";

test("reads legal consent payload from a signup body", () => {
  assert.deepEqual(
    extractLegalConsentPayload({
      acceptedLegal: true,
      acceptedLegalVersion: "2026-03-21-v1",
      acceptedLegalSource: "register_screen",
    }),
    {
      acceptedLegal: true,
      acceptedLegalVersion: "2026-03-21-v1",
      acceptedLegalSource: "register_screen",
    },
  );
});

test("falls back to safe defaults when consent payload is missing", () => {
  assert.deepEqual(extractLegalConsentPayload(null), {
    acceptedLegal: false,
    acceptedLegalVersion: null,
    acceptedLegalSource: DEFAULT_LEGAL_ACCEPTANCE_SOURCE,
  });
});

test("extracts first client ip and user agent from headers", () => {
  const headers = new Headers({
    "x-forwarded-for": "203.0.113.10, 10.0.0.1",
    "user-agent": "FrescariTest/1.0",
  });

  assert.equal(extractIpAddress(headers), "203.0.113.10");
  assert.equal(extractUserAgent(headers), "FrescariTest/1.0");
});

test("identifies email/password signup requests", () => {
  assert.equal(
    isEmailPasswordSignUpRequest("https://example.com/api/auth/sign-up/email"),
    true,
  );
  assert.equal(
    isEmailPasswordSignUpRequest("https://example.com/api/auth/sign-in/email"),
    false,
  );
});
