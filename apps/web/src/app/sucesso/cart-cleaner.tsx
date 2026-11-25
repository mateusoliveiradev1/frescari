"use client";

import { useEffect } from "react";

import { readCheckoutReturn } from "@/lib/checkout-return";
import { useCartStore } from "@/store/useCartStore";

/**
 * After a paid (or, for weighed items, authorized) checkout, removes only
 * that farm's items from the cart: the buyer may still have items from other
 * farms to pay for. A Pix still pending, a failed payment or a link opened by
 * itself leaves the cart as it is.
 */
export function CartCleaner({ clear }: { clear: boolean }) {
  useEffect(() => {
    const store = useCartStore.getState();
    store.setIsOpen(false);

    if (!clear) {
      return;
    }

    const { farmId } = readCheckoutReturn(window.location.search);

    if (farmId) {
      store.removeItemsByFarm(farmId);
    }
  }, [clear]);

  return null;
}
