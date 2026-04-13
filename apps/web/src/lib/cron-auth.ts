import { NextResponse } from "next/server";

const CRON_UNAUTHORIZED_MESSAGE = "Chamada cron nao autorizada.";
const CRON_SECRET_MISSING_MESSAGE = "CRON_SECRET nao esta configurado.";

const noStoreHeaders = {
  "Cache-Control": "no-store",
};

function buildCronErrorResponse(message: string, status: number) {
  return NextResponse.json(
    {
      ok: false,
      error: message,
    },
    {
      status,
      headers: noStoreHeaders,
    },
  );
}

export function authorizeCronRequest(request: Request) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return buildCronErrorResponse(CRON_SECRET_MISSING_MESSAGE, 500);
  }

  const authorizationHeader = request.headers.get("authorization");

  if (!authorizationHeader?.startsWith("Bearer ")) {
    return buildCronErrorResponse(CRON_UNAUTHORIZED_MESSAGE, 401);
  }

  const token = authorizationHeader.slice("Bearer ".length).trim();

  if (!token || token !== cronSecret) {
    return buildCronErrorResponse(CRON_UNAUTHORIZED_MESSAGE, 401);
  }

  return null;
}

export const cronResponseHeaders = noStoreHeaders;
