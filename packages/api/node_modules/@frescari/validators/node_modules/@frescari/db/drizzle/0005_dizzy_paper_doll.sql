ALTER TABLE "product_lots" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "product_lots_tenant_idx" ON "product_lots" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "product_lots_product_idx" ON "product_lots" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "product_lots_deleted_idx" ON "product_lots" USING btree ("deleted_at");--> statement-breakpoint
ALTER TABLE "product_lots" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "product_lots" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "product_lots_select_policy" ON "product_lots"
    FOR SELECT
    USING (
        current_setting('app.bypass_rls', true) = 'on'
        OR current_setting('app.allow_product_lot_public_read', true) = 'on'
        OR "tenant_id" = nullif(current_setting('app.current_tenant', true), '')::uuid
    );--> statement-breakpoint
CREATE POLICY "product_lots_insert_policy" ON "product_lots"
    FOR INSERT
    WITH CHECK (
        current_setting('app.bypass_rls', true) = 'on'
        OR "tenant_id" = nullif(current_setting('app.current_tenant', true), '')::uuid
    );--> statement-breakpoint
CREATE POLICY "product_lots_update_policy" ON "product_lots"
    FOR UPDATE
    USING (
        current_setting('app.bypass_rls', true) = 'on'
        OR "tenant_id" = nullif(current_setting('app.current_tenant', true), '')::uuid
    )
    WITH CHECK (
        current_setting('app.bypass_rls', true) = 'on'
        OR "tenant_id" = nullif(current_setting('app.current_tenant', true), '')::uuid
    );--> statement-breakpoint
CREATE POLICY "product_lots_delete_policy" ON "product_lots"
    FOR DELETE
    USING (current_setting('app.bypass_rls', true) = 'on');
