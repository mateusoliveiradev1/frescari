import assert from "node:assert/strict";
import test from "node:test";

import { withRlsMockDb } from "./test-db";

type StorefrontCaller = {
  storefront: {
    updateProfile: (input: unknown) => Promise<{
      slug: string;
      photoUrl: string | null;
      bio: string | null;
    }>;
  };
};

type Role = "admin" | "buyer" | "producer";

async function createCaller(db: unknown, role: Role, tenantId = "tenant-1") {
  const [{ createTRPCRouter }, { storefrontRouter }] = await Promise.all([
    import("./trpc"),
    import("./routers/storefront"),
  ]);

  return createTRPCRouter({ storefront: storefrontRouter }).createCaller({
    db: db as never,
    req: undefined,
    session: { user: { id: "user-1" } },
    user: {
      email: "user@frescari.test",
      id: "user-1",
      image: null,
      name: "Teste",
      role,
      tenantId,
    },
  }) as unknown as StorefrontCaller;
}

function createDb(tenantType: "PRODUCER" | "BUYER") {
  const state = {
    updates: [] as Array<Record<string, unknown>>,
  };

  const db = withRlsMockDb({
    // tenantProcedure looks the tenant up with select().from().where().limit()
    select() {
      return {
        from() {
          return {
            where() {
              return {
                limit: async () => [{ id: "tenant-1", type: tenantType }],
              };
            },
          };
        },
      };
    },
    update() {
      return {
        set(values: Record<string, unknown>) {
          state.updates.push(values);
          return {
            where() {
              return {
                returning: async () => [
                  {
                    slug: "sitio-1",
                    photoUrl: values.storefrontPhotoUrl ?? null,
                    bio: values.storefrontBio ?? null,
                  },
                ],
              };
            },
          };
        },
      };
    },
  });

  return { db, state };
}

test("storefront.updateProfile saves only the photo and the trimmed bio", async () => {
  const { db, state } = createDb("PRODUCER");
  const caller = await createCaller(db, "producer");

  const result = await caller.storefront.updateProfile({
    photoUrl: "https://abc123.ufs.sh/f/foto.jpg",
    bio: "  Hortaliças sem agrotóxico desde 1998.  ",
  });

  assert.deepEqual(state.updates, [
    {
      storefrontPhotoUrl: "https://abc123.ufs.sh/f/foto.jpg",
      storefrontBio: "Hortaliças sem agrotóxico desde 1998.",
    },
  ]);
  assert.equal(result.slug, "sitio-1");
});

test("storefront.updateProfile rejects a photo from another host", async () => {
  const { db, state } = createDb("PRODUCER");
  const caller = await createCaller(db, "producer");

  await assert.rejects(
    caller.storefront.updateProfile({
      photoUrl: "https://example.com/foto.jpg",
      bio: null,
    }),
    (error: { code?: string }) => error.code === "BAD_REQUEST",
  );
  assert.equal(state.updates.length, 0);
});

test("storefront.updateProfile is producer-only", async () => {
  const { db, state } = createDb("BUYER");
  const caller = await createCaller(db, "buyer");

  await assert.rejects(
    caller.storefront.updateProfile({ photoUrl: null, bio: "oi" }),
    (error: { code?: string }) => error.code === "FORBIDDEN",
  );
  assert.equal(state.updates.length, 0);
});
