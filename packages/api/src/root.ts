import { createTRPCRouter } from './trpc';
import { productRouter } from './routers/product';
import { lotRouter } from './routers/lot';
import { orderRouter } from './routers/order';

export const appRouter = createTRPCRouter({
    product: productRouter,
    lot: lotRouter,
    order: orderRouter,
});

export type AppRouter = typeof appRouter;
