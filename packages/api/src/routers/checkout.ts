import { z } from 'zod';
import Stripe from 'stripe';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';

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
    items: CheckoutItem[],
    deliveryFee: number,
): Stripe.Checkout.SessionCreateParams.LineItem[] {
    const productLines: Stripe.Checkout.SessionCreateParams.LineItem[] =
        items.map((item) => ({
            price_data: {
                currency: 'brl',
                product_data: {
                    name: item.productName,
                    ...(item.imageUrl ? { images: [item.imageUrl] } : {}),
                },
                unit_amount: toStripeCents(item.unitPrice, item.pricingType),
            },
            quantity: item.quantity,
        }));

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
        .mutation(async ({ input }) => {
            if (!stripeSecretKey) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message:
                        'Stripe não está configurado. Contate o administrador.',
                });
            }

            const lineItems = buildLineItems(input.items, input.deliveryFee);

            // Compose metadata for traceability
            const lotIds = input.items.map((i) => i.lotId).join(',');
            const addressLine = `${input.address.street}, ${input.address.number} - ${input.address.city}/${input.address.state} - CEP: ${input.address.cep}`;

            try {
                const session = await stripe.checkout.sessions.create({
                    mode: 'payment',
                    payment_intent_data: {
                        capture_method: 'manual',
                        metadata: {
                            lot_ids: lotIds,
                            delivery_address: addressLine,
                        },
                    },
                    line_items: lineItems,
                    success_url: `${APP_URL}/dashboard/pedidos?checkout=success`,
                    cancel_url: `${APP_URL}/catalogo?checkout=cancelled`,
                    metadata: {
                        lot_ids: lotIds,
                        delivery_address: addressLine,
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
