import { z } from 'zod';
import { createHash } from 'crypto';
import Stripe from 'stripe';
import { createTRPCRouter, protectedProcedure, buyerProcedure, producerProcedure, tenantProcedure } from '../trpc';
import { productLots, products, orders, orderItems, tenants, masterProducts } from '@frescari/db';
import { eq, inArray, sql, and } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import {
    buildDeliveryAddressLine,
    geocodeDeliveryAddress,
    toDeliveryPointGeoJson,
    type GeocodedPoint,
} from '../geocoding';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = new Stripe(stripeSecretKey ?? '');
const WEIGHT_SAFETY_MARGIN = 1.1;
const PLATFORM_FEE_RATE = 0.1;

const isWeightSaleUnit = (saleUnit?: string | null) => {
    const normalizedSaleUnit = saleUnit?.toLowerCase();
    return normalizedSaleUnit === 'kg'
        || normalizedSaleUnit === 'g'
        || normalizedSaleUnit === 'peso'
        || normalizedSaleUnit === 'weight';
};

const isWeightBasedItem = (item: {
    saleUnit?: string | null;
    pricingType?: string | null;
    masterPricingType?: string | null;
}) => {
    return item.pricingType?.toUpperCase() === 'WEIGHT'
        || item.masterPricingType?.toUpperCase() === 'WEIGHT'
        || isWeightSaleUnit(item.saleUnit);
};

export const orderRouter = createTRPCRouter({
    createOrder: buyerProcedure
        .input(
            z.object({
                deliveryStreet: z.string().min(3, "Rua é obrigatória."),
                deliveryNumber: z.string().min(1, "Número é obrigatório."),
                deliveryCep: z.string().regex(/^\d{5}-?\d{3}$/, "CEP inválido."),
                deliveryCity: z.string().min(2, "Cidade é obrigatória."),
                deliveryState: z.string().length(2, "Estado deve ter 2 letras (UF)."),
                deliveryFee: z.number().min(0).default(0),
                deliveryNotes: z.string().optional(),
                items: z.array(
                    z.object({
                        lotId: z.string().uuid(),
                        quantity: z.number().positive(),
                    })
                ),
            })
        )
        .mutation(async ({ ctx, input }) => {
            console.log("[MUTATION_START]: Payload recebido", input);
            const { db, session, user } = ctx;

            if (!session || !user?.tenantId) {
                throw new TRPCError({
                    code: 'FORBIDDEN',
                    message: 'Comprador não possui uma organização vinculada (tenantId ausente).',
                });
            }

            const buyerTenantId = user.tenantId;
            const lotIds = input.items.map((i) => i.lotId);

            if (lotIds.length === 0) {
                throw new TRPCError({
                    code: 'BAD_REQUEST',
                    message: 'Carrinho vazio.',
                });
            }

            // Compose a single-line address for legacy display
            const deliveryAddress = {
                street: input.deliveryStreet,
                number: input.deliveryNumber,
                cep: input.deliveryCep,
                city: input.deliveryCity,
                state: input.deliveryState,
            };
            const composedAddress = buildDeliveryAddressLine(deliveryAddress);

            let geocodedDeliveryPoint: GeocodedPoint | null = null;

            try {
                geocodedDeliveryPoint = await geocodeDeliveryAddress(deliveryAddress);
            } catch (error) {
                console.error('[GEOCODING_ERROR_CREATE_ORDER]:', error);
                throw new TRPCError({
                    code: 'BAD_REQUEST',
                    message: 'Nao foi possivel validar o endereco de entrega. Revise os dados e tente novamente.',
                    cause: error,
                });
            }

            if (!geocodedDeliveryPoint) {
                throw new TRPCError({
                    code: 'BAD_REQUEST',
                    message: 'Nao foi possivel localizar o endereco de entrega informado. Revise os dados e tente novamente.',
                });
            }

            const deliveryPoint = toDeliveryPointGeoJson(geocodedDeliveryPoint);

            try {
                // Begin Transaction
                return await db.transaction(async (tx) => {
                    // Fetch the real lots to prevent client spoofing
                    const fetchedLots = await tx
                        .select({
                            lotId: productLots.id,
                            productId: products.id,
                            sellerTenantId: productLots.tenantId,
                            availableQty: productLots.availableQty,
                            expiryDate: productLots.expiryDate,
                            priceOverride: productLots.priceOverride,
                            pricePerUnit: products.pricePerUnit,
                            pricingType: productLots.pricingType,
                            masterPricingType: masterProducts.pricingType,
                            saleUnit: products.saleUnit
                        })
                        .from(productLots)
                        .innerJoin(products, eq(productLots.productId, products.id))
                        .leftJoin(masterProducts, eq(products.masterProductId, masterProducts.id))
                        .where(inArray(productLots.id, lotIds));

                    if (fetchedLots.length !== lotIds.length) {
                        throw new TRPCError({
                            code: 'BAD_REQUEST',
                            message: 'Um ou mais produtos não foram encontrados.',
                        });
                    }

                    // Process the requested items
                    const processedItems = input.items.map((reqItem) => {
                        const lotData = fetchedLots.find((l) => l.lotId === reqItem.lotId);
                        if (!lotData) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });

                        if (Number(lotData.availableQty) < reqItem.quantity) {
                            throw new TRPCError({
                                code: 'BAD_REQUEST',
                                message: `Quantidade indisponível para o lote ${reqItem.lotId}`,
                            });
                        }

                        // Strict integer validation for UNIT and BOX pricing types
                        const isWeight = lotData.pricingType === 'WEIGHT' || lotData.masterPricingType === 'WEIGHT' || lotData.saleUnit === 'kg' || lotData.saleUnit === 'g';
                        if (!isWeight && !Number.isInteger(reqItem.quantity)) {
                            throw new TRPCError({
                                code: 'BAD_REQUEST',
                                message: `A quantidade para o produto ${lotData.productId} deve ser um número inteiro.`,
                            });
                        }

                        // Value calc logic
                        const basePrice = Number(lotData.priceOverride || lotData.pricePerUnit);

                        // "Last Chance" - 40%
                        const now = new Date();
                        const expiry = new Date(lotData.expiryDate);
                        const diffTime = Math.abs(expiry.getTime() - now.getTime());
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        const isLastChance = diffDays <= 1;

                        const finalUnitPrice = isLastChance ? basePrice * 0.6 : basePrice;

                        return {
                            ...reqItem,
                            productId: lotData.productId,
                            sellerTenantId: lotData.sellerTenantId,
                            unitPrice: finalUnitPrice,
                            totalPrice: finalUnitPrice * reqItem.quantity,
                            saleUnit: (lotData.pricingType === 'WEIGHT' || lotData.masterPricingType === 'WEIGHT' || lotData.saleUnit === 'kg' || lotData.saleUnit === 'g') ? 'kg' : 'unit'
                        };
                    });

                    // Group by sellerTenantId
                    const ordersBySeller = processedItems.reduce((acc, item) => {
                        if (!acc[item.sellerTenantId]) acc[item.sellerTenantId] = [];
                        acc[item.sellerTenantId].push(item);
                        return acc;
                    }, {} as Record<string, typeof processedItems>);

                    // Insert Orders & OrderItems per Seller
                    const createdOrders = [];

                    for (const sellerId in ordersBySeller) {
                        const items = ordersBySeller[sellerId];
                        const itemsTotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
                        // Final formula: (sum of base_price * qty) + deliveryFee
                        const orderTotal = itemsTotal + input.deliveryFee;

                        // Create the Order
                        const [newOrder] = await tx.insert(orders).values({
                            buyerTenantId,
                            sellerTenantId: sellerId,
                            status: 'confirmed',
                            deliveryStreet: input.deliveryStreet,
                            deliveryNumber: input.deliveryNumber,
                            deliveryCep: input.deliveryCep,
                            deliveryCity: input.deliveryCity,
                            deliveryState: input.deliveryState,
                            deliveryAddress: composedAddress,
                            deliveryPoint,
                            deliveryFee: input.deliveryFee.toFixed(2),
                            deliveryNotes: input.deliveryNotes,
                            totalAmount: orderTotal.toFixed(4),
                        }).returning();

                        // Create Order Items
                        await tx.insert(orderItems).values(
                            items.map(i => ({
                                orderId: newOrder.id,
                                lotId: i.lotId,
                                productId: i.productId,
                                qty: i.quantity.toString(),
                                unitPrice: i.unitPrice.toFixed(4),
                                saleUnit: i.saleUnit
                            }))
                        );

                        // Deduce stock for each item
                        for (const i of items) {
                            const currentLot = fetchedLots.find(l => l.lotId === i.lotId)!;
                            const newQty = (Number(currentLot.availableQty) - i.quantity).toString();

                            await tx.update(productLots)
                                .set({ availableQty: newQty })
                                .where(eq(productLots.id, i.lotId));
                        }

                        createdOrders.push(newOrder.id);
                    }

                    return { success: true, orderIds: createdOrders };
                });
            } catch (error) {
                console.error("[ERRO_DB_ORDER_DETALHADO]: ", error);

                if (error instanceof TRPCError) {
                    throw error;
                }

                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Erro interno ao processar o pedido. Verifique os logs.',
                    cause: error,
                });
            }
        }),

    listMyOrders: tenantProcedure
        .input(z.object({ status: z.string().optional() }).optional())
        .query(async ({ ctx, input }) => {
            const { db, tenantId } = ctx;

            // To ensure safety relative to relations setup, fetching manually using a standard select:
            const allOrders = await db
                .select({
                    id: orders.id,
                    status: orders.status,
                    totalAmount: orders.totalAmount,
                    createdAt: orders.createdAt,
                    sellerTenantId: orders.sellerTenantId,
                    sellerName: tenants.name,
                })
                .from(orders)
                .innerJoin(tenants, eq(orders.sellerTenantId, tenants.id))
                .where(
                    and(
                        eq(orders.buyerTenantId, tenantId),
                        input?.status && input.status !== 'all' ? eq(orders.status, input.status as "draft" | "confirmed" | "picking" | "in_transit" | "delivered" | "cancelled") : undefined
                    )
                )
                .orderBy(sql`${orders.createdAt} DESC`);

            const orderIds = allOrders.map(o => o.id);

            if (orderIds.length === 0) return [];

            const items = await db
                .select({
                    orderId: orderItems.orderId,
                    qty: orderItems.qty,
                    unitPrice: orderItems.unitPrice,
                    productName: products.name,
                    saleUnit: orderItems.saleUnit,
                    farmName: tenants.name,
                    images: products.images,
                    pricingType: productLots.pricingType,
                    masterPricingType: masterProducts.pricingType,
                })
                .from(orderItems)
                .innerJoin(products, eq(orderItems.productId, products.id))
                .innerJoin(productLots, eq(orderItems.lotId, productLots.id))
                .innerJoin(tenants, eq(productLots.tenantId, tenants.id))
                .leftJoin(masterProducts, eq(products.masterProductId, masterProducts.id))
                .where(inArray(orderItems.orderId, orderIds));

            // Group items into their respective orders
            return allOrders.map(order => ({
                ...order,
                items: items.filter(item => item.orderId === order.id).map(item => ({
                    ...item,
                    imageUrl: item.images && item.images.length > 0 ? item.images[0] : null,
                })),
            }));
        }),

    cancelOrder: buyerProcedure
        .input(
            z.object({
                orderId: z.string().uuid(),
            })
        )
        .mutation(async ({ ctx, input }) => {
            const { db, tenantId } = ctx;

            try {
                return await db.transaction(async (tx) => {
                    // Check if order exists, belongs to the buyer, and is in allowed state
                    const targetOrder = await tx.query.orders.findFirst({
                        where: and(
                            eq(orders.id, input.orderId),
                            eq(orders.buyerTenantId, tenantId)
                        )
                    });

                    if (!targetOrder) {
                        throw new TRPCError({
                            code: 'NOT_FOUND',
                            message: 'Pedido não encontrado ou você não tem permissão para acessá-lo.',
                        });
                    }

                    if (targetOrder.status !== 'confirmed') {
                        throw new TRPCError({
                            code: 'BAD_REQUEST',
                            message: 'Apenas pedidos com status "Processando" podem ser cancelados.',
                        });
                    }

                    // Fetch order items to refund stock
                    const items = await tx.query.orderItems.findMany({
                        where: eq(orderItems.orderId, targetOrder.id)
                    });

                    // Update order status to 'cancelled'
                    await tx.update(orders)
                        .set({ status: 'cancelled' })
                        .where(eq(orders.id, targetOrder.id));

                    // Refund stock to product lots
                    for (const item of items) {
                        if (!item.lotId) continue;

                        await tx.update(productLots)
                            .set({
                                availableQty: sql`${productLots.availableQty} + ${item.qty}::numeric`
                            })
                            .where(eq(productLots.id, item.lotId));
                    }

                    return { success: true };
                });
            } catch (error) {
                console.error("[ERRO_CANCELAR_PEDIDO]: ", error);
                if (error instanceof TRPCError) {
                    throw error;
                }
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Ocorreu um erro ao cancelar o pedido.',
                });
            }
        }),

    // ─── Seller-side: list orders received by the producer ───
    listReceivedOrders: producerProcedure
        .input(z.object({ status: z.string().optional() }).optional())
        .query(async ({ ctx, input }) => {
            const { db, tenantId } = ctx;

            const allOrders = await db
                .select({
                    id: orders.id,
                    status: orders.status,
                    totalAmount: orders.totalAmount,
                    deliveryFee: orders.deliveryFee,
                    createdAt: orders.createdAt,
                    buyerTenantId: orders.buyerTenantId,
                    buyerName: tenants.name,
                })
                .from(orders)
                .innerJoin(tenants, eq(orders.buyerTenantId, tenants.id))
                .where(
                    and(
                        eq(orders.sellerTenantId, tenantId),
                        input?.status && input.status !== 'all'
                            ? eq(orders.status, input.status as "draft" | "confirmed" | "picking" | "in_transit" | "delivered" | "cancelled")
                            : undefined
                    )
                )
                .orderBy(sql`${orders.createdAt} DESC`);

            const orderIds = allOrders.map(o => o.id);

            if (orderIds.length === 0) return [];

            const items = await db
                .select({
                    id: orderItems.id,
                    orderId: orderItems.orderId,
                    qty: orderItems.qty,
                    unitPrice: orderItems.unitPrice,
                    productName: products.name,
                    saleUnit: orderItems.saleUnit,
                    pricingType: productLots.pricingType,
                    masterPricingType: masterProducts.pricingType,
                })
                .from(orderItems)
                .innerJoin(products, eq(orderItems.productId, products.id))
                .innerJoin(productLots, eq(orderItems.lotId, productLots.id))
                .leftJoin(masterProducts, eq(products.masterProductId, masterProducts.id))
                .where(inArray(orderItems.orderId, orderIds));

            return allOrders.map((order, index, arr) => ({
                ...order,
                visualId: (arr.length - index).toString().padStart(4, '0'),
                items: items.filter(item => item.orderId === order.id),
            }));
        }),

    // ─── Seller-side: update order status ───
    updateOrderStatus: producerProcedure
        .input(
            z.object({
                orderId: z.string().uuid(),
                status: z.enum(['confirmed', 'picking', 'in_transit', 'delivered', 'cancelled']),
            })
        )
        .mutation(async ({ ctx, input }) => {
            const { db, tenantId } = ctx;

            // Validate order belongs to this seller
            const targetOrder = await db.query.orders.findFirst({
                where: and(
                    eq(orders.id, input.orderId),
                    eq(orders.sellerTenantId, tenantId)
                )
            });

            if (!targetOrder) {
                throw new TRPCError({
                    code: 'NOT_FOUND',
                    message: 'Pedido não encontrado.',
                });
            }

            await db.update(orders)
                .set({ status: input.status })
                .where(eq(orders.id, input.orderId));

            return { success: true };
        }),

    // ─── Capture Weighed Order (Stripe Destination Charge) ───
    captureWeighedOrder: producerProcedure
        .input(
            z.object({
                orderId: z.string().uuid(),
                weighedItems: z.array(
                    z.object({
                        orderItemId: z.string().uuid(),
                        finalWeight: z.number().positive(),
                    })
                ).min(1, 'É necessário informar ao menos um peso final.'),
            })
        )
        .mutation(async ({ ctx, input }) => {
            const { db, tenantId } = ctx;

            if (!stripeSecretKey) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Stripe não está configurado.',
                });
            }

            // 1. Fetch order and validate ownership
            const targetOrder = await db.query.orders.findFirst({
                where: and(
                    eq(orders.id, input.orderId),
                    eq(orders.sellerTenantId, tenantId)
                ),
            });

            if (!targetOrder) {
                throw new TRPCError({
                    code: 'NOT_FOUND',
                    message: 'Pedido não encontrado ou você não tem permissão.',
                });
            }

            if (!['awaiting_weight', 'payment_authorized', 'confirmed'].includes(targetOrder.status)) {
                throw new TRPCError({
                    code: 'BAD_REQUEST',
                    message: 'Este pedido não está aguardando pesagem.',
                });
            }

            if (!targetOrder.paymentIntentId && !targetOrder.stripeSessionId) {
                throw new TRPCError({
                    code: 'BAD_REQUEST',
                    message: 'Este pedido não possui uma sessão de pagamento vinculada.',
                });
            }

            const items = await db
                .select({
                    id: orderItems.id,
                    qty: orderItems.qty,
                    unitPrice: orderItems.unitPrice,
                    saleUnit: orderItems.saleUnit,
                    productName: products.name,
                    pricingType: productLots.pricingType,
                    masterPricingType: masterProducts.pricingType,
                })
                .from(orderItems)
                .innerJoin(products, eq(orderItems.productId, products.id))
                .innerJoin(productLots, eq(orderItems.lotId, productLots.id))
                .leftJoin(masterProducts, eq(products.masterProductId, masterProducts.id))
                .where(eq(orderItems.orderId, targetOrder.id));

            if (items.length === 0) {
                throw new TRPCError({
                    code: 'NOT_FOUND',
                    message: 'Este pedido nÃ£o possui itens para reconciliar.',
                });
            }

            const weightItems = items.filter(isWeightBasedItem);

            if (weightItems.length === 0) {
                throw new TRPCError({
                    code: 'BAD_REQUEST',
                    message: 'Este pedido nÃ£o possui itens vendidos por peso.',
                });
            }

            const itemsById = new Map(items.map(item => [item.id, item]));
            const weightItemIds = new Set(weightItems.map(item => item.id));

            const dynamicCaptureSchema = z.object({
                orderId: z.string().uuid(),
                weighedItems: z.array(
                    z.object({
                        orderItemId: z.string().uuid(),
                        finalWeight: z.number().positive(),
                    })
                ).min(1, 'Ã‰ necessÃ¡rio informar ao menos um peso final.'),
            }).superRefine((payload, validationContext) => {
                const seenOrderItemIds = new Set<string>();

                payload.weighedItems.forEach((weighedItem, index) => {
                    if (!weightItemIds.has(weighedItem.orderItemId)) {
                        validationContext.addIssue({
                            code: z.ZodIssueCode.custom,
                            path: ['weighedItems', index, 'orderItemId'],
                            message: 'Apenas itens vendidos por peso podem ser enviados para captura.',
                        });
                        return;
                    }

                    if (seenOrderItemIds.has(weighedItem.orderItemId)) {
                        validationContext.addIssue({
                            code: z.ZodIssueCode.custom,
                            path: ['weighedItems', index, 'orderItemId'],
                            message: 'Cada item pesÃ¡vel deve ser informado apenas uma vez.',
                        });
                        return;
                    }

                    seenOrderItemIds.add(weighedItem.orderItemId);

                    const targetItem = itemsById.get(weighedItem.orderItemId);
                    if (!targetItem) {
                        return;
                    }

                    const requestedWeight = Number(targetItem.qty);
                    const maxAllowedWeight = requestedWeight * WEIGHT_SAFETY_MARGIN;

                    if (weighedItem.finalWeight > maxAllowedWeight) {
                        validationContext.addIssue({
                            code: z.ZodIssueCode.custom,
                            path: ['weighedItems', index, 'finalWeight'],
                            message: `${targetItem.productName} excede o limite de 10% (${maxAllowedWeight.toFixed(3)} ${targetItem.saleUnit}).`,
                        });
                    }
                });

                weightItems.forEach((weightItem) => {
                    if (!seenOrderItemIds.has(weightItem.id)) {
                        validationContext.addIssue({
                            code: z.ZodIssueCode.custom,
                            path: ['weighedItems'],
                            message: `Informe o peso final de ${weightItem.productName}.`,
                        });
                    }
                });
            });

            const validatedPayload = dynamicCaptureSchema.safeParse(input);

            if (!validatedPayload.success) {
                throw new TRPCError({
                    code: 'BAD_REQUEST',
                    message: validatedPayload.error.issues[0]?.message ?? 'Os pesos informados sÃ£o invÃ¡lidos.',
                });
            }

            const finalWeightsByItemId = new Map(
                validatedPayload.data.weighedItems.map(({ orderItemId, finalWeight }) => [orderItemId, finalWeight])
            );

            const itemsTotalCents = items.reduce((sum, item) => {
                const finalQty = finalWeightsByItemId.get(item.id) ?? Number(item.qty);
                return sum + Math.round(finalQty * Number(item.unitPrice) * 100);
            }, 0);
            const deliveryFeeCents = Math.round(Number(targetOrder.deliveryFee) * 100);
            const grossAmountCents = itemsTotalCents + deliveryFeeCents;
            const grossAmount = grossAmountCents / 100;
            const platformFeeCents = Math.round(grossAmountCents * PLATFORM_FEE_RATE);
            const netAmountCents = grossAmountCents - platformFeeCents;
            const storedTotalCents = Math.round(Number(targetOrder.totalAmount) * 100);
            const totalAmountCents = grossAmountCents;
            const applicationFeeCents = platformFeeCents;
            const totalAmountBrl = grossAmount;
            const updatedItemsParams = Array.from(
                finalWeightsByItemId.entries(),
                ([id, finalWeight]) => ({ id, qty: finalWeight.toString() })
            );

            // 4. Retrieve Stripe Session and PaymentIntent
            let paymentIntentId = targetOrder.paymentIntentId ?? '';
            if (!paymentIntentId) {
            try {
                const session = await stripe.checkout.sessions.retrieve(targetOrder.stripeSessionId!);
                const pi = session.payment_intent;
                paymentIntentId = typeof pi === 'string' ? pi : (pi?.id ?? '');

                if (!paymentIntentId) {
                    throw new Error('Payment Intent ID não encontrado na sessão.');
                }
            } catch (error) {
                console.error('[STRIPE_RETRIEVE_ERROR]', error);
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Falha ao recuperar os dados de pagamento do Stripe.',
                    cause: error,
                });
            }
            }

            if (!paymentIntentId) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'NÃ£o foi possÃ­vel identificar o Payment Intent do Stripe.',
                });
            }

            let paymentIntent: Stripe.PaymentIntent;
            try {
                paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
            } catch (error) {
                console.error('[STRIPE_PAYMENT_INTENT_RETRIEVE_ERROR]', error);
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Falha ao recuperar o pagamento do Stripe.',
                    cause: error,
                });
            }

            const alreadyCaptured = paymentIntent.status === 'succeeded';

            if (alreadyCaptured) {
                if (paymentIntent.amount_received !== grossAmountCents) {
                    throw new TRPCError({
                        code: 'BAD_REQUEST',
                        message: 'O pagamento jÃ¡ foi capturado com um valor diferente. Revise este pedido manualmente.',
                    });
                }

                if (targetOrder.status === 'confirmed') {
                    if (storedTotalCents !== grossAmountCents) {
                        throw new TRPCError({
                            code: 'BAD_REQUEST',
                            message: 'O pedido jÃ¡ foi confirmado com um total diferente. Revise este pedido manualmente.',
                        });
                    }

                    return {
                        success: true,
                        finalAmount: grossAmount,
                        grossAmount,
                        platformFee: platformFeeCents / 100,
                        netAmount: netAmountCents / 100,
                        alreadyCaptured: true,
                    };
                }
            } else {
                if (targetOrder.status === 'confirmed') {
                    throw new TRPCError({
                        code: 'BAD_REQUEST',
                        message: 'O pedido jÃ¡ foi confirmado no sistema, mas o pagamento ainda nÃ£o estÃ¡ capturado. Revise manualmente.',
                    });
                }

                if (paymentIntent.status !== 'requires_capture') {
                    throw new TRPCError({
                        code: 'BAD_REQUEST',
                        message: 'Este pagamento nÃ£o estÃ¡ em um estado capturÃ¡vel no Stripe.',
                    });
                }

                if ((paymentIntent.amount_capturable ?? 0) < grossAmountCents) {
                    throw new TRPCError({
                        code: 'BAD_REQUEST',
                        message: 'O valor final ultrapassa o total previamente autorizado. Revise os pesos informados.',
                    });
                }

                const captureFingerprint = validatedPayload.data.weighedItems
                    .slice()
                    .sort((left, right) => left.orderItemId.localeCompare(right.orderItemId))
                    .map(({ orderItemId, finalWeight }) => `${orderItemId}:${finalWeight.toFixed(3)}`)
                    .join('|');
                const idempotencyKey = `capture-weighed-order:${targetOrder.id}:${createHash('sha256')
                    .update(captureFingerprint)
                    .digest('hex')}`;

                // 5. Capture Payment in Stripe
                try {
                    await stripe.paymentIntents.capture(paymentIntentId, {
                        amount_to_capture: totalAmountCents,
                        application_fee_amount: applicationFeeCents,
                    }, {
                        idempotencyKey,
                    });
            } catch (error) {
                console.error('[STRIPE_CAPTURE_ERROR]', error);
                // Informar ao operador exatamente porque a captura falhou
                throw new TRPCError({
                    code: 'BAD_REQUEST',
                    message: 'O pagamento falhou ou foi recusado pela operadora. Não libere o pedido. Verifique logs do Stripe.',
                    cause: error,
                });
            }

            }

            // 6. DB Updates in Transaction
            try {
                await db.transaction(async (tx) => {
                    // Update quantities
                    for (const uItem of updatedItemsParams) {
                        await tx.update(orderItems)
                            .set({ qty: uItem.qty })
                            .where(eq(orderItems.id, uItem.id));
                    }

                    // Update order status and new total
                    await tx.update(orders)
                        .set({
                            status: 'confirmed', // Movendo de "awaiting_weight" para "confirmed"
                            totalAmount: totalAmountBrl.toFixed(4),
                            paymentIntentId,
                        })
                        .where(eq(orders.id, targetOrder.id));
                });
            } catch (error) {
                console.error('[DB_UPDATE_ERROR]', error);
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Falha ao salvar as atualizações de peso no banco de dados, mas o pagamento já foi capturado no Stripe!',
                    cause: error,
                });
            }

            return {
                success: true,
                finalAmount: totalAmountBrl,
                grossAmount,
                platformFee: platformFeeCents / 100,
                netAmount: netAmountCents / 100,
                alreadyCaptured,
            };
        }),
});
