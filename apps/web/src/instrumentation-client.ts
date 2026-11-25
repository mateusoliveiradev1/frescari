import * as Sentry from "@sentry/nextjs";

import { getSentryOptions } from "@/lib/sentry-options";

// Browser error reporting (Sentry). No-op without a DSN.
Sentry.init(getSentryOptions());

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
