import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import Module from "node:module";

import { NextRequest } from "next/server";

const authState: {
  handler: (request: Request) => Promise<Response>;
} = {
  handler: async () => Response.json({ ok: true }),
};

const originalModuleLoad = (
  Module as typeof Module & {
    _load: (request: string, parent: unknown, isMain: boolean) => unknown;
  }
)._load;

function createAuthRequest(pathname: string) {
  return new NextRequest(`https://example.com${pathname}`, {
    method: "POST",
  });
}

before(() => {
  (
    Module as typeof Module & {
      _load: (request: string, parent: unknown, isMain: boolean) => unknown;
    }
  )._load = function patchedModuleLoad(
    request: string,
    parent: unknown,
    isMain: boolean,
  ) {
    if (request === "@/lib/auth") {
      return {
        auth: {
          handler: (request: Request) => authState.handler(request),
        },
      };
    }

    return originalModuleLoad.call(this, request, parent, isMain);
  };
});

after(() => {
  (
    Module as typeof Module & {
      _load: (request: string, parent: unknown, isMain: boolean) => unknown;
    }
  )._load = originalModuleLoad;
});

beforeEach(() => {
  authState.handler = async () => Response.json({ ok: true });
});

test("POST /api/auth/sign-in/email strips the session token from success payloads", async () => {
  authState.handler = async () =>
    Response.json(
      {
        redirect: false,
        token: "session-secret",
        url: null,
        user: {
          id: "user_123",
          email: "buyer@example.com",
        },
      },
      {
        headers: {
          "set-cookie":
            "__Secure-better-auth.session_token=session-secret; HttpOnly; Secure; SameSite=Lax",
          "x-auth-source": "better-auth",
        },
      },
    );

  const { POST } = await import("./route");
  const response = await POST(createAuthRequest("/api/auth/sign-in/email"));
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.token, null);
  assert.deepEqual(payload.user, {
    id: "user_123",
    email: "buyer@example.com",
  });
  assert.equal(payload.redirect, false);
  assert.equal(payload.url, null);
  assert.equal(response.headers.get("x-auth-source"), "better-auth");
  assert.match(
    response.headers.get("set-cookie") ?? "",
    /HttpOnly; Secure; SameSite=Lax/,
  );
});

test("POST /api/auth/sign-up/email strips the session token from success payloads", async () => {
  authState.handler = async () =>
    Response.json(
      {
        token: "new-session-secret",
        user: {
          id: "user_456",
          email: "producer@example.com",
          name: "Produtor Frescari",
        },
      },
      {
        headers: {
          "set-cookie":
            "__Secure-better-auth.session_token=new-session-secret; HttpOnly; Secure; SameSite=Lax",
        },
      },
    );

  const { POST } = await import("./route");
  const response = await POST(createAuthRequest("/api/auth/sign-up/email"));
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.token, null);
  assert.deepEqual(payload.user, {
    id: "user_456",
    email: "producer@example.com",
    name: "Produtor Frescari",
  });
  assert.match(
    response.headers.get("set-cookie") ?? "",
    /HttpOnly; Secure; SameSite=Lax/,
  );
});

test("POST /api/auth/sign-up/email masks duplicate user errors", async () => {
  authState.handler = async () =>
    Response.json(
      {
        code: "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL",
        message: "User already exists",
      },
      {
        status: 422,
      },
    );

  const { POST } = await import("./route");
  const response = await POST(createAuthRequest("/api/auth/sign-up/email"));
  const payload = await response.json();

  assert.equal(response.status, 422);
  assert.deepEqual(payload, {
    code: "SIGN_UP_FAILED",
    message:
      "Nao foi possivel concluir o cadastro agora. Revise os dados e tente novamente.",
  });
});
