import { createTRPCRouter } from './trpc';
import { productRouter } from './routers/product';
import { lotRouter } from './routers/lot';

export const appRouter = createTRPCRouter({
    product: productRouter,
    lot: lotRouter,
});

export type AppRouter = typeof appRouter;
