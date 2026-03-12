import { createTRPCRouter } from './trpc';
import { productRouter } from './routers/product';
import { lotRouter } from './routers/lot';
import { orderRouter } from './routers/order';
import { onboardingRouter } from './routers/onboarding';
import { checkoutRouter } from './routers/checkout';
import { stripeRouter } from './routers/stripe';
import { adminRouter } from './routers/admin';
import { farmRouter } from './routers/farm';

export const appRouter = createTRPCRouter({
    product: productRouter,
    lot: lotRouter,
    order: orderRouter,
    onboarding: onboardingRouter,
    checkout: checkoutRouter,
    stripe: stripeRouter,
    admin: adminRouter,
    farm: farmRouter,
});

export type AppRouter = typeof appRouter;
