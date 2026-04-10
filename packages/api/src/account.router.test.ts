import assert from "node:assert/strict";
import test from "node:test";

import { withRlsMockDb } from "./test-db";

type AccountCaller = {
  account: {
    getOverview: () => Promise<{
      flags: Record<string, boolean>;
      tenant: Record<string, unknown> | null;
      user: Record<string, unknown>;
    }>;
    updateRegistration: (input: unknown) => Promise<{
      success: boolean;
      tenant: Record<string, unknown>;
    }>;
  };
};

type AuthenticatedUser = {
  email: string;
  id: string;
  image: string | null;
  name: string;
  role: "admin" | "buyer" | "producer";
  tenantId: string | null;
};

type TenantRecord = {
  id: string;
  name: string;
  producerContactName: string | null;
  producerDocumentId: string | null;
  producerLegalEntityType: "PF" | "PJ" | null;
  producerLegalName: string | null;
  producerPhone: string | null;
  type: "BUYER" | "PRODUCER" | null;
};

async function createAccountCaller(db: unknown, user: AuthenticatedUser) {
  const [{ createTRPCRouter }, { accountRouter }] = await Promise.all([
    import("./trpc"),
    import("./routers/account"),
  ]);

  const testRouter = createTRPCRouter({ account: accountRouter });

  return testRouter.createCaller({
    db: db as never,
    req: undefined,
    session: { user: { id: user.id } },
    user,
  });
}

function createAccountDb(initialTenant: TenantRecord | null) {
  const state = {
    tenant: initialTenant,
    tenantLookupCount: 0,
    updatedValues: null as Record<string, unknown> | null,
  };

  const db = withRlsMockDb({
    query: {
      tenants: {
        findFirst: async () => {
          state.tenantLookupCount += 1;
          return state.tenant;
        },
      },
    },
    update() {
      return {
        set(values: Record<string, unknown>) {
          state.updatedValues = values;
          state.tenant =
            state.tenant === null
              ? state.tenant
              : { ...state.tenant, ...values };

          return {
            where() {
              return {
                returning: async () => (state.tenant ? [state.tenant] : []),
              };
            },
          };
        },
      };
    },
  });

  return { db, state };
}

test("account.getOverview returns buyer account data and flags", async () => {
  const { db } = createAccountDb({
    id: "tenant-buyer-1",
    name: "Mercado Central",
    producerContactName: null,
    producerDocumentId: null,
    producerLegalEntityType: null,
    producerLegalName: null,
    producerPhone: null,
    type: "BUYER",
  });

  const caller = await createAccountCaller(db, {
    email: "buyer@frescari.test",
    id: "user-buyer-1",
    image: null,
    name: "Matheus Oliveira",
    role: "buyer",
    tenantId: "tenant-buyer-1",
  });

  const result = await (caller as AccountCaller).account.getOverview();

  assert.equal(result.user.role, "buyer");
  assert.equal(result.user.tenantId, "tenant-buyer-1");
  assert.equal(result.tenant?.name, "Mercado Central");
  assert.equal(result.tenant?.type, "BUYER");
  assert.deepEqual(result.flags, {
    canAccessAddresses: true,
    canManageRegistration: true,
    hasTenant: true,
    isAdmin: false,
    isBuyer: true,
    isProducer: false,
  });
});

test("account.getOverview returns producer account data and flags", async () => {
  const { db } = createAccountDb({
    id: "tenant-producer-1",
    name: "Sitio da Ana",
    producerContactName: "Ana Maria",
    producerDocumentId: "52998224725",
    producerLegalEntityType: "PF",
    producerLegalName: "Ana Maria de Souza",
    producerPhone: "11998765432",
    type: "PRODUCER",
  });

  const caller = await createAccountCaller(db, {
    email: "producer@frescari.test",
    id: "user-producer-1",
    image: "https://cdn.frescari.test/avatar.png",
    name: "Ana Maria",
    role: "producer",
    tenantId: "tenant-producer-1",
  });

  const result = await (caller as AccountCaller).account.getOverview();

  assert.equal(result.user.role, "producer");
  assert.equal(result.tenant?.producerDocumentId, "52998224725");
  assert.equal(result.tenant?.producerPhone, "11998765432");
  assert.equal(result.flags.canAccessAddresses, false);
  assert.equal(result.flags.isProducer, true);
});

test("account.getOverview does not look up tenant data for admins without tenant", async () => {
  const { db, state } = createAccountDb(null);

  const caller = await createAccountCaller(db, {
    email: "admin@frescari.test",
    id: "user-admin-1",
    image: null,
    name: "Administrador",
    role: "admin",
    tenantId: null,
  });

  const result = await (caller as AccountCaller).account.getOverview();

  assert.equal(result.tenant, null);
  assert.equal(state.tenantLookupCount, 0);
  assert.deepEqual(result.flags, {
    canAccessAddresses: false,
    canManageRegistration: false,
    hasTenant: false,
    isAdmin: true,
    isBuyer: false,
    isProducer: false,
  });
});

test("account.updateRegistration updates producer tenant fields with normalized values", async () => {
  const { db, state } = createAccountDb({
    id: "tenant-producer-1",
    name: "Sitio antigo",
    producerContactName: "Contato antigo",
    producerDocumentId: "00000000000",
    producerLegalEntityType: "PF",
    producerLegalName: "Nome antigo",
    producerPhone: "11999999999",
    type: "PRODUCER",
  });

  const caller = await createAccountCaller(db, {
    email: "producer@frescari.test",
    id: "user-producer-1",
    image: null,
    name: "Ana Maria",
    role: "producer",
    tenantId: "tenant-producer-1",
  });

  const result = await (caller as AccountCaller).account.updateRegistration({
    contactName: "  Ana   Maria Souza  ",
    documentId: "529.982.247-25",
    legalEntityType: "PF",
    legalName: "  Ana Maria de Souza  ",
    phone: "+55 (11) 99876-5432",
    publicName: "  Sitio da Ana  ",
    type: "producer",
  });

  assert.equal(result.success, true);
  assert.equal(result.tenant.name, "Sitio da Ana");
  assert.equal(result.tenant.producerContactName, "Ana Maria Souza");
  assert.equal(result.tenant.producerDocumentId, "52998224725");
  assert.equal(result.tenant.producerPhone, "11998765432");
  assert.equal(state.updatedValues?.name, "Sitio da Ana");
  assert.ok(state.updatedValues?.producerProfileCompletedAt instanceof Date);
});

test("account.updateRegistration updates buyer tenant name with supported fields only", async () => {
  const { db, state } = createAccountDb({
    id: "tenant-buyer-1",
    name: "Mercado Antigo",
    producerContactName: null,
    producerDocumentId: null,
    producerLegalEntityType: null,
    producerLegalName: null,
    producerPhone: null,
    type: "BUYER",
  });

  const caller = await createAccountCaller(db, {
    email: "buyer@frescari.test",
    id: "user-buyer-1",
    image: null,
    name: "Matheus Oliveira",
    role: "buyer",
    tenantId: "tenant-buyer-1",
  });

  const result = await (caller as AccountCaller).account.updateRegistration({
    companyName: "  Mercado Central  ",
    type: "buyer",
  });

  assert.equal(result.success, true);
  assert.equal(result.tenant.name, "Mercado Central");
  assert.deepEqual(state.updatedValues, {
    name: "Mercado Central",
  });
});

test("account.updateRegistration rejects payloads that do not match the authenticated role", async () => {
  const { db } = createAccountDb({
    id: "tenant-buyer-1",
    name: "Mercado Central",
    producerContactName: null,
    producerDocumentId: null,
    producerLegalEntityType: null,
    producerLegalName: null,
    producerPhone: null,
    type: "BUYER",
  });

  const caller = await createAccountCaller(db, {
    email: "buyer@frescari.test",
    id: "user-buyer-1",
    image: null,
    name: "Matheus Oliveira",
    role: "buyer",
    tenantId: "tenant-buyer-1",
  });

  await assert.rejects(
    () =>
      (caller as AccountCaller).account.updateRegistration({
        contactName: "Ana",
        documentId: "529.982.247-25",
        legalEntityType: "PF",
        legalName: "Ana Maria",
        phone: "(11) 99876-5432",
        publicName: "Sitio da Ana",
        type: "producer",
      }),
    /payload de cadastro nao corresponde ao papel autenticado/i,
  );
});
