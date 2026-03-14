ALTER TABLE "farms" ADD COLUMN "min_order_value" numeric(10, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "farms" ADD COLUMN "free_shipping_threshold" numeric(10, 2);