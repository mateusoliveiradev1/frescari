"use client";

import { useEffect } from "react";

import { readCheckoutReturn } from "@/lib/checkout-return";
import { useCartStore } from "@/store/useCartStore";

/**
 * After a paid checkout, removes only that farm's items from the cart: the
 * buyer may still have items from other farms to pay for. Items stay in the
 * cart until this point, so going back from Stripe without paying loses
 * nothing.
 */
export function CartCleaner() {
  useEffect(() => {
    const store = useCartStore.getState();
    store.setIsOpen(false);

    const { farmId } = readCheckoutReturn(window.location.search);

    if (farmId) {
      store.removeItemsByFarm(farmId);
    }
  }, []);

  return null;
}
