ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "twoFactorEnabled" boolean DEFAULT false;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "twoFactor" (
	"id" text PRIMARY KEY NOT NULL,
	"secret" text NOT NULL,
	"backupCodes" text NOT NULL,
	"userId" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
	"verified" boolean DEFAULT true,
	"failedVerificationCount" integer DEFAULT 0,
	"lockedUntil" timestamp
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "twoFactor_secret_idx" ON "twoFactor" ("secret");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "twoFactor_userId_idx" ON "twoFactor" ("userId");--> statement-breakpoint
DO $$
BEGIN
	-- Login runs as the restricted app role, which must read and write 2FA rows.
	IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'frescari_app') THEN
		GRANT SELECT, INSERT, UPDATE, DELETE ON "twoFactor" TO frescari_app;
	END IF;
END $$;
