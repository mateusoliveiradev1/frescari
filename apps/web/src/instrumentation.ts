import * as Sentry from "@sentry/nextjs";

import { getSentryOptions } from "@/lib/sentry-options";

// Server and edge error reporting (Sentry). No-op without a DSN.
export function register() {
  if (
    process.env.NEXT_RUNTIME === "nodejs" ||
    process.env.NEXT_RUNTIME === "edge"
  ) {
    Sentry.init(getSentryOptions());
  }
}

// Errors thrown while rendering server components, route handlers and
// middleware are reported with the route they happened on.
export const onRequestError = Sentry.captureRequestError;
