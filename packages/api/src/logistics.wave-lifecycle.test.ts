/* eslint-disable @typescript-eslint/no-explicit-any -- test doubles for the tRPC caller and db */
import assert from "node:assert/strict";
import { test } from "node:test";

import { deliveryDispatchWaves, farmVehicles, orders } from "@frescari/db";

import { withRlsMockDb } from "./test-db";

const WAVE = "77777777-7777-4777-8777-777777777777";
const VEHICLE = "88888888-8888-4888-8888-888888888888";

async function createProducerCaller(db: unknown) {
  const [{ createTRPCRouter }, { logisticsRouter }] = await Promise.all([
    import("./trpc"),
    import("./routers/logistics"),
  ]);
  return createTRPCRouter({ logistics: logisticsRouter }).createCaller({
    db: db as never,
    req: undefined,
    session: { user: { id: "user-1" } },
    user: {
      id: "user-1",
      tenantId: "tenant-1",
      role: "producer",
      name: "Joao",
    },
  } as any) as any;
}

function chain(rows: unknown[]) {
  return {
    from() {
      return this;
    },
    innerJoin() {
      return this;
    },
    where() {
      return Object.assign(Promise.resolve(rows), {
        limit: async () => rows,
      });
    },
    limit: async () => rows,
  };
}

function createWaveDb(input: {
  waveStatus: "confirmed" | "departed" | "cancelled";
  vehicleId?: string | null;
  readyOrders: string[];
}) {
  const updates: Array<{ table: string; values: Record<string, unknown> }> = [];

  const db = withRlsMockDb({
    select(selection?: Record<string, unknown>) {
      // The procedure's tenant lookup (id + type), on every call.
      if (
        selection &&
        "type" in selection &&
        "id" in selection &&
        Object.keys(selection).length === 2
      ) {
        return chain([{ id: "tenant-1", type: "PRODUCER" }]);
      }
      if (selection && "userId" in selection) {
        return chain([{ userId: "buyer-user-1" }]);
      }
      if (selection && "selectedVehicleId" in selection) {
        return chain([
          {
            id: WAVE,
            status: input.waveStatus,
            selectedVehicleId: input.vehicleId ?? null,
          },
        ]);
      }
      // the wave's orders
      return chain(input.readyOrders.map((orderId) => ({ orderId })));
    },
    update(table: unknown) {
      const name =
        table === orders
          ? "orders"
          : table === deliveryDispatchWaves
            ? "waves"
            : table === farmVehicles
              ? "vehicles"
              : "other";
      return {
        set(values: Record<string, unknown>) {
          updates.push({ table: name, values });
          const result = input.readyOrders.map((id) => ({
            id,
            buyerTenantId: "buyer-1",
          }));
          return {
            where() {
              return Object.assign(Promise.resolve(undefined), {
                returning: async () => (name === "orders" ? result : []),
              });
            },
          };
        },
      };
    },
    insert() {
      return {
        values(values: Record<string, unknown>[]) {
          return {
            onConflictDoNothing() {
              return {
                returning: async () =>
                  values.map((_, index) => ({ id: `n-${index}` })),
              };
            },
          };
        },
      };
    },
  });

  return { db, updates };
}

test("departing a wave sends its ready orders in transit and holds the vehicle", async () => {
  const { db, updates } = createWaveDb({
    waveStatus: "confirmed",
    vehicleId: VEHICLE,
    readyOrders: ["o1", "o2"],
  });
  const caller = await createProducerCaller(db);

  const result = await caller.logistics.departDispatchWave({ waveId: WAVE });

  assert.deepEqual(result, { success: true, departedOrderCount: 2 });
  assert.deepEqual(
    updates.map((update) => [
      update.table,
      update.values.status ?? update.values.availabilityStatus,
    ]),
    [
      ["orders", "in_transit"],
      ["waves", "departed"],
      ["vehicles", "in_use"],
    ],
  );
});

test("a wave that already left cannot leave again or be undone", async () => {
  const departed = createWaveDb({
    waveStatus: "departed",
    readyOrders: ["o1"],
  });
  const caller = await createProducerCaller(departed.db);

  await assert.rejects(
    () => caller.logistics.departDispatchWave({ waveId: WAVE }),
    /ja foi registrada/,
  );
  await assert.rejects(
    () => caller.logistics.cancelDispatchWave({ waveId: WAVE }),
    /ja partiu/,
  );
  assert.deepEqual(departed.updates, []);
});

test("undoing a wave returns its orders to the queue", async () => {
  const { db, updates } = createWaveDb({
    waveStatus: "confirmed",
    readyOrders: ["o1", "o2"],
  });
  const caller = await createProducerCaller(db);

  const result = await caller.logistics.cancelDispatchWave({ waveId: WAVE });

  assert.deepEqual(result, { success: true, releasedOrderCount: 2 });
  assert.deepEqual(
    updates.map((update) => [update.table, update.values.status]),
    [
      ["orders", "confirmed"],
      ["waves", "cancelled"],
    ],
  );
});

test("departing a wave with no order still ready is refused", async () => {
  const { db, updates } = createWaveDb({
    waveStatus: "confirmed",
    readyOrders: [],
  });
  const caller = await createProducerCaller(db);

  await assert.rejects(
    () => caller.logistics.departDispatchWave({ waveId: WAVE }),
    /Nenhum pedido desta saida/,
  );
  assert.equal(
    updates.some((update) => update.table === "waves"),
    false,
  );
});
