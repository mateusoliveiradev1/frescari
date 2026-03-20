import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import Module from "node:module";

const lotState = {
  createRepositoryCalls: 0,
  createInlinePublisherCalls: [] as unknown[],
  runPassCalls: [] as unknown[],
};

const notificationState = {
  createEmitterCalls: 0,
  createDeliveryRepositoryCalls: 0,
  createDeliveryNotifierCalls: 0,
  runDeliveryPassCalls: [] as unknown[],
};

const originalModuleLoad = (
  Module as typeof Module & {
    _load: (request: string, parent: unknown, isMain: boolean) => unknown;
  }
)._load;

function resetState() {
  lotState.createRepositoryCalls = 0;
  lotState.createInlinePublisherCalls = [];
  lotState.runPassCalls = [];

  notificationState.createEmitterCalls = 0;
  notificationState.createDeliveryRepositoryCalls = 0;
  notificationState.createDeliveryNotifierCalls = 0;
  notificationState.runDeliveryPassCalls = [];
}

before(() => {
  (
    Module as typeof Module & {
      _load: (request: string, parent: unknown, isMain: boolean) => unknown;
    }
  )._load = function patchedModuleLoad(
    request: string,
    parent: unknown,
    isMain: boolean,
  ) {
    if (request === "@frescari/api/workers/lot-freshness") {
      return {
        createDbLotFreshnessRepository: () => {
          lotState.createRepositoryCalls += 1;
          return { kind: "lot-repository" };
        },
        createInlineLotEventPublisher: (emitter: unknown) => {
          lotState.createInlinePublisherCalls.push(emitter);
          return { kind: "inline-publisher", emitter };
        },
        runLotFreshnessPass: async (args: unknown) => {
          lotState.runPassCalls.push(args);
          return {
            processedLots: 3,
            updatedLots: 2,
            expiredLots: 1,
            expiringSoonEvents: 1,
          };
        },
      };
    }

    if (request === "@frescari/api/workers/notification-worker") {
      return {
        createDbLotNotificationEmitter: () => {
          notificationState.createEmitterCalls += 1;
          return { kind: "lot-emitter" };
        },
        createDbDeliveryDelayRepository: () => {
          notificationState.createDeliveryRepositoryCalls += 1;
          return { kind: "delivery-repository" };
        },
        createDbDeliveryDelayNotifier: () => {
          notificationState.createDeliveryNotifierCalls += 1;
          return { kind: "delivery-notifier" };
        },
        runDeliveryDelayScanPass: async (args: unknown) => {
          notificationState.runDeliveryPassCalls.push(args);
          return {
            scannedOrders: 4,
            notifiedOrders: 4,
            latestDeliveryWindowEnd: new Date("2026-03-19T12:00:00.000Z"),
          };
        },
      };
    }

    return originalModuleLoad.call(this, request, parent, isMain);
  };
});

after(() => {
  (
    Module as typeof Module & {
      _load: (request: string, parent: unknown, isMain: boolean) => unknown;
    }
  )._load = originalModuleLoad;
});

beforeEach(() => {
  resetState();
});

test("runLotFreshnessCronJob wires direct repository and inline publisher without queue infrastructure", async () => {
  const { runLotFreshnessCronJob } = await import("./cron-jobs");

  const now = new Date("2026-03-19T09:00:00.000Z");
  const result = await runLotFreshnessCronJob(now);

  assert.equal(lotState.createRepositoryCalls, 1);
  assert.equal(notificationState.createEmitterCalls, 1);
  assert.equal(lotState.createInlinePublisherCalls.length, 1);
  assert.equal(lotState.runPassCalls.length, 1);
  assert.deepEqual(lotState.runPassCalls[0], {
    repository: { kind: "lot-repository" },
    publisher: {
      kind: "inline-publisher",
      emitter: { kind: "lot-emitter" },
    },
    now,
  });
  assert.deepEqual(result, {
    processedLots: 3,
    updatedLots: 2,
    expiredLots: 1,
    expiringSoonEvents: 1,
  });
});

test("runDeliveryDelayCronJob wires repository and notifier directly without queue infrastructure", async () => {
  const { runDeliveryDelayCronJob } = await import("./cron-jobs");

  const now = new Date("2026-03-19T09:30:00.000Z");
  const result = await runDeliveryDelayCronJob(now);

  assert.equal(notificationState.createDeliveryRepositoryCalls, 1);
  assert.equal(notificationState.createDeliveryNotifierCalls, 1);
  assert.equal(notificationState.runDeliveryPassCalls.length, 1);
  assert.deepEqual(notificationState.runDeliveryPassCalls[0], {
    repository: { kind: "delivery-repository" },
    notifier: { kind: "delivery-notifier" },
    now,
  });
  assert.deepEqual(result, {
    scannedOrders: 4,
    notifiedOrders: 4,
    latestDeliveryWindowEnd: new Date("2026-03-19T12:00:00.000Z"),
  });
});
