import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { db } from '@frescari/db';
import { orders, orderItems, productLots, products } from '@frescari/db';
import { eq, inArray } from 'drizzle-orm';

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
    if (!webhookSecret) {
        console.error('[WEBHOOK] STRIPE_WEBHOOK_SECRET is not configured.');
        return NextResponse.json(
            { error: 'Webhook secret not configured' },
            { status: 500 },
        );
    }

    const body = await req.text();
    const signature = req.headers.get('stripe-signature');

    if (!signature) {
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

    // ── Handle events ────────────────────────────────────────────────
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session;

        try {
            await handleCheckoutCompleted(session);
        } catch (error) {
            console.error('[WEBHOOK] Error processing checkout.session.completed:', error);
            // Return 200 to prevent Stripe from retrying on application errors
            // that would fail again (e.g. duplicate order). Log for manual review.
            return NextResponse.json({ received: true, error: 'Processing error logged' });
        }
    }

    return NextResponse.json({ received: true });
}

// ── Business logic ───────────────────────────────────────────────────
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
    const metadata = session.metadata;
    if (!metadata) {
        console.error('[WEBHOOK] Session has no metadata:', session.id);
        return;
    }

    const buyerTenantId = metadata.buyer_tenant_id;
    const itemsRaw = metadata.items;
    const addressRaw = metadata.address;
    const deliveryFee = parseFloat(metadata.delivery_fee ?? '0');

    if (!buyerTenantId || !itemsRaw || !addressRaw) {
        console.error('[WEBHOOK] Missing required metadata fields:', {
            buyerTenantId,
            hasItems: !!itemsRaw,
            hasAddress: !!addressRaw,
        });
        return;
    }

    // Parse metadata
    const parsedItems: MetadataItem[] = JSON.parse(itemsRaw);
    const parsedAddress: MetadataAddress = JSON.parse(addressRaw);

    if (parsedItems.length === 0) {
        console.error('[WEBHOOK] No items in metadata for session:', session.id);
        return;
    }

    // Fetch lot data from DB for seller tenant IDs and product IDs
    const lotIds = parsedItems.map((i) => i.lotId);
    const fetchedLots = await db
        .select({
            lotId: productLots.id,
            productId: products.id,
            sellerTenantId: productLots.tenantId,
        })
        .from(productLots)
        .innerJoin(products, eq(productLots.productId, products.id))
        .where(inArray(productLots.id, lotIds));

    if (fetchedLots.length === 0) {
        console.error('[WEBHOOK] No lots found for IDs:', lotIds);
        return;
    }

    // Compose a single-line address for legacy display
    const composedAddress = `${parsedAddress.street}, ${parsedAddress.number} - ${parsedAddress.city}/${parsedAddress.state} - CEP: ${parsedAddress.cep}`;

    // Group items by seller
    const itemsWithLotData = parsedItems.map((item) => {
        const lotData = fetchedLots.find((l) => l.lotId === item.lotId);
        return {
            ...item,
            productId: lotData?.productId ?? '',
            sellerTenantId: lotData?.sellerTenantId ?? '',
        };
    });

    const ordersBySeller = itemsWithLotData.reduce(
        (acc, item) => {
            if (!item.sellerTenantId) return acc;
            if (!acc[item.sellerTenantId]) acc[item.sellerTenantId] = [];
            acc[item.sellerTenantId]!.push(item);
            return acc;
        },
        {} as Record<string, typeof itemsWithLotData>,
    );

    // Create orders per seller inside a transaction
    await db.transaction(async (tx) => {
        for (const sellerId of Object.keys(ordersBySeller)) {
            const items = ordersBySeller[sellerId]!;
            const itemsTotal = items.reduce(
                (sum, item) => sum + item.price * item.qty,
                0,
            );
            const orderTotal = itemsTotal + deliveryFee;

            // Create the Order with awaiting_weight status
            const [newOrder] = await tx
                .insert(orders)
                .values({
                    buyerTenantId,
                    sellerTenantId: sellerId,
                    status: 'awaiting_weight',
                    deliveryStreet: parsedAddress.street,
                    deliveryNumber: parsedAddress.number,
                    deliveryCep: parsedAddress.cep,
                    deliveryCity: parsedAddress.city,
                    deliveryState: parsedAddress.state.toUpperCase(),
                    deliveryAddress: composedAddress,
                    deliveryFee: deliveryFee.toFixed(2),
                    totalAmount: orderTotal.toFixed(4),
                })
                .returning();

            // Create Order Items
            await tx.insert(orderItems).values(
                items.map((i) => ({
                    orderId: newOrder!.id,
                    lotId: i.lotId,
                    productId: i.productId,
                    qty: i.qty.toString(),
                    unitPrice: i.price.toFixed(4),
                })),
            );

            // Deduct stock
            for (const item of items) {
                await tx
                    .update(productLots)
                    .set({
                        availableQty: `${Math.max(0, Number((await tx.select({ qty: productLots.availableQty }).from(productLots).where(eq(productLots.id, item.lotId)).then(r => r[0]?.qty ?? '0'))) - item.qty)}`,
                    })
                    .where(eq(productLots.id, item.lotId));
            }
        }
    });

    console.log(
        `[WEBHOOK] ✅ Orders created for session ${session.id} | Buyer: ${buyerTenantId}`,
    );
}
