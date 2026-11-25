import { NextResponse } from "next/server";

import { reportError } from "@/lib/report-error";

import { runExpiredWeighedHolds } from "@/lib/expired-weighed-holds";
import { authorizeCronRequest, cronResponseHeaders } from "@/lib/cron-auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const authorizationError = authorizeCronRequest(request);

  if (authorizationError) {
    return authorizationError;
  }

  try {
    const summary = await runExpiredWeighedHolds();

    return NextResponse.json(
      { ok: true, job: "expired-holds", summary },
      { headers: cronResponseHeaders },
    );
  } catch (error) {
    reportError(error, "cron.expired-holds");

    return NextResponse.json(
      { ok: false, error: "Expired holds cron execution failed." },
      { status: 500, headers: cronResponseHeaders },
    );
  }
}
