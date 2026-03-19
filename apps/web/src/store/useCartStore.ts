import { create } from "zustand";
import { persist, subscribeWithSelector } from "zustand/middleware";
import { getDefaultAddQuantity, normalizeQuantity } from "@/lib/cart-quantity";
import { resolveEffectiveSaleUnit } from "@/lib/sale-units";

// Reusing the same interface from the catalog (ensure it matches exactly what we need)
export interface CatalogLot {
  id: string;
  lotCode: string;
  farmId: string;
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
  pricingType: "UNIT" | "WEIGHT" | "BOX";
  estimatedWeight: number | null;
  unit: string;
  status: "fresco" | "last_chance" | "vencido";
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
  removeItemsByFarm: (farmId: string) => void;
  updateItemQty: (lotId: string, newQty: number) => void;
  clearCart: () => void;
  setIsOpen: (isOpen: boolean) => void;
  toggleCart: () => void;
}

export type CartStore = CartState & CartActions;

const normalizeCatalogLot = <T extends CatalogLot>(lot: T): T => ({
  ...lot,
  saleUnit: resolveEffectiveSaleUnit(lot.saleUnit, lot.unit),
});

const sanitizePersistedCartItem = (item: CartItem) => {
  if (typeof item.farmId !== "string" || item.farmId.trim().length === 0) {
    return null;
  }

  const normalizedItem = normalizeCatalogLot(item);
  const safeQty = normalizeQuantity(normalizedItem, item.cartQty);

  if (safeQty <= 0) {
    return null;
  }

  return {
    ...normalizedItem,
    cartQty: safeQty,
  };
};

export const useCartStore = create<CartStore>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        items: [],
        isOpen: false,

        addItem: (lot: CatalogLot, qty) => {
          const { items } = get();
          const normalizedLot = normalizeCatalogLot(lot);
          const existingItem = items.find(
            (i: CartItem) => i.id === normalizedLot.id,
          );
          const requestedQty = qty ?? getDefaultAddQuantity(normalizedLot);
          const finalQtyToAdd = normalizeQuantity(normalizedLot, requestedQty);

          if (finalQtyToAdd <= 0) {
            return;
          }

          if (existingItem) {
            const safeQty = normalizeQuantity(
              normalizedLot,
              existingItem.cartQty + finalQtyToAdd,
            );

            set({
              items: items.map((i: CartItem) =>
                i.id === normalizedLot.id
                  ? { ...i, ...normalizedLot, cartQty: safeQty }
                  : i,
              ),
              isOpen: true, // open cart when adding
            });
          } else {
            set({
              items: [...items, { ...normalizedLot, cartQty: finalQtyToAdd }],
              isOpen: true, // open cart when adding
            });
          }
        },

        removeItem: (lotId: string) => {
          set((state: CartStore) => ({
            items: state.items.filter((i: CartItem) => i.id !== lotId),
          }));
        },

        removeItemsByFarm: (farmId: string) => {
          set((state: CartStore) => ({
            items: state.items.filter(
              (item: CartItem) => item.farmId !== farmId,
            ),
          }));
        },

        updateItemQty: (lotId: string, newQty: number) => {
          const { items } = get();
          const item = items.find((i: CartItem) => i.id === lotId);

          if (!item) {
            return;
          }

          const safeQty = normalizeQuantity(item, newQty);

          if (safeQty <= 0) {
            return;
          }

          set({
            items: items.map((i: CartItem) =>
              i.id === lotId ? { ...i, cartQty: safeQty } : i,
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
        name: "frescari-cart-storage",
        merge: (persistedState, currentState) => {
          const persistedCart = persistedState as
            | Partial<CartState>
            | undefined;
          const persistedItems = Array.isArray(persistedCart?.items)
            ? persistedCart.items
            : [];

          return {
            ...currentState,
            items: persistedItems
              .map((item) => sanitizePersistedCartItem(item as CartItem))
              .filter((item): item is CartItem => item !== null),
            isOpen:
              typeof persistedCart?.isOpen === "boolean"
                ? persistedCart.isOpen
                : currentState.isOpen,
          };
        },
      },
    ),
  ),
);

export const selectCartIsOpen = (state: CartStore) => state.isOpen;

// Re-computes dynamic stuff like total on the fly
export const useCartTotals = () => {
  const items = useCartStore((state: CartStore) => state.items);

  const totalItems = items.reduce(
    (acc: number, item: CartItem) => acc + item.cartQty,
    0,
  );
  const subtotal = items.reduce(
    (acc: number, item: CartItem) => acc + item.finalPrice * item.cartQty,
    0,
  );
  const originalSubtotal = items.reduce(
    (acc: number, item: CartItem) =>
      acc + (item.originalPrice || item.finalPrice) * item.cartQty,
    0,
  );
  const savings = originalSubtotal - subtotal;

  return { totalItems, subtotal, originalSubtotal, savings };
};
