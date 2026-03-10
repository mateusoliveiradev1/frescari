"use client";

import { useEffect } from "react";
import { useCartStore } from "@/store/useCartStore";

/**
 * Client component that clears the cart and closes the drawer
 * when the user lands on the success page after Stripe checkout.
 */
export function CartCleaner() {
    useEffect(() => {
        const store = useCartStore.getState();
        // Close the cart drawer if it's open
        store.setIsOpen(false);
        // Clear all items from the cart
        store.clearCart();
    }, []);

    return null;
}
