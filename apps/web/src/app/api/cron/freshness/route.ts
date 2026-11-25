import { NextResponse } from "next/server";

import { reportError } from "@/lib/report-error";

import { authorizeCronRequest, cronResponseHeaders } from "@/lib/cron-auth";
import { runLotFreshnessCronJob } from "@/lib/cron-jobs";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const authorizationError = authorizeCronRequest(request);

  if (authorizationError) {
    return authorizationError;
  }

  try {
    const summary = await runLotFreshnessCronJob();

    return NextResponse.json(
      {
        ok: true,
        job: "freshness",
        summary,
      },
      {
        headers: cronResponseHeaders,
      },
    );
  } catch (error) {
    reportError(error, "cron.freshness");

    return NextResponse.json(
      {
        ok: false,
        error: "Freshness cron execution failed.",
      },
      {
        status: 500,
        headers: cronResponseHeaders,
      },
    );
  }
}
