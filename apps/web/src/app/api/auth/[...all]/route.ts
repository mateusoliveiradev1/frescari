import { auth } from "@/lib/auth";
import { checkRateLimit, extractClientIp } from "@/lib/rate-limit";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/** 10 attempts per minute per IP per auth endpoint. */
const AUTH_RATE_LIMIT = { limit: 10, windowMs: 60_000 } as const;

const RATE_LIMITED_PATHS = [
  "/sign-in/email",
  "/sign-up/email",
  "/change-password",
  "/request-password-reset",
  // Keep the legacy path protected while the wrapper transitions to Better Auth's current endpoint naming.
  "/forget-password",
] as const;

function isRateLimitedAuthPath(request: NextRequest): boolean {
  const pathname = request.nextUrl.pathname;
  return (
    request.method === "POST" &&
    RATE_LIMITED_PATHS.some((p) => pathname.endsWith(p))
  );
}

function buildRateLimitedResponse(resetAt: number): Response {
  const retryAfterSec = Math.ceil((resetAt - Date.now()) / 1000);
  return Response.json(
    {
      message:
        "Muitas tentativas consecutivas. Aguarde um momento antes de tentar novamente.",
      code: "RATE_LIMITED",
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(Math.max(retryAfterSec, 1)),
        "X-RateLimit-Limit": String(AUTH_RATE_LIMIT.limit),
        "X-RateLimit-Remaining": "0",
      },
    },
  );
}

const GENERIC_SIGN_UP_ERROR = {
  message:
    "Nao foi possivel concluir o cadastro agora. Revise os dados e tente novamente.",
  code: "SIGN_UP_FAILED",
} as const;

const INVALID_CHANGE_PASSWORD_PAYLOAD = {
  code: "INVALID_CHANGE_PASSWORD_PAYLOAD",
  message: "Payload invalido para troca de senha.",
} as const;

type SanitizedChangePasswordPayload = {
  currentPassword: string;
  newPassword: string;
  revokeOtherSessions?: boolean;
};

function isSignUpRequest(request: NextRequest) {
  return request.nextUrl.pathname.endsWith("/sign-up/email");
}

function isDuplicateUserError(body: unknown) {
  if (!body || typeof body !== "object") {
    return false;
  }

  const code = "code" in body ? body.code : undefined;
  return typeof code === "string" && code.startsWith("USER_ALREADY_EXISTS");
}

function isChangePasswordRequest(request: NextRequest) {
  return request.nextUrl.pathname.endsWith("/change-password");
}

function shouldStripSessionToken(request: NextRequest) {
  return (
    request.nextUrl.pathname.endsWith("/sign-in/email") ||
    request.nextUrl.pathname.endsWith("/sign-up/email") ||
    isChangePasswordRequest(request)
  );
}

function isJsonObject(body: unknown): body is Record<string, unknown> {
  return Boolean(body) && typeof body === "object" && !Array.isArray(body);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function sanitizeChangePasswordPayload(
  body: unknown,
): SanitizedChangePasswordPayload | null {
  if (!isJsonObject(body)) {
    return null;
  }

  const currentPassword = body.currentPassword;
  const newPassword = body.newPassword;
  const revokeOtherSessions = body.revokeOtherSessions;

  if (!isNonEmptyString(currentPassword) || !isNonEmptyString(newPassword)) {
    return null;
  }

  return {
    currentPassword,
    newPassword,
    ...(typeof revokeOtherSessions === "boolean"
      ? { revokeOtherSessions }
      : {}),
  };
}

function buildInvalidChangePasswordPayloadResponse() {
  return Response.json(INVALID_CHANGE_PASSWORD_PAYLOAD, {
    status: 400,
  });
}

function cloneRequestWithJsonBody(
  request: NextRequest,
  body: SanitizedChangePasswordPayload,
) {
  const headers = new Headers(request.headers);
  headers.set("content-type", "application/json");
  headers.delete("content-length");

  return new Request(request.url, {
    method: request.method,
    headers,
    body: JSON.stringify(body),
  });
}

async function buildForwardedAuthRequest(request: NextRequest) {
  if (!isChangePasswordRequest(request)) {
    return request;
  }

  let body: unknown;

  try {
    body = await request.clone().json();
  } catch {
    return buildInvalidChangePasswordPayloadResponse();
  }

  const sanitizedPayload = sanitizeChangePasswordPayload(body);

  if (!sanitizedPayload) {
    return buildInvalidChangePasswordPayloadResponse();
  }

  return cloneRequestWithJsonBody(request, sanitizedPayload);
}

function buildJsonResponse(response: Response, payload: unknown) {
  const headers = new Headers(response.headers);
  headers.delete("content-length");

  return Response.json(payload, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function handleAuthRequest(request: NextRequest) {
  if (isRateLimitedAuthPath(request)) {
    const ip = extractClientIp(request.headers);
    const key = `auth:${ip}:${request.nextUrl.pathname}`;
    const result = checkRateLimit(
      key,
      AUTH_RATE_LIMIT.limit,
      AUTH_RATE_LIMIT.windowMs,
    );

    if (!result.allowed) {
      return buildRateLimitedResponse(result.resetAt);
    }
  }

  const forwardedRequest = await buildForwardedAuthRequest(request);

  if (forwardedRequest instanceof Response) {
    return forwardedRequest;
  }

  const response = await auth.handler(forwardedRequest);

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return response;
  }

  let payload: unknown;

  try {
    payload = await response.clone().json();
  } catch {
    return response;
  }

  if (isSignUpRequest(request) && isDuplicateUserError(payload)) {
    return buildJsonResponse(response, GENERIC_SIGN_UP_ERROR);
  }

  if (
    !response.ok ||
    !shouldStripSessionToken(request) ||
    !isJsonObject(payload)
  ) {
    return response;
  }

  if (typeof payload.token !== "string") {
    return response;
  }

  return buildJsonResponse(response, {
    ...payload,
    token: null,
  });
}

export async function GET(request: NextRequest) {
  return handleAuthRequest(request);
}

export async function POST(request: NextRequest) {
  return handleAuthRequest(request);
}
