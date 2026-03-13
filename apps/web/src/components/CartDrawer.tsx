"use client";

import * as React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import Image from 'next/image';
import { X, Plus, Minus, ShoppingCart, Trash2, Scale, CircleHelp } from 'lucide-react';
import { Button, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger, formatCurrencyBRL } from '@frescari/ui';
import { useCartStore, useCartTotals, selectCartIsOpen, CartStore, CartItem } from '@/store/useCartStore';
import { trpc } from '@/trpc/react';
import { toast } from 'sonner';
import { authClient } from '@/lib/auth-client';
import {
    formatQuantityInput,
    getMaximumQuantity,
    getQuantityInputPattern,
    getQuantityMin,
    getQuantityMinLabel,
    getQuantityStep,
    isWeightBasedQuantityItem,
    normalizeQuantity,
    roundQuantity,
} from '@/lib/cart-quantity';

const formatCurrency = formatCurrencyBRL;

const WEIGHT_AUTHORIZATION_BUFFER = 0.1;

const roundCurrency = (value: number) => Math.round(value * 100) / 100;
const isWeightBasedCartItem = isWeightBasedQuantityItem;
const getCartQtyStep = getQuantityStep;
const getCartQtyMin = getQuantityMin;
const formatCartQtyInput = formatQuantityInput;
const hasWeightUnitHint = (value?: string | null) =>
    /(kg|quilo|quilos|g|grama|gramas|peso|weight)/i.test(value ?? '');

type CartInfoTooltipProps = {
    content: string;
    label: string;
};

function CartInfoTooltip({ content, label }: CartInfoTooltipProps) {
    const [open, setOpen] = React.useState(false);
    const [prefersTapInteraction, setPrefersTapInteraction] = React.useState(false);
    const triggerRef = React.useRef<HTMLButtonElement | null>(null);
    const contentRef = React.useRef<HTMLDivElement | null>(null);

    React.useEffect(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
            return;
        }

        const mediaQuery = window.matchMedia('(hover: none), (pointer: coarse)');
        const updateInteractionMode = () => {
            setPrefersTapInteraction(mediaQuery.matches);
            if (!mediaQuery.matches) {
                setOpen(false);
            }
        };

        updateInteractionMode();

        if (typeof mediaQuery.addEventListener === 'function') {
            mediaQuery.addEventListener('change', updateInteractionMode);
            return () => mediaQuery.removeEventListener('change', updateInteractionMode);
        }

        mediaQuery.addListener(updateInteractionMode);
        return () => mediaQuery.removeListener(updateInteractionMode);
    }, []);

    React.useEffect(() => {
        if (!prefersTapInteraction || !open) {
            return;
        }

        const handlePointerDown = (event: PointerEvent) => {
            if (!(event.target instanceof Node)) {
                return;
            }

            if (
                triggerRef.current?.contains(event.target)
                || contentRef.current?.contains(event.target)
            ) {
                return;
            }

            setOpen(false);
        };

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setOpen(false);
            }
        };

        const handleScroll = () => {
            setOpen(false);
        };

        document.addEventListener('pointerdown', handlePointerDown, true);
        document.addEventListener('keydown', handleEscape);
        window.addEventListener('scroll', handleScroll, true);

        return () => {
            document.removeEventListener('pointerdown', handlePointerDown, true);
            document.removeEventListener('keydown', handleEscape);
            window.removeEventListener('scroll', handleScroll, true);
        };
    }, [open, prefersTapInteraction]);

    const handleTouchLikePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
        if (!prefersTapInteraction || event.pointerType === 'mouse') {
            return;
        }

        event.preventDefault();
        setOpen((current) => !current);
    };

    const handleTapClick = (event: React.MouseEvent<HTMLButtonElement>) => {
        if (prefersTapInteraction) {
            event.preventDefault();
        }
    };

    const handleTapKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
        if (!prefersTapInteraction) {
            return;
        }

        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setOpen((current) => !current);
        }
    };

    return (
        <Tooltip
            onOpenChange={setOpen}
            open={open}
        >
            <TooltipTrigger asChild>
                <button
                    aria-label={label}
                    aria-expanded={prefersTapInteraction ? open : undefined}
                    className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-forest/15 bg-white text-bark/70 transition-colors hover:border-forest/30 hover:text-soil focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/30"
                    onClick={handleTapClick}
                    onKeyDown={handleTapKeyDown}
                    onPointerDown={handleTouchLikePointerDown}
                    ref={triggerRef}
                    type="button"
                >
                    <CircleHelp className="h-3.5 w-3.5" />
                </button>
            </TooltipTrigger>
            <TooltipContent
                align={prefersTapInteraction ? 'center' : 'start'}
                className="max-w-[320px]"
                collisionPadding={16}
                ref={contentRef}
                side="top"
            >
                <p>{content}</p>
            </TooltipContent>
        </Tooltip>
    );
}

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

    const setQtyDraft = (itemId: string, value: string) => {
        setQtyDrafts((current) => ({
            ...current,
            [itemId]: value,
        }));
    };

    const commitQtyDraft = (item: CartItem) => {
        const rawDraft = qtyDrafts[item.id];

        if (rawDraft === undefined) {
            return;
        }

        clearQtyDraft(item.id);

        const normalizedDraft = rawDraft.trim();
        if (normalizedDraft === '' || normalizedDraft === '.' || normalizedDraft === ',') {
            return;
        }

        const parsedQty = Number(normalizedDraft.replace(',', '.'));
        if (Number.isNaN(parsedQty)) {
            return;
        }

        const minQty = getCartQtyMin(item);
        const normalizedQty = normalizeQuantity(item, parsedQty, { clampMin: false });

        if (normalizedQty < minQty) {
            toast.error(`A quantidade minima e ${getQuantityMinLabel(item)}. Use a lixeira para remover o item.`);
            return;
        }

        const safeQty = normalizeQuantity(item, parsedQty);
        if (parsedQty > getMaximumQuantity(item)) {
            toast.error('Quantidade acima do disponivel. Ajustamos para o maximo em estoque.');
        }

        updateItemQty(item.id, safeQty);
    };

    const handleQtyDraftChange = (item: CartItem, value: string) => {
        const pattern = getQuantityInputPattern(item);

        if (!pattern.test(value)) {
            return;
        }

        setQtyDraft(item.id, value);
    };

    const adjustItemQty = (item: CartItem, direction: 'increase' | 'decrease') => {
        clearQtyDraft(item.id);

        const step = getCartQtyStep(item);
        const minQty = getCartQtyMin(item);
        const nextQty = isWeightBasedCartItem(item)
            ? roundQuantity(direction === 'increase' ? item.cartQty + step : item.cartQty - step)
            : Math.trunc(direction === 'increase' ? item.cartQty + step : item.cartQty - step);

        if (direction === 'decrease' && nextQty < minQty) {
            return;
        }

        if (direction === 'increase' && nextQty > getMaximumQuantity(item)) {
            return;
        }

        updateItemQty(item.id, nextQty);
    };

    // Delivery fee — MVP fixed value; future: recalculated via distance API
    const DELIVERY_FEE = 8.00;
    const weightBasedItems = items.filter(
        (item) =>
            isWeightBasedCartItem(item)
            || hasWeightUnitHint(item.saleUnit)
            || hasWeightUnitHint(item.unit),
    );
    const hasWeightBasedItems = weightBasedItems.length > 0;
    const weightBasedSubtotal = weightBasedItems.reduce(
        (acc, item) => acc + (item.finalPrice * item.cartQty),
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
        <TooltipProvider delayDuration={120}>
        <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
            <Dialog.Portal>
                {/* Backdrop */}
                <Dialog.Overlay className="fixed inset-0 z-[140] bg-bark/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />

                {/* Drawer Panel */}
                <Dialog.Content className="fixed inset-y-0 right-0 z-[150] flex w-full max-w-[34rem] flex-col border-l border-forest/10 bg-cream shadow-2xl data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] sm:max-w-[36rem]">
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
                    <div className="cart-drawer-scroll flex-1 overflow-y-auto overscroll-contain w-full px-4 pt-5 pb-8 sm:px-6 sm:pt-6 sm:pb-10">
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
                                                                        onClick={() => adjustItemQty(item, 'decrease')}
                                                                        className="flex h-9 w-9 items-center justify-center rounded-full text-bark transition-colors hover:bg-forest/10 hover:text-forest select-none disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-bark"
                                                                        aria-label="Decrease quantity"
                                                                        disabled={item.cartQty <= getCartQtyMin(item)}
                                                                    >
                                                                        <Minus className="w-3.5 h-3.5" />
                                                                    </button>

                                                                    <input
                                                                        type="text"
                                                                        inputMode={isWeightBased ? 'decimal' : 'numeric'}
                                                                        value={qtyDrafts[item.id] ?? formatCartQtyInput(item, item.cartQty)}
                                                                        onChange={(e) => handleQtyDraftChange(item, e.target.value)}
                                                                        onBlur={() => commitQtyDraft(item)}
                                                                        onKeyDown={(e) => {
                                                                            if (e.key === 'Enter') {
                                                                                e.currentTarget.blur();
                                                                            }

                                                                            if (e.key === 'Escape') {
                                                                                clearQtyDraft(item.id);
                                                                                e.currentTarget.blur();
                                                                            }
                                                                        }}
                                                                        className="w-16 border-none bg-transparent p-0 text-center font-sans text-sm font-semibold tabular-nums focus:ring-0"
                                                                        style={{ MozAppearance: 'textfield' }}
                                                                        aria-label={`Quantidade de ${item.productName}`}
                                                                    />

                                                                    <button
                                                                        onClick={() => adjustItemQty(item, 'increase')}
                                                                        className="flex h-9 w-9 items-center justify-center rounded-full text-bark transition-colors hover:bg-forest/10 hover:text-forest select-none disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-bark"
                                                                        aria-label="Increase quantity"
                                                                        disabled={roundQuantity(item.cartQty + getCartQtyStep(item)) > getMaximumQuantity(item)}
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

                                <div className="rounded-[24px] border border-forest/10 bg-white p-4 shadow-[0_10px_24px_rgba(27,67,50,0.05)]">
                                    {hasWeightBasedItems && (
                                        <div className="mb-4 rounded-[20px] border border-forest/10 bg-sage/20 p-3.5">
                                            <div className="flex items-start gap-3">
                                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-forest text-cream">
                                                    <Scale className="h-4 w-4" />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <p className="text-sm font-semibold text-soil">
                                                            Compra por peso com transparencia
                                                        </p>
                                                        <CartInfoTooltip
                                                            content="Produtos vendidos por peso podem variar um pouco na separacao. O checkout reserva ate 10% acima da estimativa, mas a cobranca final considera apenas o peso exato separado pelo produtor."
                                                            label="Entenda como funciona a compra por peso"
                                                        />
                                                    </div>
                                                    <p className="mt-1 text-xs leading-5 text-bark/80">
                                                        O total abaixo continua estimado ate a pesagem final.
                                                    </p>
                                                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-bark">
                                                        <span className="rounded-full border border-forest/10 bg-white px-3 py-1.5">
                                                            {`Estimativa atual: ${formatCurrency(estimatedTotal)}`}
                                                        </span>
                                                        <span className="rounded-full border border-forest/10 bg-white px-3 py-1.5">
                                                            {`Limite maximo reservado: ${formatCurrency(estimatedPreAuthorizationTotal)}`}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="space-y-3">
                                        {savings > 0 && (
                                            <div className="flex items-center justify-between text-sm font-medium text-ember">
                                                <span>Economia em Last Chance</span>
                                                <span>- {formatCurrency(savings)}</span>
                                            </div>
                                        )}
                                        <div className="flex items-center justify-between gap-3 text-sm text-bark">
                                            <span className="flex items-center gap-2">
                                                {hasWeightBasedItems ? 'Subtotal estimado dos itens' : 'Subtotal dos itens'}
                                                {hasWeightBasedItems && (
                                                    <CartInfoTooltip
                                                        content="Para itens por peso, este subtotal usa a quantidade informada no carrinho como estimativa inicial. O valor pode subir ou descer um pouco depois da pesagem exata."
                                                        label="Entenda o subtotal estimado dos itens por peso"
                                                    />
                                                )}
                                            </span>
                                            <span className="font-medium text-soil">{formatCurrency(subtotal)}</span>
                                        </div>
                                        <div className="flex items-center justify-between gap-3 text-sm text-bark">
                                            <span>Taxa de entrega</span>
                                            <span className="font-medium text-soil">{formatCurrency(DELIVERY_FEE)}</span>
                                        </div>
                                        {hasWeightBasedItems && (
                                            <div className="flex items-center justify-between gap-3 text-sm text-bark">
                                                <span className="flex items-center gap-2">
                                                    Margem de pre-autorizacao (10%)
                                                    <CartInfoTooltip
                                                        content="Essa margem serve apenas para garantir a aprovacao do pagamento caso o peso real fique um pouco acima da estimativa. Se ela nao for usada, nao entra na cobranca final."
                                                        label="Entenda a margem de pre-autorizacao de dez por cento"
                                                    />
                                                </span>
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
                                                        O valor final sera confirmado apos a pesagem exata dos itens.
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
                                <Button
                                    className="rounded-xl normal-case tracking-normal"
                                    disabled={items.length === 0 || createCheckout.isPending}
                                    onClick={clearCart}
                                    type="button"
                                    variant="ghost"
                                >
                                    Limpar
                                </Button>
                                <Button
                                    className="flex-1 rounded-xl normal-case tracking-normal"
                                    disabled={items.length === 0 || !isAddressComplete}
                                    isPending={createCheckout.isPending}
                                    onClick={handleCheckout}
                                    type="button"
                                    variant="primary"
                                >
                                    Ir para Pagamento
                                </Button>
                            </div>
                        </div>
                    )}
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
        </TooltipProvider>
    );
}
