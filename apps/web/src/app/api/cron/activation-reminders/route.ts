import { NextResponse } from "next/server";

import { reportError } from "@/lib/report-error";

import { runActivationReminders } from "@/lib/activation-reminders";
import { authorizeCronRequest, cronResponseHeaders } from "@/lib/cron-auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const authorizationError = authorizeCronRequest(request);

  if (authorizationError) {
    return authorizationError;
  }

  try {
    const summary = await runActivationReminders();

    return NextResponse.json(
      { ok: true, job: "activation-reminders", summary },
      { headers: cronResponseHeaders },
    );
  } catch (error) {
    reportError(error, "cron.activation-reminders");

    return NextResponse.json(
      { ok: false, error: "Activation reminders cron execution failed." },
      { status: 500, headers: cronResponseHeaders },
    );
  }
}
