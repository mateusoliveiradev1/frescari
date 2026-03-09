import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { productLots, products, orders, orderItems } from '@frescari/db';
import { eq, inArray, desc, asc, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';

export const orderRouter = createTRPCRouter({
    createOrder: protectedProcedure
        .input(
            z.object({
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
                        })
                        .from(productLots)
                        .innerJoin(products, eq(productLots.productId, products.id))
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
                            totalPrice: finalUnitPrice * reqItem.quantity
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
                        const orderTotal = items.reduce((sum, item) => sum + item.totalPrice, 0);

                        // Create the Order
                        const [newOrder] = await tx.insert(orders).values({
                            buyerTenantId,
                            sellerTenantId: sellerId,
                            status: 'confirmed',
                            totalAmount: orderTotal.toFixed(4),
                        }).returning();

                        // Create Order Items
                        await tx.insert(orderItems).values(
                            items.map(i => ({
                                orderId: newOrder.id,
                                lotId: i.lotId,
                                productId: i.productId,
                                qty: i.quantity.toString(),
                                unitPrice: i.unitPrice.toFixed(4)
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

    listMyOrders: protectedProcedure
        .query(async ({ ctx }) => {
            const { db, user } = ctx;

            if (!user?.tenantId) {
                throw new TRPCError({
                    code: 'FORBIDDEN',
                    message: 'Usuário sem organização vinculada.',
                });
            }

            // Fetch orders for this buyer
            const myOrders = await db.query.orders.findMany({
                where: eq(orders.buyerTenantId, user.tenantId),
                with: {
                    // Use standard drizzle-orm relations for nested models if they are configured correctly, 
                    // or just raw select if relations are absent. Assuming relations are set up in schema.
                },
                orderBy: (orders, { desc }) => [desc(orders.createdAt)],
            });

            // To ensure safety relative to relations setup, fetching manually using a standard select:
            const allOrders = await db
                .select({
                    id: orders.id,
                    status: orders.status,
                    totalAmount: orders.totalAmount,
                    createdAt: orders.createdAt,
                    sellerTenantId: orders.sellerTenantId,
                })
                .from(orders)
                .where(eq(orders.buyerTenantId, user.tenantId))
                .orderBy(sql`${orders.createdAt} DESC`);

            const orderIds = allOrders.map(o => o.id);

            if (orderIds.length === 0) return [];

            const items = await db
                .select({
                    orderId: orderItems.orderId,
                    qty: orderItems.qty,
                    unitPrice: orderItems.unitPrice,
                    productName: products.name,
                    saleUnit: products.saleUnit,
                    farmName: productLots.tenantId, // we should really fetch tenant name but returning id for now
                    images: products.images,
                })
                .from(orderItems)
                .innerJoin(products, eq(orderItems.productId, products.id))
                .innerJoin(productLots, eq(orderItems.lotId, productLots.id))
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
});
