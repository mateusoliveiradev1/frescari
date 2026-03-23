import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import {
  buildAuthVerificationEmail,
  sendAuthVerificationEmail,
} from "@/lib/auth-email";

const writableEnv = process.env as Record<string, string | undefined>;
const originalConsoleInfo = console.info;
const originalFetch = global.fetch;
const originalNodeEnv = process.env.NODE_ENV;
const originalResendApiKey = process.env.RESEND_API_KEY;
const originalAuthEmailFrom = process.env.AUTH_EMAIL_FROM;
const originalAuthEmailFromName = process.env.AUTH_EMAIL_FROM_NAME;
const originalAuthEmailReplyTo = process.env.AUTH_EMAIL_REPLY_TO;

afterEach(() => {
  console.info = originalConsoleInfo;
  global.fetch = originalFetch;

  if (originalNodeEnv === undefined) {
    Reflect.deleteProperty(writableEnv, "NODE_ENV");
  } else {
    writableEnv.NODE_ENV = originalNodeEnv;
  }

  if (originalResendApiKey === undefined) {
    Reflect.deleteProperty(writableEnv, "RESEND_API_KEY");
  } else {
    writableEnv.RESEND_API_KEY = originalResendApiKey;
  }

  if (originalAuthEmailFrom === undefined) {
    Reflect.deleteProperty(writableEnv, "AUTH_EMAIL_FROM");
  } else {
    writableEnv.AUTH_EMAIL_FROM = originalAuthEmailFrom;
  }

  if (originalAuthEmailFromName === undefined) {
    Reflect.deleteProperty(writableEnv, "AUTH_EMAIL_FROM_NAME");
  } else {
    writableEnv.AUTH_EMAIL_FROM_NAME = originalAuthEmailFromName;
  }

  if (originalAuthEmailReplyTo === undefined) {
    Reflect.deleteProperty(writableEnv, "AUTH_EMAIL_REPLY_TO");
  } else {
    writableEnv.AUTH_EMAIL_REPLY_TO = originalAuthEmailReplyTo;
  }
});

test("buildAuthVerificationEmail includes the recipient name and verification url", () => {
  const email = buildAuthVerificationEmail({
    user: {
      email: "buyer@example.com",
      name: "Comprador Frescari",
    },
    url: "https://app.frescari.com/auth/verified?token=abc123",
  });

  assert.equal(email.subject, "Confirme seu email para entrar na Frescari");
  assert.match(email.text, /Comprador Frescari/);
  assert.match(email.text, /abc123/);
  assert.match(email.html, /Confirmar email/);
  assert.match(email.html, /Comprador Frescari/);
});

test("sendAuthVerificationEmail logs the verification link outside production when delivery is not configured", async () => {
  const logEntries: string[] = [];

  writableEnv.NODE_ENV = "development";
  Reflect.deleteProperty(writableEnv, "RESEND_API_KEY");
  Reflect.deleteProperty(writableEnv, "AUTH_EMAIL_FROM");

  console.info = ((message: string) => {
    logEntries.push(message);
  }) as typeof console.info;

  await sendAuthVerificationEmail({
    user: {
      email: "buyer@example.com",
      name: "Comprador Frescari",
    },
    url: "https://app.frescari.com/auth/verified?token=abc123",
  });

  assert.equal(logEntries.length, 1);
  const firstLogEntry = logEntries[0];

  assert.ok(firstLogEntry);
  assert.match(firstLogEntry, /buyer@example.com/);
  assert.match(firstLogEntry, /abc123/);
});

test("sendAuthVerificationEmail throws in production when delivery is not configured", async () => {
  writableEnv.NODE_ENV = "production";
  Reflect.deleteProperty(writableEnv, "RESEND_API_KEY");
  Reflect.deleteProperty(writableEnv, "AUTH_EMAIL_FROM");

  await assert.rejects(
    sendAuthVerificationEmail({
      user: {
        email: "buyer@example.com",
        name: "Comprador Frescari",
      },
      url: "https://app.frescari.com/auth/verified?token=abc123",
    }),
    /Verification email delivery is not configured/,
  );
});

test("sendAuthVerificationEmail sends the payload to Resend when configured", async () => {
  let capturedRequest: {
    input: RequestInfo | URL;
    init?: RequestInit;
  } | null = null;

  writableEnv.NODE_ENV = "development";
  writableEnv.RESEND_API_KEY = "resend_test_key";
  writableEnv.AUTH_EMAIL_FROM = "ops@frescari.com";
  writableEnv.AUTH_EMAIL_FROM_NAME = "Frescari";
  writableEnv.AUTH_EMAIL_REPLY_TO = "suporte@frescari.com";

  global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    capturedRequest = { input, init };

    return new Response(null, {
      status: 200,
      statusText: "OK",
    });
  }) as typeof fetch;

  await sendAuthVerificationEmail({
    user: {
      email: "buyer@example.com",
      name: "Comprador Frescari",
    },
    url: "https://app.frescari.com/auth/verified?token=abc123",
  });

  if (!capturedRequest) {
    throw new Error("Expected the Resend request to be captured.");
  }

  const request = capturedRequest as {
    input: RequestInfo | URL;
    init?: RequestInit;
  };

  assert.equal(request.input, "https://api.resend.com/emails");
  assert.equal(request.init?.method, "POST");
  assert.equal(
    request.init?.headers &&
      (request.init.headers as Record<string, string>).Authorization,
    "Bearer resend_test_key",
  );

  const payload = JSON.parse(String(request.init?.body));

  assert.equal(payload.from, "Frescari <ops@frescari.com>");
  assert.deepEqual(payload.to, ["buyer@example.com"]);
  assert.equal(payload.reply_to, "suporte@frescari.com");
  assert.equal(payload.subject, "Confirme seu email para entrar na Frescari");
  assert.match(payload.text, /abc123/);
});
