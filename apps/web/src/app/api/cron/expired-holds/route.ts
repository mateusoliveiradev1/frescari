import { NextResponse } from "next/server";

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
    console.error("[cron:expired-holds] execution failed", error);

    return NextResponse.json(
      { ok: false, error: "Expired holds cron execution failed." },
      { status: 500, headers: cronResponseHeaders },
    );
  }
}
