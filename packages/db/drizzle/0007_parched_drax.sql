CREATE INDEX "orders_buyer_idx" ON "orders" USING btree ("buyer_tenant_id");--> statement-breakpoint
CREATE INDEX "orders_seller_idx" ON "orders" USING btree ("seller_tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_stripe_session_seller_unique" ON "orders" USING btree ("stripe_session_id","seller_tenant_id") WHERE "orders"."stripe_session_id" IS NOT NULL;