ALTER TABLE "user"
ADD COLUMN IF NOT EXISTS "marketingEmailsOptOutAt" timestamp;
