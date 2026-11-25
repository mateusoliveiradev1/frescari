import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

import { reportError } from "@/lib/report-error";
import { appRouter, createTRPCContext } from "@frescari/api";
import { auth } from "@/lib/auth";

const handler = async (req: Request) => {
  // Attempt to get session using headers from the current request
  const sessionResponse = await auth.api.getSession({
    headers: req.headers,
  });

  // Handle context securely mapping Better Auth user
  const session = sessionResponse?.session || null;
  const user = sessionResponse?.user || null;

  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => createTRPCContext({ req, session, user }),
    onError: ({ error, path }) => {
      // Expected answers (bad input, not found, forbidden...) are
      // not incidents; only unexpected failures go to Sentry.
      if (error.code === "INTERNAL_SERVER_ERROR") {
        reportError(error.cause ?? error, "trpc", { path: path ?? null });
      } else {
        console.error(
          "[TRPC_GLOBAL_ERROR]: ",
          error.message,
          error.cause ?? "Sem causa raiz",
        );
      }
    },
  });
};

export { handler as GET, handler as POST };
