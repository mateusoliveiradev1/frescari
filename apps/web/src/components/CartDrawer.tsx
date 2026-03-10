"use client";

import * as React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Plus, Minus, ShoppingCart, Trash2, Loader2 } from 'lucide-react';
import { useCartStore, useCartTotals, selectCartIsOpen, CartStore, CartItem } from '@/store/useCartStore';
import { trpc } from '@/trpc/react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { authClient } from '@/lib/auth-client';

const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

export function CartDrawer() {
    const isOpen = useCartStore(selectCartIsOpen);
    const setIsOpen = useCartStore((state: CartStore) => state.setIsOpen);
    const items = useCartStore((state: CartStore) => state.items);
    const updateItemQty = useCartStore((state: CartStore) => state.updateItemQty);
    const removeItem = useCartStore((state: CartStore) => state.removeItem);
    const clearCart = useCartStore((state: CartStore) => state.clearCart);

    // Calculate totals directly from the hook
    const { totalItems, subtotal, originalSubtotal, savings } = useCartTotals();

    const router = useRouter();
    const { data: session } = authClient.useSession();

    const [deliveryAddress, setDeliveryAddress] = React.useState('');
    const [deliveryNotes, setDeliveryNotes] = React.useState('');

    // @ts-ignore - bypassing workspace type propagation issues
    const createOrder = trpc.order.createOrder.useMutation({
        onSuccess: () => {
            clearCart();
            setIsOpen(false);
            setDeliveryAddress('');
            setDeliveryNotes('');
            router.push('/dashboard/pedidos');
        },
        onError: (err: any) => {
            toast.error(err.message || 'Falha ao iniciar pagamento. Verifique sua conexão e tente novamente.');
        },
    });

    const handleCheckout = () => {
        if (items.length === 0) return;

        // @ts-expect-error tenantId exists in custom schema
        if (!session?.user?.tenantId) {
            toast.error("Seu cadastro está incompleto. Empresa não identificada.");
            return;
        }

        if (!deliveryAddress.trim()) {
            toast.error("Por favor, preencha o endereço de entrega.");
            return;
        }

        createOrder.mutate({
            deliveryAddress: deliveryAddress.trim(),
            deliveryNotes: deliveryNotes.trim() ? deliveryNotes.trim() : undefined,
            items: items.map(item => ({
                lotId: item.id,
                quantity: item.cartQty
            }))
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
                <Dialog.Content className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-cream shadow-2xl border-l border-forest/10 flex flex-col data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]">
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
                    <div className="flex-1 overflow-y-auto w-full p-6">
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
                                    <button className="mt-4 px-6 py-2 bg-forest/10 text-forest font-semibold rounded-full hover:bg-forest/20 transition-colors">
                                        Explorar Catálogo
                                    </button>
                                </Dialog.Close>
                            </div>
                        ) : (
                            <ul className="space-y-6 w-full">
                                {items.map((item: CartItem) => {
                                    const isWeightBased = ['kg', 'g'].includes(item.saleUnit.toLowerCase());
                                    const step = isWeightBased ? 0.5 : 1;

                                    return (
                                        <li key={item.id} className="flex gap-4">
                                            {/* Item Image */}
                                            <div className="flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden bg-forest/5 border border-forest/10">
                                                {item.imageUrl ? (
                                                    <img
                                                        src={item.imageUrl}
                                                        alt={item.productName}
                                                        className="w-full h-full object-cover object-center"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center">
                                                        <span className="text-forest/30 font-display font-medium">Sem foto</span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Item Info */}
                                            <div className="flex-1 flex flex-col justify-between">
                                                <div>
                                                    <div className="flex justify-between items-start">
                                                        <h3 className="font-sans text-base font-semibold text-soil line-clamp-1">
                                                            {item.productName}
                                                        </h3>
                                                        <button
                                                            onClick={() => removeItem(item.id)}
                                                            className="text-bark/40 hover:text-ember transition-colors p-1"
                                                            aria-label="Remove item"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                    <div className="flex flex-wrap items-center gap-2 mt-1">
                                                        <p className="text-xs text-bark/80">
                                                            {item.farmName}
                                                        </p>
                                                        <span className="inline-flex items-center rounded-md bg-forest/10 px-2 py-0.5 text-[10px] font-medium text-forest ring-1 ring-inset ring-forest/20 capitalize">
                                                            {item.unit}
                                                            {item.pricingType === 'BOX' && item.estimatedWeight ? ` (~${item.estimatedWeight}kg)` : ''}
                                                        </span>
                                                    </div>
                                                    {item.isLastChance && (
                                                        <span className="inline-block mt-1 text-[10px] font-bold text-ember uppercase tracking-wider bg-ember/10 px-1.5 py-0.5 rounded-sm">
                                                            Aproveite 🔥
                                                        </span>
                                                    )}
                                                </div>

                                                <div className="flex items-end justify-between mt-3">
                                                    {/* Price */}
                                                    <div className="flex flex-col">
                                                        {item.originalPrice > item.finalPrice && (
                                                            <span className="text-[10px] text-bark line-through opacity-70">
                                                                {formatCurrency(item.originalPrice)}
                                                            </span>
                                                        )}
                                                        <span className="font-sans font-bold text-forest">
                                                            {formatCurrency(item.finalPrice)}
                                                            <span className="text-xs font-normal text-bark"> / {item.unit}</span>
                                                        </span>
                                                    </div>

                                                    {/* Qty Controls */}
                                                    <div className="flex items-center bg-white border border-forest/20 rounded-full p-1 shadow-sm">
                                                        <button
                                                            onClick={() => updateItemQty(item.id, item.pricingType === 'WEIGHT' ? Math.max(0, Number((item.cartQty - 0.5).toFixed(2))) : item.cartQty - 1)}
                                                            className="w-7 h-7 flex items-center justify-center text-bark hover:text-forest hover:bg-forest/10 rounded-full transition-colors select-none"
                                                            aria-label="Decrease quantity"
                                                        >
                                                            <Minus className="w-3.5 h-3.5" />
                                                        </button>

                                                        {item.pricingType === 'WEIGHT' ? (
                                                            <input
                                                                type="text"
                                                                inputMode="decimal"
                                                                value={item.cartQty}
                                                                onChange={(e) => {
                                                                    // Only allow numbers and dots/commas
                                                                    const val = e.target.value.replace(',', '.');
                                                                    if (val === '' || val === '.') {
                                                                        // Temoporary state can be tricky with Zustand numeric typing, 
                                                                        // but passing 0 is a workaround if we strictly delete.
                                                                        updateItemQty(item.id, 0);
                                                                    } else if (!isNaN(Number(val))) {
                                                                        updateItemQty(item.id, Number(val));
                                                                    }
                                                                }}
                                                                className="w-12 text-center font-sans text-sm font-semibold bg-transparent border-none focus:ring-0 p-0 m-0"
                                                                style={{ MozAppearance: 'textfield' }}
                                                            />
                                                        ) : (
                                                            <span className="w-10 text-center font-sans text-sm font-semibold select-none">
                                                                {item.cartQty}
                                                            </span>
                                                        )}

                                                        <button
                                                            onClick={() => updateItemQty(item.id, item.pricingType === 'WEIGHT' ? Number((item.cartQty + 0.5).toFixed(2)) : item.cartQty + 1)}
                                                            className="w-7 h-7 flex items-center justify-center text-bark hover:text-forest hover:bg-forest/10 rounded-full transition-colors select-none"
                                                            aria-label="Increase quantity"
                                                            disabled={item.cartQty >= item.availableQty}
                                                        >
                                                            <Plus className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>

                    {/* Footer */}
                    {items.length > 0 && (
                        <div className="border-t border-forest/10 bg-white p-6 pb-8 space-y-4">
                            {/* Delivery Form */}
                            <div className="space-y-3 mb-4 p-4 bg-forest/5 rounded-xl border border-forest/10">
                                <div>
                                    <label htmlFor="address" className="block text-xs font-semibold text-soil mb-1">
                                        Endereço Completo de Entrega *
                                    </label>
                                    <input
                                        id="address"
                                        type="text"
                                        placeholder="Ex: Rua das Flores, 123, Bairro Centro"
                                        value={deliveryAddress}
                                        onChange={(e) => setDeliveryAddress(e.target.value)}
                                        className="w-full px-3 py-2 text-sm rounded-lg border border-forest/20 focus:outline-none focus:ring-2 focus:ring-forest/30 transition-all bg-white"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="notes" className="block text-xs font-semibold text-soil mb-1">
                                        Observações (Opcional)
                                    </label>
                                    <input
                                        id="notes"
                                        type="text"
                                        placeholder="Ex: Deixar na portaria"
                                        value={deliveryNotes}
                                        onChange={(e) => setDeliveryNotes(e.target.value)}
                                        className="w-full px-3 py-2 text-sm rounded-lg border border-forest/20 focus:outline-none focus:ring-2 focus:ring-forest/30 transition-all bg-white"
                                    />
                                </div>
                            </div>

                            {savings > 0 && (
                                <div className="flex items-center justify-between text-sm font-medium text-ember">
                                    <span>Economia em Last Chance</span>
                                    <span>- {formatCurrency(savings)}</span>
                                </div>
                            )}
                            <div className="flex items-center justify-between text-lg font-bold text-soil">
                                <span>Subtotal</span>
                                <span>{formatCurrency(subtotal)}</span>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={clearCart}
                                    disabled={createOrder.isPending}
                                    className="px-4 py-3 rounded-xl border border-forest/20 font-semibold text-bark hover:bg-forest/5 transition-colors disabled:opacity-50"
                                >
                                    Limpar
                                </button>
                                <button
                                    onClick={handleCheckout}
                                    disabled={createOrder.isPending || items.length === 0 || !deliveryAddress.trim()}
                                    className="flex-1 px-4 py-3 rounded-xl bg-forest text-cream font-bold hover:bg-forest/90 transition-colors shadow-md hover:shadow-lg hover:-translate-y-[1px] active:translate-y-0 relative disabled:opacity-50 disabled:pointer-events-none"
                                >
                                    <span className="flex items-center justify-center gap-2">
                                        {createOrder.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Finalizar Pedido"}
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
