import { appRouter, createTRPCContext } from "@frescari/api";

import { getRequestAuthSession } from "@/lib/server-session";

export const getServerTrpc = async () => {
    return appRouter.createCaller(await createTRPCContext({}));
};

export const getAuthedServerTrpc = async () => {
    const sessionResponse = await getRequestAuthSession();

    return appRouter.createCaller(
        await createTRPCContext({
            session: sessionResponse?.session ?? null,
            user: sessionResponse?.user ?? null,
        }),
    );
};
