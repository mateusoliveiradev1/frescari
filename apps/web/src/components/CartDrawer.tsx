"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import Image from "next/image";
import Link from "next/link";
import {
  CircleHelp,
  LoaderCircle,
  MapPin,
  Minus,
  Plus,
  Scale,
  ShoppingCart,
  Trash2,
  X,
} from "lucide-react";
import {
  Button,
  Skeleton,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  formatCurrencyBRL,
} from "@frescari/ui";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
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
} from "@/lib/cart-quantity";
import { getSaleUnitLabel, resolveEffectiveSaleUnit } from "@/lib/sale-units";
import {
  type CartItem,
  type CartStore,
  selectCartIsOpen,
  useCartStore,
} from "@/store/useCartStore";
import { trpc } from "@/trpc/react";

type DefaultAddress = {
  id: string;
  title: string;
  formattedAddress: string;
  street: string;
  number: string;
  zipcode: string;
  city: string;
  state: string;
} | null;

type FarmGroup = {
  farmId: string;
  farmName: string;
  items: CartItem[];
};

type SessionUser = {
  id?: string;
  name?: string | null;
  email?: string | null;
  role?: string | null;
};

const formatCurrency = formatCurrencyBRL;
const WEIGHT_AUTHORIZATION_BUFFER = 0.1;

const roundCurrency = (value: number) => Math.round(value * 100) / 100;

type CartInfoTooltipProps = {
  content: string;
  label: string;
};

function CartInfoTooltip({ content, label }: CartInfoTooltipProps) {
  const [open, setOpen] = React.useState(false);
  const [prefersTapInteraction, setPrefersTapInteraction] =
    React.useState(false);
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const contentRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function"
    ) {
      return;
    }

    const mediaQuery = window.matchMedia("(hover: none), (pointer: coarse)");
    const updateInteractionMode = () => {
      setPrefersTapInteraction(mediaQuery.matches);
      if (!mediaQuery.matches) {
        setOpen(false);
      }
    };

    updateInteractionMode();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", updateInteractionMode);
      return () =>
        mediaQuery.removeEventListener("change", updateInteractionMode);
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
        triggerRef.current?.contains(event.target) ||
        contentRef.current?.contains(event.target)
      ) {
        return;
      }

      setOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    const handleScroll = () => {
      setOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleEscape);
    window.addEventListener("scroll", handleScroll, true);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleEscape);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [open, prefersTapInteraction]);

  const handleTouchLikePointerDown = (
    event: React.PointerEvent<HTMLButtonElement>,
  ) => {
    if (!prefersTapInteraction || event.pointerType === "mouse") {
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

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setOpen((current) => !current);
    }
  };

  return (
    <Tooltip onOpenChange={setOpen} open={open}>
      <TooltipTrigger asChild>
        <button
          aria-expanded={prefersTapInteraction ? open : undefined}
          aria-label={label}
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
        align={prefersTapInteraction ? "center" : "start"}
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

function buildFarmGroups(items: CartItem[]): FarmGroup[] {
  const grouped = new Map<string, FarmGroup>();

  for (const item of items) {
    const current = grouped.get(item.farmId);
    if (current) {
      current.items.push(item);
      continue;
    }

    grouped.set(item.farmId, {
      farmId: item.farmId,
      farmName: item.farmName,
      items: [item],
    });
  }

  return Array.from(grouped.values());
}

function FarmCheckoutSection({
  group,
  defaultAddress,
  isAddressLoading,
  isBuyerSignedIn,
}: {
  group: FarmGroup;
  defaultAddress: DefaultAddress;
  isAddressLoading: boolean;
  isBuyerSignedIn: boolean;
}) {
  const removeItem = useCartStore((state: CartStore) => state.removeItem);
  const removeItemsByFarm = useCartStore(
    (state: CartStore) => state.removeItemsByFarm,
  );
  const updateItemQty = useCartStore((state: CartStore) => state.updateItemQty);
  const setIsOpen = useCartStore((state: CartStore) => state.setIsOpen);
  const [drafts, setDrafts] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    setDrafts((current) => {
      const validIds = new Set(group.items.map((item) => item.id));
      const next: Record<string, string> = {};

      for (const [itemId, value] of Object.entries(current)) {
        if (validIds.has(itemId)) {
          next[itemId] = value;
        }
      }

      return next;
    });
  }, [group.items]);

  const commitDraft = (item: CartItem) => {
    const raw = drafts[item.id];

    if (raw === undefined) {
      return;
    }

    setDrafts((current) => {
      const next = { ...current };
      delete next[item.id];
      return next;
    });

    const normalized = raw.trim();
    if (normalized === "" || normalized === "." || normalized === ",") {
      return;
    }

    const parsed = Number(normalized.replace(",", "."));
    if (Number.isNaN(parsed)) {
      return;
    }

    const minimum = getQuantityMin(item);
    const unclamped = normalizeQuantity(item, parsed, { clampMin: false });
    if (unclamped < minimum) {
      toast.error(`A quantidade minima e ${getQuantityMinLabel(item)}.`);
      return;
    }

    const safeQty = normalizeQuantity(item, parsed);
    if (parsed > getMaximumQuantity(item)) {
      toast.error(
        "Quantidade acima do disponivel. Ajustamos para o maximo em estoque.",
      );
    }

    updateItemQty(item.id, safeQty);
  };

  const adjustQty = (item: CartItem, direction: "increase" | "decrease") => {
    const step = getQuantityStep(item);
    const nextQty = isWeightBasedQuantityItem(item)
      ? roundQuantity(
          direction === "increase" ? item.cartQty + step : item.cartQty - step,
        )
      : Math.trunc(
          direction === "increase" ? item.cartQty + step : item.cartQty - step,
        );

    if (direction === "decrease" && nextQty < getQuantityMin(item)) {
      return;
    }

    if (direction === "increase" && nextQty > getMaximumQuantity(item)) {
      return;
    }

    updateItemQty(item.id, nextQty);
  };

  const subtotal = group.items.reduce(
    (sum, item) => sum + item.finalPrice * item.cartQty,
    0,
  );
  const weightBasedItems = group.items.filter((item) =>
    isWeightBasedQuantityItem(item),
  );
  const hasWeightBasedItems = weightBasedItems.length > 0;
  const weightBasedSubtotal = weightBasedItems.reduce(
    (sum, item) => sum + item.finalPrice * item.cartQty,
    0,
  );

  const freightQuery = trpc.logistics.calculateFreight.useQuery(
    {
      farmId: group.farmId,
      addressId: defaultAddress?.id ?? "",
      subtotal,
    },
    {
      enabled: Boolean(isBuyerSignedIn && defaultAddress?.id),
      retry: false,
    },
  );

  const checkoutMutation = trpc.checkout.createFarmCheckoutSession.useMutation({
    onSuccess: (data) => {
      removeItemsByFarm(group.farmId);
      setIsOpen(false);
      window.location.href = data.url;
    },
    onError: (error) => {
      toast.error(
        error.message || "Falha ao iniciar o checkout desta fazenda.",
      );
    },
  });

  const isOutOfRange = freightQuery.error?.data?.code === "PRECONDITION_FAILED";
  const minOrderValue = freightQuery.data?.minOrderValue ?? 0;
  const hasReachedMinimumOrder =
    freightQuery.data?.hasReachedMinimumOrder ?? minOrderValue <= 0;
  const remainingForMinimumOrder =
    freightQuery.data?.remainingForMinimumOrder ??
    Math.max(0, roundCurrency(minOrderValue - subtotal));
  const freeShippingThreshold =
    freightQuery.data?.freeShippingThreshold ?? null;
  const hasReachedFreeShipping =
    freightQuery.data?.hasReachedFreeShipping ?? false;
  const remainingForFreeShipping =
    freightQuery.data?.remainingForFreeShipping ??
    (freeShippingThreshold !== null
      ? Math.max(0, roundCurrency(freeShippingThreshold - subtotal))
      : null);
  const freightCost = freightQuery.data?.freightCost ?? null;
  const baseFreightCost = freightQuery.data?.baseFreightCost ?? freightCost;
  const total =
    freightCost === null
      ? null
      : Math.round((subtotal + freightCost) * 100) / 100;
  const authorizationBuffer = hasWeightBasedItems
    ? roundCurrency(weightBasedSubtotal * WEIGHT_AUTHORIZATION_BUFFER)
    : 0;
  const estimatedPreAuthorizationTotal =
    total !== null && hasWeightBasedItems
      ? roundCurrency(total + authorizationBuffer)
      : null;
  const disableCheckout =
    !isBuyerSignedIn ||
    !defaultAddress ||
    isAddressLoading ||
    freightQuery.isPending ||
    checkoutMutation.isPending ||
    isOutOfRange ||
    !hasReachedMinimumOrder ||
    (freightQuery.isError && !isOutOfRange) ||
    freightCost === null;

  const handleCheckout = () => {
    if (!isBuyerSignedIn) {
      toast.error("Faca login como comprador para continuar.");
      return;
    }

    if (!defaultAddress) {
      toast.error("Cadastre um endereco padrao antes de concluir o pedido.");
      return;
    }

    if (!hasReachedMinimumOrder) {
      toast.error(
        `Faltam ${formatCurrency(remainingForMinimumOrder)} para atingir o pedido minimo desta fazenda.`,
      );
      return;
    }

    if (freightCost === null) {
      toast.error("Aguarde o calculo do frete desta fazenda.");
      return;
    }

    checkoutMutation.mutate({
      farmId: group.farmId,
      addressId: defaultAddress.id,
      items: group.items.map((item) => ({
        lotId: item.id,
        quantity: item.cartQty,
      })),
    });
  };

  return (
    <section className="space-y-4 rounded-[28px] border border-forest/10 bg-white p-4 shadow-[0_12px_28px_rgba(27,67,50,0.06)]">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-sans text-[10px] font-bold uppercase tracking-[0.18em] text-bark/60">
            Pedido por fazenda
          </p>
          <h3 className="font-display text-2xl font-black text-soil">
            {group.farmName}
          </h3>
        </div>
        <span className="rounded-full border border-forest/15 bg-sage px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-forest">
          {group.items.length} item{group.items.length > 1 ? "s" : ""}
        </span>
      </div>

      <ul className="space-y-3">
        {group.items.map((item) => {
          const isWeightBased = isWeightBasedQuantityItem(item);

          return (
            <li
              className="rounded-[22px] border border-forest/10 bg-cream p-4"
              key={item.id}
            >
              <div className="grid grid-cols-[84px_minmax(0,1fr)] gap-4">
                <div className="relative h-21 w-21 overflow-hidden rounded-[18px] border border-forest/10 bg-forest/5">
                  {item.imageUrl ? (
                    <Image
                      alt={item.productName}
                      className="object-cover"
                      fill
                      sizes="84px"
                      src={item.imageUrl}
                    />
                  ) : null}
                </div>

                <div className="min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h4 className="line-clamp-2 font-sans text-sm font-semibold text-soil">
                        {item.productName}
                      </h4>
                      <p className="mt-1 text-xs text-bark/75">
                        {formatCurrency(item.finalPrice)} /{" "}
                        {getSaleUnitLabel(
                          resolveEffectiveSaleUnit(item.saleUnit, item.unit),
                        )}
                      </p>
                    </div>
                    <button
                      aria-label="Remover item"
                      className="rounded-full p-1.5 text-bark/40 transition-[background-color,color,box-shadow] hover:bg-ember/10 hover:text-ember focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
                      onClick={() => removeItem(item.id)}
                      type="button"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mt-3 flex items-center justify-end">
                    <div className="flex items-center rounded-full border border-forest/15 bg-white p-1 shadow-[0_14px_28px_-26px_rgba(13,51,33,0.5)]">
                      <button
                        aria-label="Diminuir quantidade"
                        className="flex h-9 w-9 items-center justify-center rounded-full text-bark transition-[background-color,color,box-shadow] hover:bg-forest/10 hover:text-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-40"
                        disabled={item.cartQty <= getQuantityMin(item)}
                        onClick={() => adjustQty(item, "decrease")}
                        type="button"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>

                      <input
                        aria-label={`Quantidade de ${item.productName}`}
                        className="w-16 border-none bg-transparent p-0 text-center font-sans text-sm font-semibold tabular-nums text-soil focus:outline-none focus:ring-0"
                        inputMode={isWeightBased ? "decimal" : "numeric"}
                        onBlur={() => commitDraft(item)}
                        onChange={(event) => {
                          const value = event.target.value;
                          if (getQuantityInputPattern(item).test(value)) {
                            setDrafts((current) => ({
                              ...current,
                              [item.id]: value,
                            }));
                          }
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === "Escape") {
                            event.currentTarget.blur();
                          }
                        }}
                        type="text"
                        style={{ MozAppearance: "textfield" }}
                        value={
                          drafts[item.id] ??
                          formatQuantityInput(item, item.cartQty)
                        }
                      />

                      <button
                        aria-label="Aumentar quantidade"
                        className="flex h-9 w-9 items-center justify-center rounded-full text-bark transition-[background-color,color,box-shadow] hover:bg-forest/10 hover:text-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-40"
                        disabled={
                          roundQuantity(item.cartQty + getQuantityStep(item)) >
                          getMaximumQuantity(item)
                        }
                        onClick={() => adjustQty(item, "increase")}
                        type="button"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="rounded-[24px] border border-forest/10 bg-white p-4 shadow-[0_18px_36px_-30px_rgba(13,51,33,0.42)]">
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
                    content="Itens vendidos por peso podem variar um pouco na separacao. O checkout reserva uma margem de 10 por cento para absorver a pesagem final, mas a cobranca considera apenas o peso real."
                    label="Entenda como funciona a compra por peso"
                  />
                </div>
                <p className="mt-1 text-xs leading-5 text-bark/80">
                  O total abaixo continua estimado ate a pesagem final desta
                  fazenda.
                </p>
                {estimatedPreAuthorizationTotal !== null && (
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-bark">
                    <span className="rounded-full border border-forest/10 bg-white px-3 py-1.5">
                      {`Estimativa atual: ${formatCurrency(total ?? 0)}`}
                    </span>
                    <span className="rounded-full border border-forest/10 bg-white px-3 py-1.5">
                      {`Limite maximo reservado: ${formatCurrency(estimatedPreAuthorizationTotal)}`}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-bark">
              {hasWeightBasedItems
                ? "Subtotal estimado desta fazenda"
                : "Subtotal desta fazenda"}
              {hasWeightBasedItems && (
                <CartInfoTooltip
                  content="Para itens por peso, este subtotal usa a quantidade informada no carrinho como estimativa inicial. O valor pode subir ou descer um pouco depois da pesagem exata."
                  label="Entenda o subtotal estimado dos itens por peso"
                />
              )}
            </span>
            <span className="font-semibold text-soil">
              {formatCurrency(subtotal)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-bark">Frete</span>
            {isAddressLoading || freightQuery.isPending ? (
              <Skeleton className="h-5 w-20" />
            ) : freightCost !== null ? (
              hasReachedFreeShipping ? (
                <span className="flex items-center gap-2 font-semibold text-emerald-700">
                  {baseFreightCost !== null && baseFreightCost > 0 ? (
                    <span className="text-bark/45 line-through">
                      {formatCurrency(baseFreightCost)}
                    </span>
                  ) : null}
                  <span>Gratis</span>
                </span>
              ) : (
                <span className="font-semibold text-soil">
                  {formatCurrency(freightCost)}
                </span>
              )
            ) : (
              <span className="font-semibold text-bark/65">Indisponivel</span>
            )}
          </div>
          {minOrderValue > 0 && !hasReachedMinimumOrder ? (
            <div className="rounded-[18px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
              {`Faltam ${formatCurrency(remainingForMinimumOrder)} para atingir o pedido minimo de ${formatCurrency(minOrderValue)}.`}
            </div>
          ) : null}
          {freeShippingThreshold !== null ? (
            <div className="rounded-[18px] border border-forest/10 bg-sage/20 px-4 py-3">
              <div className="flex items-center justify-between gap-3 text-xs font-semibold uppercase tracking-[0.12em] text-bark/70">
                <span>Frete Gratis</span>
                <span>
                  {hasReachedFreeShipping
                    ? "Liberado"
                    : `${Math.min(
                        100,
                        Math.round((subtotal / freeShippingThreshold) * 100),
                      )}%`}
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
                <div
                  className="h-full rounded-full bg-forest transition-[width]"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.max(
                        0,
                        freeShippingThreshold > 0
                          ? (subtotal / freeShippingThreshold) * 100
                          : 100,
                      ),
                    )}%`,
                  }}
                />
              </div>
              <p className="mt-2 text-sm text-bark/80">
                {hasReachedFreeShipping
                  ? "Frete gratis liberado para esta fazenda."
                  : `Faltam ${formatCurrency(remainingForFreeShipping ?? 0)} para frete gratis.`}
              </p>
            </div>
          ) : null}
          {hasWeightBasedItems && (
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-bark">
                Margem de pre-autorizacao (10%)
                <CartInfoTooltip
                  content="Essa margem serve apenas para garantir a aprovacao do pagamento caso o peso real fique um pouco acima da estimativa. Se ela nao for usada, nao entra na cobranca final."
                  label="Entenda a margem de pre-autorizacao"
                />
              </span>
              <span className="font-semibold text-soil">
                {formatCurrency(authorizationBuffer)}
              </span>
            </div>
          )}
          <div className="border-t border-forest/10 pt-3">
            <div className="flex items-center justify-between gap-3">
              <span className="font-semibold text-soil">
                {hasWeightBasedItems
                  ? "Estimativa do total desta fazenda"
                  : "Total desta fazenda"}
              </span>
              {isAddressLoading || freightQuery.isPending ? (
                <Skeleton className="h-6 w-24" />
              ) : total !== null ? (
                <span className="text-lg font-bold text-soil">
                  {formatCurrency(total)}
                </span>
              ) : (
                <span className="font-semibold text-bark/65">
                  Aguardando frete
                </span>
              )}
            </div>
            {hasWeightBasedItems && total !== null && (
              <p className="mt-2 text-[11px] leading-5 text-bark/70">
                O valor final sera confirmado apos a pesagem exata dos itens
                desta fazenda.
              </p>
            )}
          </div>
        </div>

        {isOutOfRange ? (
          <p className="mt-4 rounded-[18px] border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            Endereco fora da area de entrega
          </p>
        ) : null}

        {!isOutOfRange && freightQuery.isError ? (
          <p className="mt-4 rounded-[18px] border border-soil/10 bg-cream-dark/35 px-4 py-3 text-sm font-medium text-bark/80">
            Nao foi possivel calcular o frete desta fazenda agora.
          </p>
        ) : null}

        <Button
          className="mt-4 w-full"
          disabled={disableCheckout}
          onClick={handleCheckout}
          type="button"
        >
          {checkoutMutation.isPending ? (
            <>
              <LoaderCircle className="h-4 w-4 animate-spin" />
              Redirecionando...
            </>
          ) : (
            "Fechar Pedido desta Fazenda"
          )}
        </Button>
      </div>
    </section>
  );
}

export function CartDrawer() {
  const isOpen = useCartStore(selectCartIsOpen);
  const setIsOpen = useCartStore((state: CartStore) => state.setIsOpen);
  const clearCart = useCartStore((state: CartStore) => state.clearCart);
  const items = useCartStore((state: CartStore) => state.items);
  const { data: session } = authClient.useSession();
  const sessionUser = session?.user as SessionUser | undefined;
  const [isMounted, setIsMounted] = React.useState(false);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  const totalItems = items.reduce((sum, item) => sum + item.cartQty, 0);
  const farmGroups = buildFarmGroups(items);
  const isBuyerSignedIn = sessionUser?.role === "buyer";
  const defaultAddressQuery = trpc.addresses.getDefaultAddress.useQuery(
    undefined,
    {
      enabled: isBuyerSignedIn,
      retry: false,
    },
  );

  if (!isMounted) {
    return null;
  }

  return (
    <TooltipProvider delayDuration={120}>
      <Dialog.Root onOpenChange={setIsOpen} open={isOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[140] bg-bark/40 backdrop-blur-sm data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />

          <Dialog.Content className="fixed inset-y-0 right-0 z-[150] flex w-full max-w-[34rem] flex-col border-l border-forest/10 bg-cream shadow-[0_28px_70px_-26px_rgba(13,51,33,0.45)] transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-[36rem]">
            <Dialog.Description className="sr-only">
              Carrinho agrupado por fazenda com checkout independente por
              produtor.
            </Dialog.Description>

            <div className="flex items-center justify-between border-b border-forest/10 bg-white px-6 py-5">
              <Dialog.Title className="flex items-center gap-2 font-display text-xl font-black tracking-[-0.03em] text-soil">
                <ShoppingCart className="h-5 w-5 text-forest" />
                Seu Carrinho
                {totalItems > 0 ? (
                  <span className="ml-2 inline-flex h-5 items-center justify-center rounded-full bg-forest px-2 text-[11px] font-bold text-cream">
                    {totalItems}
                  </span>
                ) : null}
              </Dialog.Title>
              <Dialog.Close asChild>
                <button
                  aria-label="Fechar"
                  className="rounded-full p-2 text-bark/60 transition-[background-color,color,box-shadow] hover:bg-forest/5 hover:text-soil focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                  type="button"
                >
                  <X className="h-5 w-5" />
                </button>
              </Dialog.Close>
            </div>

            <div className="cart-drawer-scroll flex-1 overflow-y-auto overscroll-contain px-4 pb-8 pt-5 sm:px-6 sm:pb-10 sm:pt-6">
              {items.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center">
                  <div className="surface-panel flex max-w-md flex-col items-center rounded-[30px] px-7 py-10 text-center">
                    <div className="flex h-18 w-18 items-center justify-center rounded-full border border-forest/10 bg-sage/18 shadow-[0_18px_36px_-28px_rgba(13,51,33,0.42)]">
                      <ShoppingCart className="h-8 w-8 text-forest/44" />
                    </div>
                    <p className="mt-6 font-sans text-[10px] font-bold uppercase tracking-[0.18em] text-bark/58">
                      Nenhum item selecionado
                    </p>
                    <p className="mt-3 font-display text-2xl font-black tracking-[-0.03em] text-soil">
                      Carrinho vazio
                    </p>
                    <p className="mt-3 font-sans text-sm leading-6 text-bark/72">
                      Explore o catalogo para montar pedidos por fazenda com
                      frete e total calculados de forma transparente.
                    </p>
                    <Button
                      asChild
                      className="mt-7 rounded-[18px] px-6"
                      variant="primary"
                    >
                      <Link href="/catalogo" onClick={() => setIsOpen(false)}>
                        Ir para o catalogo
                      </Link>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-5">
                  <section className="rounded-[24px] border border-forest/10 bg-white p-4 shadow-[0_18px_36px_-30px_rgba(13,51,33,0.42)]">
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-forest text-cream">
                        <MapPin className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-sans text-[10px] font-bold uppercase tracking-[0.18em] text-bark/65">
                          Endereco base do frete
                        </p>
                        {defaultAddressQuery.isPending ? (
                          <div className="mt-3 space-y-2">
                            <Skeleton className="h-4 w-36" />
                            <Skeleton className="h-4 w-5/6" />
                          </div>
                        ) : defaultAddressQuery.data ? (
                          <>
                            <p className="mt-2 font-sans text-sm font-semibold text-soil">
                              {defaultAddressQuery.data.title}
                            </p>
                            <p className="mt-1 font-sans text-sm leading-6 text-bark/80">
                              {defaultAddressQuery.data.formattedAddress}
                            </p>
                          </>
                        ) : isBuyerSignedIn ? (
                          <div className="mt-3 space-y-3">
                            <p className="font-sans text-sm leading-6 text-bark/80">
                              Cadastre um endereco padrao para liberar o frete
                              por fazenda.
                            </p>
                            <Button asChild size="sm">
                              <Link
                                href="/conta/enderecos"
                                onClick={() => setIsOpen(false)}
                              >
                                Cadastrar Endereco de Entrega
                              </Link>
                            </Button>
                          </div>
                        ) : (
                          <p className="mt-2 font-sans text-sm leading-6 text-bark/80">
                            Faca login como comprador para calcular frete e
                            fechar pedidos.
                          </p>
                        )}
                      </div>
                    </div>
                  </section>

                  {farmGroups.map((group) => (
                    <FarmCheckoutSection
                      defaultAddress={defaultAddressQuery.data ?? null}
                      group={group}
                      isAddressLoading={defaultAddressQuery.isPending}
                      isBuyerSignedIn={isBuyerSignedIn}
                      key={group.farmId}
                    />
                  ))}
                </div>
              )}
            </div>

            {items.length > 0 ? (
              <div className="border-t border-forest/10 bg-white px-4 py-4 sm:px-6 sm:py-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="font-sans text-sm leading-6 text-bark/80">
                    {farmGroups.length} fazenda
                    {farmGroups.length > 1 ? "s" : ""} no carrinho. Cada pedido
                    fecha separadamente para manter frete e operacao claros.
                  </p>
                  <Button
                    className="rounded-[16px]"
                    onClick={() => clearCart()}
                    type="button"
                    variant="secondary"
                  >
                    Limpar carrinho
                  </Button>
                </div>
              </div>
            ) : null}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </TooltipProvider>
  );
}
