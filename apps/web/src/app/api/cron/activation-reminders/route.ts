import { NextResponse } from "next/server";

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
    console.error("[cron:activation-reminders] execution failed", error);

    return NextResponse.json(
      { ok: false, error: "Activation reminders cron execution failed." },
      { status: 500, headers: cronResponseHeaders },
    );
  }
}
