import { NextResponse } from "next/server";

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
    console.error("[cron:notifications] execution failed", error);

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
