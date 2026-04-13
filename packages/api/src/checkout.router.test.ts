import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import Module from "node:module";

import { withRlsMockDb } from "./test-db";

process.env.STRIPE_SECRET_KEY ??= "sk_test_mocked";
process.env.NEXT_PUBLIC_APP_URL ??= "https://app.example.com";

type StripeSessionPayload = {
  metadata: Record<string, string>;
  line_items: Array<{
    quantity?: number;
    price_data?: {
      unit_amount?: number;
    };
  }>;
  payment_intent_data?: {
    capture_method?: string;
    transfer_data?: {
      destination?: string;
    };
    application_fee_amount?: number;
    metadata?: Record<string, string>;
  };
};

type StripeAccountPayload = {
  type?: string;
  business_type?: string;
  email?: string;
  business_profile?: {
    name?: string;
    url?: string;
  };
};

type StripeRetrievedAccount = {
  id: string;
  charges_enabled: boolean;
  details_submitted: boolean;
  payouts_enabled: boolean;
  requirements?: {
    currently_due?: string[];
    disabled_reason?: string | null;
    eventually_due?: string[];
    past_due?: string[];
  };
};

type StripeAccountLinkPayload = {
  account: string;
  refresh_url?: string;
  return_url?: string;
  type?: string;
};

type TestContextUser = {
  id: string;
  tenantId: string;
  role: "buyer" | "producer";
  name: string;
};

type TestTrpcContext = {
  db: never;
  req: undefined;
  session: { user: { id: string } };
  user: TestContextUser;
};

type CheckoutCaller = {
  checkout: {
    createFarmCheckoutSession: (input: unknown) => Promise<{ url: string }>;
    createCheckoutSession: (input: unknown) => Promise<unknown>;
  };
};

type StripeCaller = {
  stripe: {
    createStripeConnect: (input: unknown) => Promise<unknown>;
  };
};

const stripeState = {
  createdSessionPayload: null as StripeSessionPayload | null,
  createSessionError: null as Error | null,
  createdAccountPayload: null as StripeAccountPayload | null,
  createAccountError: null as Error | null,
  createdAccountLinkPayload: null as StripeAccountLinkPayload | null,
  createLoginLinkError: null as Error | null,
  loginLinkAccountId: null as string | null,
  retrieveAccountError: null as Error | null,
  retrievedAccount: null as StripeRetrievedAccount | null,
};

function createThenableChain(result: unknown) {
  const chain = {
    from() {
      return chain;
    },
    innerJoin() {
      return chain;
    },
    leftJoin() {
      return chain;
    },
    where() {
      return chain;
    },
    limit() {
      return Promise.resolve(result);
    },
    then(
      onFulfilled: (value: unknown) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) {
      return Promise.resolve(result).then(onFulfilled, onRejected);
    },
  };

  return chain;
}

class StripeMock {
  checkout = {
    sessions: {
      create: async (payload: StripeSessionPayload) => {
        if (stripeState.createSessionError) {
          throw stripeState.createSessionError;
        }

        stripeState.createdSessionPayload = payload;

        return {
          id: "cs_test_mocked",
          url: "https://stripe.example/checkout/session",
        };
      },
    },
  };

  accounts = {
    create: async (payload: StripeAccountPayload) => {
      if (stripeState.createAccountError) {
        throw stripeState.createAccountError;
      }

      stripeState.createdAccountPayload = payload;

      return {
        id: "acct_test_mocked",
      };
    },
    createLoginLink: async (accountId: string) => {
      if (stripeState.createLoginLinkError) {
        throw stripeState.createLoginLinkError;
      }

      stripeState.loginLinkAccountId = accountId;

      return {
        url: "https://stripe.example/login-link",
      };
    },
    retrieve: async (accountId: string) => {
      if (stripeState.retrieveAccountError) {
        throw stripeState.retrieveAccountError;
      }

      return (
        stripeState.retrievedAccount ?? {
          id: accountId,
          charges_enabled: true,
          details_submitted: true,
          payouts_enabled: true,
          requirements: {
            currently_due: [],
            disabled_reason: null,
            eventually_due: [],
            past_due: [],
          },
        }
      );
    },
  };

  accountLinks = {
    create: async (payload: StripeAccountLinkPayload) => {
      stripeState.createdAccountLinkPayload = payload;

      return {
        url: "https://stripe.example/account-onboarding",
      };
    },
  };
}

const originalModuleLoad = (
  Module as typeof Module & {
    _load: (request: string, parent: unknown, isMain: boolean) => unknown;
  }
)._load;

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
    if (request === "stripe") {
      return { __esModule: true, default: StripeMock };
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
  stripeState.createdSessionPayload = null;
  stripeState.createSessionError = null;
  stripeState.createdAccountPayload = null;
  stripeState.createAccountError = null;
  stripeState.createdAccountLinkPayload = null;
  stripeState.createLoginLinkError = null;
  stripeState.loginLinkAccountId = null;
  stripeState.retrieveAccountError = null;
  stripeState.retrievedAccount = null;
});

function createBuyerContext(db: unknown): TestTrpcContext {
  return {
    db: db as never,
    req: undefined,
    session: { user: { id: "buyer-user-1" } },
    user: {
      id: "buyer-user-1",
      tenantId: "buyer-tenant-1",
      role: "buyer",
      name: "Comprador Teste",
    },
  };
}

function createProducerContext(db: unknown): TestTrpcContext {
  return {
    db: db as never,
    req: undefined,
    session: { user: { id: "producer-user-1" } },
    user: {
      id: "producer-user-1",
      tenantId: "producer-tenant-1",
      role: "producer",
      name: "Produtor Teste",
    },
  };
}

async function createCheckoutCaller(db: unknown) {
  const [{ createTRPCRouter }, { checkoutRouter }] = await Promise.all([
    import("./trpc"),
    import("./routers/checkout"),
  ]);

  const testRouter = createTRPCRouter({ checkout: checkoutRouter });
  return testRouter.createCaller(createBuyerContext(db as never));
}

async function createStripeCaller(db: unknown) {
  const [{ createTRPCRouter }, { stripeRouter }] = await Promise.all([
    import("./trpc"),
    import("./routers/stripe"),
  ]);

  const testRouter = createTRPCRouter({ stripe: stripeRouter });
  return testRouter.createCaller(createProducerContext(db as never));
}

function createTenantSelectChain(type: "BUYER" | "PRODUCER" = "BUYER") {
  return createThenableChain([
    {
      id: type === "BUYER" ? "buyer-tenant-1" : "producer-tenant-1",
      type,
    },
  ]);
}

function createAddressSelectChain() {
  return createThenableChain([
    {
      id: "11111111-1111-4111-8111-111111111111",
      tenantId: "buyer-tenant-1",
      title: "Casa",
      formattedAddress: "Rua das Flores, 123 - Sao Paulo/SP - CEP 01010-000",
      street: "Rua das Flores",
      number: "123",
      zipcode: "01010-000",
      neighborhood: "Centro",
      city: "Sao Paulo",
      state: "SP",
      country: "BR",
      complement: "Apto 12",
      location: [-46.63, -23.55] as [number, number],
    },
  ]);
}

function createFarmSelectChain() {
  return createThenableChain([
    {
      id: "22222222-2222-4222-8222-222222222222",
      location: [-46.61, -23.54] as [number, number],
      baseDeliveryFee: "8.00",
      pricePerKm: "2.00",
      maxDeliveryRadiusKm: "20.00",
      minOrderValue: "30.00",
      freeShippingThreshold: "120.00",
    },
  ]);
}

function createDistanceSelectChain(distanceMeters: number) {
  return createThenableChain([{ distanceMeters }]);
}

function createLotSelectChain(overrides?: Record<string, unknown>) {
  return createThenableChain([
    {
      lotId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      farmId: "22222222-2222-4222-8222-222222222222",
      sellerTenantId: "producer-tenant-1",
      availableQty: "10.000",
      expiryDate: new Date("2030-01-01T00:00:00.000Z"),
      priceOverride: null,
      dbPricingType: "UNIT",
      lotImageUrl: null,
      lotUnit: "unit",
      stripeAccountId: "acct_producer_123",
      productName: "Tomate",
      productSaleUnit: "unit",
      pricePerUnit: 10,
      productImages: [],
      masterPricingType: "UNIT",
      ...overrides,
    },
  ]);
}

function createInvalidStripeDestinationError() {
  const error = new Error("No such destination: 'acct_invalid_destination'");

  Object.assign(error, {
    code: "resource_missing",
    raw: {
      code: "resource_missing",
      param: "payment_intent_data[transfer_data][destination]",
      message: "No such destination: 'acct_invalid_destination'",
    },
  });

  return error;
}

function createStripePlatformLossesConfigurationError() {
  const error = new Error(
    "Please review the responsibilities of managing losses for connected accounts at https://dashboard.stripe.com/settings/connect/platform-profile.",
  );

  Object.assign(error, {
    type: "StripeInvalidRequestError",
    rawType: "invalid_request_error",
    statusCode: 400,
    requestId: "req_platform_profile_pending",
  });

  return error;
}

function createIncompleteStripeOnboardingLoginLinkError() {
  const error = new Error(
    "Cannot create a login link for an account that has not completed onboarding.",
  );

  Object.assign(error, {
    type: "StripeInvalidRequestError",
    rawType: "invalid_request_error",
    statusCode: 400,
    requestId: "req_incomplete_onboarding_login_link",
  });

  return error;
}

function createUpdateChain(onSet?: (values: Record<string, unknown>) => void) {
  const chain = {
    set(values: Record<string, unknown>) {
      onSet?.(values);
      return chain;
    },
    where() {
      return Promise.resolve();
    },
  };

  return chain;
}

test("checkout.createFarmCheckoutSession rejects unexpected legacy financial fields", async () => {
  const db = withRlsMockDb({
    select() {
      return createTenantSelectChain("BUYER");
    },
  });

  const caller = await createCheckoutCaller(db);

  await assert.rejects(
    () =>
      (caller as CheckoutCaller).checkout.createFarmCheckoutSession({
        farmId: "22222222-2222-4222-8222-222222222222",
        addressId: "11111111-1111-4111-8111-111111111111",
        deliveryFee: 1,
        items: [
          {
            lotId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            quantity: 3,
          },
        ],
      }),
    /Unrecognized|unexpected/i,
  );
});

test("checkout.createFarmCheckoutSession recalculates freight on the server and stores address snapshot metadata", async () => {
  let selectCallCount = 0;

  const db = withRlsMockDb({
    select() {
      selectCallCount += 1;

      switch (selectCallCount) {
        case 1:
          return createTenantSelectChain("BUYER");
        case 2:
          return createAddressSelectChain();
        case 3:
          return createFarmSelectChain();
        case 4:
          return createDistanceSelectChain(5000);
        case 5:
          return createLotSelectChain();
        default:
          throw new Error(`Unexpected select call #${selectCallCount}`);
      }
    },
    update() {
      return createUpdateChain(() => undefined);
    },
  });

  const caller = await createCheckoutCaller(db);
  const result = await (
    caller as CheckoutCaller
  ).checkout.createFarmCheckoutSession({
    farmId: "22222222-2222-4222-8222-222222222222",
    addressId: "11111111-1111-4111-8111-111111111111",
    items: [
      {
        lotId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        quantity: 3,
      },
    ],
  });

  assert.deepEqual(result, { url: "https://stripe.example/checkout/session" });
  assert.ok(stripeState.createdSessionPayload);

  const payload = stripeState.createdSessionPayload!;
  assert.equal(payload.metadata.buyer_tenant_id, "buyer-tenant-1");
  assert.equal(
    payload.metadata.farm_id,
    "22222222-2222-4222-8222-222222222222",
  );
  assert.equal(
    payload.metadata.address_id,
    "11111111-1111-4111-8111-111111111111",
  );
  assert.ok(payload.metadata.address_snapshot);
  assert.equal("address" in payload.metadata, false);
  assert.equal(Number(payload.metadata.delivery_fee), 18);

  const addressSnapshot = JSON.parse(
    payload.metadata.address_snapshot,
  ) as Record<string, unknown>;
  assert.equal(addressSnapshot.street, "Rua das Flores");
  assert.equal(addressSnapshot.number, "123");
  assert.equal(addressSnapshot.zipcode, "01010-000");
  assert.equal(addressSnapshot.city, "Sao Paulo");
  assert.equal(addressSnapshot.state, "SP");
  assert.equal(addressSnapshot.latitude, -23.55);
  assert.equal(addressSnapshot.longitude, -46.63);

  assert.equal(payload.line_items.length, 2);
  assert.equal(payload.line_items[1]?.price_data?.unit_amount, 1800);
  assert.equal(
    payload.payment_intent_data?.transfer_data?.destination,
    "acct_producer_123",
  );
});

test("checkout.createFarmCheckoutSession normalizes weighable items to a single Stripe line item quantity", async () => {
  let selectCallCount = 0;

  const db = withRlsMockDb({
    select() {
      selectCallCount += 1;

      switch (selectCallCount) {
        case 1:
          return createTenantSelectChain("BUYER");
        case 2:
          return createAddressSelectChain();
        case 3:
          return createFarmSelectChain();
        case 4:
          return createDistanceSelectChain(5000);
        case 5:
          return createLotSelectChain({
            dbPricingType: "WEIGHT",
            lotUnit: "kg",
            productSaleUnit: "kg",
            masterPricingType: "WEIGHT",
            pricePerUnit: 30,
          });
        default:
          throw new Error(`Unexpected select call #${selectCallCount}`);
      }
    },
    update() {
      return createUpdateChain(() => undefined);
    },
  });

  const caller = await createCheckoutCaller(db);
  const result = await (
    caller as CheckoutCaller
  ).checkout.createFarmCheckoutSession({
    farmId: "22222222-2222-4222-8222-222222222222",
    addressId: "11111111-1111-4111-8111-111111111111",
    items: [
      {
        lotId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        quantity: 1.25,
      },
    ],
  });

  assert.deepEqual(result, { url: "https://stripe.example/checkout/session" });
  assert.ok(stripeState.createdSessionPayload);

  const payload = stripeState.createdSessionPayload!;
  const weighableLineItem = payload.line_items[0];
  const metadataItemsRaw = payload.metadata.items;
  assert.ok(metadataItemsRaw);
  const metadataItems = JSON.parse(metadataItemsRaw) as Array<
    Record<string, unknown>
  >;

  assert.equal(payload.line_items.length, 2);
  assert.equal(weighableLineItem?.quantity, 1);
  assert.equal(weighableLineItem?.price_data?.unit_amount, 4125);
  assert.equal(payload.line_items[1]?.price_data?.unit_amount, 1800);
  assert.equal(metadataItems[0]?.qty, 1.25);
  assert.equal(payload.payment_intent_data?.capture_method, "manual");
});

test("checkout.createCheckoutSession rejects the legacy mixed checkout path", async () => {
  const db = withRlsMockDb({
    select() {
      return createTenantSelectChain("BUYER");
    },
  });

  const caller = await createCheckoutCaller(db);

  await assert.rejects(
    () =>
      (caller as CheckoutCaller).checkout.createCheckoutSession({
        items: [
          {
            lotId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            quantity: 1,
          },
        ],
        address: {
          street: "Rua das Flores",
          number: "123",
          cep: "01010-000",
          city: "Sao Paulo",
          state: "SP",
        },
        deliveryFee: 10,
      }),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /createFarmCheckoutSession/i);
      return true;
    },
  );
});

test("checkout.createFarmCheckoutSession rejects lots that do not belong to the informed farm", async () => {
  let selectCallCount = 0;

  const db = withRlsMockDb({
    select() {
      selectCallCount += 1;

      switch (selectCallCount) {
        case 1:
          return createTenantSelectChain("BUYER");
        case 2:
          return createAddressSelectChain();
        case 3:
          return createFarmSelectChain();
        case 4:
          return createDistanceSelectChain(5000);
        case 5:
          return createLotSelectChain({
            farmId: "33333333-3333-4333-8333-333333333333",
          });
        default:
          throw new Error(`Unexpected select call #${selectCallCount}`);
      }
    },
  });

  const caller = await createCheckoutCaller(db);

  await assert.rejects(
    () =>
      (caller as CheckoutCaller).checkout.createFarmCheckoutSession({
        farmId: "22222222-2222-4222-8222-222222222222",
        addressId: "11111111-1111-4111-8111-111111111111",
        items: [
          {
            lotId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            quantity: 2,
          },
        ],
      }),
    /fazenda/i,
  );

  assert.equal(stripeState.createdSessionPayload, null);
});

test("checkout.createFarmCheckoutSession surfaces invalid producer Stripe destinations as a precondition failure", async () => {
  let selectCallCount = 0;
  stripeState.createSessionError = createInvalidStripeDestinationError();

  const db = withRlsMockDb({
    select() {
      selectCallCount += 1;

      switch (selectCallCount) {
        case 1:
          return createTenantSelectChain("BUYER");
        case 2:
          return createAddressSelectChain();
        case 3:
          return createFarmSelectChain();
        case 4:
          return createDistanceSelectChain(5000);
        case 5:
          return createLotSelectChain();
        default:
          throw new Error(`Unexpected select call #${selectCallCount}`);
      }
    },
    update() {
      return createUpdateChain(() => undefined);
    },
  });

  const caller = await createCheckoutCaller(db);

  await assert.rejects(
    () =>
      (caller as CheckoutCaller).checkout.createFarmCheckoutSession({
        farmId: "22222222-2222-4222-8222-222222222222",
        addressId: "11111111-1111-4111-8111-111111111111",
        items: [
          {
            lotId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            quantity: 3,
          },
        ],
      }),
    /recebimento valido/i,
  );

  assert.equal(stripeState.createdSessionPayload, null);
});

test("checkout.createFarmCheckoutSession supports platform-only Stripe mode without a producer Connect account", async () => {
  const previousMode = process.env.STRIPE_CONNECT_MODE;
  process.env.STRIPE_CONNECT_MODE = "platform_only";

  let selectCallCount = 0;

  try {
    const db = withRlsMockDb({
      select() {
        selectCallCount += 1;

        switch (selectCallCount) {
          case 1:
            return createTenantSelectChain("BUYER");
          case 2:
            return createAddressSelectChain();
          case 3:
            return createFarmSelectChain();
          case 4:
            return createDistanceSelectChain(5000);
          case 5:
            return createLotSelectChain({
              stripeAccountId: null,
            });
          default:
            throw new Error(`Unexpected select call #${selectCallCount}`);
        }
      },
    });

    const caller = await createCheckoutCaller(db);
    const result = await (
      caller as CheckoutCaller
    ).checkout.createFarmCheckoutSession({
      farmId: "22222222-2222-4222-8222-222222222222",
      addressId: "11111111-1111-4111-8111-111111111111",
      items: [
        {
          lotId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          quantity: 3,
        },
      ],
    });

    assert.deepEqual(result, {
      url: "https://stripe.example/checkout/session",
    });
    assert.ok(stripeState.createdSessionPayload);

    const payload = stripeState.createdSessionPayload!;
    assert.equal(payload.payment_intent_data?.transfer_data, undefined);
    assert.equal(
      payload.payment_intent_data?.application_fee_amount,
      undefined,
    );
    assert.equal(
      payload.payment_intent_data?.metadata?.stripe_connect_mode,
      "platform_only",
    );
    assert.equal(payload.metadata?.stripe_connect_mode, "platform_only");
  } finally {
    if (previousMode === undefined) {
      delete process.env.STRIPE_CONNECT_MODE;
    } else {
      process.env.STRIPE_CONNECT_MODE = previousMode;
    }
  }
});

test("stripe.createStripeConnect fails fast when platform-only Stripe mode is enabled", async () => {
  const previousMode = process.env.STRIPE_CONNECT_MODE;
  process.env.STRIPE_CONNECT_MODE = "platform_only";

  try {
    const db = withRlsMockDb({
      select() {
        return createTenantSelectChain("PRODUCER");
      },
    });

    const caller = await createStripeCaller(db);

    await assert.rejects(
      () => (caller as StripeCaller).stripe.createStripeConnect({}),
      /checkout sem connect/i,
    );
  } finally {
    if (previousMode === undefined) {
      delete process.env.STRIPE_CONNECT_MODE;
    } else {
      process.env.STRIPE_CONNECT_MODE = previousMode;
    }
  }
});

test("stripe.createStripeConnect uses NEXT_PUBLIC_APP_URL for business profile url and persists the created Stripe account id", async () => {
  let updatedStripeAccountId: string | null = null;
  let selectCallCount = 0;

  const db = withRlsMockDb({
    select() {
      selectCallCount += 1;

      switch (selectCallCount) {
        case 1:
          return createTenantSelectChain("PRODUCER");
        case 2:
          return createThenableChain([
            {
              tenant: {
                id: "producer-tenant-1",
                name: "Fazenda Boa Terra",
                stripeAccountId: null,
              },
              email: "produtor@example.com",
              name: "Maria da Silva",
            },
          ]);
        default:
          throw new Error(`Unexpected select call #${selectCallCount}`);
      }
    },
    update() {
      return createUpdateChain((values) => {
        updatedStripeAccountId =
          typeof values.stripeAccountId === "string"
            ? values.stripeAccountId
            : null;
      });
    },
  });

  const caller = await createStripeCaller(db);
  const result = await (caller as StripeCaller).stripe.createStripeConnect({});

  assert.equal(
    (result as { url?: string }).url,
    "https://stripe.example/account-onboarding",
  );
  assert.equal(updatedStripeAccountId, "acct_test_mocked");
  assert.equal(
    stripeState.createdAccountPayload?.business_profile?.url,
    "https://app.example.com",
  );
  assert.equal(stripeState.createdAccountPayload?.business_type, "individual");
  assert.deepEqual(stripeState.createdAccountLinkPayload, {
    account: "acct_test_mocked",
    refresh_url: "https://app.example.com/dashboard",
    return_url: "https://app.example.com/dashboard",
    type: "account_onboarding",
  });
});

test("stripe.createStripeConnect resumes incomplete onboarding with a fresh account link when login link is unavailable", async () => {
  let selectCallCount = 0;
  stripeState.createLoginLinkError =
    createIncompleteStripeOnboardingLoginLinkError();

  const db = withRlsMockDb({
    select() {
      selectCallCount += 1;

      switch (selectCallCount) {
        case 1:
          return createTenantSelectChain("PRODUCER");
        case 2:
          return createThenableChain([
            {
              tenant: {
                id: "producer-tenant-1",
                name: "Fazenda Boa Terra",
                stripeAccountId: "acct_existing_incomplete",
              },
              email: "produtor@example.com",
              name: "Maria da Silva",
            },
          ]);
        default:
          throw new Error(`Unexpected select call #${selectCallCount}`);
      }
    },
    update() {
      return createUpdateChain(() => undefined);
    },
  });

  const caller = await createStripeCaller(db);
  const result = await (caller as StripeCaller).stripe.createStripeConnect({});

  assert.equal(
    (result as { url?: string }).url,
    "https://stripe.example/account-onboarding",
  );
  assert.equal(stripeState.loginLinkAccountId, null);
  assert.equal(stripeState.createdAccountPayload, null);
  assert.deepEqual(stripeState.createdAccountLinkPayload, {
    account: "acct_existing_incomplete",
    refresh_url: "https://app.example.com/dashboard",
    return_url: "https://app.example.com/dashboard",
    type: "account_onboarding",
  });
});

test("stripe.createStripeConnect surfaces pending Stripe platform profile setup as a precondition failure", async () => {
  let selectCallCount = 0;
  stripeState.createAccountError =
    createStripePlatformLossesConfigurationError();

  const db = withRlsMockDb({
    select() {
      selectCallCount += 1;

      switch (selectCallCount) {
        case 1:
          return createTenantSelectChain("PRODUCER");
        case 2:
          return createThenableChain([
            {
              tenant: {
                id: "producer-tenant-1",
                name: "Fazenda Boa Terra",
                stripeAccountId: null,
              },
              email: "produtor@example.com",
              name: "Maria da Silva",
            },
          ]);
        default:
          throw new Error(`Unexpected select call #${selectCallCount}`);
      }
    },
    update() {
      return createUpdateChain(() => undefined);
    },
  });

  const caller = await createStripeCaller(db);

  await assert.rejects(
    () => (caller as StripeCaller).stripe.createStripeConnect({}),
    /configuracao de recebimento da plataforma|perfil financeiro da plataforma/i,
  );

  assert.equal(stripeState.createdAccountPayload, null);
  assert.equal(stripeState.createdAccountLinkPayload, null);
});
