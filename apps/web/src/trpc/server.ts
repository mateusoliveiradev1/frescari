// @ts-ignore
import { appRouter, createTRPCContext } from '@frescari/api';

// In a server component, we call the router directly, bypassing the HTTP layer.
// Lazily load context on demand per request, preventing Next.js from
// executing `createTRPCContext` (and connecting to DB) dynamically at build time module-load.
export const getServerTrpc = async () => {
    return (appRouter as any).createCaller(await (createTRPCContext as any)({}));
};
