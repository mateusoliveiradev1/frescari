import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter, createTRPCContext } from "@frescari/api";
import { auth } from "@/lib/auth";

const handler = async (req: Request) => {
    // Attempt to get session using headers from the current request
    const sessionResponse = await auth.api.getSession({
        headers: req.headers
    });

    // Handle context securely mapping Better Auth user
    const session = sessionResponse?.session || null;
    const user = sessionResponse?.user || null;

    return fetchRequestHandler({
        endpoint: "/api/trpc",
        req,
        router: appRouter,
        createContext: () => createTRPCContext({ req, session, user }),
        onError: ({ error }) => {
            console.error("[TRPC_GLOBAL_ERROR]: ", error.message, error.cause ?? "Sem causa raiz");
        },
    });
};

export { handler as GET, handler as POST };
