import { createTRPCRouter } from "./trpc";
import { productRouter } from "./routers/product";
import { lotRouter } from "./routers/lot";
import { orderRouter } from "./routers/order";
import { onboardingRouter } from "./routers/onboarding";
import { checkoutRouter } from "./routers/checkout";
import { stripeRouter } from "./routers/stripe";
import { adminRouter } from "./routers/admin";
import { farmRouter } from "./routers/farm";
import { addressesRouter } from "./routers/addresses";
import { logisticsRouter } from "./routers/logistics";
import { notificationRouter } from "./routers/notification";
import { accountRouter } from "./routers/account";

export const appRouter = createTRPCRouter({
  product: productRouter,
  lot: lotRouter,
  order: orderRouter,
  onboarding: onboardingRouter,
  checkout: checkoutRouter,
  stripe: stripeRouter,
  admin: adminRouter,
  farm: farmRouter,
  addresses: addressesRouter,
  logistics: logisticsRouter,
  notification: notificationRouter,
  account: accountRouter,
});

export type AppRouter = typeof appRouter;
