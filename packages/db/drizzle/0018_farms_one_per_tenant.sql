-- One farm per producer. Deliveries join farms by tenant and farm creation
-- is find-then-insert, so a race could create a second farm and duplicate
-- every delivery item. Fails (and changes nothing) if duplicates exist.
CREATE UNIQUE INDEX IF NOT EXISTS "farms_tenant_id_uidx" ON "farms" ("tenant_id");
