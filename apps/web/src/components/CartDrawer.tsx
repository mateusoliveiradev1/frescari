"use client";

import * as React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import Image from 'next/image';
import { X, Plus, Minus, ShoppingCart, Trash2, Loader2, Scale } from 'lucide-react';
import { useCartStore, useCartTotals, selectCartIsOpen, CartStore, CartItem } from '@/store/useCartStore';
import { trpc } from '@/trpc/react';
import { toast } from 'sonner';
import { authClient } from '@/lib/auth-client';

const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

const WEIGHT_AUTHORIZATION_BUFFER = 0.1;

const roundCurrency = (value: number) => Math.round(value * 100) / 100;

const isWeightBasedCartItem = (
    item: Pick<CartItem, 'pricingType' | 'saleUnit' | 'unit'>
) => {
    const normalizedSaleUnit = item.saleUnit?.toLowerCase();
    const normalizedUnit = item.unit?.toLowerCase();

    return item.pricingType === 'WEIGHT'
        || normalizedSaleUnit === 'kg'
        || normalizedSaleUnit === 'g'
        || normalizedSaleUnit === 'peso'
        || normalizedSaleUnit === 'weight'
        || normalizedUnit === 'kg'
        || normalizedUnit === 'g';
};

export function CartDrawer() {
    const isOpen = useCartStore(selectCartIsOpen);
    const setIsOpen = useCartStore((state: CartStore) => state.setIsOpen);
    const items = useCartStore((state: CartStore) => state.items);
    const updateItemQty = useCartStore((state: CartStore) => state.updateItemQty);
    const removeItem = useCartStore((state: CartStore) => state.removeItem);
    const clearCart = useCartStore((state: CartStore) => state.clearCart);

    // Calculate totals directly from the hook
    const { totalItems, subtotal, savings } = useCartTotals();
    const { data: session } = authClient.useSession();

    const [deliveryStreet, setDeliveryStreet] = React.useState('');
    const [deliveryNumber, setDeliveryNumber] = React.useState('');
    const [deliveryCep, setDeliveryCep] = React.useState('');
    const [deliveryCity, setDeliveryCity] = React.useState('');
    const [deliveryState, setDeliveryState] = React.useState('');
    const [deliveryNotes, setDeliveryNotes] = React.useState('');
    const [qtyDrafts, setQtyDrafts] = React.useState<Record<string, string>>({});

    React.useEffect(() => {
        setQtyDrafts((current) => {
            const validItemIds = new Set(items.map((item) => item.id));
            let changed = false;
            const nextDrafts: Record<string, string> = {};

            for (const [itemId, draftValue] of Object.entries(current)) {
                if (validItemIds.has(itemId)) {
                    nextDrafts[itemId] = draftValue;
                } else {
                    changed = true;
                }
            }

            return changed ? nextDrafts : current;
        });
    }, [items]);

    const clearQtyDraft = (itemId: string) => {
        setQtyDrafts((current) => {
            if (!(itemId in current)) {
                return current;
            }

            const nextDrafts = { ...current };
            delete nextDrafts[itemId];
            return nextDrafts;
        });
    };

    const commitWeightQtyDraft = (item: CartItem) => {
        const rawDraft = qtyDrafts[item.id];

        if (rawDraft === undefined) {
            return;
        }

        clearQtyDraft(item.id);

        const normalizedDraft = rawDraft.trim();
        if (normalizedDraft === '' || normalizedDraft === '.') {
            return;
        }

        const parsedQty = Number(normalizedDraft);
        if (Number.isNaN(parsedQty)) {
            return;
        }

        updateItemQty(item.id, parsedQty);
    };

    // Delivery fee — MVP fixed value; future: recalculated via distance API
    const DELIVERY_FEE = 8.00;
    const hasWeightBasedItems = items.some((item) => isWeightBasedCartItem(item));
    const weightBasedSubtotal = items.reduce(
        (acc, item) => acc + (isWeightBasedCartItem(item) ? item.finalPrice * item.cartQty : 0),
        0
    );
    const estimatedTotal = roundCurrency(subtotal + DELIVERY_FEE);
    const authorizationBuffer = hasWeightBasedItems
        ? roundCurrency(weightBasedSubtotal * WEIGHT_AUTHORIZATION_BUFFER)
        : 0;
    const estimatedPreAuthorizationTotal = roundCurrency(estimatedTotal + authorizationBuffer);

    const createCheckout = trpc.checkout.createCheckoutSession.useMutation({
        onSuccess: (data: { url: string }) => {
            // Close the cart drawer and clear items BEFORE redirecting to Stripe
            // This ensures users don't see old cart items when returning to the success page
            setIsOpen(false);
            clearCart();
            // Redirect to Stripe Checkout
            window.location.href = data.url;
        },
        onError: (err) => {
            toast.error(err.message || 'Falha ao iniciar pagamento. Verifique sua conexão e tente novamente.');
        },
    });

    const isAddressComplete = deliveryStreet.trim().length >= 3 &&
        deliveryNumber.trim().length >= 1 &&
        /^\d{5}-?\d{3}$/.test(deliveryCep.trim()) &&
        deliveryCity.trim().length >= 2 &&
        deliveryState.trim().length === 2;

    const handleCheckout = () => {
        if (items.length === 0) return;

        // @ts-expect-error tenantId exists in custom schema
        if (!session?.user?.tenantId) {
            toast.error("Seu cadastro está incompleto. Empresa não identificada.");
            return;
        }

        if (!isAddressComplete) {
            toast.error("Por favor, preencha todos os campos do endereço de entrega.");
            return;
        }

        createCheckout.mutate({
            items: items.map(item => ({
                lotId: item.id,
                quantity: item.cartQty,
                pricingType: item.pricingType,
                productName: item.productName,
                unitPrice: item.finalPrice,
                imageUrl: item.imageUrl,
            })),
            address: {
                street: deliveryStreet.trim(),
                number: deliveryNumber.trim(),
                cep: deliveryCep.trim(),
                city: deliveryCity.trim(),
                state: deliveryState.trim().toUpperCase(),
            },
            deliveryFee: DELIVERY_FEE,
        });
    };

    // Prevent hydration mismatch for zustand persist (optional, but good practice)
    const [isMounted, setIsMounted] = React.useState(false);
    React.useEffect(() => {
        setIsMounted(true);
    }, []);

    if (!isMounted) return null;

    return (
        <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
            <Dialog.Portal>
                {/* Backdrop */}
                <Dialog.Overlay className="fixed inset-0 z-50 bg-bark/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />

                {/* Drawer Panel */}
                <Dialog.Content className="fixed inset-y-0 right-0 z-50 w-full max-w-[34rem] bg-cream shadow-2xl border-l border-forest/10 flex flex-col data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] sm:max-w-[36rem]">
                    <Dialog.Description className="sr-only">
                        Resumo dos itens no seu carrinho de compras e formulário de endereço para finalização do pedido.
                    </Dialog.Description>
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-5 border-b border-forest/10 bg-white">
                        <Dialog.Title className="font-display text-xl font-bold text-soil flex items-center gap-2">
                            <ShoppingCart className="w-5 h-5 text-forest" />
                            Seu Carrinho
                            {totalItems > 0 && (
                                <span className="ml-2 inline-flex items-center justify-center bg-forest text-cream text-[11px] font-bold h-5 px-2 rounded-full">
                                    {totalItems}
                                </span>
                            )}
                        </Dialog.Title>
                        <Dialog.Close asChild>
                            <button
                                className="p-2 text-bark/60 hover:text-soil hover:bg-forest/5 rounded-full transition-colors"
                                aria-label="Fechar"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </Dialog.Close>
                    </div>

                    {/* Content area */}
                    <div className="flex-1 overflow-y-auto w-full px-4 py-5 sm:p-6">
                        {items.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-70">
                                <ShoppingCart className="w-16 h-16 text-forest/20" />
                                <div>
                                    <p className="font-display text-lg font-bold text-soil">Carrinho vazio</p>
                                    <p className="font-sans text-sm text-bark mt-1">
                                        Adicione os melhores produtos frescos da região.
                                    </p>
                                </div>
                                <Dialog.Close asChild>
                                    <button className="mt-4 rounded-full bg-forest/10 px-6 py-2 font-semibold text-forest transition-colors hover:bg-forest/20">
                                        Explorar Catálogo
                                    </button>
                                </Dialog.Close>
                            </div>
                        ) : (
                            <div className="space-y-5">
                                <ul className="space-y-4 w-full sm:space-y-5">
                                {items.map((item: CartItem) => {
                                    const isWeightBased = isWeightBasedCartItem(item);

                                    return (
                                        <li key={item.id} className="rounded-[26px] border border-forest/10 bg-white p-4 shadow-[0_12px_28px_rgba(27,67,50,0.06)]">
                                            <div className="grid grid-cols-[96px_minmax(0,1fr)] items-start gap-4">
                                                <div className="relative h-24 w-24 overflow-hidden rounded-[22px] border border-forest/10 bg-forest/5">
                                                    {item.imageUrl ? (
                                                        <Image
                                                            src={item.imageUrl}
                                                            alt={item.productName}
                                                            fill
                                                            sizes="96px"
                                                            className="object-cover object-center"
                                                        />
                                                    ) : (
                                                        <div className="flex h-full w-full items-center justify-center">
                                                            <span className="font-display text-sm font-medium text-forest/30">Sem foto</span>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="min-w-0">
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="min-w-0">
                                                            <h3 className="font-sans text-[16px] font-semibold leading-snug text-soil line-clamp-2">
                                                                {item.productName}
                                                            </h3>
                                                            <p className="mt-1 text-xs text-bark/80 line-clamp-1">
                                                                {item.farmName}
                                                            </p>
                                                        </div>
                                                        <button
                                                            onClick={() => removeItem(item.id)}
                                                            className="mt-0.5 rounded-full p-1.5 text-bark/40 transition-colors hover:bg-ember/10 hover:text-ember"
                                                            aria-label="Remove item"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>

                                                    <div className="mt-2 flex flex-wrap items-center gap-2">
                                                        <span className="inline-flex items-center rounded-full bg-forest/10 px-2.5 py-1 text-[10px] font-semibold text-forest ring-1 ring-inset ring-forest/20 capitalize">
                                                            {item.unit}
                                                            {item.pricingType === 'BOX' && item.estimatedWeight ? ` (~${item.estimatedWeight}kg)` : ''}
                                                        </span>
                                                        {item.isLastChance && (
                                                            <span className="inline-flex items-center rounded-full bg-ember/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-ember">
                                                                Aproveite 🔥
                                                            </span>
                                                        )}
                                                    </div>

                                                    <div className="mt-3 rounded-[20px] bg-cream px-3.5 py-3 ring-1 ring-forest/8">
                                                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                                            <div className="min-w-0">
                                                                {item.originalPrice > item.finalPrice && (
                                                                    <span className="block text-[10px] text-bark/60 line-through">
                                                                        {formatCurrency(item.originalPrice)}
                                                                    </span>
                                                                )}
                                                                <span className="font-sans text-sm font-bold text-forest">
                                                                    {formatCurrency(item.finalPrice)}
                                                                    <span className="text-xs font-normal text-bark"> / {item.unit}</span>
                                                                </span>
                                                            </div>

                                                            <div className="flex justify-end">
                                                                <div className="flex shrink-0 items-center rounded-full border border-forest/15 bg-white p-1 shadow-sm">
                                                                    <button
                                                                        onClick={() => {
                                                                            if (isWeightBased) {
                                                                                clearQtyDraft(item.id);
                                                                            }

                                                                            updateItemQty(
                                                                                item.id,
                                                                                isWeightBased
                                                                                    ? Math.max(0, Number((item.cartQty - 0.5).toFixed(2)))
                                                                                    : item.cartQty - 1
                                                                            );
                                                                        }}
                                                                        className="flex h-9 w-9 items-center justify-center rounded-full text-bark transition-colors hover:bg-forest/10 hover:text-forest select-none"
                                                                        aria-label="Decrease quantity"
                                                                    >
                                                                        <Minus className="w-3.5 h-3.5" />
                                                                    </button>

                                                                    {isWeightBased ? (
                                                                        <input
                                                                            type="text"
                                                                            inputMode="decimal"
                                                                            value={qtyDrafts[item.id] ?? String(item.cartQty)}
                                                                            onChange={(e) => {
                                                                                const val = e.target.value.replace(',', '.');

                                                                                if (/^\d*\.?\d*$/.test(val)) {
                                                                                    setQtyDrafts((current) => ({
                                                                                        ...current,
                                                                                        [item.id]: val,
                                                                                    }));
                                                                                }
                                                                            }}
                                                                            onBlur={() => commitWeightQtyDraft(item)}
                                                                            onKeyDown={(e) => {
                                                                                if (e.key === 'Enter') {
                                                                                    e.currentTarget.blur();
                                                                                }

                                                                                if (e.key === 'Escape') {
                                                                                    clearQtyDraft(item.id);
                                                                                    e.currentTarget.blur();
                                                                                }
                                                                            }}
                                                                            className="w-14 border-none bg-transparent p-0 text-center font-sans text-sm font-semibold focus:ring-0"
                                                                            style={{ MozAppearance: 'textfield' }}
                                                                        />
                                                                    ) : (
                                                                        <span className="w-12 text-center font-sans text-sm font-semibold select-none">
                                                                            {item.cartQty}
                                                                        </span>
                                                                    )}

                                                                    <button
                                                                        onClick={() => {
                                                                            if (isWeightBased) {
                                                                                clearQtyDraft(item.id);
                                                                            }

                                                                            updateItemQty(
                                                                                item.id,
                                                                                isWeightBased
                                                                                    ? Number((item.cartQty + 0.5).toFixed(2))
                                                                                    : item.cartQty + 1
                                                                            );
                                                                        }}
                                                                        className="flex h-9 w-9 items-center justify-center rounded-full text-bark transition-colors hover:bg-forest/10 hover:text-forest select-none"
                                                                        aria-label="Increase quantity"
                                                                        disabled={item.cartQty >= item.availableQty}
                                                                    >
                                                                        <Plus className="w-3.5 h-3.5" />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>

                            <div className="space-y-4 border-t border-forest/10 pt-5">
                                <div className="space-y-3 rounded-[24px] border border-forest/10 bg-white p-4 shadow-[0_10px_24px_rgba(27,67,50,0.05)]">
                                    <p className="text-xs font-bold uppercase tracking-wider text-soil">
                                        {"Endere\u00E7o de Entrega"}
                                    </p>
                                    <div className="grid grid-cols-3 gap-2.5">
                                        <div className="col-span-2">
                                            <label htmlFor="street" className="mb-1 block text-[10px] font-semibold text-bark">Rua *</label>
                                            <input
                                                id="street"
                                                type="text"
                                                placeholder="Rua das Flores"
                                                value={deliveryStreet}
                                                onChange={(e) => setDeliveryStreet(e.target.value)}
                                                className="w-full rounded-xl border border-forest/20 bg-cream px-3 py-2.5 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-forest/30"
                                            />
                                        </div>
                                        <div>
                                            <label htmlFor="number" className="mb-1 block text-[10px] font-semibold text-bark">{"N\u00BA *"}</label>
                                            <input
                                                id="number"
                                                type="text"
                                                placeholder="123"
                                                value={deliveryNumber}
                                                onChange={(e) => setDeliveryNumber(e.target.value)}
                                                className="w-full rounded-xl border border-forest/20 bg-cream px-3 py-2.5 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-forest/30"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2.5">
                                        <div>
                                            <label htmlFor="cep" className="mb-1 block text-[10px] font-semibold text-bark">CEP *</label>
                                            <input
                                                id="cep"
                                                type="text"
                                                placeholder="01234-567"
                                                value={deliveryCep}
                                                onChange={(e) => setDeliveryCep(e.target.value)}
                                                className="w-full rounded-xl border border-forest/20 bg-cream px-3 py-2.5 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-forest/30"
                                                maxLength={9}
                                            />
                                        </div>
                                        <div>
                                            <label htmlFor="city" className="mb-1 block text-[10px] font-semibold text-bark">Cidade *</label>
                                            <input
                                                id="city"
                                                type="text"
                                                placeholder={"S\u00E3o Paulo"}
                                                value={deliveryCity}
                                                onChange={(e) => setDeliveryCity(e.target.value)}
                                                className="w-full rounded-xl border border-forest/20 bg-cream px-3 py-2.5 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-forest/30"
                                            />
                                        </div>
                                        <div>
                                            <label htmlFor="state" className="mb-1 block text-[10px] font-semibold text-bark">UF *</label>
                                            <input
                                                id="state"
                                                type="text"
                                                placeholder="SP"
                                                value={deliveryState}
                                                onChange={(e) => setDeliveryState(e.target.value)}
                                                className="w-full rounded-xl border border-forest/20 bg-cream px-3 py-2.5 text-sm uppercase transition-all focus:outline-none focus:ring-2 focus:ring-forest/30"
                                                maxLength={2}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label htmlFor="notes" className="mb-1 block text-[10px] font-semibold text-bark">
                                            {"Observa\u00E7\u00F5es (Opcional)"}
                                        </label>
                                        <input
                                            id="notes"
                                            type="text"
                                            placeholder="Ex: Deixar na portaria"
                                            value={deliveryNotes}
                                            onChange={(e) => setDeliveryNotes(e.target.value)}
                                            className="w-full rounded-xl border border-forest/20 bg-cream px-3 py-2.5 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-forest/30"
                                        />
                                    </div>
                                </div>

                                {hasWeightBasedItems && (
                                    <div className="rounded-[24px] border border-forest/10 bg-sage/20 p-4 shadow-[0_10px_24px_rgba(27,67,50,0.05)]">
                                        <div className="flex items-start gap-3">
                                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-forest text-cream">
                                                <Scale className="h-4 w-4" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-xs font-bold uppercase tracking-wider text-soil">{"Aviso de Pesagem"}</p>
                                                <p className="mt-1 text-sm font-semibold leading-6 text-soil">
                                                    {"Itens por peso podem sofrer pequena varia\u00E7\u00E3o."}
                                                </p>
                                                <p className="mt-2 text-sm leading-6 text-bark">
                                                    {"O seu cart\u00E3o ir\u00E1 pr\u00E9-autorizar uma margem de 10% a mais, mas voc\u00EA s\u00F3 pagar\u00E1 pelo peso exato que for separado pelo produtor."}
                                                </p>
                                                <div className="mt-3 flex flex-wrap gap-2 text-xs text-bark">
                                                    <span className="rounded-full border border-forest/10 bg-white px-3 py-1.5">
                                                        {`Estimativa atual: ${formatCurrency(estimatedTotal)}`}
                                                    </span>
                                                    <span className="rounded-full border border-forest/10 bg-white px-3 py-1.5">
                                                        {`Pr\u00E9-autoriza\u00E7\u00E3o m\u00E1xima: ${formatCurrency(estimatedPreAuthorizationTotal)}`}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="rounded-[24px] border border-forest/10 bg-white p-4 shadow-[0_10px_24px_rgba(27,67,50,0.05)]">
                                    <div className="space-y-3">
                                        {savings > 0 && (
                                            <div className="flex items-center justify-between text-sm font-medium text-ember">
                                                <span>Economia em Last Chance</span>
                                                <span>- {formatCurrency(savings)}</span>
                                            </div>
                                        )}
                                        <div className="flex items-center justify-between gap-3 text-sm text-bark">
                                            <span>{hasWeightBasedItems ? 'Subtotal estimado dos itens' : 'Subtotal dos itens'}</span>
                                            <span className="font-medium text-soil">{formatCurrency(subtotal)}</span>
                                        </div>
                                        <div className="flex items-center justify-between gap-3 text-sm text-bark">
                                            <span>Taxa de entrega</span>
                                            <span className="font-medium text-soil">{formatCurrency(DELIVERY_FEE)}</span>
                                        </div>
                                        {hasWeightBasedItems && (
                                            <div className="flex items-center justify-between gap-3 text-sm text-bark">
                                                <span>{"Margem de pr\u00E9-autoriza\u00E7\u00E3o (10%)"}</span>
                                                <span className="font-medium text-soil">{formatCurrency(authorizationBuffer)}</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="mt-4 border-t border-forest/10 pt-4">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="min-w-0">
                                                <p className="text-lg font-bold text-soil">
                                                    {hasWeightBasedItems ? 'Estimativa do total' : 'Total'}
                                                </p>
                                                {hasWeightBasedItems && (
                                                    <p className="mt-1 text-[11px] leading-5 text-bark/70">
                                                        {"O valor final ser\u00E1 confirmado ap\u00F3s a pesagem exata dos itens."}
                                                    </p>
                                                )}
                                            </div>
                                            <span className="text-xl font-bold text-soil">
                                                {formatCurrency(hasWeightBasedItems ? estimatedTotal : subtotal + DELIVERY_FEE)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    {items.length > 0 && (
                        <div className="border-t border-forest/10 bg-white px-4 py-4 sm:px-6 sm:py-5">
                            {false && (
                                <div className="space-y-3 rounded-xl border border-forest/10 bg-forest/5 p-4">
                                <p className="text-xs font-bold uppercase tracking-wider text-soil">Endereço de Entrega</p>
                                <div className="grid grid-cols-3 gap-2">
                                    <div className="col-span-2">
                                        <label htmlFor="street" className="mb-0.5 block text-[10px] font-semibold text-bark">Rua *</label>
                                        <input
                                            id="street"
                                            type="text"
                                            placeholder="Rua das Flores"
                                            value={deliveryStreet}
                                            onChange={(e) => setDeliveryStreet(e.target.value)}
                                            className="w-full rounded-lg border border-forest/20 bg-white px-3 py-2 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-forest/30"
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="number" className="mb-0.5 block text-[10px] font-semibold text-bark">Nº *</label>
                                        <input
                                            id="number"
                                            type="text"
                                            placeholder="123"
                                            value={deliveryNumber}
                                            onChange={(e) => setDeliveryNumber(e.target.value)}
                                            className="w-full rounded-lg border border-forest/20 bg-white px-3 py-2 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-forest/30"
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    <div>
                                        <label htmlFor="cep" className="mb-0.5 block text-[10px] font-semibold text-bark">CEP *</label>
                                        <input
                                            id="cep"
                                            type="text"
                                            placeholder="01234-567"
                                            value={deliveryCep}
                                            onChange={(e) => setDeliveryCep(e.target.value)}
                                            className="w-full rounded-lg border border-forest/20 bg-white px-3 py-2 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-forest/30"
                                            maxLength={9}
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="city" className="mb-0.5 block text-[10px] font-semibold text-bark">Cidade *</label>
                                        <input
                                            id="city"
                                            type="text"
                                            placeholder="São Paulo"
                                            value={deliveryCity}
                                            onChange={(e) => setDeliveryCity(e.target.value)}
                                            className="w-full rounded-lg border border-forest/20 bg-white px-3 py-2 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-forest/30"
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="state" className="mb-0.5 block text-[10px] font-semibold text-bark">UF *</label>
                                        <input
                                            id="state"
                                            type="text"
                                            placeholder="SP"
                                            value={deliveryState}
                                            onChange={(e) => setDeliveryState(e.target.value)}
                                            className="w-full rounded-lg border border-forest/20 bg-white px-3 py-2 text-sm uppercase transition-all focus:outline-none focus:ring-2 focus:ring-forest/30"
                                            maxLength={2}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label htmlFor="notes" className="mb-0.5 block text-[10px] font-semibold text-bark">Observações (Opcional)</label>
                                    <input
                                        id="notes"
                                        type="text"
                                        placeholder="Ex: Deixar na portaria"
                                        value={deliveryNotes}
                                        onChange={(e) => setDeliveryNotes(e.target.value)}
                                        className="w-full rounded-lg border border-forest/20 bg-white px-3 py-2 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-forest/30"
                                    />
                                </div>
                                </div>
                            )}

                            {hasWeightBasedItems && (
                                <div className="hidden rounded-xl border border-forest/10 bg-sage/20 p-4">
                                    <div className="flex items-start gap-3">
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-forest text-cream">
                                            <Scale className="h-4 w-4" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-xs font-bold uppercase tracking-wider text-soil">Aviso de Pesagem</p>
                                            <p className="mt-1 text-sm font-semibold text-soil">
                                                Itens por peso podem sofrer pequena variação.
                                            </p>
                                            <p className="mt-2 text-sm leading-6 text-bark">
                                                O seu cartão irá pré-autorizar uma margem de 10% a mais, mas você só pagará pelo peso exato que for separado pelo produtor.
                                            </p>
                                            <div className="mt-3 flex flex-wrap gap-2 text-xs text-bark">
                                                <span className="rounded-full border border-forest/10 bg-white px-3 py-1">
                                                    {`Estimativa atual: ${formatCurrency(estimatedTotal)}`}
                                                </span>
                                                <span className="rounded-full border border-forest/10 bg-white px-3 py-1">
                                                    {`Pré-autorização máxima: ${formatCurrency(estimatedPreAuthorizationTotal)}`}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {savings > 0 && false && (
                                <div className="flex items-center justify-between text-sm font-medium text-ember">
                                    <span>Economia em Last Chance</span>
                                    <span>- {formatCurrency(savings)}</span>
                                </div>
                            )}
                            <div className="hidden items-center justify-between text-sm text-bark">
                                <span>{hasWeightBasedItems ? 'Subtotal estimado dos itens' : 'Subtotal dos itens'}</span>
                                <span>{formatCurrency(subtotal)}</span>
                            </div>
                            <div className="hidden items-center justify-between text-sm text-bark">
                                <span>Taxa de entrega</span>
                                <span>{formatCurrency(DELIVERY_FEE)}</span>
                            </div>
                            {hasWeightBasedItems && (
                                <div className="hidden items-center justify-between text-sm text-bark">
                                    <span>Margem de pré-autorização (10%)</span>
                                    <span>{formatCurrency(authorizationBuffer)}</span>
                                </div>
                            )}
                            <div className="hidden border-t border-forest/10 pt-3">
                                <div className="flex items-center justify-between text-lg font-bold text-soil">
                                    <span>{hasWeightBasedItems ? 'Estimativa do total' : 'Total'}</span>
                                    <span>{formatCurrency(hasWeightBasedItems ? estimatedTotal : subtotal + DELIVERY_FEE)}</span>
                                </div>
                                {hasWeightBasedItems && (
                                    <p className="mt-1 text-[11px] text-bark/70">
                                        O valor final será confirmado após a pesagem exata dos itens.
                                    </p>
                                )}
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={clearCart}
                                    disabled={createCheckout.isPending}
                                    className="rounded-xl border border-forest/20 px-4 py-3 font-semibold text-bark transition-colors hover:bg-forest/5 disabled:opacity-50"
                                >
                                    Limpar
                                </button>
                                <button
                                    onClick={handleCheckout}
                                    disabled={createCheckout.isPending || items.length === 0 || !isAddressComplete}
                                    className="relative flex-1 rounded-xl bg-forest px-4 py-3 font-bold text-cream shadow-md transition-colors hover:-translate-y-[1px] hover:bg-forest/90 hover:shadow-lg active:translate-y-0 disabled:pointer-events-none disabled:opacity-50"
                                >
                                    <span className="flex items-center justify-center gap-2">
                                        {createCheckout.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Ir para Pagamento"}
                                    </span>
                                </button>
                            </div>
                        </div>
                    )}
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
