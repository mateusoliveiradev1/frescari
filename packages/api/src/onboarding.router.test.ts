import assert from "node:assert/strict";
import test from "node:test";

import { withRlsMockDb } from "./test-db";

type OnboardingCaller = {
  onboarding: {
    setupAccount: (
      input: unknown,
    ) => Promise<{ tenantId: string; type: string }>;
  };
};

type AuthenticatedUser = {
  id: string;
  tenantId: string | null;
  role: "buyer" | "producer";
  name: string;
};

async function createOnboardingCaller(db: unknown, user?: AuthenticatedUser) {
  const [{ createTRPCRouter }, { onboardingRouter }] = await Promise.all([
    import("./trpc"),
    import("./routers/onboarding"),
  ]);

  const testRouter = createTRPCRouter({ onboarding: onboardingRouter });

  return testRouter.createCaller({
    db: db as never,
    req: undefined,
    session: { user: { id: user?.id ?? "user-new-1" } },
    user: user ?? {
      id: "user-new-1",
      tenantId: null,
      role: "buyer",
      name: "Usuario Novo",
    },
  });
}

test("onboarding.setupAccount keeps fresh buyer accounts in buyer role", async () => {
  const state = {
    insertedTenant: null as Record<string, unknown> | null,
    updatedUser: null as Record<string, unknown> | null,
  };

  const db = withRlsMockDb({
    insert() {
      return {
        values(values: Record<string, unknown>) {
          state.insertedTenant = values;

          return {
            returning: async () => [
              {
                id: "buyer-tenant-1",
                type: "BUYER",
              },
            ],
          };
        },
      };
    },
    update() {
      return {
        set(values: Record<string, unknown>) {
          state.updatedUser = values;

          return {
            where: async () => undefined,
          };
        },
      };
    },
  });

  const caller = await createOnboardingCaller(db);
  const result = await (caller as OnboardingCaller).onboarding.setupAccount({
    type: "BUYER",
    companyName: "Mercado Central",
  });

  assert.deepEqual(result, {
    tenantId: "buyer-tenant-1",
    type: "BUYER",
  });
  assert.deepEqual(state.updatedUser, {
    tenantId: "buyer-tenant-1",
    role: "buyer",
  });
  assert.equal(state.insertedTenant?.name, "Mercado Central");
  assert.equal(state.insertedTenant?.type, "BUYER");
  assert.match(String(state.insertedTenant?.slug), /^mercado-central-/);
});

test("onboarding.setupAccount only upgrades to producer after explicit producer selection", async () => {
  const state = {
    insertedTenant: null as Record<string, unknown> | null,
    updatedUser: null as Record<string, unknown> | null,
  };

  const db = withRlsMockDb({
    insert() {
      return {
        values(values: Record<string, unknown>) {
          state.insertedTenant = values;

          return {
            returning: async () => [
              {
                id: "producer-tenant-1",
                type: "PRODUCER",
              },
            ],
          };
        },
      };
    },
    update() {
      return {
        set(values: Record<string, unknown>) {
          state.updatedUser = values;

          return {
            where: async () => undefined,
          };
        },
      };
    },
  });

  const caller = await createOnboardingCaller(db);
  const result = await (caller as OnboardingCaller).onboarding.setupAccount({
    type: "PRODUCER",
    publicName: "Sitio da Ana",
    legalEntityType: "PF",
    documentId: "529.982.247-25",
    legalName: "Ana Maria de Souza",
    contactName: "Ana Maria",
    phone: "(11) 99876-5432",
  });

  assert.deepEqual(result, {
    tenantId: "producer-tenant-1",
    type: "PRODUCER",
  });
  assert.deepEqual(state.updatedUser, {
    tenantId: "producer-tenant-1",
    role: "producer",
  });
  assert.equal(state.insertedTenant?.name, "Sitio da Ana");
  assert.equal(state.insertedTenant?.type, "PRODUCER");
  assert.equal(state.insertedTenant?.producerContactName, "Ana Maria");
  assert.equal(state.insertedTenant?.producerDocumentId, "52998224725");
  assert.equal(state.insertedTenant?.producerLegalEntityType, "PF");
  assert.equal(state.insertedTenant?.producerLegalName, "Ana Maria de Souza");
  assert.equal(state.insertedTenant?.producerPhone, "11998765432");
  assert.ok(state.insertedTenant?.producerProfileCompletedAt instanceof Date);
});

test("onboarding.setupAccount rejects users who already have a tenant", async () => {
  let insertAttempts = 0;
  let updateAttempts = 0;

  const db = withRlsMockDb({
    insert() {
      insertAttempts += 1;

      return {
        values() {
          return {
            returning: async () => [],
          };
        },
      };
    },
    update() {
      updateAttempts += 1;

      return {
        set() {
          return {
            where: async () => undefined,
          };
        },
      };
    },
  });

  const caller = await createOnboardingCaller(db, {
    id: "user-existing-1",
    tenantId: "tenant-existing-1",
    role: "buyer",
    name: "Usuario Existente",
  });

  await assert.rejects(
    () =>
      (caller as OnboardingCaller).onboarding.setupAccount({
        type: "BUYER",
        companyName: "Nao deveria criar",
      }),
    /ja possui uma organizacao vinculada/i,
  );

  assert.equal(insertAttempts, 0);
  assert.equal(updateAttempts, 0);
});
