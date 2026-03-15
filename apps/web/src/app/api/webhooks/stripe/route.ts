import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { db } from '@frescari/db';
import {
    enableProductLotBypassContext,
    orders,
    orderItems,
    productLots,
    products,
    masterProducts,
} from '@frescari/db';
import { eq, inArray, sql } from 'drizzle-orm';
import {
    buildDeliveryAddressLine,
    geocodeDeliveryAddress,
    isWeighableSaleUnit,
    parseDeliveryPointMetadata,
    resolveEffectiveSaleUnit,
    toDeliveryPointGeoJson,
} from '@frescari/api';

import { resolveAuthorizedOrderStatus } from './resolve-order-status';

// ── Stripe SDK ───────────────────────────────────────────────────────
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '');
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

// ── Types for parsed metadata ────────────────────────────────────────
interface MetadataItem {
    lotId: string;
    qty: number;
    pt: 'UNIT' | 'WEIGHT' | 'BOX';
    name: string;
    price: number;
}

interface MetadataAddress {
    street: string;
    number: string;
    cep: string;
    city: string;
    state: string;
}

// ── Webhook handler ──────────────────────────────────────────────────
export async function POST(req: NextRequest) {
    console.log('[WEBHOOK] ── Incoming request ──');

    if (!webhookSecret) {
        console.error('[WEBHOOK] STRIPE_WEBHOOK_SECRET is not configured.');
        return NextResponse.json(
            { error: 'Webhook secret not configured' },
            { status: 500 },
        );
    }

    // CRITICAL: Must use req.text() to get raw body for signature verification
    const body = await req.text();
    const signature = req.headers.get('stripe-signature');

    if (!signature) {
        console.error('[WEBHOOK] Missing stripe-signature header.');
        return NextResponse.json(
            { error: 'Missing stripe-signature header' },
            { status: 400 },
        );
    }

    // ── Verify signature ─────────────────────────────────────────────
    let event: Stripe.Event;
    try {
        event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        console.error('[WEBHOOK] Signature verification failed:', message);
        return NextResponse.json(
            { error: `Webhook signature verification failed: ${message}` },
            { status: 400 },
        );
    }

    console.log(`[WEBHOOK] Evento recebido: ${event.type}, ID: ${event.id}`);

    // ── Handle events ────────────────────────────────────────────────
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session;

        if (session.metadata?.orderId) {
            try {
                const targetOrder = await db.query.orders.findFirst({
                    where: eq(orders.id, session.metadata.orderId),
                });

                if (!targetOrder) {
                    throw new Error(`Pedido ${session.metadata.orderId} nao encontrado para atualizacao do webhook.`);
                }

                const paymentIntentId = typeof session.payment_intent === 'string'
                    ? session.payment_intent
                    : session.payment_intent?.id;
                const nextStatus = resolveAuthorizedOrderStatus(targetOrder.status);
                const parsedDeliveryPoint = parseDeliveryPointMetadata(
                    session.metadata.delivery_point ?? session.metadata.deliveryPoint,
                );

                console.log(`[WEBHOOK] Atualizando pedido existente: ${session.metadata.orderId}`);
                await db
                    .update(orders)
                    .set({
                        status: nextStatus,
                        stripeSessionId: targetOrder.stripeSessionId ?? session.id,
                        paymentIntentId: paymentIntentId ?? targetOrder.paymentIntentId,
                        ...(parsedDeliveryPoint && !targetOrder.deliveryPoint
                            ? { deliveryPoint: toDeliveryPointGeoJson(parsedDeliveryPoint) }
                            : {}),
                    })
                    .where(eq(orders.id, session.metadata.orderId));
                console.log(`[WEBHOOK] Pedido ${session.metadata.orderId} atualizado para ${nextStatus}`);
            } catch (error) {
                console.error(`[WEBHOOK ERROR] Falha ao atualizar pedido ${session.metadata.orderId}:`, error);
                // Policy: Return 200 so Stripe doesn't retry infinitely on DB failure for existing order
                return NextResponse.json(
                    { received: true, error: 'Database update failed for existing order' },
                    { status: 200 },
                );
            }
        } else {
            try {
                await handleCheckoutCompleted(session);
            } catch (error) {
                console.error('[WEBHOOK ERROR] Falha ao processar checkout.session.completed:', error);
                // Return 500 so Stripe retries on transient errors (e.g. DB down).
                // For permanent errors (missing metadata), handleCheckoutCompleted
                // already logs the details before throwing.
                return NextResponse.json(
                    { received: true, error: 'Processing error logged' },
                    { status: 500 },
                );
            }
        }
    }

    return NextResponse.json({ received: true });
}

// ── Business logic ───────────────────────────────────────────────────
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
    console.log(`[WEBHOOK] Processando sessão: ${session.id}`);

    // ── 1. Extract & validate metadata ───────────────────────────────
    const metadata = session.metadata;
    if (!metadata) {
        throw new Error(`[WEBHOOK] Session ${session.id} has no metadata.`);
    }

    const buyerTenantId = metadata.buyer_tenant_id;
    const itemsRaw = metadata.items;
    const addressRaw = metadata.address;
    const deliveryFeeStr = metadata.delivery_fee ?? '0';
    const deliveryPointRaw = metadata.delivery_point ?? metadata.deliveryPoint;

    if (!buyerTenantId || !itemsRaw || !addressRaw) {
        throw new Error(
            `[WEBHOOK] Metadados obrigatórios ausentes na sessão ${session.id}: ` +
            `buyer_tenant_id=${buyerTenantId ? '✓' : '✗'}, ` +
            `items=${itemsRaw ? '✓' : '✗'}, ` +
            `address=${addressRaw ? '✓' : '✗'}`,
        );
    }

    console.log(`[WEBHOOK] Metadados extraídos: buyer=${buyerTenantId}, deliveryFee=${deliveryFeeStr}`);


    // ── 2. Parse JSON safely ─────────────────────────────────────────
    let parsedItems: MetadataItem[];
    let parsedAddress: MetadataAddress;
    const metadataDeliveryPoint = parseDeliveryPointMetadata(deliveryPointRaw);

    try {
        parsedItems = JSON.parse(itemsRaw) as MetadataItem[];
    } catch {
        throw new Error(`[WEBHOOK] Failed to parse items JSON for session ${session.id}: ${itemsRaw}`);
    }

    try {
        parsedAddress = JSON.parse(addressRaw) as MetadataAddress;
    } catch {
        throw new Error(`[WEBHOOK] Failed to parse address JSON for session ${session.id}: ${addressRaw}`);
    }

    if (parsedItems.length === 0) {
        throw new Error(`[WEBHOOK] No items in metadata for session ${session.id}.`);
    }

    const deliveryFee = parseFloat(deliveryFeeStr);
    console.log(`[WEBHOOK] Itens parseados: ${parsedItems.length} item(ns), deliveryFee=${deliveryFee}`);

    let resolvedDeliveryPoint = metadataDeliveryPoint;

    if (!resolvedDeliveryPoint) {
        console.warn(
            `[WEBHOOK] metadata.delivery_point ausente ou invalido para sessao ${session.id}. Aplicando fallback de geocoding.`,
        );
        resolvedDeliveryPoint = await geocodeDeliveryAddress(parsedAddress);
    }

    if (!resolvedDeliveryPoint) {
        throw new Error(
            `[WEBHOOK] Nao foi possivel determinar delivery_point para a sessao ${session.id}.`,
        );
    }

    const deliveryPoint = toDeliveryPointGeoJson(resolvedDeliveryPoint);

    // ── 3. Idempotency guard ─────────────────────────────────────────
    const existingOrder = await db
        .select({ id: orders.id })
        .from(orders)
        .where(eq(orders.stripeSessionId, session.id))
        .limit(1);

    if (existingOrder.length > 0) {
        console.log(`[WEBHOOK] ⚠️ Sessão ${session.id} já processada (order ${existingOrder[0]!.id}). Ignorando duplicata.`);
        return;
    }

    // ── 4. Fetch lot data from DB ────────────────────────────────────
    const lotIds = parsedItems.map((i) => i.lotId);
    console.log(`[WEBHOOK] Buscando lotes no banco: ${lotIds.join(', ')}`);

    const fetchedLots = await db.transaction(async (tx) => {
        await enableProductLotBypassContext(tx);

        return tx
            .select({
                lotId: productLots.id,
                productId: productLots.productId,
                sellerTenantId: productLots.tenantId,
                availableQty: productLots.availableQty,
                lotUnit: productLots.unit,
                saleUnit: products.saleUnit,
                pricingType: productLots.pricingType,
                masterPricingType: masterProducts.pricingType,
            })
            .from(productLots)
            .innerJoin(products, eq(productLots.productId, products.id))
            .leftJoin(masterProducts, eq(products.masterProductId, masterProducts.id))
            .where(inArray(productLots.id, lotIds));
    });

    if (fetchedLots.length === 0) {
        throw new Error(`[WEBHOOK] Nenhum lote encontrado no banco para IDs: ${lotIds.join(', ')}`);
    }

    console.log(`[WEBHOOK] Lotes encontrados no banco: ${fetchedLots.length}`);

    // ── 5. Map items to lot data ─────────────────────────────────────
    const composedAddress = buildDeliveryAddressLine(parsedAddress);

    const itemsWithLotData = parsedItems.map((item) => {
        const lotData = fetchedLots.find((l) => l.lotId === item.lotId);
        if (!lotData) {
            console.warn(`[WEBHOOK] ⚠️ Lote ${item.lotId} não encontrado no banco. Será ignorado.`);
        }
        return {
            ...item,
            productId: lotData?.productId ?? '',
            sellerTenantId: lotData?.sellerTenantId ?? '',
            saleUnit: resolveEffectiveSaleUnit(lotData?.saleUnit, lotData?.lotUnit),
            pricingType: lotData?.pricingType,
            masterPricingType: lotData?.masterPricingType,
        };
    });

    // ── 6. Group items by seller ─────────────────────────────────────
    const ordersBySeller = itemsWithLotData.reduce(
        (acc, item) => {
            if (!item.sellerTenantId) return acc;
            if (!acc[item.sellerTenantId]) acc[item.sellerTenantId] = [];
            acc[item.sellerTenantId]!.push(item);
            return acc;
        },
        {} as Record<string, typeof itemsWithLotData>,
    );

    const sellerCount = Object.keys(ordersBySeller).length;
    console.log(`[WEBHOOK] Pedidos agrupados por ${sellerCount} vendedor(es).`);

    // ── 7. Create orders inside a DB transaction ─────────────────────
    console.log('[WEBHOOK] Iniciando transação no banco...');

    await db.transaction(async (tx) => {
        await enableProductLotBypassContext(tx);

        for (const sellerId of Object.keys(ordersBySeller)) {
            const sellerItems = ordersBySeller[sellerId]!;
            const itemsTotal = sellerItems.reduce(
                (sum, item) => sum + item.price * item.qty,
                0,
            );
            const orderTotal = itemsTotal + deliveryFee;

            const hasWeightItems = sellerItems.some((item) => isWeighableSaleUnit(item.saleUnit));
            const initialStatus = hasWeightItems ? 'awaiting_weight' : 'confirmed';

            const paymentIntentId = typeof session.payment_intent === 'string'
                ? session.payment_intent
                : session.payment_intent?.id;

            // ── Insert Order ─────────────────────────────────────────
            const [newOrder] = await tx
                .insert(orders)
                .values({
                    buyerTenantId,
                    sellerTenantId: sellerId,
                    status: initialStatus,
                    stripeSessionId: session.id,
                    paymentIntentId: paymentIntentId ?? null,
                    deliveryStreet: parsedAddress.street,
                    deliveryNumber: parsedAddress.number,
                    deliveryCep: parsedAddress.cep,
                    deliveryCity: parsedAddress.city,
                    deliveryState: parsedAddress.state.toUpperCase(),
                    deliveryAddress: composedAddress,
                    deliveryPoint,
                    deliveryFee: deliveryFee.toFixed(2),
                    totalAmount: orderTotal.toFixed(4),
                })
                .returning();

            if (!newOrder) {
                throw new Error(`[WEBHOOK] Falha ao inserir order para seller ${sellerId} — returning() vazio.`);
            }

            console.log(`[WEBHOOK] ✅ Pedido criado: ${newOrder.id} | Vendedor: ${sellerId} | Total: R$${orderTotal.toFixed(2)}`);

            // ── Insert Order Items ───────────────────────────────────
            await tx.insert(orderItems).values(
                sellerItems.map((item) => ({
                    orderId: newOrder.id,
                    lotId: item.lotId,
                    productId: item.productId,
                    qty: item.qty.toString(),
                    unitPrice: item.price.toFixed(4),
                    saleUnit: item.saleUnit ?? 'unit',
                })),
            );

            console.log(`[WEBHOOK] ✅ ${sellerItems.length} item(ns) inserido(s) para pedido ${newOrder.id}`);

            // ── Deduct stock atomically ──────────────────────────────
            for (const item of sellerItems) {
                await tx
                    .update(productLots)
                    .set({
                        availableQty: sql`GREATEST(0, ${productLots.availableQty} - ${item.qty.toString()}::numeric)`,
                    })
                    .where(eq(productLots.id, item.lotId));

                console.log(`[WEBHOOK] ✅ Estoque decrementado: lote ${item.lotId} (-${item.qty})`);
            }
        }
    });

    console.log(
        `[WEBHOOK] ✅ Transação completa para sessão ${session.id} | Comprador: ${buyerTenantId}`,
    );
}
