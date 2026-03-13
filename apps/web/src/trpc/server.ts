import { appRouter, createTRPCContext } from "@frescari/api";

export const getServerTrpc = async () => {
    return appRouter.createCaller(await createTRPCContext({}));
};
