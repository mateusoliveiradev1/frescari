ALTER TABLE "tenants" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tenants" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenants_select_policy" ON "tenants"
    FOR SELECT
    USING (
        current_setting('app.bypass_rls', true) = 'on'
        OR "id" = nullif(current_setting('app.current_tenant', true), '')::uuid
        OR EXISTS (
            SELECT 1
            FROM "user"
            WHERE "user"."id" = nullif(current_setting('app.current_user', true), '')
              AND "user"."tenant_id" = "tenants"."id"
        )
        OR EXISTS (
            SELECT 1
            FROM "orders"
            WHERE (
                "orders"."buyer_tenant_id" = nullif(current_setting('app.current_tenant', true), '')::uuid
                AND "orders"."seller_tenant_id" = "tenants"."id"
            )
            OR (
                "orders"."seller_tenant_id" = nullif(current_setting('app.current_tenant', true), '')::uuid
                AND "orders"."buyer_tenant_id" = "tenants"."id"
            )
        )
    );--> statement-breakpoint
CREATE POLICY "tenants_insert_policy" ON "tenants"
    FOR INSERT
    WITH CHECK (current_setting('app.bypass_rls', true) = 'on');--> statement-breakpoint
CREATE POLICY "tenants_update_policy" ON "tenants"
    FOR UPDATE
    USING (
        current_setting('app.bypass_rls', true) = 'on'
        OR "id" = nullif(current_setting('app.current_tenant', true), '')::uuid
    )
    WITH CHECK (
        current_setting('app.bypass_rls', true) = 'on'
        OR "id" = nullif(current_setting('app.current_tenant', true), '')::uuid
    );--> statement-breakpoint
CREATE POLICY "tenants_delete_policy" ON "tenants"
    FOR DELETE
    USING (current_setting('app.bypass_rls', true) = 'on');--> statement-breakpoint

ALTER TABLE "user" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "users_select_policy" ON "user"
    FOR SELECT
    USING (
        current_setting('app.bypass_rls', true) = 'on'
        OR "id" = nullif(current_setting('app.current_user', true), '')
        OR "tenant_id" = nullif(current_setting('app.current_tenant', true), '')::uuid
    );--> statement-breakpoint
CREATE POLICY "users_insert_policy" ON "user"
    FOR INSERT
    WITH CHECK (current_setting('app.bypass_rls', true) = 'on');--> statement-breakpoint
CREATE POLICY "users_update_policy" ON "user"
    FOR UPDATE
    USING (
        current_setting('app.bypass_rls', true) = 'on'
        OR "id" = nullif(current_setting('app.current_user', true), '')
    )
    WITH CHECK (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
            "id" = nullif(current_setting('app.current_user', true), '')
            AND "tenant_id" = nullif(current_setting('app.current_tenant', true), '')::uuid
        )
    );--> statement-breakpoint
CREATE POLICY "users_delete_policy" ON "user"
    FOR DELETE
    USING (current_setting('app.bypass_rls', true) = 'on');--> statement-breakpoint

ALTER TABLE "session" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "session" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "session_bypass_policy" ON "session"
    FOR ALL
    USING (current_setting('app.bypass_rls', true) = 'on')
    WITH CHECK (current_setting('app.bypass_rls', true) = 'on');--> statement-breakpoint

ALTER TABLE "account" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "account" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "account_bypass_policy" ON "account"
    FOR ALL
    USING (current_setting('app.bypass_rls', true) = 'on')
    WITH CHECK (current_setting('app.bypass_rls', true) = 'on');--> statement-breakpoint

ALTER TABLE "verification" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "verification" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "verification_bypass_policy" ON "verification"
    FOR ALL
    USING (current_setting('app.bypass_rls', true) = 'on')
    WITH CHECK (current_setting('app.bypass_rls', true) = 'on');--> statement-breakpoint

ALTER TABLE "farms" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "farms" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "farms_select_policy" ON "farms"
    FOR SELECT
    USING (
        current_setting('app.bypass_rls', true) = 'on'
        OR current_setting('app.allow_catalog_public_read', true) = 'on'
        OR "tenant_id" = nullif(current_setting('app.current_tenant', true), '')::uuid
    );--> statement-breakpoint
CREATE POLICY "farms_insert_policy" ON "farms"
    FOR INSERT
    WITH CHECK (
        current_setting('app.bypass_rls', true) = 'on'
        OR "tenant_id" = nullif(current_setting('app.current_tenant', true), '')::uuid
    );--> statement-breakpoint
CREATE POLICY "farms_update_policy" ON "farms"
    FOR UPDATE
    USING (
        current_setting('app.bypass_rls', true) = 'on'
        OR "tenant_id" = nullif(current_setting('app.current_tenant', true), '')::uuid
    )
    WITH CHECK (
        current_setting('app.bypass_rls', true) = 'on'
        OR "tenant_id" = nullif(current_setting('app.current_tenant', true), '')::uuid
    );--> statement-breakpoint
CREATE POLICY "farms_delete_policy" ON "farms"
    FOR DELETE
    USING (
        current_setting('app.bypass_rls', true) = 'on'
        OR "tenant_id" = nullif(current_setting('app.current_tenant', true), '')::uuid
    );--> statement-breakpoint

ALTER TABLE "addresses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "addresses" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "addresses_select_policy" ON "addresses"
    FOR SELECT
    USING (
        current_setting('app.bypass_rls', true) = 'on'
        OR "tenant_id" = nullif(current_setting('app.current_tenant', true), '')::uuid
    );--> statement-breakpoint
CREATE POLICY "addresses_insert_policy" ON "addresses"
    FOR INSERT
    WITH CHECK (
        current_setting('app.bypass_rls', true) = 'on'
        OR "tenant_id" = nullif(current_setting('app.current_tenant', true), '')::uuid
    );--> statement-breakpoint
CREATE POLICY "addresses_update_policy" ON "addresses"
    FOR UPDATE
    USING (
        current_setting('app.bypass_rls', true) = 'on'
        OR "tenant_id" = nullif(current_setting('app.current_tenant', true), '')::uuid
    )
    WITH CHECK (
        current_setting('app.bypass_rls', true) = 'on'
        OR "tenant_id" = nullif(current_setting('app.current_tenant', true), '')::uuid
    );--> statement-breakpoint
CREATE POLICY "addresses_delete_policy" ON "addresses"
    FOR DELETE
    USING (
        current_setting('app.bypass_rls', true) = 'on'
        OR "tenant_id" = nullif(current_setting('app.current_tenant', true), '')::uuid
    );--> statement-breakpoint

ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "products" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "products_select_policy" ON "products"
    FOR SELECT
    USING (
        current_setting('app.bypass_rls', true) = 'on'
        OR current_setting('app.allow_catalog_public_read', true) = 'on'
        OR "tenant_id" = nullif(current_setting('app.current_tenant', true), '')::uuid
    );--> statement-breakpoint
CREATE POLICY "products_insert_policy" ON "products"
    FOR INSERT
    WITH CHECK (
        current_setting('app.bypass_rls', true) = 'on'
        OR "tenant_id" = nullif(current_setting('app.current_tenant', true), '')::uuid
    );--> statement-breakpoint
CREATE POLICY "products_update_policy" ON "products"
    FOR UPDATE
    USING (
        current_setting('app.bypass_rls', true) = 'on'
        OR "tenant_id" = nullif(current_setting('app.current_tenant', true), '')::uuid
    )
    WITH CHECK (
        current_setting('app.bypass_rls', true) = 'on'
        OR "tenant_id" = nullif(current_setting('app.current_tenant', true), '')::uuid
    );--> statement-breakpoint
CREATE POLICY "products_delete_policy" ON "products"
    FOR DELETE
    USING (
        current_setting('app.bypass_rls', true) = 'on'
        OR "tenant_id" = nullif(current_setting('app.current_tenant', true), '')::uuid
    );--> statement-breakpoint

ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "orders" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "orders_select_policy" ON "orders"
    FOR SELECT
    USING (
        current_setting('app.bypass_rls', true) = 'on'
        OR "buyer_tenant_id" = nullif(current_setting('app.current_tenant', true), '')::uuid
        OR "seller_tenant_id" = nullif(current_setting('app.current_tenant', true), '')::uuid
    );--> statement-breakpoint
CREATE POLICY "orders_insert_policy" ON "orders"
    FOR INSERT
    WITH CHECK (
        current_setting('app.bypass_rls', true) = 'on'
        OR "buyer_tenant_id" = nullif(current_setting('app.current_tenant', true), '')::uuid
        OR "seller_tenant_id" = nullif(current_setting('app.current_tenant', true), '')::uuid
    );--> statement-breakpoint
CREATE POLICY "orders_update_policy" ON "orders"
    FOR UPDATE
    USING (
        current_setting('app.bypass_rls', true) = 'on'
        OR "buyer_tenant_id" = nullif(current_setting('app.current_tenant', true), '')::uuid
        OR "seller_tenant_id" = nullif(current_setting('app.current_tenant', true), '')::uuid
    )
    WITH CHECK (
        current_setting('app.bypass_rls', true) = 'on'
        OR "buyer_tenant_id" = nullif(current_setting('app.current_tenant', true), '')::uuid
        OR "seller_tenant_id" = nullif(current_setting('app.current_tenant', true), '')::uuid
    );--> statement-breakpoint
CREATE POLICY "orders_delete_policy" ON "orders"
    FOR DELETE
    USING (current_setting('app.bypass_rls', true) = 'on');--> statement-breakpoint

ALTER TABLE "order_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "order_items" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "order_items_select_policy" ON "order_items"
    FOR SELECT
    USING (
        current_setting('app.bypass_rls', true) = 'on'
        OR EXISTS (
            SELECT 1
            FROM "orders"
            WHERE "orders"."id" = "order_items"."order_id"
              AND (
                "orders"."buyer_tenant_id" = nullif(current_setting('app.current_tenant', true), '')::uuid
                OR "orders"."seller_tenant_id" = nullif(current_setting('app.current_tenant', true), '')::uuid
              )
        )
    );--> statement-breakpoint
CREATE POLICY "order_items_insert_policy" ON "order_items"
    FOR INSERT
    WITH CHECK (
        current_setting('app.bypass_rls', true) = 'on'
        OR EXISTS (
            SELECT 1
            FROM "orders"
            WHERE "orders"."id" = "order_items"."order_id"
              AND (
                "orders"."buyer_tenant_id" = nullif(current_setting('app.current_tenant', true), '')::uuid
                OR "orders"."seller_tenant_id" = nullif(current_setting('app.current_tenant', true), '')::uuid
              )
        )
    );--> statement-breakpoint
CREATE POLICY "order_items_update_policy" ON "order_items"
    FOR UPDATE
    USING (
        current_setting('app.bypass_rls', true) = 'on'
        OR EXISTS (
            SELECT 1
            FROM "orders"
            WHERE "orders"."id" = "order_items"."order_id"
              AND (
                "orders"."buyer_tenant_id" = nullif(current_setting('app.current_tenant', true), '')::uuid
                OR "orders"."seller_tenant_id" = nullif(current_setting('app.current_tenant', true), '')::uuid
              )
        )
    )
    WITH CHECK (
        current_setting('app.bypass_rls', true) = 'on'
        OR EXISTS (
            SELECT 1
            FROM "orders"
            WHERE "orders"."id" = "order_items"."order_id"
              AND (
                "orders"."buyer_tenant_id" = nullif(current_setting('app.current_tenant', true), '')::uuid
                OR "orders"."seller_tenant_id" = nullif(current_setting('app.current_tenant', true), '')::uuid
              )
        )
    );--> statement-breakpoint
CREATE POLICY "order_items_delete_policy" ON "order_items"
    FOR DELETE
    USING (
        current_setting('app.bypass_rls', true) = 'on'
        OR EXISTS (
            SELECT 1
            FROM "orders"
            WHERE "orders"."id" = "order_items"."order_id"
              AND (
                "orders"."buyer_tenant_id" = nullif(current_setting('app.current_tenant', true), '')::uuid
                OR "orders"."seller_tenant_id" = nullif(current_setting('app.current_tenant', true), '')::uuid
              )
        )
    );
