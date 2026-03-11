import { z } from 'zod';
import Stripe from 'stripe';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { db, tenants, productLots, products, masterProducts } from '@frescari/db';
import { eq, inArray } from 'drizzle-orm';

// ── Stripe SDK initialisation ────────────────────────────────────────
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
    console.warn(
        '[STRIPE] STRIPE_SECRET_KEY is not set. Checkout will fail at runtime.',
    );
}

const stripe = new Stripe(stripeSecretKey ?? '');

// ── Constants ────────────────────────────────────────────────────────
const WEIGHT_SAFETY_MARGIN = 1.10; // +10 % buffer for scale variance
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

// ── Zod schemas ──────────────────────────────────────────────────────
const pricingTypeSchema = z.enum(['UNIT', 'WEIGHT', 'BOX']);

const checkoutItemSchema = z.object({
    lotId: z.string().uuid(),
    quantity: z.number().positive(),
    pricingType: pricingTypeSchema,
    productName: z.string().min(1),
    unitPrice: z.number().positive(),
    imageUrl: z.string().url().nullish(),
});

const deliveryAddressSchema = z.object({
    street: z.string().min(3, 'Rua é obrigatória.'),
    number: z.string().min(1, 'Número é obrigatório.'),
    cep: z.string().regex(/^\d{5}-?\d{3}$/, 'CEP inválido.'),
    city: z.string().min(2, 'Cidade é obrigatória.'),
    state: z.string().length(2, 'Estado deve ter 2 letras (UF).'),
});

export type CheckoutItem = z.infer<typeof checkoutItemSchema>;
export type DeliveryAddress = z.infer<typeof deliveryAddressSchema>;

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Converts a BRL float price to Stripe-compatible integer cents.
 * Applies the 10 % weight safety margin when the item is priced by weight.
 */
function toStripeCents(
    brlPrice: number,
    pricingType: CheckoutItem['pricingType'],
): number {
    const adjusted =
        pricingType === 'WEIGHT' ? brlPrice * WEIGHT_SAFETY_MARGIN : brlPrice;
    return Math.round(adjusted * 100);
}

function buildLineItems(
    items: Array<CheckoutItem & { masterPricingType?: 'UNIT' | 'WEIGHT' | 'BOX' | null; productSaleUnit?: string | null; dbPricingType?: 'UNIT' | 'WEIGHT' | 'BOX' | null; dBPx?: number | null; }>,
    deliveryFee: number,
): Stripe.Checkout.SessionCreateParams.LineItem[] {
    const productLines: Stripe.Checkout.SessionCreateParams.LineItem[] =
        items.map((item) => {
            const isWeight = item.pricingType === 'WEIGHT' || item.masterPricingType === 'WEIGHT' || item.productSaleUnit === 'kg' || item.productSaleUnit === 'g' || item.dbPricingType === 'WEIGHT';

            return {
                price_data: {
                    currency: 'brl',
                    product_data: {
                        name: item.productName,
                        ...(item.imageUrl ? { images: [item.imageUrl] } : {}),
                    },
                    unit_amount: toStripeCents(item.unitPrice, isWeight ? 'WEIGHT' : 'UNIT'),
                },
                quantity: item.quantity,
            };
        });

    // Delivery fee as a standalone line-item
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

// ── Router ───────────────────────────────────────────────────────────
export const checkoutRouter = createTRPCRouter({
    createCheckoutSession: protectedProcedure
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
                    message:
                        'Stripe não está configurado. Contate o administrador.',
                });
            }

            const buyerTenantId = ctx.user?.tenantId as string | undefined;
            if (!buyerTenantId) {
                throw new TRPCError({
                    code: 'FORBIDDEN',
                    message: 'Comprador sem organização vinculada.',
                });
            }

            // Get product Lot and obtain the sellerTenantId -> stripeAccountId
            const firstLotId = input.items[0]?.lotId;
            if (!firstLotId) {
                throw new TRPCError({
                    code: 'BAD_REQUEST',
                    message: 'Carrinho inválido.',
                });
            }

            const lotIdsToFetch = input.items.map((i) => i.lotId);

            const lotDataForStripe = await db
                .select({
                    lotId: productLots.id,
                    stripeAccountId: tenants.stripeAccountId,
                    masterPricingType: masterProducts.pricingType,
                    productSaleUnit: products.saleUnit,
                    dbPricingType: productLots.pricingType
                })
                .from(productLots)
                .innerJoin(tenants, eq(tenants.id, productLots.tenantId))
                .innerJoin(products, eq(productLots.productId, products.id))
                .leftJoin(masterProducts, eq(products.masterProductId, masterProducts.id))
                .where(inArray(productLots.id, lotIdsToFetch));

            const producerStripeAccountId = lotDataForStripe[0]?.stripeAccountId;

            if (!producerStripeAccountId) {
                throw new TRPCError({
                    code: 'PRECONDITION_FAILED',
                    message: 'Produtor não possui conta Stripe configurada para receber pagamentos.',
                });
            }

            // Merge original items with accurate pricing types from db
            const safeItems = input.items.map((item) => {
                const mergedLot = lotDataForStripe.find(ld => ld.lotId === item.lotId);
                return {
                    ...item,
                    masterPricingType: mergedLot?.masterPricingType,
                    productSaleUnit: mergedLot?.productSaleUnit,
                    dbPricingType: mergedLot?.dbPricingType
                };
            });

            const lineItems = buildLineItems(safeItems, input.deliveryFee);

            // Compose address line for display
            const addressLine = `${input.address.street}, ${input.address.number} - ${input.address.city}/${input.address.state} - CEP: ${input.address.cep}`;

            // Serialize items for webhook reconstruction (Stripe metadata max 500 chars per value)
            const itemsJson = JSON.stringify(
                input.items.map((i) => ({
                    lotId: i.lotId,
                    qty: i.quantity,
                    pt: i.pricingType,
                    name: i.productName,
                    price: i.unitPrice,
                })),
            );

            // Structured address JSON for webhook
            const addressJson = JSON.stringify(input.address);

            const hasWeightProducts = safeItems.some(
                (item) => item.pricingType === 'WEIGHT' || item.masterPricingType === 'WEIGHT' || item.productSaleUnit === 'kg' || item.productSaleUnit === 'g' || item.dbPricingType === 'WEIGHT'
            );

            const captureMethod = hasWeightProducts ? 'manual' : 'automatic';
            const isAllUnitOrder = !hasWeightProducts;

            // Calculate total cart value in order to get dynamic application_fee_amount (e.g. 10%)
            const itemsTotalBRL = input.items.reduce(
                (sum, item) => sum + (item.unitPrice * item.quantity),
                0
            );

            const totalAmountBrl = itemsTotalBRL + input.deliveryFee;
            // Converting back to generalized integer cents for math (ignoring weight safety logic gap on this fee calculation to follow direct BRL total requested unless specific rule is needed).
            // Using standard representation conversion
            const totalAmountCents = Math.round(totalAmountBrl * 100);

            // Fixed temporary platform fee of 10%
            const calculatedFeeCents = Math.round(totalAmountCents * 0.1);

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
                        delivery_fee: input.deliveryFee.toString(),
                        delivery_address: addressLine,
                        is_all_unit_order: isAllUnitOrder.toString(),
                    },
                });

                if (!session.url) {
                    throw new TRPCError({
                        code: 'INTERNAL_SERVER_ERROR',
                        message:
                            'Stripe não retornou a URL de checkout. Tente novamente.',
                    });
                }

                return { url: session.url };
            } catch (error) {
                // Re-throw known tRPC errors
                if (error instanceof TRPCError) throw error;

                console.error('[STRIPE_ERROR]:', error);
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message:
                        'Falha ao criar sessão de pagamento. Verifique os logs.',
                    cause: error,
                });
            }
        }),
});

