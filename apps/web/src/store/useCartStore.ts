import { create } from 'zustand';
import { persist, subscribeWithSelector } from 'zustand/middleware';

// Reusing the same interface from the catalog (ensure it matches exactly what we need)
export interface CatalogLot {
    id: string;
    lotCode: string;
    harvestDate: string;
    expiryDate: string;
    availableQty: number;
    freshnessScore: number | null;
    productName: string;
    saleUnit: string;
    imageUrl: string | null;
    farmName: string;
    originalPrice: number;
    finalPrice: number;
    isLastChance: boolean;
    pricingType: 'UNIT' | 'WEIGHT' | 'BOX';
    estimatedWeight: number | null;
}

export interface CartItem extends CatalogLot {
    cartQty: number;
}

export interface CartState {
    items: CartItem[];
    isOpen: boolean;
}

export interface CartActions {
    addItem: (lot: CatalogLot, qty?: number) => void;
    removeItem: (lotId: string) => void;
    updateItemQty: (lotId: string, newQty: number) => void;
    clearCart: () => void;
    setIsOpen: (isOpen: boolean) => void;
    toggleCart: () => void;
}

export type CartStore = CartState & CartActions;

export const useCartStore = create<CartStore>()(
    subscribeWithSelector(
        persist(
            (set, get) => ({
                items: [],
                isOpen: false,

                addItem: (lot: CatalogLot, qty = 1) => {
                    const { items } = get();
                    const existingItem = items.find((i: CartItem) => i.id === lot.id);

                    // Fractional logic: if it's weight based, default step could be 0.5. 
                    // When adding from the card, we might pass a specific step.
                    // For now, let's strictly add what is requested, or increment by default.

                    // Determine step based on unit
                    const isWeightBased = lot.pricingType === 'WEIGHT';
                    const step = isWeightBased ? 0.5 : 1;
                    const finalQtyToAdd = qty === 1 ? step : qty;

                    if (existingItem) {
                        const newQty = existingItem.cartQty + finalQtyToAdd;
                        // Avoid exceeding available qty
                        const safeQty = newQty > lot.availableQty ? lot.availableQty : newQty;

                        set({
                            items: items.map((i: CartItem) =>
                                i.id === lot.id ? { ...i, cartQty: safeQty } : i
                            ),
                            isOpen: true, // open cart when adding
                        });
                    } else {
                        const safeQty = finalQtyToAdd > lot.availableQty ? lot.availableQty : finalQtyToAdd;
                        set({
                            items: [...items, { ...lot, cartQty: safeQty }],
                            isOpen: true, // open cart when adding
                        });
                    }
                },

                removeItem: (lotId: string) => {
                    set((state: CartStore) => ({
                        items: state.items.filter((i: CartItem) => i.id !== lotId),
                    }));
                },

                updateItemQty: (lotId: string, newQty: number) => {
                    if (newQty <= 0) {
                        get().removeItem(lotId);
                        return;
                    }

                    const { items } = get();
                    const item = items.find((i: CartItem) => i.id === lotId);

                    if (item && newQty > item.availableQty) {
                        // Max out at available
                        set({
                            items: items.map((i: CartItem) =>
                                i.id === lotId ? { ...i, cartQty: item.availableQty } : i
                            ),
                        });
                        return;
                    }

                    set({
                        items: items.map((i: CartItem) =>
                            i.id === lotId ? { ...i, cartQty: newQty } : i
                        ),
                    });
                },

                clearCart: () => {
                    set({ items: [] });
                },

                setIsOpen: (isOpen: boolean) => {
                    set({ isOpen });
                },

                toggleCart: () => {
                    set((state: CartStore) => ({ isOpen: !state.isOpen }));
                },
            }),
            {
                name: 'frescari-cart-storage',
            }
        )
    )
);

// Helpful selector exports
export const selectCartItems = (state: CartStore) => state.items;
export const selectCartIsOpen = (state: CartStore) => state.isOpen;

// Re-computes dynamic stuff like total on the fly
export const useCartTotals = () => {
    const items = useCartStore((state: CartStore) => state.items);

    const totalItems = items.reduce((acc: number, item: CartItem) => acc + item.cartQty, 0);
    const subtotal = items.reduce((acc: number, item: CartItem) => acc + (item.finalPrice * item.cartQty), 0);
    const originalSubtotal = items.reduce((acc: number, item: CartItem) => acc + ((item.originalPrice || item.finalPrice) * item.cartQty), 0);
    const savings = originalSubtotal - subtotal;

    return { totalItems, subtotal, originalSubtotal, savings };
};
