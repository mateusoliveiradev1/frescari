import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import Module from "node:module";

const cronState = {
  runCalls: 0,
};

const originalCronSecret = process.env.CRON_SECRET;
const originalModuleLoad = (
  Module as typeof Module & {
    _load: (request: string, parent: unknown, isMain: boolean) => unknown;
  }
)._load;

function resetState() {
  cronState.runCalls = 0;
  process.env.CRON_SECRET = "cron-secret";
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
    if (request === "@/lib/cron-jobs") {
      return {
        runLotFreshnessCronJob: async () => {
          cronState.runCalls += 1;
          return {
            processedLots: 2,
            updatedLots: 1,
            expiredLots: 0,
            expiringSoonEvents: 1,
          };
        },
      };
    }

    return originalModuleLoad.call(this, request, parent, isMain);
  };
});

after(() => {
  process.env.CRON_SECRET = originalCronSecret;
  (
    Module as typeof Module & {
      _load: (request: string, parent: unknown, isMain: boolean) => unknown;
    }
  )._load = originalModuleLoad;
});

beforeEach(() => {
  resetState();
});

test("GET /api/cron/freshness rejects requests without a bearer token", async () => {
  const { GET } = await import("./route");

  const response = await GET(
    new Request("https://example.com/api/cron/freshness"),
  );

  assert.equal(response.status, 401);
  assert.equal(cronState.runCalls, 0);
});

test("GET /api/cron/freshness rejects requests with an invalid bearer token", async () => {
  const { GET } = await import("./route");

  const response = await GET(
    new Request("https://example.com/api/cron/freshness", {
      headers: {
        Authorization: "Bearer wrong-secret",
      },
    }),
  );

  assert.equal(response.status, 401);
  assert.equal(cronState.runCalls, 0);
});

test("GET /api/cron/freshness fails fast when CRON_SECRET is missing", async () => {
  delete process.env.CRON_SECRET;
  const { GET } = await import("./route");

  const response = await GET(
    new Request("https://example.com/api/cron/freshness", {
      headers: {
        Authorization: "Bearer cron-secret",
      },
    }),
  );

  assert.equal(response.status, 500);
  assert.equal(cronState.runCalls, 0);
});

test("GET /api/cron/freshness runs the direct freshness job when the bearer token is valid", async () => {
  const { GET } = await import("./route");

  const response = await GET(
    new Request("https://example.com/api/cron/freshness", {
      headers: {
        Authorization: "Bearer cron-secret",
      },
    }),
  );

  assert.equal(response.status, 200);
  assert.equal(cronState.runCalls, 1);

  const payload = await response.json();
  assert.deepEqual(payload, {
    ok: true,
    job: "freshness",
    summary: {
      processedLots: 2,
      updatedLots: 1,
      expiredLots: 0,
      expiringSoonEvents: 1,
    },
  });
});
