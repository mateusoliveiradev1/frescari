ALTER TABLE "farms" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "farms" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "addresses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "addresses" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "products" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "product_lots" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "product_lots" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "orders" FORCE ROW LEVEL SECURITY;--> statement-breakpoint

DROP POLICY IF EXISTS "product_lots_delete_policy" ON "product_lots";--> statement-breakpoint
CREATE POLICY "product_lots_delete_policy" ON "product_lots"
    FOR DELETE
    USING (
        current_setting('app.bypass_rls', true) = 'on'
        OR "tenant_id" = nullif(current_setting('app.current_tenant', true), '')::uuid
    );--> statement-breakpoint

DROP POLICY IF EXISTS "orders_delete_policy" ON "orders";--> statement-breakpoint
CREATE POLICY "orders_delete_policy" ON "orders"
    FOR DELETE
    USING (
        current_setting('app.bypass_rls', true) = 'on'
        OR "buyer_tenant_id" = nullif(current_setting('app.current_tenant', true), '')::uuid
        OR "seller_tenant_id" = nullif(current_setting('app.current_tenant', true), '')::uuid
    );
