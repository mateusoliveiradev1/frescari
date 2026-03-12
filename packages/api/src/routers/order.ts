import { z } from 'zod';
import Stripe from 'stripe';
import { createTRPCRouter, protectedProcedure, buyerProcedure, producerProcedure, tenantProcedure } from '../trpc';
import { productLots, products, orders, orderItems, tenants, masterProducts } from '@frescari/db';
import { eq, inArray, sql, and } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = new Stripe(stripeSecretKey ?? '');

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
            const composedAddress = `${input.deliveryStreet}, ${input.deliveryNumber} - ${input.deliveryCity}/${input.deliveryState} - CEP: ${input.deliveryCep}`;

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

            if (targetOrder.status !== 'awaiting_weight') {
                throw new TRPCError({
                    code: 'BAD_REQUEST',
                    message: 'Este pedido não está aguardando pesagem.',
                });
            }

            if (!targetOrder.stripeSessionId) {
                throw new TRPCError({
                    code: 'BAD_REQUEST',
                    message: 'Este pedido não possui uma sessão de pagamento vinculada.',
                });
            }

            // 2. Fetch order items
            const items = await db.query.orderItems.findMany({
                where: eq(orderItems.orderId, targetOrder.id),
            });

            // 3. Recalculate totals
            let itemsTotal = 0;
            const updatedItemsParams: { id: string; qty: string }[] = [];

            for (const item of items) {
                const weighedInput = input.weighedItems.find(wi => wi.orderItemId === item.id);
                const finalQty = weighedInput ? weighedInput.finalWeight : Number(item.qty);

                itemsTotal += finalQty * Number(item.unitPrice);

                if (weighedInput) {
                    updatedItemsParams.push({ id: item.id, qty: finalQty.toString() });
                }
            }

            const deliveryFee = Number(targetOrder.deliveryFee);
            const totalAmountBrl = itemsTotal + deliveryFee;

            // Converter para centavos
            const totalAmountCents = Math.round(totalAmountBrl * 100);
            const applicationFeeCents = Math.round(totalAmountCents * 0.1); // 10% fee

            // 4. Retrieve Stripe Session and PaymentIntent
            let paymentIntentId: string;
            try {
                const session = await stripe.checkout.sessions.retrieve(targetOrder.stripeSessionId);
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

            // 5. Capture Payment in Stripe
            try {
                await stripe.paymentIntents.capture(paymentIntentId, {
                    amount_to_capture: totalAmountCents,
                    application_fee_amount: applicationFeeCents,
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
                            totalAmount: totalAmountBrl.toFixed(4)
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

            return { success: true, finalAmount: totalAmountBrl };
        }),
});
