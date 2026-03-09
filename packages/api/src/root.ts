import { createTRPCRouter } from './trpc';
import { productRouter } from './routers/product';
import { lotRouter } from './routers/lot';
import { orderRouter } from './routers/order';
import { onboardingRouter } from './routers/onboarding';

export const appRouter = createTRPCRouter({
    product: productRouter,
    lot: lotRouter,
    order: orderRouter,
    onboarding: onboardingRouter,
});

export type AppRouter = typeof appRouter;
