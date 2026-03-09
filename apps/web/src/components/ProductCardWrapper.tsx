"use client";

import { ProductCard } from '@frescari/ui';
import { useCartStore, CartStore, CatalogLot } from '@/store/useCartStore';

export function ProductCardWrapper({ lot, isLastChance, delay }: { lot: CatalogLot; isLastChance: boolean, delay?: string }) {
    const addItem = useCartStore((state: CartStore) => state.addItem);

    return (
        <ProductCard
            lotCode={lot.lotCode}
            productName={lot.productName}
            finalPrice={lot.finalPrice}
            originalPrice={lot.originalPrice}
            availableQty={lot.availableQty}
            saleUnit={lot.saleUnit}
            farmName={lot.farmName}
            harvestDate={lot.harvestDate}
            imageUrl={lot.imageUrl}
            isLastChance={isLastChance}
            style={delay ? { animationDelay: delay } : undefined}
            onReserve={() => addItem(lot)}
        />
    )
}
