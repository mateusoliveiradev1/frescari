"use client";

import { useState } from 'react';
import Image from 'next/image';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
    Badge,
    Button,
    formatCurrencyBRL,
    formatQuantity,
} from '@frescari/ui';
import { Minus, Plus, ShoppingCart, Leaf, Calendar, Info } from 'lucide-react';
import { toast } from 'sonner';
import { CatalogLot, useCartStore, CartStore } from '@/store/useCartStore';
import {
    formatQuantityInput,
    getDefaultDetailsQuantity,
    getMaximumQuantity,
    getQuantityInputPattern,
    getQuantityMin,
    getQuantityMinLabel,
    getQuantityStep,
    isWeightBasedQuantityItem,
    normalizeQuantity,
    roundQuantity,
} from '@/lib/cart-quantity';

interface ProductDetailsSheetProps {
    lot: CatalogLot | null;
    isOpen: boolean;
    onClose: () => void;
}

export function ProductDetailsSheet({ lot, isOpen, onClose }: ProductDetailsSheetProps) {
    const addItem = useCartStore((state: CartStore) => state.addItem);
    const [quantity, setQuantity] = useState(() => (lot ? getDefaultDetailsQuantity(lot) : 1));
    const [quantityDraft, setQuantityDraft] = useState<string | null>(null);

    if (!lot) return null;

    const isWeightBased = isWeightBasedQuantityItem(lot);
    const step = getQuantityStep(lot);
    const minQuantity = getQuantityMin(lot);
    const maximumQuantity = getMaximumQuantity(lot);
    const totalPrice = lot.finalPrice * quantity;

    const clearQuantityDraft = () => {
        setQuantityDraft(null);
    };

    const commitQuantityDraft = () => {
        if (quantityDraft === null) {
            return quantity;
        }

        const normalizedDraft = quantityDraft.trim();
        clearQuantityDraft();

        if (normalizedDraft === '' || normalizedDraft === '.' || normalizedDraft === ',') {
            return quantity;
        }

        if (!getQuantityInputPattern(lot).test(normalizedDraft)) {
            return quantity;
        }

        const parsedQuantity = Number(normalizedDraft.replace(',', '.'));
        if (Number.isNaN(parsedQuantity)) {
            return quantity;
        }

        const normalizedQuantity = normalizeQuantity(lot, parsedQuantity, { clampMin: false });
        if (normalizedQuantity < minQuantity) {
            toast.error(`A quantidade minima e ${getQuantityMinLabel(lot)}.`);
            return null;
        }

        const safeQuantity = normalizeQuantity(lot, parsedQuantity);
        if (parsedQuantity > maximumQuantity) {
            toast.error('Quantidade acima do disponivel. Ajustamos para o maximo em estoque.');
        }

        setQuantity(safeQuantity);
        return safeQuantity;
    };

    const handleIncrement = () => {
        clearQuantityDraft();

        const nextQuantity = isWeightBased
            ? roundQuantity(quantity + step)
            : Math.trunc(quantity + step);

        if (nextQuantity <= maximumQuantity) {
            setQuantity(nextQuantity);
        }
    };

    const handleDecrement = () => {
        clearQuantityDraft();

        const nextQuantity = isWeightBased
            ? roundQuantity(quantity - step)
            : Math.trunc(quantity - step);

        if (nextQuantity >= minQuantity) {
            setQuantity(nextQuantity);
        }
    };

    const handleAddToCart = () => {
        const resolvedQuantity = commitQuantityDraft();

        if (!resolvedQuantity || resolvedQuantity <= 0) {
            return;
        }

        addItem(lot, resolvedQuantity);
        onClose();
    };

    const formatDate = (dateStr: string) => {
        try {
            return new Intl.DateTimeFormat('pt-BR', {
                timeZone: 'UTC',
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
            }).format(new Date(dateStr));
        } catch {
            return dateStr;
        }
    };

    return (
        <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <SheetContent className="overflow-y-auto sm:max-w-xl">
                <SheetHeader className="space-y-4">
                    <SheetDescription className="sr-only">
                        Detalhes detalhados do produto, incluindo preço, quantidade disponível e informações de colheita.
                    </SheetDescription>
                    {/* Hero Image Section — Organic Luxury Differentiation */}
                    <div className="relative w-full aspect-video rounded-sm overflow-hidden bg-sage/20 mb-4 shadow-inner">
                        {lot.imageUrl ? (
                            <Image
                                src={lot.imageUrl}
                                alt={lot.productName}
                                fill
                                className="object-cover"
                                sizes="(max-width: 768px) 100vw, 600px"
                            />
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center opacity-20">
                                <Leaf size={64} className="text-forest" />
                            </div>
                        )}

                        {/* Status Badge — SSOT */}
                        <div className="absolute top-4 left-4">
                            {lot.availableQty <= 0 ? (
                                <Badge variant="destructive" className="bg-red-500 text-white border-none px-3 py-1 font-bold">Esgotado</Badge>
                            ) : lot.status === 'vencido' ? (
                                <Badge variant="destructive" className="bg-red-500 text-white border-none px-3 py-1 font-bold">Vencido ⚠️</Badge>
                            ) : lot.status === 'last_chance' ? (
                                <Badge variant="LastChance" className="px-3 py-1 font-bold">Última Colheita 🔥</Badge>
                            ) : (
                                <Badge className="bg-forest text-white border-none px-3 py-1 font-bold flex gap-1.5 items-center">
                                    <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                                    Fresco
                                </Badge>
                            )}
                        </div>
                    </div>

                    <div className="space-y-1">
                        <SheetTitle className="text-4xl sm:text-5xl font-black italic text-soil">
                            {lot.productName}
                        </SheetTitle>
                        <div className="flex items-center gap-2 text-forest/70 font-sans text-xs font-bold uppercase tracking-widest">
                            <Leaf size={14} />
                            {lot.farmName}
                        </div>
                    </div>
                </SheetHeader>

                <div className="mt-8 space-y-8">
                    {/* B2B Info Grid */}
                    <div className="grid grid-cols-2 gap-4 border-y border-soil/10 py-6">
                        <div className="space-y-1">
                            <span className="block text-[10px] uppercase tracking-wider text-bark/50 font-bold">Data de Colheita</span>
                            <div className="flex items-center gap-2 text-soil font-medium">
                                <Calendar size={16} className="text-forest" />
                                {formatDate(lot.harvestDate)}
                            </div>
                        </div>
                        <div className="space-y-1">
                            <span className="block text-[10px] uppercase tracking-wider text-bark/50 font-bold">Validade</span>
                            <div className="flex items-center gap-2 text-soil font-medium">
                                <Info size={16} className="text-ember" />
                                {formatDate(lot.expiryDate)}
                            </div>
                        </div>
                    </div>

                    {/* Pricing & Interaction */}
                    <div className="space-y-6">
                        <div className="flex items-end justify-between">
                            <div className="space-y-1">
                                <span className="text-[10px] uppercase tracking-wider text-bark/50 font-bold">Preço Unitário</span>
                                <div className="text-3xl font-display font-black text-soil leading-none">
                                    {formatCurrencyBRL(lot.finalPrice)}
                                    <span className="text-sm font-normal text-bark/60 ml-1">/{lot.unit || lot.saleUnit}</span>
                                </div>
                            </div>
                            <div className="text-right space-y-1">
                                <span className="text-[10px] uppercase tracking-wider text-bark/50 font-bold">Disponível</span>
                                <div className="text-bark font-bold">
                                    {formatQuantity(lot.availableQty)} {lot.unit || lot.saleUnit}
                                </div>
                            </div>
                        </div>

                        {/* Quantity UI */}
                        <div className="p-6 bg-soil/5 rounded-sm space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-soil font-bold font-sans">Selecione a quantidade:</span>
                                <div className="flex items-center bg-cream border border-soil/20 rounded-sm overflow-hidden">
                                    <button
                                        onClick={handleDecrement}
                                        disabled={quantity <= minQuantity}
                                        className="p-3 hover:bg-soil/5 disabled:opacity-30 transition-colors"
                                    >
                                        <Minus size={18} />
                                    </button>
                                    <input
                                        type="text"
                                        inputMode={isWeightBased ? 'decimal' : 'numeric'}
                                        value={quantityDraft ?? formatQuantityInput(lot, quantity)}
                                        onChange={(e) => {
                                            const nextValue = e.target.value;

                                            if (!getQuantityInputPattern(lot).test(nextValue)) {
                                                return;
                                            }

                                            setQuantityDraft(nextValue);
                                        }}
                                        onBlur={() => {
                                            commitQuantityDraft();
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.currentTarget.blur();
                                            }

                                            if (e.key === 'Escape') {
                                                clearQuantityDraft();
                                                e.currentTarget.blur();
                                            }
                                        }}
                                        className="min-w-[4.5rem] border-x border-soil/10 bg-transparent px-4 py-3 text-center font-display text-xl font-bold focus:outline-none"
                                        aria-label={`Quantidade de ${lot.productName}`}
                                    />
                                    <button
                                        onClick={handleIncrement}
                                        disabled={quantity >= maximumQuantity}
                                        className="p-3 hover:bg-soil/5 disabled:opacity-30 transition-colors"
                                    >
                                        <Plus size={18} />
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center justify-between pt-4 border-t border-soil/10">
                                <span className="text-bark text-sm font-medium">Total Estimado</span>
                                <span className="text-2xl font-display font-black text-forest">
                                    {formatCurrencyBRL(totalPrice)}
                                </span>
                            </div>
                        </div>

                        {/* CTA — Sticky on Mobile for increased conversion */}
                        <div className="sticky bottom-0 bg-cream pt-4 pb-6 mt-auto border-t border-soil/10 -mx-6 px-6 sm:mx-0 sm:px-0 sm:border-none sm:relative sm:pb-0">
                            <Button
                                variant={lot.status === 'last_chance' ? 'lastChance' : 'primary'}
                                size="lg"
                                className="w-full h-16 text-lg font-bold gap-3 rounded-sm shadow-md hover:shadow-lg transition-all"
                                onClick={handleAddToCart}
                                disabled={lot.availableQty <= 0 || lot.status === 'vencido'}
                            >
                                <ShoppingCart size={20} />
                                Adicionar {formatQuantityInput(lot, quantity)} {lot.unit || lot.saleUnit} ao Carrinho
                            </Button>
                        </div>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}
