import { createTRPCRouter } from './trpc';
import { productRouter } from './routers/product';
import { lotRouter } from './routers/lot';
import { orderRouter } from './routers/order';
import { onboardingRouter } from './routers/onboarding';
import { checkoutRouter } from './routers/checkout';
import { stripeRouter } from './routers/stripe';

export const appRouter = createTRPCRouter({
    product: productRouter,
    lot: lotRouter,
    order: orderRouter,
    onboarding: onboardingRouter,
    checkout: checkoutRouter,
    stripe: stripeRouter,
});

export type AppRouter = typeof appRouter;
