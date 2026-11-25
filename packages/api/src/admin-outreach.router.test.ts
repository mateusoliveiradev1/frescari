import assert from "node:assert/strict";
import test from "node:test";

import { withRlsMockDb } from "./test-db";

type OutreachCaller = {
  admin: {
    setTenantOutreachContacted: (input: unknown) => Promise<{
      id: string;
      outreachContactedAt: Date | null;
    }>;
  };
};

const TENANT_ID = "11111111-1111-4111-8111-111111111111";

async function createCaller(db: unknown, role: "admin" | "producer" | "buyer") {
  const [{ createTRPCRouter }, { adminRouter }] = await Promise.all([
    import("./trpc"),
    import("./routers/admin"),
  ]);

  return createTRPCRouter({ admin: adminRouter }).createCaller({
    db: db as never,
    req: undefined,
    session: { user: { id: "user-1" } },
    user: {
      email: "ops@frescari.test",
      id: "user-1",
      image: null,
      name: "Ops",
      role,
      tenantId: null,
    },
  }) as unknown as OutreachCaller;
}

function createDb() {
  const updates: Array<Record<string, unknown>> = [];
  const db = withRlsMockDb({
    update() {
      return {
        set(values: Record<string, unknown>) {
          updates.push(values);
          return {
            where() {
              return {
                returning: async () => [
                  {
                    id: TENANT_ID,
                    outreachContactedAt: values.outreachContactedAt ?? null,
                  },
                ],
              };
            },
          };
        },
      };
    },
  });
  return { db, updates };
}

test("admin marks and unmarks a producer as contacted", async () => {
  const { db, updates } = createDb();
  const caller = await createCaller(db, "admin");

  const marked = await caller.admin.setTenantOutreachContacted({
    tenantId: TENANT_ID,
    contacted: true,
  });
  assert.ok(marked.outreachContactedAt instanceof Date);

  const unmarked = await caller.admin.setTenantOutreachContacted({
    tenantId: TENANT_ID,
    contacted: false,
  });
  assert.equal(unmarked.outreachContactedAt, null);
  assert.equal(updates.length, 2);
});

test("only admins can mark outreach", async () => {
  const { db, updates } = createDb();
  const caller = await createCaller(db, "producer");

  await assert.rejects(
    caller.admin.setTenantOutreachContacted({
      tenantId: TENANT_ID,
      contacted: true,
    }),
    (error: { code?: string }) => error.code === "FORBIDDEN",
  );
  assert.equal(updates.length, 0);
});
