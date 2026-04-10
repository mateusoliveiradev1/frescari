import assert from "node:assert/strict";
import test from "node:test";

import {
  accountRegistrationUpdateSchema,
  buildAccountOverviewFlags,
  buildTenantRegistrationUpdate,
} from "./account-profile";

test("buildAccountOverviewFlags resolves visibility by role", () => {
  assert.deepEqual(buildAccountOverviewFlags("buyer", "tenant-buyer-1"), {
    canAccessAddresses: true,
    canManageRegistration: true,
    hasTenant: true,
    isAdmin: false,
    isBuyer: true,
    isProducer: false,
  });

  assert.deepEqual(buildAccountOverviewFlags("producer", "tenant-producer-1"), {
    canAccessAddresses: false,
    canManageRegistration: true,
    hasTenant: true,
    isAdmin: false,
    isBuyer: false,
    isProducer: true,
  });

  assert.deepEqual(buildAccountOverviewFlags("admin", null), {
    canAccessAddresses: false,
    canManageRegistration: false,
    hasTenant: false,
    isAdmin: true,
    isBuyer: false,
    isProducer: false,
  });
});

test("accountRegistrationUpdateSchema normalizes buyer payloads", () => {
  const payload = accountRegistrationUpdateSchema.parse({
    companyName: "  Mercado   Central  ",
    type: "buyer",
  });

  assert.deepEqual(payload, {
    companyName: "Mercado Central",
    type: "buyer",
  });
  assert.deepEqual(buildTenantRegistrationUpdate(payload), {
    name: "Mercado Central",
  });
});

test("accountRegistrationUpdateSchema normalizes producer payloads", () => {
  const payload = accountRegistrationUpdateSchema.parse({
    contactName: "  Ana   Maria Souza  ",
    documentId: "529.982.247-25",
    legalEntityType: "PF",
    legalName: "  Ana Maria de Souza  ",
    phone: "+55 (11) 99876-5432",
    publicName: "  Sitio da Ana  ",
    type: "producer",
  });

  assert.deepEqual(payload, {
    contactName: "Ana Maria Souza",
    documentId: "52998224725",
    legalEntityType: "PF",
    legalName: "Ana Maria de Souza",
    phone: "11998765432",
    publicName: "Sitio da Ana",
    type: "producer",
  });

  const update = buildTenantRegistrationUpdate(payload);

  assert.equal(update.name, "Sitio da Ana");
  assert.equal(update.producerContactName, "Ana Maria Souza");
  assert.equal(update.producerDocumentId, "52998224725");
  assert.equal(update.producerLegalEntityType, "PF");
  assert.equal(update.producerLegalName, "Ana Maria de Souza");
  assert.equal(update.producerPhone, "11998765432");
  assert.ok(update.producerProfileCompletedAt instanceof Date);
});

test("accountRegistrationUpdateSchema rejects invalid producer document and phone", () => {
  const result = accountRegistrationUpdateSchema.safeParse({
    contactName: "Maria",
    documentId: "04.252.011/0001-11",
    legalEntityType: "PJ",
    legalName: "Hortifruti Central LTDA",
    phone: "9999",
    publicName: "Hortifruti Central",
    type: "producer",
  });

  assert.equal(result.success, false);

  if (result.success) {
    throw new Error("Expected invalid producer registration payload.");
  }

  assert.deepEqual(
    result.error.issues.map((issue) => issue.path.join(".")),
    ["documentId", "phone"],
  );
});
