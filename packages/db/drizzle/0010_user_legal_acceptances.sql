CREATE TABLE "user_legal_acceptances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"legal_version" text NOT NULL,
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"source" text DEFAULT 'sign_up_email' NOT NULL,
	CONSTRAINT "user_legal_acceptances_user_id_user_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX "user_legal_acceptances_user_idx" ON "user_legal_acceptances" USING btree ("user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "user_legal_acceptances_user_version_uidx" ON "user_legal_acceptances" USING btree ("user_id","legal_version");
