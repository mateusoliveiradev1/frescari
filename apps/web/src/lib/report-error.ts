import * as Sentry from "@sentry/nextjs";

/**
 * Logs an error we caught on purpose (so the request could still answer)
 * and also sends it to Sentry, tagged with where it happened. Without a DSN
 * the Sentry part is a no-op and only the log remains.
 */
export function reportError(
  error: unknown,
  where: string,
  extra?: Record<string, string | number | boolean | null | undefined>,
) {
  console.error(`[${where}]`, error);
  Sentry.captureException(error, {
    tags: { where },
    extra,
  });
}
