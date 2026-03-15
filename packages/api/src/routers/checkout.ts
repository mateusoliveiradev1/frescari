import { z } from 'zod';
import Stripe from 'stripe';
import { createTRPCRouter, buyerProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import {
    db,
    farms,
    masterProducts,
    productLots,
    products,
    tenants,
} from '@frescari/db';
import { eq, inArray } from 'drizzle-orm';

import { calculateLotPriceAndStatus } from '../utils/lot-status';
import { isWeighableSaleUnit, resolveEffectiveSaleUnit } from '../sale-units';
import {
    buildDeliveryAddressLine,
    geocodeDeliveryAddress,
    serializeDeliveryPointMetadata,
    type DeliveryAddress as GeocodingDeliveryAddress,
    type GeocodedPoint,
} from '../geocoding';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
    console.warn(
        '[STRIPE] STRIPE_SECRET_KEY is not set. Checkout will fail at runtime.',
    );
}

const stripe = new Stripe(stripeSecretKey ?? '');
const WEIGHT_SAFETY_MARGIN = 1.10;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
const PLATFORM_FEE_RATE = 0.1;

const pricingTypeSchema = z.enum(['UNIT', 'WEIGHT', 'BOX']);

const checkoutItemSchema = z.object({
    lotId: z.string().uuid(),
    quantity: z.number().positive(),
});

const deliveryAddressSchema = z.object({
    street: z.string().min(3, 'Rua e obrigatoria.'),
    number: z.string().min(1, 'Numero e obrigatorio.'),
    cep: z.string().regex(/^\d{5}-?\d{3}$/, 'CEP invalido.'),
    city: z.string().min(2, 'Cidade e obrigatoria.'),
    state: z.string().length(2, 'Estado deve ter 2 letras (UF).'),
});

export type CheckoutItem = z.infer<typeof checkoutItemSchema>;
export type DeliveryAddress = z.infer<typeof deliveryAddressSchema>;

type SafeCheckoutItem = {
    lotId: string;
    quantity: number;
    pricingType: z.infer<typeof pricingTypeSchema>;
    productName: string;
    unitPrice: number;
    imageUrl: string | null;
    productSaleUnit: string | null;
};

function toStripeCents(brlPrice: number, isWeighable: boolean): number {
    const adjusted = isWeighable ? brlPrice * WEIGHT_SAFETY_MARGIN : brlPrice;
    return Math.round(adjusted * 100);
}

function buildLineItems(
    items: SafeCheckoutItem[],
    deliveryFee: number,
): Stripe.Checkout.SessionCreateParams.LineItem[] {
    const productLines: Stripe.Checkout.SessionCreateParams.LineItem[] =
        items.map((item) => {
            const isWeighable = isWeighableSaleUnit(item.productSaleUnit);

            return {
                price_data: {
                    currency: 'brl',
                    product_data: {
                        name: item.productName,
                        ...(item.imageUrl ? { images: [item.imageUrl] } : {}),
                    },
                    unit_amount: toStripeCents(item.unitPrice, isWeighable),
                },
                quantity: item.quantity,
            };
        });

    const deliveryLine: Stripe.Checkout.SessionCreateParams.LineItem = {
        price_data: {
            currency: 'brl',
            product_data: { name: 'Taxa de Entrega' },
            unit_amount: Math.round(deliveryFee * 100),
        },
        quantity: 1,
    };

    return [...productLines, deliveryLine];
}

function normalizeCurrencyValue(rawValue: string | number | null | undefined) {
    const parsedValue =
        typeof rawValue === 'number' ? rawValue : Number(rawValue ?? 0);

    if (!Number.isFinite(parsedValue)) {
        return 0;
    }

    return Math.max(0, Number(parsedValue.toFixed(2)));
}

function normalizeNullableCurrencyValue(rawValue: string | number | null | undefined) {
    if (rawValue === null || rawValue === undefined) {
        return null;
    }

    const parsedValue = typeof rawValue === 'number' ? rawValue : Number(rawValue);

    if (!Number.isFinite(parsedValue)) {
        return null;
    }

    return Math.max(0, Number(parsedValue.toFixed(2)));
}

function formatCurrencyMessage(value: number) {
    return `R$ ${value.toFixed(2).replace('.', ',')}`;
}

export const checkoutRouter = createTRPCRouter({
    createCheckoutSession: buyerProcedure
        .input(
            z.object({
                items: z.array(checkoutItemSchema).min(1, 'Carrinho vazio.'),
                address: deliveryAddressSchema,
                deliveryFee: z.number().min(0),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            if (!stripeSecretKey) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Stripe nao esta configurado. Contate o administrador.',
                });
            }

            const buyerTenantId = ctx.user?.tenantId as string | undefined;
            if (!buyerTenantId) {
                throw new TRPCError({
                    code: 'FORBIDDEN',
                    message: 'Comprador sem organizacao vinculada.',
                });
            }

            const lotIdsToFetch = input.items.map((item) => item.lotId);

            const lotDataForStripe = await db
                .select({
                    lotId: productLots.id,
                    sellerTenantId: productLots.tenantId,
                    availableQty: productLots.availableQty,
                    expiryDate: productLots.expiryDate,
                    priceOverride: productLots.priceOverride,
                    dbPricingType: productLots.pricingType,
                    lotImageUrl: productLots.imageUrl,
                    lotUnit: productLots.unit,
                    stripeAccountId: tenants.stripeAccountId,
                    productName: products.name,
                    productSaleUnit: products.saleUnit,
                    pricePerUnit: products.pricePerUnit,
                    productImages: products.images,
                    masterPricingType: masterProducts.pricingType,
                    minOrderValue: farms.minOrderValue,
                    freeShippingThreshold: farms.freeShippingThreshold,
                })
                .from(productLots)
                .innerJoin(tenants, eq(tenants.id, productLots.tenantId))
                .innerJoin(products, eq(productLots.productId, products.id))
                .innerJoin(farms, eq(products.farmId, farms.id))
                .leftJoin(masterProducts, eq(products.masterProductId, masterProducts.id))
                .where(inArray(productLots.id, lotIdsToFetch));

            if (lotDataForStripe.length !== lotIdsToFetch.length) {
                throw new TRPCError({
                    code: 'BAD_REQUEST',
                    message: 'Um ou mais lotes do carrinho nao foram encontrados.',
                });
            }

            const producerStripeAccountId = lotDataForStripe[0]?.stripeAccountId;
            if (!producerStripeAccountId) {
                throw new TRPCError({
                    code: 'PRECONDITION_FAILED',
                    message: 'Produtor nao possui conta Stripe configurada para receber pagamentos.',
                });
            }

            const producerTenantId = lotDataForStripe[0]?.sellerTenantId;
            const mixedSellers = lotDataForStripe.some(
                (lot) => lot.sellerTenantId !== producerTenantId,
            );
            if (mixedSellers) {
                throw new TRPCError({
                    code: 'BAD_REQUEST',
                    message: 'Todos os itens do checkout devem pertencer a mesma fazenda.',
                });
            }

            const safeItems: SafeCheckoutItem[] = input.items.map((item) => {
                const lotData = lotDataForStripe.find((lot) => lot.lotId === item.lotId);
                if (!lotData) {
                    throw new TRPCError({
                        code: 'BAD_REQUEST',
                        message: `Lote ${item.lotId} nao encontrado.`,
                    });
                }

                if (Number(lotData.availableQty) < item.quantity) {
                    throw new TRPCError({
                        code: 'BAD_REQUEST',
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
                        code: 'BAD_REQUEST',
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
                        code: 'BAD_REQUEST',
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
            const minOrderValue = normalizeCurrencyValue(
                lotDataForStripe[0]?.minOrderValue,
            );
            const freeShippingThreshold = normalizeNullableCurrencyValue(
                lotDataForStripe[0]?.freeShippingThreshold,
            );

            if (itemsTotalBRL < minOrderValue) {
                throw new TRPCError({
                    code: 'PRECONDITION_FAILED',
                    message:
                        `Este pedido nao atingiu o valor minimo de ${formatCurrencyMessage(minOrderValue)} para esta fazenda.`,
                });
            }

            const effectiveDeliveryFee =
                freeShippingThreshold !== null && itemsTotalBRL >= freeShippingThreshold
                    ? 0
                    : input.deliveryFee;

            const lineItems = buildLineItems(safeItems, effectiveDeliveryFee);

            let geocodedDeliveryPoint: GeocodedPoint | null = null;
            try {
                geocodedDeliveryPoint = await geocodeDeliveryAddress(
                    input.address as GeocodingDeliveryAddress,
                );
            } catch (error) {
                console.error('[GEOCODING_ERROR]:', error);
                throw new TRPCError({
                    code: 'BAD_REQUEST',
                    message:
                        'Nao foi possivel validar o endereco de entrega. Revise os dados e tente novamente.',
                    cause: error,
                });
            }

            if (!geocodedDeliveryPoint) {
                throw new TRPCError({
                    code: 'BAD_REQUEST',
                    message:
                        'Nao foi possivel localizar o endereco de entrega informado. Revise os dados e tente novamente.',
                });
            }

            const addressLine = buildDeliveryAddressLine(
                input.address as GeocodingDeliveryAddress,
            );

            const itemsJson = JSON.stringify(
                safeItems.map((item) => ({
                    lotId: item.lotId,
                    qty: item.quantity,
                    pt: item.pricingType,
                    name: item.productName,
                    price: item.unitPrice,
                })),
            );
            const addressJson = JSON.stringify(input.address);
            const deliveryPointJson = serializeDeliveryPointMetadata(geocodedDeliveryPoint);

            const hasWeightProducts = safeItems.some((item) =>
                isWeighableSaleUnit(item.productSaleUnit),
            );
            const captureMethod = hasWeightProducts ? 'manual' : 'automatic';
            const isAllUnitOrder = !hasWeightProducts;

            const totalAmountBrl = itemsTotalBRL + effectiveDeliveryFee;
            const totalAmountCents = Math.round(totalAmountBrl * 100);
            const calculatedFeeCents = Math.round(totalAmountCents * PLATFORM_FEE_RATE);

            try {
                const session = await stripe.checkout.sessions.create({
                    mode: 'payment',
                    payment_intent_data: {
                        capture_method: captureMethod,
                        application_fee_amount: calculatedFeeCents,
                        transfer_data: {
                            destination: producerStripeAccountId,
                        },
                        metadata: {
                            buyer_tenant_id: buyerTenantId,
                            delivery_address: addressLine,
                            address: addressJson,
                            delivery_fee: effectiveDeliveryFee.toString(),
                            delivery_point: deliveryPointJson,
                            is_all_unit_order: isAllUnitOrder.toString(),
                        },
                    },
                    line_items: lineItems,
                    success_url: `${APP_URL}/sucesso?session_id={CHECKOUT_SESSION_ID}`,
                    cancel_url: `${APP_URL}/catalogo?checkout=cancelled`,
                    metadata: {
                        buyer_tenant_id: buyerTenantId,
                        items: itemsJson,
                        address: addressJson,
                        delivery_fee: effectiveDeliveryFee.toString(),
                        delivery_address: addressLine,
                        delivery_point: deliveryPointJson,
                        is_all_unit_order: isAllUnitOrder.toString(),
                    },
                });

                if (!session.url) {
                    throw new TRPCError({
                        code: 'INTERNAL_SERVER_ERROR',
                        message: 'Stripe nao retornou a URL de checkout. Tente novamente.',
                    });
                }

                return { url: session.url };
            } catch (error) {
                if (error instanceof TRPCError) {
                    throw error;
                }

                console.error('[STRIPE_ERROR]:', error);
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Falha ao criar sessao de pagamento. Verifique os logs.',
                    cause: error,
                });
            }
        }),
});
