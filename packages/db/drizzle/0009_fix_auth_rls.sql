ALTER TABLE "user" NO FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "users_select_policy" ON "user";--> statement-breakpoint
DROP POLICY IF EXISTS "users_insert_policy" ON "user";--> statement-breakpoint
DROP POLICY IF EXISTS "users_update_policy" ON "user";--> statement-breakpoint
DROP POLICY IF EXISTS "users_delete_policy" ON "user";--> statement-breakpoint

ALTER TABLE "session" NO FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "session" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "session_bypass_policy" ON "session";--> statement-breakpoint

ALTER TABLE "account" NO FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "account" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "account_bypass_policy" ON "account";--> statement-breakpoint

ALTER TABLE "verification" NO FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "verification" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "verification_bypass_policy" ON "verification";
