DO $$
BEGIN
    IF to_regclass('"public"."user"') IS NOT NULL THEN
        EXECUTE 'ALTER TABLE "user" NO FORCE ROW LEVEL SECURITY';
        EXECUTE 'ALTER TABLE "user" DISABLE ROW LEVEL SECURITY';
        EXECUTE 'DROP POLICY IF EXISTS "users_select_policy" ON "user"';
        EXECUTE 'DROP POLICY IF EXISTS "users_insert_policy" ON "user"';
        EXECUTE 'DROP POLICY IF EXISTS "users_update_policy" ON "user"';
        EXECUTE 'DROP POLICY IF EXISTS "users_delete_policy" ON "user"';
    END IF;

    IF to_regclass('"public"."session"') IS NOT NULL THEN
        EXECUTE 'ALTER TABLE "session" NO FORCE ROW LEVEL SECURITY';
        EXECUTE 'ALTER TABLE "session" DISABLE ROW LEVEL SECURITY';
        EXECUTE 'DROP POLICY IF EXISTS "session_bypass_policy" ON "session"';
    END IF;

    IF to_regclass('"public"."account"') IS NOT NULL THEN
        EXECUTE 'ALTER TABLE "account" NO FORCE ROW LEVEL SECURITY';
        EXECUTE 'ALTER TABLE "account" DISABLE ROW LEVEL SECURITY';
        EXECUTE 'DROP POLICY IF EXISTS "account_bypass_policy" ON "account"';
    END IF;

    IF to_regclass('"public"."verification"') IS NOT NULL THEN
        EXECUTE 'ALTER TABLE "verification" NO FORCE ROW LEVEL SECURITY';
        EXECUTE 'ALTER TABLE "verification" DISABLE ROW LEVEL SECURITY';
        EXECUTE 'DROP POLICY IF EXISTS "verification_bypass_policy" ON "verification"';
    END IF;
END
$$;
--> statement-breakpoint

DO $$
BEGIN
    IF to_regclass('"public"."tenants"') IS NOT NULL THEN
        EXECUTE 'ALTER TABLE "tenants" ENABLE ROW LEVEL SECURITY';
        EXECUTE 'ALTER TABLE "tenants" FORCE ROW LEVEL SECURITY';
        EXECUTE 'DROP POLICY IF EXISTS "tenants_select_policy" ON "tenants"';
        EXECUTE 'DROP POLICY IF EXISTS "tenants_insert_policy" ON "tenants"';
        EXECUTE 'DROP POLICY IF EXISTS "tenants_update_policy" ON "tenants"';
        EXECUTE 'DROP POLICY IF EXISTS "tenants_delete_policy" ON "tenants"';

        EXECUTE $policy$
            CREATE POLICY "tenants_select_policy" ON "tenants"
                FOR SELECT
                USING (
                    current_setting('app.bypass_rls', true) = 'on'
                    OR current_setting('app.allow_catalog_public_read', true) = 'on'
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
                )
        $policy$;

        EXECUTE $policy$
            CREATE POLICY "tenants_insert_policy" ON "tenants"
                FOR INSERT
                WITH CHECK (current_setting('app.bypass_rls', true) = 'on')
        $policy$;

        EXECUTE $policy$
            CREATE POLICY "tenants_update_policy" ON "tenants"
                FOR UPDATE
                USING (
                    current_setting('app.bypass_rls', true) = 'on'
                    OR "id" = nullif(current_setting('app.current_tenant', true), '')::uuid
                )
                WITH CHECK (
                    current_setting('app.bypass_rls', true) = 'on'
                    OR "id" = nullif(current_setting('app.current_tenant', true), '')::uuid
                )
        $policy$;

        EXECUTE $policy$
            CREATE POLICY "tenants_delete_policy" ON "tenants"
                FOR DELETE
                USING (current_setting('app.bypass_rls', true) = 'on')
        $policy$;
    END IF;
END
$$;
--> statement-breakpoint

DO $$
BEGIN
    IF to_regclass('"public"."farms"') IS NOT NULL THEN
        EXECUTE 'ALTER TABLE "farms" ENABLE ROW LEVEL SECURITY';
        EXECUTE 'ALTER TABLE "farms" FORCE ROW LEVEL SECURITY';
        EXECUTE 'DROP POLICY IF EXISTS "farms_select_policy" ON "farms"';
        EXECUTE 'DROP POLICY IF EXISTS "farms_insert_policy" ON "farms"';
        EXECUTE 'DROP POLICY IF EXISTS "farms_update_policy" ON "farms"';
        EXECUTE 'DROP POLICY IF EXISTS "farms_delete_policy" ON "farms"';

        EXECUTE $policy$
            CREATE POLICY "farms_select_policy" ON "farms"
                FOR SELECT
                USING (
                    current_setting('app.bypass_rls', true) = 'on'
                    OR current_setting('app.allow_catalog_public_read', true) = 'on'
                    OR "tenant_id" = nullif(current_setting('app.current_tenant', true), '')::uuid
                )
        $policy$;

        EXECUTE $policy$
            CREATE POLICY "farms_insert_policy" ON "farms"
                FOR INSERT
                WITH CHECK (
                    current_setting('app.bypass_rls', true) = 'on'
                    OR "tenant_id" = nullif(current_setting('app.current_tenant', true), '')::uuid
                )
        $policy$;

        EXECUTE $policy$
            CREATE POLICY "farms_update_policy" ON "farms"
                FOR UPDATE
                USING (
                    current_setting('app.bypass_rls', true) = 'on'
                    OR "tenant_id" = nullif(current_setting('app.current_tenant', true), '')::uuid
                )
                WITH CHECK (
                    current_setting('app.bypass_rls', true) = 'on'
                    OR "tenant_id" = nullif(current_setting('app.current_tenant', true), '')::uuid
                )
        $policy$;

        EXECUTE $policy$
            CREATE POLICY "farms_delete_policy" ON "farms"
                FOR DELETE
                USING (
                    current_setting('app.bypass_rls', true) = 'on'
                    OR "tenant_id" = nullif(current_setting('app.current_tenant', true), '')::uuid
                )
        $policy$;
    END IF;
END
$$;
--> statement-breakpoint

DO $$
BEGIN
    IF to_regclass('"public"."addresses"') IS NOT NULL THEN
        EXECUTE 'ALTER TABLE "addresses" ENABLE ROW LEVEL SECURITY';
        EXECUTE 'ALTER TABLE "addresses" FORCE ROW LEVEL SECURITY';
        EXECUTE 'DROP POLICY IF EXISTS "addresses_select_policy" ON "addresses"';
        EXECUTE 'DROP POLICY IF EXISTS "addresses_insert_policy" ON "addresses"';
        EXECUTE 'DROP POLICY IF EXISTS "addresses_update_policy" ON "addresses"';
        EXECUTE 'DROP POLICY IF EXISTS "addresses_delete_policy" ON "addresses"';

        EXECUTE $policy$
            CREATE POLICY "addresses_select_policy" ON "addresses"
                FOR SELECT
                USING (
                    current_setting('app.bypass_rls', true) = 'on'
                    OR "tenant_id" = nullif(current_setting('app.current_tenant', true), '')::uuid
                )
        $policy$;

        EXECUTE $policy$
            CREATE POLICY "addresses_insert_policy" ON "addresses"
                FOR INSERT
                WITH CHECK (
                    current_setting('app.bypass_rls', true) = 'on'
                    OR "tenant_id" = nullif(current_setting('app.current_tenant', true), '')::uuid
                )
        $policy$;

        EXECUTE $policy$
            CREATE POLICY "addresses_update_policy" ON "addresses"
                FOR UPDATE
                USING (
                    current_setting('app.bypass_rls', true) = 'on'
                    OR "tenant_id" = nullif(current_setting('app.current_tenant', true), '')::uuid
                )
                WITH CHECK (
                    current_setting('app.bypass_rls', true) = 'on'
                    OR "tenant_id" = nullif(current_setting('app.current_tenant', true), '')::uuid
                )
        $policy$;

        EXECUTE $policy$
            CREATE POLICY "addresses_delete_policy" ON "addresses"
                FOR DELETE
                USING (
                    current_setting('app.bypass_rls', true) = 'on'
                    OR "tenant_id" = nullif(current_setting('app.current_tenant', true), '')::uuid
                )
        $policy$;
    END IF;
END
$$;
--> statement-breakpoint

DO $$
BEGIN
    IF to_regclass('"public"."products"') IS NOT NULL THEN
        EXECUTE 'ALTER TABLE "products" ENABLE ROW LEVEL SECURITY';
        EXECUTE 'ALTER TABLE "products" FORCE ROW LEVEL SECURITY';
        EXECUTE 'DROP POLICY IF EXISTS "products_select_policy" ON "products"';
        EXECUTE 'DROP POLICY IF EXISTS "products_insert_policy" ON "products"';
        EXECUTE 'DROP POLICY IF EXISTS "products_update_policy" ON "products"';
        EXECUTE 'DROP POLICY IF EXISTS "products_delete_policy" ON "products"';

        EXECUTE $policy$
            CREATE POLICY "products_select_policy" ON "products"
                FOR SELECT
                USING (
                    current_setting('app.bypass_rls', true) = 'on'
                    OR current_setting('app.allow_catalog_public_read', true) = 'on'
                    OR "tenant_id" = nullif(current_setting('app.current_tenant', true), '')::uuid
                )
        $policy$;

        EXECUTE $policy$
            CREATE POLICY "products_insert_policy" ON "products"
                FOR INSERT
                WITH CHECK (
                    current_setting('app.bypass_rls', true) = 'on'
                    OR "tenant_id" = nullif(current_setting('app.current_tenant', true), '')::uuid
                )
        $policy$;

        EXECUTE $policy$
            CREATE POLICY "products_update_policy" ON "products"
                FOR UPDATE
                USING (
                    current_setting('app.bypass_rls', true) = 'on'
                    OR "tenant_id" = nullif(current_setting('app.current_tenant', true), '')::uuid
                )
                WITH CHECK (
                    current_setting('app.bypass_rls', true) = 'on'
                    OR "tenant_id" = nullif(current_setting('app.current_tenant', true), '')::uuid
                )
        $policy$;

        EXECUTE $policy$
            CREATE POLICY "products_delete_policy" ON "products"
                FOR DELETE
                USING (
                    current_setting('app.bypass_rls', true) = 'on'
                    OR "tenant_id" = nullif(current_setting('app.current_tenant', true), '')::uuid
                )
        $policy$;
    END IF;
END
$$;
--> statement-breakpoint

DO $$
BEGIN
    IF to_regclass('"public"."product_lots"') IS NOT NULL THEN
        EXECUTE 'ALTER TABLE "product_lots" ENABLE ROW LEVEL SECURITY';
        EXECUTE 'ALTER TABLE "product_lots" FORCE ROW LEVEL SECURITY';
        EXECUTE 'DROP POLICY IF EXISTS "product_lots_select_policy" ON "product_lots"';
        EXECUTE 'DROP POLICY IF EXISTS "product_lots_insert_policy" ON "product_lots"';
        EXECUTE 'DROP POLICY IF EXISTS "product_lots_update_policy" ON "product_lots"';
        EXECUTE 'DROP POLICY IF EXISTS "product_lots_delete_policy" ON "product_lots"';

        EXECUTE $policy$
            CREATE POLICY "product_lots_select_policy" ON "product_lots"
                FOR SELECT
                USING (
                    current_setting('app.bypass_rls', true) = 'on'
                    OR current_setting('app.allow_product_lot_public_read', true) = 'on'
                    OR "tenant_id" = nullif(current_setting('app.current_tenant', true), '')::uuid
                )
        $policy$;

        EXECUTE $policy$
            CREATE POLICY "product_lots_insert_policy" ON "product_lots"
                FOR INSERT
                WITH CHECK (
                    current_setting('app.bypass_rls', true) = 'on'
                    OR "tenant_id" = nullif(current_setting('app.current_tenant', true), '')::uuid
                )
        $policy$;

        EXECUTE $policy$
            CREATE POLICY "product_lots_update_policy" ON "product_lots"
                FOR UPDATE
                USING (
                    current_setting('app.bypass_rls', true) = 'on'
                    OR "tenant_id" = nullif(current_setting('app.current_tenant', true), '')::uuid
                )
                WITH CHECK (
                    current_setting('app.bypass_rls', true) = 'on'
                    OR "tenant_id" = nullif(current_setting('app.current_tenant', true), '')::uuid
                )
        $policy$;

        EXECUTE $policy$
            CREATE POLICY "product_lots_delete_policy" ON "product_lots"
                FOR DELETE
                USING (
                    current_setting('app.bypass_rls', true) = 'on'
                    OR "tenant_id" = nullif(current_setting('app.current_tenant', true), '')::uuid
                )
        $policy$;
    END IF;
END
$$;
--> statement-breakpoint

DO $$
BEGIN
    IF to_regclass('"public"."orders"') IS NOT NULL THEN
        EXECUTE 'ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY';
        EXECUTE 'ALTER TABLE "orders" FORCE ROW LEVEL SECURITY';
        EXECUTE 'DROP POLICY IF EXISTS "orders_select_policy" ON "orders"';
        EXECUTE 'DROP POLICY IF EXISTS "orders_insert_policy" ON "orders"';
        EXECUTE 'DROP POLICY IF EXISTS "orders_update_policy" ON "orders"';
        EXECUTE 'DROP POLICY IF EXISTS "orders_delete_policy" ON "orders"';

        EXECUTE $policy$
            CREATE POLICY "orders_select_policy" ON "orders"
                FOR SELECT
                USING (
                    current_setting('app.bypass_rls', true) = 'on'
                    OR "buyer_tenant_id" = nullif(current_setting('app.current_tenant', true), '')::uuid
                    OR "seller_tenant_id" = nullif(current_setting('app.current_tenant', true), '')::uuid
                )
        $policy$;

        EXECUTE $policy$
            CREATE POLICY "orders_insert_policy" ON "orders"
                FOR INSERT
                WITH CHECK (
                    current_setting('app.bypass_rls', true) = 'on'
                    OR "buyer_tenant_id" = nullif(current_setting('app.current_tenant', true), '')::uuid
                    OR "seller_tenant_id" = nullif(current_setting('app.current_tenant', true), '')::uuid
                )
        $policy$;

        EXECUTE $policy$
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
                )
        $policy$;

        EXECUTE $policy$
            CREATE POLICY "orders_delete_policy" ON "orders"
                FOR DELETE
                USING (
                    current_setting('app.bypass_rls', true) = 'on'
                    OR "buyer_tenant_id" = nullif(current_setting('app.current_tenant', true), '')::uuid
                    OR "seller_tenant_id" = nullif(current_setting('app.current_tenant', true), '')::uuid
                )
        $policy$;
    END IF;
END
$$;
--> statement-breakpoint

DO $$
BEGIN
    IF to_regclass('"public"."order_items"') IS NOT NULL THEN
        EXECUTE 'ALTER TABLE "order_items" ENABLE ROW LEVEL SECURITY';
        EXECUTE 'ALTER TABLE "order_items" FORCE ROW LEVEL SECURITY';
        EXECUTE 'DROP POLICY IF EXISTS "order_items_select_policy" ON "order_items"';
        EXECUTE 'DROP POLICY IF EXISTS "order_items_insert_policy" ON "order_items"';
        EXECUTE 'DROP POLICY IF EXISTS "order_items_update_policy" ON "order_items"';
        EXECUTE 'DROP POLICY IF EXISTS "order_items_delete_policy" ON "order_items"';

        EXECUTE $policy$
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
                )
        $policy$;

        EXECUTE $policy$
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
                )
        $policy$;

        EXECUTE $policy$
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
                )
        $policy$;

        EXECUTE $policy$
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
                )
        $policy$;
    END IF;
END
$$;
--> statement-breakpoint

DO $$
BEGIN
    IF to_regclass('"public"."notifications"') IS NOT NULL THEN
        EXECUTE 'ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY';
        EXECUTE 'ALTER TABLE "notifications" FORCE ROW LEVEL SECURITY';
        EXECUTE 'DROP POLICY IF EXISTS "notifications_select_policy" ON "notifications"';
        EXECUTE 'DROP POLICY IF EXISTS "notifications_insert_policy" ON "notifications"';
        EXECUTE 'DROP POLICY IF EXISTS "notifications_update_policy" ON "notifications"';
        EXECUTE 'DROP POLICY IF EXISTS "notifications_delete_policy" ON "notifications"';

        EXECUTE $policy$
            CREATE POLICY "notifications_select_policy" ON "notifications"
                FOR SELECT
                USING (
                    current_setting('app.bypass_rls', true) = 'on'
                    OR "user_id" = nullif(current_setting('app.current_user', true), '')
                    OR "tenant_id" = nullif(current_setting('app.current_tenant', true), '')::uuid
                )
        $policy$;

        EXECUTE $policy$
            CREATE POLICY "notifications_insert_policy" ON "notifications"
                FOR INSERT
                WITH CHECK (
                    current_setting('app.bypass_rls', true) = 'on'
                    OR "tenant_id" = nullif(current_setting('app.current_tenant', true), '')::uuid
                )
        $policy$;

        EXECUTE $policy$
            CREATE POLICY "notifications_update_policy" ON "notifications"
                FOR UPDATE
                USING (
                    current_setting('app.bypass_rls', true) = 'on'
                    OR "user_id" = nullif(current_setting('app.current_user', true), '')
                )
                WITH CHECK (
                    current_setting('app.bypass_rls', true) = 'on'
                    OR (
                        "user_id" = nullif(current_setting('app.current_user', true), '')
                        AND "tenant_id" = nullif(current_setting('app.current_tenant', true), '')::uuid
                    )
                )
        $policy$;

        EXECUTE $policy$
            CREATE POLICY "notifications_delete_policy" ON "notifications"
                FOR DELETE
                USING (
                    current_setting('app.bypass_rls', true) = 'on'
                    OR "tenant_id" = nullif(current_setting('app.current_tenant', true), '')::uuid
                )
        $policy$;
    END IF;
END
$$;
--> statement-breakpoint

DO $$
BEGIN
    IF to_regclass('"public"."farm_vehicles"') IS NOT NULL THEN
        EXECUTE 'ALTER TABLE "farm_vehicles" ENABLE ROW LEVEL SECURITY';
        EXECUTE 'ALTER TABLE "farm_vehicles" FORCE ROW LEVEL SECURITY';
        EXECUTE 'DROP POLICY IF EXISTS "farm_vehicles_select_policy" ON "farm_vehicles"';
        EXECUTE 'DROP POLICY IF EXISTS "farm_vehicles_insert_policy" ON "farm_vehicles"';
        EXECUTE 'DROP POLICY IF EXISTS "farm_vehicles_update_policy" ON "farm_vehicles"';
        EXECUTE 'DROP POLICY IF EXISTS "farm_vehicles_delete_policy" ON "farm_vehicles"';

        EXECUTE $policy$
            CREATE POLICY "farm_vehicles_select_policy" ON "farm_vehicles"
                FOR SELECT
                USING (
                    current_setting('app.bypass_rls', true) = 'on'
                    OR "tenant_id" = nullif(current_setting('app.current_tenant', true), '')::uuid
                )
        $policy$;

        EXECUTE $policy$
            CREATE POLICY "farm_vehicles_insert_policy" ON "farm_vehicles"
                FOR INSERT
                WITH CHECK (
                    current_setting('app.bypass_rls', true) = 'on'
                    OR "tenant_id" = nullif(current_setting('app.current_tenant', true), '')::uuid
                )
        $policy$;

        EXECUTE $policy$
            CREATE POLICY "farm_vehicles_update_policy" ON "farm_vehicles"
                FOR UPDATE
                USING (
                    current_setting('app.bypass_rls', true) = 'on'
                    OR "tenant_id" = nullif(current_setting('app.current_tenant', true), '')::uuid
                )
                WITH CHECK (
                    current_setting('app.bypass_rls', true) = 'on'
                    OR "tenant_id" = nullif(current_setting('app.current_tenant', true), '')::uuid
                )
        $policy$;

        EXECUTE $policy$
            CREATE POLICY "farm_vehicles_delete_policy" ON "farm_vehicles"
                FOR DELETE
                USING (
                    current_setting('app.bypass_rls', true) = 'on'
                    OR "tenant_id" = nullif(current_setting('app.current_tenant', true), '')::uuid
                )
        $policy$;
    END IF;
END
$$;
--> statement-breakpoint

DO $$
BEGIN
    IF to_regclass('"public"."delivery_dispatch_overrides"') IS NOT NULL THEN
        EXECUTE 'ALTER TABLE "delivery_dispatch_overrides" ENABLE ROW LEVEL SECURITY';
        EXECUTE 'ALTER TABLE "delivery_dispatch_overrides" FORCE ROW LEVEL SECURITY';
        EXECUTE 'DROP POLICY IF EXISTS "delivery_dispatch_overrides_select_policy" ON "delivery_dispatch_overrides"';
        EXECUTE 'DROP POLICY IF EXISTS "delivery_dispatch_overrides_insert_policy" ON "delivery_dispatch_overrides"';
        EXECUTE 'DROP POLICY IF EXISTS "delivery_dispatch_overrides_update_policy" ON "delivery_dispatch_overrides"';
        EXECUTE 'DROP POLICY IF EXISTS "delivery_dispatch_overrides_delete_policy" ON "delivery_dispatch_overrides"';

        EXECUTE $policy$
            CREATE POLICY "delivery_dispatch_overrides_select_policy" ON "delivery_dispatch_overrides"
                FOR SELECT
                USING (
                    current_setting('app.bypass_rls', true) = 'on'
                    OR "tenant_id" = nullif(current_setting('app.current_tenant', true), '')::uuid
                )
        $policy$;

        EXECUTE $policy$
            CREATE POLICY "delivery_dispatch_overrides_insert_policy" ON "delivery_dispatch_overrides"
                FOR INSERT
                WITH CHECK (
                    current_setting('app.bypass_rls', true) = 'on'
                    OR "tenant_id" = nullif(current_setting('app.current_tenant', true), '')::uuid
                )
        $policy$;

        EXECUTE $policy$
            CREATE POLICY "delivery_dispatch_overrides_update_policy" ON "delivery_dispatch_overrides"
                FOR UPDATE
                USING (
                    current_setting('app.bypass_rls', true) = 'on'
                    OR "tenant_id" = nullif(current_setting('app.current_tenant', true), '')::uuid
                )
                WITH CHECK (
                    current_setting('app.bypass_rls', true) = 'on'
                    OR "tenant_id" = nullif(current_setting('app.current_tenant', true), '')::uuid
                )
        $policy$;

        EXECUTE $policy$
            CREATE POLICY "delivery_dispatch_overrides_delete_policy" ON "delivery_dispatch_overrides"
                FOR DELETE
                USING (
                    current_setting('app.bypass_rls', true) = 'on'
                    OR "tenant_id" = nullif(current_setting('app.current_tenant', true), '')::uuid
                )
        $policy$;
    END IF;
END
$$;
--> statement-breakpoint

DO $$
BEGIN
    IF to_regclass('"public"."delivery_dispatch_waves"') IS NOT NULL THEN
        EXECUTE 'ALTER TABLE "delivery_dispatch_waves" ENABLE ROW LEVEL SECURITY';
        EXECUTE 'ALTER TABLE "delivery_dispatch_waves" FORCE ROW LEVEL SECURITY';
        EXECUTE 'DROP POLICY IF EXISTS "delivery_dispatch_waves_select_policy" ON "delivery_dispatch_waves"';
        EXECUTE 'DROP POLICY IF EXISTS "delivery_dispatch_waves_insert_policy" ON "delivery_dispatch_waves"';
        EXECUTE 'DROP POLICY IF EXISTS "delivery_dispatch_waves_update_policy" ON "delivery_dispatch_waves"';
        EXECUTE 'DROP POLICY IF EXISTS "delivery_dispatch_waves_delete_policy" ON "delivery_dispatch_waves"';

        EXECUTE $policy$
            CREATE POLICY "delivery_dispatch_waves_select_policy" ON "delivery_dispatch_waves"
                FOR SELECT
                USING (
                    current_setting('app.bypass_rls', true) = 'on'
                    OR "tenant_id" = nullif(current_setting('app.current_tenant', true), '')::uuid
                )
        $policy$;

        EXECUTE $policy$
            CREATE POLICY "delivery_dispatch_waves_insert_policy" ON "delivery_dispatch_waves"
                FOR INSERT
                WITH CHECK (
                    current_setting('app.bypass_rls', true) = 'on'
                    OR "tenant_id" = nullif(current_setting('app.current_tenant', true), '')::uuid
                )
        $policy$;

        EXECUTE $policy$
            CREATE POLICY "delivery_dispatch_waves_update_policy" ON "delivery_dispatch_waves"
                FOR UPDATE
                USING (
                    current_setting('app.bypass_rls', true) = 'on'
                    OR "tenant_id" = nullif(current_setting('app.current_tenant', true), '')::uuid
                )
                WITH CHECK (
                    current_setting('app.bypass_rls', true) = 'on'
                    OR "tenant_id" = nullif(current_setting('app.current_tenant', true), '')::uuid
                )
        $policy$;

        EXECUTE $policy$
            CREATE POLICY "delivery_dispatch_waves_delete_policy" ON "delivery_dispatch_waves"
                FOR DELETE
                USING (
                    current_setting('app.bypass_rls', true) = 'on'
                    OR "tenant_id" = nullif(current_setting('app.current_tenant', true), '')::uuid
                )
        $policy$;
    END IF;
END
$$;
--> statement-breakpoint

DO $$
BEGIN
    IF to_regclass('"public"."delivery_dispatch_wave_orders"') IS NOT NULL THEN
        EXECUTE 'ALTER TABLE "delivery_dispatch_wave_orders" ENABLE ROW LEVEL SECURITY';
        EXECUTE 'ALTER TABLE "delivery_dispatch_wave_orders" FORCE ROW LEVEL SECURITY';
        EXECUTE 'DROP POLICY IF EXISTS "delivery_dispatch_wave_orders_select_policy" ON "delivery_dispatch_wave_orders"';
        EXECUTE 'DROP POLICY IF EXISTS "delivery_dispatch_wave_orders_insert_policy" ON "delivery_dispatch_wave_orders"';
        EXECUTE 'DROP POLICY IF EXISTS "delivery_dispatch_wave_orders_update_policy" ON "delivery_dispatch_wave_orders"';
        EXECUTE 'DROP POLICY IF EXISTS "delivery_dispatch_wave_orders_delete_policy" ON "delivery_dispatch_wave_orders"';

        EXECUTE $policy$
            CREATE POLICY "delivery_dispatch_wave_orders_select_policy" ON "delivery_dispatch_wave_orders"
                FOR SELECT
                USING (
                    current_setting('app.bypass_rls', true) = 'on'
                    OR EXISTS (
                        SELECT 1
                        FROM "delivery_dispatch_waves"
                        WHERE "delivery_dispatch_waves"."id" = "delivery_dispatch_wave_orders"."wave_id"
                          AND "delivery_dispatch_waves"."tenant_id" = nullif(current_setting('app.current_tenant', true), '')::uuid
                    )
                )
        $policy$;

        EXECUTE $policy$
            CREATE POLICY "delivery_dispatch_wave_orders_insert_policy" ON "delivery_dispatch_wave_orders"
                FOR INSERT
                WITH CHECK (
                    current_setting('app.bypass_rls', true) = 'on'
                    OR EXISTS (
                        SELECT 1
                        FROM "delivery_dispatch_waves"
                        WHERE "delivery_dispatch_waves"."id" = "delivery_dispatch_wave_orders"."wave_id"
                          AND "delivery_dispatch_waves"."tenant_id" = nullif(current_setting('app.current_tenant', true), '')::uuid
                    )
                )
        $policy$;

        EXECUTE $policy$
            CREATE POLICY "delivery_dispatch_wave_orders_update_policy" ON "delivery_dispatch_wave_orders"
                FOR UPDATE
                USING (
                    current_setting('app.bypass_rls', true) = 'on'
                    OR EXISTS (
                        SELECT 1
                        FROM "delivery_dispatch_waves"
                        WHERE "delivery_dispatch_waves"."id" = "delivery_dispatch_wave_orders"."wave_id"
                          AND "delivery_dispatch_waves"."tenant_id" = nullif(current_setting('app.current_tenant', true), '')::uuid
                    )
                )
                WITH CHECK (
                    current_setting('app.bypass_rls', true) = 'on'
                    OR EXISTS (
                        SELECT 1
                        FROM "delivery_dispatch_waves"
                        WHERE "delivery_dispatch_waves"."id" = "delivery_dispatch_wave_orders"."wave_id"
                          AND "delivery_dispatch_waves"."tenant_id" = nullif(current_setting('app.current_tenant', true), '')::uuid
                    )
                )
        $policy$;

        EXECUTE $policy$
            CREATE POLICY "delivery_dispatch_wave_orders_delete_policy" ON "delivery_dispatch_wave_orders"
                FOR DELETE
                USING (
                    current_setting('app.bypass_rls', true) = 'on'
                    OR EXISTS (
                        SELECT 1
                        FROM "delivery_dispatch_waves"
                        WHERE "delivery_dispatch_waves"."id" = "delivery_dispatch_wave_orders"."wave_id"
                          AND "delivery_dispatch_waves"."tenant_id" = nullif(current_setting('app.current_tenant', true), '')::uuid
                    )
                )
        $policy$;
    END IF;
END
$$;
