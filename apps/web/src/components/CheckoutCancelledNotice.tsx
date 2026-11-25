"use client";

import { useEffect } from "react";
import { toast } from "sonner";

import {
  readCheckoutReturn,
  stripCheckoutReturnParams,
} from "@/lib/checkout-return";
import { useCartStore } from "@/store/useCartStore";

/**
 * The buyer went back from Stripe without paying: tell them nothing was
 * charged and reopen the cart, where their items still are.
 */
export function CheckoutCancelledNotice() {
  useEffect(() => {
    const { cancelled } = readCheckoutReturn(window.location.search);

    if (!cancelled) {
      return;
    }

    useCartStore.getState().setIsOpen(true);

    // The page's effects run before the layout's <Toaster> subscribes, and a
    // toast fired before that is lost; wait for it to mount. The address is
    // cleaned in the same step, so an effect re-run (React Strict Mode) still
    // sees the parameters and the notice shows exactly once.
    const timer = window.setTimeout(() => {
      toast.info("Pagamento não concluído. Nada foi cobrado.", {
        description: "Seus itens continuam no carrinho.",
      });
      window.history.replaceState(
        window.history.state,
        "",
        stripCheckoutReturnParams(window.location.href),
      );
    }, 400);

    return () => window.clearTimeout(timer);
  }, []);

  return null;
}
