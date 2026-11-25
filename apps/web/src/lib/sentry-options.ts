// Shared Sentry options for the browser, the Node server and the edge.
//
// Off until a DSN is configured (NEXT_PUBLIC_SENTRY_DSN in Vercel), so local
// development, tests and preview builds send nothing. Errors only: no
// performance tracing or session replay, which stays well inside the free
// plan. No personal data: Sentry does not attach cookies, IPs or request
// bodies when sendDefaultPii is false.
export function getSentryOptions() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim() || undefined;

  return {
    dsn,
    enabled: Boolean(dsn),
    environment:
      process.env.NEXT_PUBLIC_VERCEL_ENV ??
      process.env.VERCEL_ENV ??
      process.env.NODE_ENV,
    sendDefaultPii: false,
    tracesSampleRate: 0,
  };
}
