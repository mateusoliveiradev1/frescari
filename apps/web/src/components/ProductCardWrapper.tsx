"use client";

import { useState } from 'react';
import { ProductCard } from '@frescari/ui';
import { useCartStore, CartStore, CatalogLot } from '@/store/useCartStore';
import { ProductDetailsSheet } from './ProductDetailsSheet';

export function ProductCardWrapper({ lot, isLastChance, delay }: { lot: CatalogLot; isLastChance: boolean, delay?: string }) {
    const addItem = useCartStore((state: CartStore) => state.addItem);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);

    return (
        <>
            <ProductCard
                lotCode={lot.lotCode}
                productName={lot.productName}
                finalPrice={lot.finalPrice}
                originalPrice={lot.originalPrice}
                availableQty={lot.availableQty}
                saleUnit={lot.saleUnit}
                unit={lot.unit}
                status={lot.status}
                farmName={lot.farmName}
                harvestDate={lot.harvestDate}
                imageUrl={lot.imageUrl}
                isLastChance={isLastChance}
                style={delay ? { animationDelay: delay } : undefined}
                onReserve={() => addItem(lot)}
                onOpenDetails={() => setIsDetailsOpen(true)}
            />
            <ProductDetailsSheet
                lot={lot}
                isOpen={isDetailsOpen}
                onClose={() => setIsDetailsOpen(false)}
            />
        </>
    )
}
