import { auth } from "@/lib/auth";
import { checkRateLimit, extractClientIp } from "@/lib/rate-limit";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/** 10 attempts per minute per IP per auth endpoint. */
const AUTH_RATE_LIMIT = { limit: 10, windowMs: 60_000 } as const;

const RATE_LIMITED_PATHS = [
  "/sign-in/email",
  "/sign-up/email",
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

function isEmailPasswordAuthRequest(request: NextRequest) {
  return (
    request.nextUrl.pathname.endsWith("/sign-in/email") ||
    request.nextUrl.pathname.endsWith("/sign-up/email")
  );
}

function isJsonObject(body: unknown): body is Record<string, unknown> {
  return Boolean(body) && typeof body === "object" && !Array.isArray(body);
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
    const result = checkRateLimit(key, AUTH_RATE_LIMIT.limit, AUTH_RATE_LIMIT.windowMs);

    if (!result.allowed) {
      return buildRateLimitedResponse(result.resetAt);
    }
  }

  const response = await auth.handler(request);

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
    !isEmailPasswordAuthRequest(request) ||
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
