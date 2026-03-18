import {
    pgTable,
    uuid,
    text,
    timestamp,
    integer,
    boolean,
    numeric,
    date,
    customType,
    jsonb,
    pgEnum,
    index,
    uniqueIndex
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export type FarmAddress = {
    street: string;
    number: string;
    neighborhood?: string;
    city: string;
    state: string;
    postalCode: string;
    country?: string;
    complement?: string;
};

// Keep the legacy geometry adapter for pre-existing flows outside farms.
const geometry = customType<{ data: any; driverData: string }>({
    dataType() {
        return 'geometry(Point, 4326)';
    },
    toDriver(value) {
        if (value && typeof value === 'object' && 'type' in value) {
            return sql`ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(value)}), 4326)`;
        }

        return value;
    },
    fromDriver(value) {
        return value;
    }
});

function parsePointHex(hex: string): [number, number] {
    const bytes = new Uint8Array(hex.match(/.{1,2}/g)?.map((byte) => Number.parseInt(byte, 16)) ?? []);
    const byteOrder = bytes[0];
    const view = new DataView(bytes.buffer);
    let offset = 1;

    const geometryType = view.getUint32(offset, byteOrder === 1);
    offset += 4;

    if (geometryType & 0x20000000) {
        offset += 4;
    }

    const longitude = view.getFloat64(offset, true);
    offset += 8;
    const latitude = view.getFloat64(offset, true);

    return [longitude, latitude];
}

const postgisPoint = customType<{ data: [number, number]; driverData: string }>({
    dataType() {
        return 'geometry(Point, 4326)';
    },
    toDriver(value) {
        return `SRID=4326;POINT(${value[0]} ${value[1]})`;
    },
    fromDriver(value) {
        return parsePointHex(value);
    }
});

export const planEnum = pgEnum('plan', ['free', 'pro', 'enterprise']);
export const roleEnum = pgEnum('role', ['producer', 'distributor', 'buyer', 'admin']);
export const saleUnitEnum = pgEnum('sale_unit', ['kg', 'g', 'unit', 'box', 'dozen', 'bunch']);
export const orderStatusEnum = pgEnum('order_status', ['draft', 'confirmed', 'payment_authorized', 'awaiting_weight', 'picking', 'ready_for_dispatch', 'in_transit', 'delivered', 'cancelled']);
export const tenantTypeEnum = pgEnum('tenant_type', ['PRODUCER', 'BUYER']);
export const pricingTypeEnum = pgEnum('pricing_type', ['UNIT', 'WEIGHT', 'BOX']);
export const fleetVehicleTypeEnum = pgEnum('fleet_vehicle_type', [
    'motorcycle',
    'car',
    'pickup',
    'van',
    'refrigerated_van',
    'truck',
    'refrigerated_truck',
]);
export const fleetVehicleStatusEnum = pgEnum('fleet_vehicle_status', [
    'available',
    'in_use',
    'maintenance',
    'offline',
]);
export const dispatchConfidenceEnum = pgEnum('dispatch_confidence', ['high', 'medium', 'low']);
export const dispatchOverrideActionEnum = pgEnum('dispatch_override_action', ['pin_to_top', 'delay']);
export const dispatchOverrideReasonEnum = pgEnum('dispatch_override_reason', [
    'customer_priority',
    'delivery_window',
    'vehicle_load',
    'address_issue',
    'awaiting_picking',
    'commercial_decision',
    'other',
]);
export const dispatchWaveStatusEnum = pgEnum('dispatch_wave_status', ['confirmed', 'departed', 'cancelled']);
export const notificationTypeEnum = pgEnum('notification_type', [
    'lot_expiring_soon',
    'lot_expired',
    'order_awaiting_weight',
    'order_confirmed',
    'order_cancelled',
    'order_ready_for_dispatch',
    'delivery_in_transit',
    'delivery_delayed',
    'delivery_delivered',
]);
export const notificationScopeEnum = pgEnum('notification_scope', [
    'inventory',
    'sales',
    'orders',
    'deliveries',
    'platform',
]);
export const notificationSeverityEnum = pgEnum('notification_severity', ['info', 'warning', 'critical']);
export const notificationEntityTypeEnum = pgEnum('notification_entity_type', ['lot', 'order']);

export type DispatchRecommendationSnapshot = {
    priorityScore: number;
    urgencyLevel: 'high' | 'medium' | 'low';
    riskLevel: 'high' | 'medium' | 'low';
    confidence: 'high' | 'medium' | 'low';
    suggestedVehicleType:
        | 'motorcycle'
        | 'car'
        | 'pickup'
        | 'van'
        | 'refrigerated_van'
        | 'truck'
        | 'refrigerated_truck';
    explanation: string;
    reasons: string[];
};

export const tenants = pgTable('tenants', {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').unique().notNull(),
    name: text('name').notNull(),
    type: tenantTypeEnum('type'),
    plan: planEnum('plan').notNull().default('free'),
    geoRegion: geometry('geo_region'),
    stripeAccountId: text('stripe_account_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const users = pgTable('user', {
    id: text('id').primaryKey(),
    tenantId: uuid('tenant_id').references(() => tenants.id), // Made nullable so it can be assigned post-registration if needed
    name: text('name').notNull(),
    email: text('email').unique().notNull(),
    emailVerified: boolean('emailVerified').notNull(),
    image: text('image'),
    createdAt: timestamp('createdAt').notNull(),
    updatedAt: timestamp('updatedAt').notNull(),
    role: roleEnum('role').default('buyer').notNull(),
});

export const session = pgTable("session", {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expiresAt").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("createdAt").notNull(),
    updatedAt: timestamp("updatedAt").notNull(),
    ipAddress: text("ipAddress"),
    userAgent: text("userAgent"),
    userId: text("userId").notNull().references(() => users.id)
});

export const account = pgTable("account", {
    id: text("id").primaryKey(),
    accountId: text("accountId").notNull(),
    providerId: text("providerId").notNull(),
    userId: text("userId").notNull().references(() => users.id),
    accessToken: text("accessToken"),
    refreshToken: text("refreshToken"),
    idToken: text("idToken"),
    accessTokenExpiresAt: timestamp("accessTokenExpiresAt"),
    refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("createdAt").notNull(),
    updatedAt: timestamp("updatedAt").notNull()
});

export const verification = pgTable("verification", {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expiresAt").notNull(),
    createdAt: timestamp("createdAt"),
    updatedAt: timestamp("updatedAt")
});

export const farms = pgTable('farms', {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').references(() => tenants.id).notNull(),
    name: text('name').notNull(),
    address: jsonb('address').$type<FarmAddress | null>(),
    location: postgisPoint('location'),
    certifications: text('certifications').array(),
    baseDeliveryFee: numeric('base_delivery_fee', { precision: 10, scale: 2 }).default('0').notNull(),
    pricePerKm: numeric('price_per_km', { precision: 10, scale: 2 }).default('0').notNull(),
    maxDeliveryRadiusKm: numeric('max_delivery_radius_km', { precision: 10, scale: 2 }).default('0').notNull(),
    minOrderValue: numeric('min_order_value', { precision: 10, scale: 2 }).default('0').notNull(),
    freeShippingThreshold: numeric('free_shipping_threshold', { precision: 10, scale: 2 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const addresses = pgTable('addresses', {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').references(() => tenants.id).notNull(),
    title: text('title').notNull(),
    zipcode: text('zipcode').notNull(),
    street: text('street').notNull(),
    number: text('number').notNull(),
    neighborhood: text('neighborhood'),
    city: text('city').notNull(),
    state: text('state').notNull(),
    country: text('country').default('BR').notNull(),
    complement: text('complement'),
    formattedAddress: text('formatted_address').notNull(),
    isDefault: boolean('is_default').default(false).notNull(),
    location: postgisPoint('location').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    index('addresses_tenant_idx').on(table.tenantId),
    uniqueIndex('addresses_one_default_per_tenant').on(table.tenantId).where(sql`${table.isDefault} = true`),
    index('addresses_location_gist').using('gist', table.location),
]);

export const productCategories = pgTable('product_categories', {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').unique().notNull(),
    name: text('name').notNull(),
    parentId: uuid('parent_id'),
    seoDescription: text('seo_description'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const masterProducts = pgTable('master_products', {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    category: text('category').notNull(),
    defaultImageUrl: text('default_image_url'),
    pricingType: pricingTypeEnum('pricing_type').default('UNIT').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const products = pgTable('products', {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').references(() => tenants.id).notNull(),
    farmId: uuid('farm_id').references(() => farms.id).notNull(),
    categoryId: uuid('category_id').references(() => productCategories.id).notNull(),
    masterProductId: uuid('master_product_id').references(() => masterProducts.id),
    sku: text('sku'),
    name: text('name').notNull(),
    saleUnit: saleUnitEnum('sale_unit').notNull(),
    unitWeightG: integer('unit_weight_g'), // Essential for physical weight to unit conversion
    pricePerUnit: numeric('price_per_unit', { precision: 12, scale: 4 }).notNull(),
    minOrderQty: numeric('min_order_qty', { precision: 10, scale: 3 }).notNull(),
    originLocation: geometry('origin_location'),
    images: text('images').array(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const productLots = pgTable('product_lots', {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').references(() => tenants.id).notNull(),
    productId: uuid('product_id').references(() => products.id).notNull(),
    lotCode: text('lot_code').notNull(),
    harvestDate: date('harvest_date').notNull(),
    expiryDate: date('expiry_date').notNull(),
    availableQty: numeric('available_qty', { precision: 12, scale: 3 }).notNull(),
    reservedQty: numeric('reserved_qty', { precision: 12, scale: 3 }).default('0').notNull(),
    priceOverride: numeric('price_override', { precision: 12, scale: 4 }),
    pricingType: pricingTypeEnum('pricing_type').default('UNIT').notNull(),
    estimatedWeight: numeric('estimated_weight', { precision: 10, scale: 3 }),
    freshnessScore: integer('freshness_score'), // 0 to 100
    storageLocation: text('storage_location'),
    unit: text('unit').default('un').notNull(),
    imageUrl: text('image_url'),
    isExpired: boolean('is_expired').default(false).notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    index('product_lots_tenant_idx').on(table.tenantId),
    index('product_lots_product_idx').on(table.productId),
    index('product_lots_deleted_idx').on(table.deletedAt),
]);

export const orders = pgTable('orders', {
    id: uuid('id').primaryKey().defaultRandom(),
    buyerTenantId: uuid('buyer_tenant_id').references(() => tenants.id).notNull(),
    sellerTenantId: uuid('seller_tenant_id').references(() => tenants.id).notNull(),
    status: orderStatusEnum('status').default('draft').notNull(),
    // Structured address fields
    deliveryStreet: text('delivery_street').notNull(),
    deliveryNumber: text('delivery_number').notNull(),
    deliveryCep: text('delivery_cep').notNull(),
    deliveryCity: text('delivery_city').notNull(),
    deliveryState: text('delivery_state').notNull(),
    // Legacy single-line field (kept for backward compat / display)
    deliveryAddress: text('delivery_address').notNull(),
    deliveryNotes: text('delivery_notes'),
    deliveryPoint: geometry('delivery_point'),
    deliveryWindowStart: timestamp('delivery_window_start', { withTimezone: true }),
    deliveryWindowEnd: timestamp('delivery_window_end', { withTimezone: true }),
    deliveryFee: numeric('delivery_fee', { precision: 10, scale: 2 }).default('0').notNull(),
    totalAmount: numeric('total_amount', { precision: 14, scale: 4 }).notNull(),
    stripeSessionId: text('stripe_session_id'),
    paymentIntentId: text('payment_intent_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    index('orders_buyer_idx').on(table.buyerTenantId),
    index('orders_seller_idx').on(table.sellerTenantId),
    uniqueIndex('orders_stripe_session_seller_unique')
        .on(table.stripeSessionId, table.sellerTenantId)
        .where(sql`${table.stripeSessionId} IS NOT NULL`),
]);

export const orderItems = pgTable('order_items', {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id').references(() => orders.id).notNull(),
    lotId: uuid('lot_id').references(() => productLots.id).notNull(),
    productId: uuid('product_id').references(() => products.id).notNull(),
    qty: numeric('qty', { precision: 12, scale: 3 }).notNull(),
    unitPrice: numeric('unit_price', { precision: 12, scale: 4 }).notNull(),
    saleUnit: text('sale_unit').default('unit').notNull(),
});

export const notifications = pgTable('notifications', {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').references(() => tenants.id).notNull(),
    userId: text('user_id').references(() => users.id).notNull(),
    recipientRole: roleEnum('recipient_role').notNull(),
    type: notificationTypeEnum('type').notNull(),
    scope: notificationScopeEnum('scope').notNull(),
    severity: notificationSeverityEnum('severity').default('info').notNull(),
    entityType: notificationEntityTypeEnum('entity_type').notNull(),
    entityId: uuid('entity_id').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    href: text('href').notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default(sql`'{}'::jsonb`).notNull(),
    dedupeKey: text('dedupe_key').notNull(),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    index('notifications_user_created_idx').on(table.userId, table.createdAt),
    index('notifications_user_unread_idx').on(table.userId, table.readAt, table.createdAt),
    index('notifications_tenant_role_created_idx').on(table.tenantId, table.recipientRole, table.createdAt),
    uniqueIndex('notifications_user_dedupe_unique').on(table.userId, table.dedupeKey),
]);

export const farmVehicles = pgTable('farm_vehicles', {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').references(() => tenants.id).notNull(),
    farmId: uuid('farm_id').references(() => farms.id).notNull(),
    label: text('label').notNull(),
    vehicleType: fleetVehicleTypeEnum('vehicle_type').notNull(),
    capacityKg: numeric('capacity_kg', { precision: 10, scale: 3 }).notNull(),
    refrigeration: boolean('refrigeration').default(false).notNull(),
    availabilityStatus: fleetVehicleStatusEnum('availability_status').default('available').notNull(),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    index('farm_vehicles_tenant_idx').on(table.tenantId),
    index('farm_vehicles_farm_idx').on(table.farmId),
    index('farm_vehicles_status_idx').on(table.availabilityStatus),
]);

export const deliveryDispatchOverrides = pgTable('delivery_dispatch_overrides', {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').references(() => tenants.id).notNull(),
    orderId: uuid('order_id').references(() => orders.id).notNull(),
    operationDate: date('operation_date').notNull(),
    action: dispatchOverrideActionEnum('action').notNull(),
    reason: dispatchOverrideReasonEnum('reason').notNull(),
    reasonNotes: text('reason_notes'),
    createdByUserId: text('created_by_user_id').references(() => users.id).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    clearedAt: timestamp('cleared_at', { withTimezone: true }),
}, (table) => [
    index('delivery_dispatch_overrides_tenant_idx').on(table.tenantId),
    index('delivery_dispatch_overrides_order_idx').on(table.orderId),
    uniqueIndex('delivery_dispatch_overrides_active_unique')
        .on(table.tenantId, table.orderId, table.operationDate)
        .where(sql`${table.clearedAt} IS NULL`),
]);

export const deliveryDispatchWaves = pgTable('delivery_dispatch_waves', {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').references(() => tenants.id).notNull(),
    farmId: uuid('farm_id').references(() => farms.id),
    operationDate: date('operation_date').notNull(),
    status: dispatchWaveStatusEnum('status').default('confirmed').notNull(),
    confidence: dispatchConfidenceEnum('confidence').notNull(),
    recommendedVehicleType: fleetVehicleTypeEnum('recommended_vehicle_type').notNull(),
    selectedVehicleId: uuid('selected_vehicle_id').references(() => farmVehicles.id),
    selectedVehicleLabel: text('selected_vehicle_label'),
    recommendationSummary: text('recommendation_summary').notNull(),
    recommendationSnapshot: jsonb('recommendation_snapshot').$type<DispatchRecommendationSnapshot | null>(),
    confirmedByUserId: text('confirmed_by_user_id').references(() => users.id).notNull(),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }).defaultNow().notNull(),
    departedAt: timestamp('departed_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
}, (table) => [
    index('delivery_dispatch_waves_tenant_idx').on(table.tenantId),
    index('delivery_dispatch_waves_farm_idx').on(table.farmId),
    index('delivery_dispatch_waves_operation_idx').on(table.operationDate),
]);

export const deliveryDispatchWaveOrders = pgTable('delivery_dispatch_wave_orders', {
    id: uuid('id').primaryKey().defaultRandom(),
    waveId: uuid('wave_id').references(() => deliveryDispatchWaves.id).notNull(),
    orderId: uuid('order_id').references(() => orders.id).notNull(),
    sequence: integer('sequence').notNull(),
    priorityScore: integer('priority_score').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    index('delivery_dispatch_wave_orders_wave_idx').on(table.waveId),
    index('delivery_dispatch_wave_orders_order_idx').on(table.orderId),
    uniqueIndex('delivery_dispatch_wave_orders_wave_order_unique').on(table.waveId, table.orderId),
]);

// Relations
import { relations } from 'drizzle-orm';

export const tenantsRelations = relations(tenants, ({ many }) => ({
    users: many(users),
    farms: many(farms),
    addresses: many(addresses),
    products: many(products),
    notifications: many(notifications),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
    tenant: one(tenants, {
        fields: [users.tenantId],
        references: [tenants.id],
    }),
    notifications: many(notifications),
}));

export const farmsRelations = relations(farms, ({ one, many }) => ({
    tenant: one(tenants, {
        fields: [farms.tenantId],
        references: [tenants.id],
    }),
    products: many(products),
    vehicles: many(farmVehicles),
    dispatchWaves: many(deliveryDispatchWaves),
}));

export const addressesRelations = relations(addresses, ({ one }) => ({
    tenant: one(tenants, {
        fields: [addresses.tenantId],
        references: [tenants.id],
    }),
}));

export const productCategoriesRelations = relations(productCategories, ({ many }) => ({
    products: many(products),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
    tenant: one(tenants, {
        fields: [products.tenantId],
        references: [tenants.id],
    }),
    farm: one(farms, {
        fields: [products.farmId],
        references: [farms.id],
    }),
    category: one(productCategories, {
        fields: [products.categoryId],
        references: [productCategories.id],
    }),
    lots: many(productLots),
}));

export const productLotsRelations = relations(productLots, ({ one }) => ({
    product: one(products, {
        fields: [productLots.productId],
        references: [products.id],
    }),
    tenant: one(tenants, {
        fields: [productLots.tenantId],
        references: [tenants.id],
    }),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
    order: one(orders, {
        fields: [orderItems.orderId],
        references: [orders.id],
    }),
    lot: one(productLots, {
        fields: [orderItems.lotId],
        references: [productLots.id],
    }),
    product: one(products, {
        fields: [orderItems.productId],
        references: [products.id],
    }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
    buyerTenant: one(tenants, {
        fields: [orders.buyerTenantId],
        references: [tenants.id],
        relationName: 'buyer_orders',
    }),
    sellerTenant: one(tenants, {
        fields: [orders.sellerTenantId],
        references: [tenants.id],
        relationName: 'seller_orders',
    }),
    items: many(orderItems),
    dispatchOverrides: many(deliveryDispatchOverrides),
    dispatchWaveOrders: many(deliveryDispatchWaveOrders),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
    tenant: one(tenants, {
        fields: [notifications.tenantId],
        references: [tenants.id],
    }),
    user: one(users, {
        fields: [notifications.userId],
        references: [users.id],
    }),
}));

export const farmVehiclesRelations = relations(farmVehicles, ({ one, many }) => ({
    tenant: one(tenants, {
        fields: [farmVehicles.tenantId],
        references: [tenants.id],
    }),
    farm: one(farms, {
        fields: [farmVehicles.farmId],
        references: [farms.id],
    }),
    dispatchWaves: many(deliveryDispatchWaves),
}));

export const deliveryDispatchOverridesRelations = relations(deliveryDispatchOverrides, ({ one }) => ({
    tenant: one(tenants, {
        fields: [deliveryDispatchOverrides.tenantId],
        references: [tenants.id],
    }),
    order: one(orders, {
        fields: [deliveryDispatchOverrides.orderId],
        references: [orders.id],
    }),
    createdByUser: one(users, {
        fields: [deliveryDispatchOverrides.createdByUserId],
        references: [users.id],
    }),
}));

export const deliveryDispatchWavesRelations = relations(deliveryDispatchWaves, ({ one, many }) => ({
    tenant: one(tenants, {
        fields: [deliveryDispatchWaves.tenantId],
        references: [tenants.id],
    }),
    farm: one(farms, {
        fields: [deliveryDispatchWaves.farmId],
        references: [farms.id],
    }),
    selectedVehicle: one(farmVehicles, {
        fields: [deliveryDispatchWaves.selectedVehicleId],
        references: [farmVehicles.id],
    }),
    confirmedByUser: one(users, {
        fields: [deliveryDispatchWaves.confirmedByUserId],
        references: [users.id],
    }),
    orders: many(deliveryDispatchWaveOrders),
}));

export const deliveryDispatchWaveOrdersRelations = relations(deliveryDispatchWaveOrders, ({ one }) => ({
    wave: one(deliveryDispatchWaves, {
        fields: [deliveryDispatchWaveOrders.waveId],
        references: [deliveryDispatchWaves.id],
    }),
    order: one(orders, {
        fields: [deliveryDispatchWaveOrders.orderId],
        references: [orders.id],
    }),
}));

