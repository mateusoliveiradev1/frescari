import { NextResponse } from "next/server";

import { reportError } from "@/lib/report-error";

import { authorizeCronRequest, cronResponseHeaders } from "@/lib/cron-auth";
import { runDeliveryDelayCronJob } from "@/lib/cron-jobs";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const authorizationError = authorizeCronRequest(request);

  if (authorizationError) {
    return authorizationError;
  }

  try {
    const summary = await runDeliveryDelayCronJob();

    return NextResponse.json(
      {
        ok: true,
        job: "notifications",
        summary,
      },
      {
        headers: cronResponseHeaders,
      },
    );
  } catch (error) {
    reportError(error, "cron.notifications");

    return NextResponse.json(
      {
        ok: false,
        error: "Notifications cron execution failed.",
      },
      {
        status: 500,
        headers: cronResponseHeaders,
      },
    );
  }
}
