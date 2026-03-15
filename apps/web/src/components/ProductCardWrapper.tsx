"use client";

import { useState } from 'react';
import { ProductCard } from '@frescari/ui';
import { toast } from 'sonner';
import { useCartStore, CartStore, CatalogLot } from '@/store/useCartStore';
import { getBuyerAccessState } from '@/lib/buyer-access';
import { ProductDetailsSheet } from './ProductDetailsSheet';

export function ProductCardWrapper({ lot, isLastChance, delay, priority }: { lot: CatalogLot; isLastChance: boolean, delay?: string, priority?: boolean }) {
    const addItem = useCartStore((state: CartStore) => state.addItem);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);

    const handleReserve = async () => {
        const accessState = await getBuyerAccessState();

        if (accessState === 'guest') {
            toast.error('Entre como comprador para reservar lotes e liberar o carrinho.', {
                action: {
                    label: 'Entrar',
                    onClick: () => {
                        window.location.href = '/auth/login';
                    },
                },
            });
            return;
        }

        if (accessState === 'forbidden') {
            toast.error('Esta conta nao pode comprar. Entre com uma conta de comprador para continuar.');
            return;
        }

        if (accessState === 'error') {
            toast.error('Nao foi possivel validar sua sessao agora. Tente novamente.');
            return;
        }

        addItem(lot);
    };

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
                priority={priority}
                style={delay ? { animationDelay: delay } : undefined}
                onReserve={handleReserve}
                onOpenDetails={() => setIsDetailsOpen(true)}
            />
            <ProductDetailsSheet
                key={`${lot.id}-${isDetailsOpen ? 'open' : 'closed'}`}
                lot={lot}
                isOpen={isDetailsOpen}
                onClose={() => setIsDetailsOpen(false)}
            />
        </>
    )
}
