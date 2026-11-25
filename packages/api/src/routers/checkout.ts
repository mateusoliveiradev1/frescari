import { z } from "zod";
import Stripe from "stripe";
import { createTRPCRouter, buyerProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import {
  activeProductLotWhere,
  addresses,
  enableRlsBypassContext,
  farms,
  masterProducts,
  productLots,
  products,
  tenants,
} from "@frescari/db";
import { and, eq, inArray, sql } from "drizzle-orm";

import { buildFreightQuote } from "../freight-quote";
import { writeChunkedMetadata } from "../stripe-metadata";
import { calculateLotPriceAndStatus } from "../utils/lot-status";
import { isWeighableSaleUnit, resolveEffectiveSaleUnit } from "../sale-units";
import {
  buildDeliveryAddressLine,
  serializeDeliveryPointMetadata,
} from "../geocoding";
import { sanitizeEnvValue } from "../env";
import { syncTenantStripeConnectStatus } from "../stripe-connect";
import { isPlatformOnlyStripeMode } from "../stripe-connect-mode";
import { deriveStripeConnectStatus } from "../utils/stripe-connect-status";
import {
  DELIVERY_SLOT_ID_PATTERN,
  findDeliverySlot,
  resolveDeliverySchedule,
} from "../delivery-slots";

const stripeSecretKey = sanitizeEnvValue(process.env.STRIPE_SECRET_KEY);

if (!stripeSecretKey) {
  console.warn(
    "[STRIPE] STRIPE_SECRET_KEY is not set. Checkout will fail at runtime.",
  );
}

let stripeClient: Stripe | null = null;

function getStripeClient() {
  if (!stripeSecretKey) {
    throw new Error("STRIPE_SECRET_KEY is not set.");
  }

  if (!stripeClient) {
    stripeClient = new Stripe(stripeSecretKey);
  }

  return stripeClient;
}

const WEIGHT_SAFETY_MARGIN = 1.1;
const APP_URL =
  sanitizeEnvValue(process.env.NEXT_PUBLIC_APP_URL) ?? "http://localhost:3000";
const PLATFORM_FEE_RATE = 0.1;

const checkoutItemSchema = z
  .object({
    lotId: z.string().uuid(),
    quantity: z.number().positive(),
  })
  .strict();

const deliveryAddressSchema = z
  .object({
    street: z.string().min(3, "Rua e obrigatoria."),
    number: z.string().min(1, "Numero e obrigatorio."),
    cep: z.string().regex(/^\d{5}-?\d{3}$/, "CEP invalido."),
    city: z.string().min(2, "Cidade e obrigatoria."),
    state: z.string().length(2, "Estado deve ter 2 letras (UF)."),
  })
  .strict();

const createFarmCheckoutSessionInputSchema = z
  .object({
    farmId: z.string().uuid(),
    addressId: z.string().uuid(),
    items: z.array(checkoutItemSchema).min(1, "Carrinho vazio."),
    deliveryNotes: z.string().trim().max(500).optional(),
    deliverySlot: z
      .string()
      .regex(DELIVERY_SLOT_ID_PATTERN, "Escolha a janela de entrega."),
  })
  .strict();

type PricingType = "UNIT" | "WEIGHT" | "BOX";

type CheckoutAddressRecord = {
  id: string;
  tenantId: string;
  title: string;
  formattedAddress: string;
  street: string;
  number: string;
  zipcode: string;
  neighborhood: string | null;
  city: string;
  state: string;
  country: string;
  complement: string | null;
  location: [number, number] | null;
};

type CheckoutFarmRecord = {
  id: string;
  location: [number, number] | null;
  baseDeliveryFee: string | null;
  pricePerKm: string | null;
  maxDeliveryRadiusKm: string | null;
  minOrderValue: string | null;
  freeShippingThreshold: string | null;
  deliveryDays: number[] | null;
  deliveryPeriods: string[] | null;
  deliveryLeadDays: number | null;
};

type SafeCheckoutItem = {
  lotId: string;
  quantity: number;
  pricingType: PricingType;
  productName: string;
  unitPrice: number;
  imageUrl: string | null;
  productSaleUnit: string | null;
};

type StripeDestinationErrorLike = {
  code?: string;
  message?: string;
  raw?: {
    code?: string;
    param?: string;
    message?: string;
  };
};

function toStripeCents(brlPrice: number, isWeighable: boolean): number {
  const adjusted = isWeighable ? brlPrice * WEIGHT_SAFETY_MARGIN : brlPrice;
  return Math.round(adjusted * 100);
}

// Stripe accepts only absolute http(s) image URLs that it can fetch. Catalog
// placeholders are site-relative ("/images/..."), so they are resolved
// against the public app URL; anything Stripe could not reach (localhost,
// http, junk) is left out instead of failing the whole checkout.
export function toStripeImageUrl(
  imageUrl: string | null | undefined,
  appUrl: string = APP_URL,
): string | null {
  if (!imageUrl) return null;
  try {
    const url = new URL(imageUrl, appUrl);
    const isLocal = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    return url.protocol === "https:" && !isLocal ? url.toString() : null;
  } catch {
    return null;
  }
}

function buildLineItems(
  items: SafeCheckoutItem[],
  deliveryFee: number,
): Stripe.Checkout.SessionCreateParams.LineItem[] {
  const productLines: Stripe.Checkout.SessionCreateParams.LineItem[] =
    items.map((item) => {
      const isWeighable = isWeighableSaleUnit(item.productSaleUnit);
      const unitAmount = isWeighable
        ? toStripeCents(item.unitPrice * item.quantity, true)
        : toStripeCents(item.unitPrice, false);
      const quantity = isWeighable ? 1 : item.quantity;

      const stripeImageUrl = toStripeImageUrl(item.imageUrl);

      return {
        price_data: {
          currency: "brl",
          product_data: {
            name: item.productName,
            ...(stripeImageUrl ? { images: [stripeImageUrl] } : {}),
          },
          unit_amount: unitAmount,
        },
        quantity,
      };
    });

  const deliveryLine: Stripe.Checkout.SessionCreateParams.LineItem = {
    price_data: {
      currency: "brl",
      product_data: { name: "Taxa de Entrega" },
      unit_amount: Math.round(deliveryFee * 100),
    },
    quantity: 1,
  };

  return [...productLines, deliveryLine];
}

function formatCurrencyMessage(value: number) {
  return `R$ ${value.toFixed(2).replace(".", ",")}`;
}

function buildAddressLineFromRecord(addressRecord: CheckoutAddressRecord) {
  if (addressRecord.formattedAddress.trim().length > 0) {
    return addressRecord.formattedAddress;
  }

  return buildDeliveryAddressLine({
    street: addressRecord.street,
    number: addressRecord.number,
    cep: addressRecord.zipcode,
    city: addressRecord.city,
    state: addressRecord.state,
  });
}

function buildAddressSnapshot(addressRecord: CheckoutAddressRecord) {
  const [longitude, latitude] = addressRecord.location ?? [null, null];

  return {
    addressId: addressRecord.id,
    formattedAddress: buildAddressLineFromRecord(addressRecord),
    street: addressRecord.street,
    number: addressRecord.number,
    zipcode: addressRecord.zipcode,
    neighborhood: addressRecord.neighborhood,
    city: addressRecord.city,
    state: addressRecord.state,
    complement: addressRecord.complement,
    latitude,
    longitude,
  };
}

function isInvalidStripeDestinationError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const stripeError = error as StripeDestinationErrorLike;
  const code = stripeError.raw?.code ?? stripeError.code;
  const param = stripeError.raw?.param;
  const message = stripeError.raw?.message ?? stripeError.message ?? "";

  return (
    (code === "resource_missing" &&
      param === "payment_intent_data[transfer_data][destination]") ||
    message.includes("No such destination")
  );
}

function throwCheckoutStripeError(error: unknown): never {
  if (isInvalidStripeDestinationError(error)) {
    console.warn("[STRIPE_CONNECT_ERROR]:", error);
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        "Produtor ainda nao possui recebimento valido para aceitar pedidos.",
      cause: error,
    });
  }

  console.error("[STRIPE_ERROR]:", error);
  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "Falha ao criar sessao de pagamento. Verifique os logs.",
    cause: error,
  });
}

function buildCheckoutSessionParams({
  buyerTenantId,
  captureMethod,
  calculatedFeeCents,
  connectDestinationAccountId,
  deliveryAddress,
  deliveryFee,
  deliveryPoint,
  isAllUnitOrder,
  itemsMetadata,
  successUrl,
  cancelUrl,
  lineItems,
  addressJson,
  farmId,
  addressId,
  addressSnapshot,
  deliveryNotes,
  deliveryWindow,
}: {
  buyerTenantId: string;
  captureMethod: "manual" | "automatic";
  calculatedFeeCents: number;
  connectDestinationAccountId?: string | null;
  deliveryAddress: string;
  deliveryFee: number;
  deliveryPoint: string;
  isAllUnitOrder: boolean;
  itemsMetadata: string;
  successUrl: string;
  cancelUrl: string;
  lineItems: Stripe.Checkout.SessionCreateParams.LineItem[];
  addressJson?: string;
  farmId?: string;
  addressId?: string;
  addressSnapshot?: string;
  deliveryNotes?: string;
  deliveryWindow?: { start: Date; end: Date };
}) {
  const deliveryWindowMetadata: Record<string, string> = deliveryWindow
    ? {
        delivery_window_start: deliveryWindow.start.toISOString(),
        delivery_window_end: deliveryWindow.end.toISOString(),
      }
    : {};
  const usePlatformOnlyMode = isPlatformOnlyStripeMode();
  const paymentIntentMetadata = {
    buyer_tenant_id: buyerTenantId,
    delivery_fee: deliveryFee.toString(),
    ...writeChunkedMetadata("delivery_address", deliveryAddress),
    delivery_point: deliveryPoint,
    is_all_unit_order: isAllUnitOrder.toString(),
    stripe_connect_mode: usePlatformOnlyMode ? "platform_only" : "connect",
    ...writeChunkedMetadata("address", addressJson),
    ...(farmId ? { farm_id: farmId } : {}),
    ...(addressId ? { address_id: addressId } : {}),
    ...writeChunkedMetadata("address_snapshot", addressSnapshot),
    ...(deliveryNotes ? { delivery_notes: deliveryNotes } : {}),
    ...deliveryWindowMetadata,
  };

  const paymentIntentData: Stripe.Checkout.SessionCreateParams.PaymentIntentData =
    {
      capture_method: captureMethod,
      metadata: paymentIntentMetadata,
    };

  if (!usePlatformOnlyMode) {
    paymentIntentData.application_fee_amount = calculatedFeeCents;
    paymentIntentData.transfer_data = {
      destination: connectDestinationAccountId!,
    };
  }

  return {
    mode: "payment",
    // Card only: the webhook creates the order as paid on
    // checkout.session.completed, which for boleto or other delayed methods
    // arrives before the money does. Manual capture (weighed items) is also
    // card-only.
    payment_method_types: ["card"],
    payment_intent_data: paymentIntentData,
    line_items: lineItems,
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      buyer_tenant_id: buyerTenantId,
      ...writeChunkedMetadata("items", itemsMetadata),
      delivery_fee: deliveryFee.toString(),
      ...writeChunkedMetadata("delivery_address", deliveryAddress),
      delivery_point: deliveryPoint,
      is_all_unit_order: isAllUnitOrder.toString(),
      stripe_connect_mode: usePlatformOnlyMode ? "platform_only" : "connect",
      ...writeChunkedMetadata("address", addressJson),
      ...(farmId ? { farm_id: farmId } : {}),
      ...(addressId ? { address_id: addressId } : {}),
      ...writeChunkedMetadata("address_snapshot", addressSnapshot),
      ...(deliveryNotes ? { delivery_notes: deliveryNotes } : {}),
      ...deliveryWindowMetadata,
    },
  } satisfies Stripe.Checkout.SessionCreateParams;
}

export const checkoutRouter = createTRPCRouter({
  createCheckoutSession: buyerProcedure
    .input(
      z
        .object({
          items: z.array(checkoutItemSchema).min(1, "Carrinho vazio."),
          address: deliveryAddressSchema,
          deliveryFee: z.number().min(0),
        })
        .strict(),
    )
    .mutation(async () => {
      throw new TRPCError({
        code: "FORBIDDEN",
        message:
          "Fluxo legado desabilitado. Use checkout.createFarmCheckoutSession para iniciar o pagamento por fazenda.",
      });
    }),
  createFarmCheckoutSession: buyerProcedure
    .input(createFarmCheckoutSessionInputSchema)
    .mutation(async ({ ctx, input }) => {
      if (!stripeSecretKey) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Pagamento nao esta configurado. Contate o suporte.",
        });
      }

      const buyerTenantId = ctx.user?.tenantId as string | undefined;
      if (!buyerTenantId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Comprador sem conta comercial vinculada.",
        });
      }

      const lotIdsToFetch = input.items.map((item) => item.lotId);

      const { addressRecord, farmRecord, distanceMeters, lotDataForStripe } =
        await ctx.db.transaction(async (tx) => {
          await enableRlsBypassContext(tx);

          const [addressRecord] = await tx
            .select({
              id: addresses.id,
              tenantId: addresses.tenantId,
              title: addresses.title,
              formattedAddress: addresses.formattedAddress,
              street: addresses.street,
              number: addresses.number,
              zipcode: addresses.zipcode,
              neighborhood: addresses.neighborhood,
              city: addresses.city,
              state: addresses.state,
              country: addresses.country,
              complement: addresses.complement,
              location: addresses.location,
            })
            .from(addresses)
            .where(
              and(
                eq(addresses.id, input.addressId),
                eq(addresses.tenantId, buyerTenantId),
              ),
            )
            .limit(1);

          if (!addressRecord) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Endereco nao encontrado.",
            });
          }

          const [farmRecord] = await tx
            .select({
              id: farms.id,
              location: farms.location,
              baseDeliveryFee: farms.baseDeliveryFee,
              pricePerKm: farms.pricePerKm,
              maxDeliveryRadiusKm: farms.maxDeliveryRadiusKm,
              minOrderValue: farms.minOrderValue,
              freeShippingThreshold: farms.freeShippingThreshold,
              deliveryDays: farms.deliveryDays,
              deliveryPeriods: farms.deliveryPeriods,
              deliveryLeadDays: farms.deliveryLeadDays,
            })
            .from(farms)
            .where(eq(farms.id, input.farmId))
            .limit(1);

          if (!farmRecord) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Fazenda nao encontrada.",
            });
          }

          const [distanceRow] = await tx
            .select({
              distanceMeters: sql<number>`
                            CAST(
                                ST_DistanceSphere(${farms.location}, ${addresses.location})
                                AS double precision
                            )
                        `,
            })
            .from(farms)
            .innerJoin(addresses, eq(addresses.id, input.addressId))
            .where(
              and(
                eq(farms.id, input.farmId),
                eq(addresses.id, input.addressId),
                eq(addresses.tenantId, buyerTenantId),
              ),
            )
            .limit(1);

          const lotDataForStripe = await tx
            .select({
              lotId: productLots.id,
              farmId: products.farmId,
              sellerTenantId: productLots.tenantId,
              availableQty: productLots.availableQty,
              expiryDate: productLots.expiryDate,
              priceOverride: productLots.priceOverride,
              dbPricingType: productLots.pricingType,
              lotImageUrl: productLots.imageUrl,
              lotUnit: productLots.unit,
              stripeAccountId: tenants.stripeAccountId,
              stripeChargesEnabled: tenants.stripeChargesEnabled,
              stripeDetailsSubmitted: tenants.stripeDetailsSubmitted,
              stripePayoutsEnabled: tenants.stripePayoutsEnabled,
              stripeRequirementsCurrentlyDue:
                tenants.stripeRequirementsCurrentlyDue,
              stripeRequirementsDisabledReason:
                tenants.stripeRequirementsDisabledReason,
              stripeRequirementsEventuallyDue:
                tenants.stripeRequirementsEventuallyDue,
              stripeRequirementsPastDue: tenants.stripeRequirementsPastDue,
              stripeStatusSyncedAt: tenants.stripeStatusSyncedAt,
              productName: products.name,
              productSaleUnit: products.saleUnit,
              pricePerUnit: products.pricePerUnit,
              productImages: products.images,
              masterPricingType: masterProducts.pricingType,
            })
            .from(productLots)
            .innerJoin(tenants, eq(tenants.id, productLots.tenantId))
            .innerJoin(products, eq(productLots.productId, products.id))
            .leftJoin(
              masterProducts,
              eq(products.masterProductId, masterProducts.id),
            )
            .where(
              activeProductLotWhere(inArray(productLots.id, lotIdsToFetch)),
            );

          return {
            addressRecord: addressRecord as CheckoutAddressRecord,
            farmRecord: farmRecord as CheckoutFarmRecord,
            distanceMeters: distanceRow?.distanceMeters,
            lotDataForStripe,
          };
        });

      if (lotDataForStripe.length !== lotIdsToFetch.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Um ou mais lotes do carrinho nao foram encontrados.",
        });
      }

      const wrongFarmLot = lotDataForStripe.find(
        (lot) => lot.farmId !== input.farmId,
      );
      if (wrongFarmLot) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Todos os itens do checkout devem pertencer a fazenda selecionada.",
        });
      }

      const producerStripeAccountId = lotDataForStripe[0]?.stripeAccountId;
      if (!isPlatformOnlyStripeMode() && !producerStripeAccountId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "Produtor ainda nao possui recebimento configurado para aceitar pedidos.",
        });
      }

      const producerTenantId = lotDataForStripe[0]?.sellerTenantId;
      let producerStripeStatus = deriveStripeConnectStatus({
        stripeAccountId: producerStripeAccountId ?? null,
        stripeChargesEnabled: lotDataForStripe[0]?.stripeChargesEnabled ?? null,
        stripeDetailsSubmitted:
          lotDataForStripe[0]?.stripeDetailsSubmitted ?? null,
        stripePayoutsEnabled: lotDataForStripe[0]?.stripePayoutsEnabled ?? null,
        stripeRequirementsCurrentlyDue:
          lotDataForStripe[0]?.stripeRequirementsCurrentlyDue ?? null,
        stripeRequirementsDisabledReason:
          lotDataForStripe[0]?.stripeRequirementsDisabledReason ?? null,
        stripeRequirementsEventuallyDue:
          lotDataForStripe[0]?.stripeRequirementsEventuallyDue ?? null,
        stripeRequirementsPastDue:
          lotDataForStripe[0]?.stripeRequirementsPastDue ?? null,
        stripeStatusSyncedAt: lotDataForStripe[0]?.stripeStatusSyncedAt ?? null,
      });

      if (
        !isPlatformOnlyStripeMode() &&
        producerStripeAccountId &&
        producerTenantId &&
        !producerStripeStatus.canReceivePayments
      ) {
        try {
          const syncedStripeState = await syncTenantStripeConnectStatus(
            ctx.db,
            {
              accountId: producerStripeAccountId,
              tenantId: producerTenantId,
            },
          );

          producerStripeStatus = syncedStripeState.status;
        } catch (error) {
          console.error("[STRIPE_CONNECT_STATUS_SYNC_ERROR]", error);
        }
      }

      if (
        !isPlatformOnlyStripeMode() &&
        !producerStripeStatus.canReceivePayments
      ) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: producerStripeStatus.description,
        });
      }

      const mixedSellers = lotDataForStripe.some(
        (lot) => lot.sellerTenantId !== producerTenantId,
      );
      if (mixedSellers) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Todos os itens do checkout devem pertencer a mesma fazenda.",
        });
      }

      const safeItems: SafeCheckoutItem[] = input.items.map((item) => {
        const lotData = lotDataForStripe.find(
          (lot) => lot.lotId === item.lotId,
        );
        if (!lotData) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Lote ${item.lotId} nao encontrado.`,
          });
        }

        if (Number(lotData.availableQty) < item.quantity) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Quantidade indisponivel para o lote ${item.lotId}.`,
          });
        }

        const effectiveSaleUnit = resolveEffectiveSaleUnit(
          lotData.productSaleUnit,
          lotData.lotUnit,
        );
        const isWeightBased = isWeighableSaleUnit(effectiveSaleUnit);
        if (!isWeightBased && !Number.isInteger(item.quantity)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `A quantidade para ${lotData.productName} deve ser um numero inteiro.`,
          });
        }

        const pricing = calculateLotPriceAndStatus(
          {
            expiryDate: lotData.expiryDate,
            priceOverride: lotData.priceOverride,
          },
          lotData.pricePerUnit,
        );

        if (pricing.isExpired) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `O lote ${item.lotId} esta vencido e nao pode ser vendido.`,
          });
        }

        return {
          lotId: item.lotId,
          quantity: item.quantity,
          pricingType: lotData.dbPricingType,
          productName: lotData.productName,
          unitPrice: pricing.finalPrice,
          imageUrl: lotData.lotImageUrl ?? lotData.productImages?.[0] ?? null,
          productSaleUnit: effectiveSaleUnit,
        };
      });

      const itemsTotalBRL = safeItems.reduce(
        (sum, item) => sum + item.unitPrice * item.quantity,
        0,
      );
      const freightQuote = buildFreightQuote({
        hasFarmLocation: Boolean(farmRecord.location),
        hasAddressLocation: Boolean(addressRecord.location),
        distanceMeters,
        baseDeliveryFee: farmRecord.baseDeliveryFee,
        pricePerKm: farmRecord.pricePerKm,
        maxDeliveryRadiusKm: farmRecord.maxDeliveryRadiusKm,
        subtotal: itemsTotalBRL,
        minOrderValue: farmRecord.minOrderValue,
        freeShippingThreshold: farmRecord.freeShippingThreshold,
      });

      if (!freightQuote.hasReachedMinimumOrder) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Este pedido nao atingiu o valor minimo de ${formatCurrencyMessage(freightQuote.minOrderValue)} para esta fazenda.`,
        });
      }

      const effectiveDeliveryFee = freightQuote.freightCost;
      const lineItems = buildLineItems(safeItems, effectiveDeliveryFee);
      const addressLine = buildAddressLineFromRecord(addressRecord);
      const addressSnapshotJson = JSON.stringify(
        buildAddressSnapshot(addressRecord),
      );
      const deliveryPoint = addressRecord.location
        ? {
            longitude: addressRecord.location[0],
            latitude: addressRecord.location[1],
          }
        : null;

      if (!deliveryPoint) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "Nao foi possivel calcular o frete para esta combinacao de origem e destino.",
        });
      }

      const itemsJson = JSON.stringify(
        safeItems.map((item) => ({
          lotId: item.lotId,
          qty: item.quantity,
          pt: item.pricingType,
          name: item.productName,
          price: item.unitPrice,
        })),
      );
      const deliveryPointJson = serializeDeliveryPointMetadata(deliveryPoint);
      const hasWeightProducts = safeItems.some((item) =>
        isWeighableSaleUnit(item.productSaleUnit),
      );
      const captureMethod = hasWeightProducts ? "manual" : "automatic";
      const isAllUnitOrder = !hasWeightProducts;
      // Commission applies to the products only, never to freight: freight
      // is the producer's delivery cost and goes to them in full.
      const calculatedFeeCents = Math.round(
        Math.round(itemsTotalBRL * 100) * PLATFORM_FEE_RATE,
      );
      const deliveryNotes = input.deliveryNotes?.trim() || undefined;
      const deliverySlot = findDeliverySlot(
        resolveDeliverySchedule(farmRecord),
        input.deliverySlot,
        new Date(),
        { weighed: hasWeightProducts },
      );

      if (!deliverySlot) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: hasWeightProducts
            ? "Pedidos com itens por peso precisam ser entregues em ate 6 dias. Escolha outra janela."
            : "Esta janela de entrega nao esta mais disponivel. Escolha outra.",
        });
      }

      try {
        const session = await getStripeClient().checkout.sessions.create(
          buildCheckoutSessionParams({
            buyerTenantId,
            captureMethod,
            calculatedFeeCents,
            connectDestinationAccountId: producerStripeAccountId,
            deliveryAddress: addressLine,
            deliveryFee: effectiveDeliveryFee,
            deliveryPoint: deliveryPointJson,
            isAllUnitOrder,
            itemsMetadata: itemsJson,
            successUrl: `${APP_URL}/sucesso?session_id={CHECKOUT_SESSION_ID}`,
            cancelUrl: `${APP_URL}/catalogo?checkout=cancelled`,
            lineItems,
            farmId: input.farmId,
            addressId: input.addressId,
            addressSnapshot: addressSnapshotJson,
            deliveryNotes,
            deliveryWindow: {
              start: deliverySlot.start,
              end: deliverySlot.end,
            },
          }),
        );

        if (!session.url) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Nao foi possivel abrir o checkout. Tente novamente.",
          });
        }

        return { url: session.url };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }

        throwCheckoutStripeError(error);
      }
    }),
});
