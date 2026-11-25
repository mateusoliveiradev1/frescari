import { NextRequest, NextResponse } from "next/server";

import { verifyUnsubscribeToken } from "@/lib/email-unsubscribe";
import { setMarketingOptOut } from "@/lib/email-preferences";

// RFC 8058 one-click unsubscribe: mail clients (Gmail, Yahoo, Apple Mail)
// POST here from their own "unsubscribe" button, with no page in between.
export async function POST(req: NextRequest) {
  const userId = verifyUnsubscribeToken(req.nextUrl.searchParams.get("t"));
  if (!userId) {
    return NextResponse.json({ error: "Invalid link" }, { status: 400 });
  }

  try {
    await setMarketingOptOut(userId, true);
    return NextResponse.json({ unsubscribed: true });
  } catch (error) {
    console.error("[UNSUBSCRIBE] Falha ao descadastrar:", error);
    return NextResponse.json({ error: "Try again later" }, { status: 500 });
  }
}

// A person opening the one-click URL in a browser gets the normal page, which
// asks for confirmation (link scanners only GET, so they never unsubscribe).
export function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("t") ?? "";
  const target = new URL("/descadastro", req.nextUrl.origin);
  if (token) target.searchParams.set("t", token);
  return NextResponse.redirect(target, 303);
}
