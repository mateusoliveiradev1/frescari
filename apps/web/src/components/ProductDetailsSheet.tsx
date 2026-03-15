"use client";

import { useState } from "react";
import Image from "next/image";
import {
    Badge,
    Button,
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    formatCurrencyBRL,
    formatQuantity,
} from "@frescari/ui";
import { Calendar, Info, Leaf, Minus, Plus, Scale, ShoppingCart } from "lucide-react";
import { toast } from "sonner";

import { type CartStore, type CatalogLot, useCartStore } from "@/store/useCartStore";
import { getBuyerAccessState } from "@/lib/buyer-access";
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
} from "@/lib/cart-quantity";

interface ProductDetailsSheetProps {
    lot: CatalogLot | null;
    isOpen: boolean;
    onClose: () => void;
}

function formatDate(dateStr: string) {
    try {
        return new Intl.DateTimeFormat("pt-BR", {
            timeZone: "UTC",
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
        }).format(new Date(dateStr));
    } catch {
        return dateStr;
    }
}

export function ProductDetailsSheet({
    lot,
    isOpen,
    onClose,
}: ProductDetailsSheetProps) {
    if (!lot) {
        return null;
    }

    return (
        <Sheet onOpenChange={(open) => !open && onClose()} open={isOpen}>
            <ProductDetailsSheetBody key={lot.id} lot={lot} onClose={onClose} />
        </Sheet>
    );
}

function ProductDetailsSheetBody({
    lot,
    onClose,
}: {
    lot: CatalogLot;
    onClose: () => void;
}) {
    const addItem = useCartStore((state: CartStore) => state.addItem);
    const [quantity, setQuantity] = useState(() => getDefaultDetailsQuantity(lot));
    const [quantityDraft, setQuantityDraft] = useState<string | null>(null);
    const [imageError, setImageError] = useState(false);

    const isWeightBased = isWeightBasedQuantityItem(lot);
    const minimumQuantity = getQuantityMin(lot);
    const maximumQuantity = getMaximumQuantity(lot);
    const quantityStep = getQuantityStep(lot);
    const totalPrice = lot.finalPrice * quantity;
    const unitLabel = lot.unit || lot.saleUnit;
    const isUnavailable = lot.availableQty <= 0 || lot.status === "vencido";

    const clearDraft = () => {
        setQuantityDraft(null);
    };

    const commitQuantityDraft = () => {
        if (quantityDraft === null) {
            return quantity;
        }

        const normalizedDraft = quantityDraft.trim();
        clearDraft();

        if (normalizedDraft === "" || normalizedDraft === "." || normalizedDraft === ",") {
            return quantity;
        }

        if (!getQuantityInputPattern(lot).test(normalizedDraft)) {
            return quantity;
        }

        const parsedQuantity = Number(normalizedDraft.replace(",", "."));
        if (Number.isNaN(parsedQuantity)) {
            return quantity;
        }

        const unclamped = normalizeQuantity(lot, parsedQuantity, { clampMin: false });
        if (unclamped < minimumQuantity) {
            toast.error(`A quantidade minima e ${getQuantityMinLabel(lot)}.`);
            return null;
        }

        const safeQuantity = normalizeQuantity(lot, parsedQuantity);
        if (parsedQuantity > maximumQuantity) {
            toast.error("Quantidade acima do disponivel. Ajustamos para o maximo em estoque.");
        }

        setQuantity(safeQuantity);
        return safeQuantity;
    };

    const handleIncrement = () => {
        clearDraft();

        const nextQuantity = isWeightBased
            ? roundQuantity(quantity + quantityStep)
            : Math.trunc(quantity + quantityStep);

        if (nextQuantity <= maximumQuantity) {
            setQuantity(nextQuantity);
        }
    };

    const handleDecrement = () => {
        clearDraft();

        const nextQuantity = isWeightBased
            ? roundQuantity(quantity - quantityStep)
            : Math.trunc(quantity - quantityStep);

        if (nextQuantity >= minimumQuantity) {
            setQuantity(nextQuantity);
        }
    };

    const handleAddToCart = async () => {
        const resolvedQuantity = commitQuantityDraft();

        if (!resolvedQuantity || resolvedQuantity <= 0) {
            return;
        }

        const accessState = await getBuyerAccessState();

        if (accessState === "guest") {
            toast.error("Entre como comprador para reservar lotes e liberar o carrinho.", {
                action: {
                    label: "Entrar",
                    onClick: () => {
                        window.location.href = "/auth/login";
                    },
                },
            });
            return;
        }

        if (accessState === "forbidden") {
            toast.error("Esta conta nao pode comprar. Entre com uma conta de comprador para continuar.");
            return;
        }

        if (accessState === "error") {
            toast.error("Nao foi possivel validar sua sessao agora. Tente novamente.");
            return;
        }

        addItem(lot, resolvedQuantity);
        onClose();
    };

    return (
        <SheetContent className="overflow-y-auto border-l border-forest/10 bg-cream sm:max-w-[38rem]">
            <SheetHeader className="space-y-5">
                <SheetDescription className="text-left font-sans text-sm leading-6 text-bark/78">
                    Veja origem, janela de colheita, disponibilidade real e ajuste a quantidade
                    antes de enviar o lote para o carrinho.
                </SheetDescription>

                <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[28px] border border-forest/10 bg-sage/20 shadow-[0_22px_40px_-34px_rgba(13,51,33,0.45)]">
                    {lot.imageUrl && !imageError ? (
                        <Image
                            alt={lot.productName}
                            className="object-cover"
                            fill
                            onError={() => setImageError(true)}
                            sizes="(max-width: 768px) 100vw, 560px"
                            src={lot.imageUrl}
                        />
                    ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-sage/45 via-cream to-sage/20">
                            <div className="flex h-16 w-16 items-center justify-center rounded-full border border-forest/10 bg-white/80 text-forest">
                                <Leaf className="h-7 w-7" />
                            </div>
                            <p className="font-sans text-[10px] font-bold uppercase tracking-[0.18em] text-bark/58">
                                Imagem indisponivel
                            </p>
                        </div>
                    )}

                    <div className="absolute left-4 top-4">
                        {lot.availableQty <= 0 ? (
                            <Badge className="border-red-200 bg-red-50 text-red-700" variant="destructive">
                                Esgotado
                            </Badge>
                        ) : lot.status === "vencido" ? (
                            <Badge className="border-red-200 bg-red-50 text-red-700" variant="destructive">
                                Fora da janela
                            </Badge>
                        ) : lot.status === "last_chance" ? (
                            <Badge variant="LastChance">Ultima safra</Badge>
                        ) : (
                            <Badge variant="default">Fresco do dia</Badge>
                        )}
                    </div>
                </div>

                <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-forest/10 bg-white px-3 py-1.5 font-sans text-[10px] font-bold uppercase tracking-[0.18em] text-forest">
                            {lot.farmName}
                        </span>
                        <span className="rounded-full border border-soil/10 bg-white px-3 py-1.5 font-sans text-[10px] font-bold uppercase tracking-[0.18em] text-bark/65">
                            Lote {lot.lotCode}
                        </span>
                    </div>

                    <SheetTitle className="text-left font-display text-4xl font-black tracking-[-0.05em] text-soil sm:text-5xl">
                        {lot.productName}
                    </SheetTitle>
                </div>
            </SheetHeader>

            <div className="mt-8 space-y-6">
                <section className="grid gap-3 sm:grid-cols-2">
                    <div className="surface-panel rounded-[24px] p-5">
                        <p className="field-label">Colheita</p>
                        <div className="mt-3 flex items-center gap-3 text-soil">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sage/60 text-forest">
                                <Calendar className="h-4 w-4" />
                            </div>
                            <p className="font-sans text-sm font-semibold">{formatDate(lot.harvestDate)}</p>
                        </div>
                    </div>

                    <div className="surface-panel rounded-[24px] p-5">
                        <p className="field-label">Validade</p>
                        <div className="mt-3 flex items-center gap-3 text-soil">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-ember/10 text-ember">
                                <Info className="h-4 w-4" />
                            </div>
                            <p className="font-sans text-sm font-semibold">{formatDate(lot.expiryDate)}</p>
                        </div>
                    </div>

                    <div className="surface-panel rounded-[24px] p-5">
                        <p className="field-label">Disponivel</p>
                        <p className="mt-3 font-display text-2xl font-black tracking-[-0.04em] text-soil">
                            {formatQuantity(lot.availableQty)}
                            <span className="ml-2 font-sans text-xs font-semibold uppercase tracking-[0.16em] text-bark/58">
                                {unitLabel}
                            </span>
                        </p>
                    </div>

                    <div className="surface-panel rounded-[24px] p-5">
                        <p className="field-label">Preco por unidade</p>
                        <p className="mt-3 font-display text-2xl font-black tracking-[-0.04em] text-forest">
                            {formatCurrencyBRL(lot.finalPrice)}
                            <span className="ml-2 font-sans text-xs font-semibold uppercase tracking-[0.16em] text-bark/58">
                                /{unitLabel}
                            </span>
                        </p>
                    </div>
                </section>

                <section className="surface-panel rounded-[28px] p-6">
                    <div className="flex flex-col gap-6">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                            <div>
                                <p className="field-label">Quantidade</p>
                                <h3 className="mt-2 font-display text-2xl font-black tracking-[-0.04em] text-soil">
                                    Ajuste antes de reservar
                                </h3>
                            </div>
                            <p className="font-sans text-sm leading-6 text-bark/72">
                                Minimo de {getQuantityMinLabel(lot)} e maximo de {formatQuantity(maximumQuantity)} {unitLabel}.
                            </p>
                        </div>

                        <div className="flex flex-col gap-5 rounded-[24px] border border-forest/10 bg-white p-5">
                            <div className="flex items-center justify-between gap-4">
                                <span className="font-sans text-sm font-semibold text-soil">
                                    Quantidade selecionada
                                </span>

                                <div className="flex items-center rounded-full border border-forest/15 bg-cream p-1 shadow-[0_12px_28px_-28px_rgba(13,51,33,0.46)]">
                                    <button
                                        aria-label="Diminuir quantidade"
                                        className="flex h-11 w-11 items-center justify-center rounded-full text-bark transition-[background-color,color,box-shadow] duration-150 hover:bg-forest/10 hover:text-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2 focus-visible:ring-offset-cream disabled:cursor-not-allowed disabled:opacity-35"
                                        disabled={quantity <= minimumQuantity}
                                        onClick={handleDecrement}
                                        type="button"
                                    >
                                        <Minus className="h-4 w-4" />
                                    </button>

                                    <input
                                        aria-label={`Quantidade de ${lot.productName}`}
                                        className="w-20 border-x border-soil/10 bg-transparent px-4 py-3 text-center font-display text-2xl font-black tracking-[-0.03em] text-soil focus:outline-none"
                                        inputMode={isWeightBased ? "decimal" : "numeric"}
                                        onBlur={() => {
                                            commitQuantityDraft();
                                        }}
                                        onChange={(event) => {
                                            const nextValue = event.target.value;

                                            if (!getQuantityInputPattern(lot).test(nextValue)) {
                                                return;
                                            }

                                            setQuantityDraft(nextValue);
                                        }}
                                        onKeyDown={(event) => {
                                            if (event.key === "Enter") {
                                                event.currentTarget.blur();
                                            }

                                            if (event.key === "Escape") {
                                                clearDraft();
                                                event.currentTarget.blur();
                                            }
                                        }}
                                        type="text"
                                        value={quantityDraft ?? formatQuantityInput(lot, quantity)}
                                    />

                                    <button
                                        aria-label="Aumentar quantidade"
                                        className="flex h-11 w-11 items-center justify-center rounded-full text-bark transition-[background-color,color,box-shadow] duration-150 hover:bg-forest/10 hover:text-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2 focus-visible:ring-offset-cream disabled:cursor-not-allowed disabled:opacity-35"
                                        disabled={roundQuantity(quantity + quantityStep) > maximumQuantity}
                                        onClick={handleIncrement}
                                        type="button"
                                    >
                                        <Plus className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-end justify-between gap-4 border-t border-soil/10 pt-5">
                                <div>
                                    <p className="field-label">Estimativa do pedido</p>
                                    <p className="mt-2 font-sans text-sm leading-6 text-bark/72">
                                        O valor final considera a quantidade selecionada agora.
                                    </p>
                                </div>
                                <p className="font-display text-3xl font-black tracking-[-0.05em] text-forest">
                                    {formatCurrencyBRL(totalPrice)}
                                </p>
                            </div>
                        </div>

                        {isWeightBased ? (
                            <div className="rounded-[22px] border border-forest/10 bg-sage/22 p-4">
                                <div className="flex items-start gap-3">
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-forest text-cream">
                                        <Scale className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <p className="font-sans text-sm font-semibold text-soil">
                                            Item vendido por peso
                                        </p>
                                        <p className="mt-1 font-sans text-sm leading-6 text-bark/78">
                                            A pesagem final pode variar um pouco na separacao. O checkout mostra a
                                            previsao e a cobranca considera o peso real.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ) : null}
                    </div>
                </section>
            </div>

            <div className="sticky bottom-0 mt-8 border-t border-forest/10 bg-cream/96 px-1 pb-1 pt-5 backdrop-blur sm:px-0">
                <Button
                    className="h-15 w-full gap-3 rounded-[20px] text-base shadow-[0_22px_44px_-26px_rgba(13,51,33,0.46)] transition-[background-color,border-color,color,box-shadow,transform] duration-200 hover:-translate-y-0.5"
                    disabled={isUnavailable}
                    onClick={handleAddToCart}
                    size="lg"
                    type="button"
                    variant={lot.status === "last_chance" ? "lastChance" : "primary"}
                >
                    <ShoppingCart className="h-5 w-5" />
                    {isUnavailable
                        ? "Lote indisponivel"
                        : `Adicionar ${formatQuantityInput(lot, quantity)} ${unitLabel} ao carrinho`}
                </Button>
            </div>
        </SheetContent>
    );
}
