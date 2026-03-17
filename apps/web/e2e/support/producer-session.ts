import { exec } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

const PRODUCER_PASSWORD = "CodexProducer123!";
const execAsync = promisify(exec);

export type ProducerDashboardFixtureOptions = {
    seedFarm: boolean;
    seedVehicle: boolean;
    seedPendingDelivery: boolean;
    seedConfirmedDispatch: boolean;
    seedPendingDeliveryCount?: number;
};

type ProducerDashboardFixture = {
    buyerName: string | null;
    buyerNames: string[];
    cookie: string;
    orderId: string | null;
    orderIds: string[];
    producerTenantId: string;
    vehicleLabel: string | null;
};

function loadWebEnv() {
    const envPath = path.resolve(process.cwd(), ".env.local");
    const envContents = readFileSync(envPath, "utf8");

    for (const rawLine of envContents.split(/\r?\n/)) {
        const line = rawLine.trim();

        if (!line || line.startsWith("#")) {
            continue;
        }

        const separatorIndex = line.indexOf("=");
        if (separatorIndex === -1) {
            continue;
        }

        const key = line.slice(0, separatorIndex).trim();
        let value = line.slice(separatorIndex + 1).trim();

        if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1);
        }

        process.env[key] = value;
    }
}

export async function createProducerDashboardFixture(
    options: ProducerDashboardFixtureOptions,
): Promise<ProducerDashboardFixture> {
    loadWebEnv();

    const script = `
import { parseSetCookieHeader } from "better-auth/cookies";
import { eq } from "drizzle-orm";
import {
  authDb,
  deliveryDispatchWaveOrders,
  deliveryDispatchWaves,
  enableRlsBypassContext,
  farms,
  farmVehicles,
  masterProducts,
  orderItems,
  orders,
  productCategories,
  productLots,
  products,
  tenants,
  users,
} from "@frescari/db";
import { auth } from "../src/lib/auth";

const options = ${JSON.stringify(options)};
const producerPassword = ${JSON.stringify(PRODUCER_PASSWORD)};

function makeSlug(value) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\\u0300-\\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function isoDateOffset(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function makeFutureDate(hoursFromNow) {
  return new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
}

(async () => {
  const suffix = \`\${Date.now()}-\${Math.random().toString(36).slice(2, 8)}\`;
  const producerEmail = \`codex.producer.\${suffix}@example.com\`;
  const producerName = \`Produtor E2E \${suffix}\`;
  const producerCompanyName = \`Fazenda E2E \${suffix}\`;
  const producerTenantSlug = \`\${makeSlug(producerCompanyName)}-\${suffix}\`;
  const requestedDeliveryCount = options.seedPendingDeliveryCount ?? (options.seedPendingDelivery || options.seedConfirmedDispatch ? 1 : 0);
  const pendingDeliveryCount = Math.max(0, requestedDeliveryCount);
  const vehicleLabel = options.seedVehicle || options.seedConfirmedDispatch ? \`Van E2E \${suffix}\` : null;

  await auth.api.signUpEmail({
    body: {
      email: producerEmail,
      name: producerName,
      password: producerPassword,
    },
  });

  const producerUser = await authDb.query.users.findFirst({
    where: eq(users.email, producerEmail),
  });

  if (!producerUser) {
    throw new Error("Nao foi possivel localizar o usuario produtor recem-criado.");
  }

  const result = await authDb.transaction(async (tx) => {
    await enableRlsBypassContext(tx);

    const [producerTenant] = await tx
      .insert(tenants)
      .values({
        name: producerCompanyName,
        slug: producerTenantSlug,
        type: "PRODUCER",
        plan: "pro",
      })
      .returning({ id: tenants.id });

    await tx
      .update(users)
      .set({
        role: "producer",
        tenantId: producerTenant.id,
      })
      .where(eq(users.id, producerUser.id));

    let farmId = null;
    let seededVehicleId = null;
    let seededOrderId = null;
    const seededBuyerNames = [];
    const seededOrderIds = [];

    if (options.seedFarm || options.seedVehicle || options.seedPendingDelivery || options.seedConfirmedDispatch) {
      const [farm] = await tx
        .insert(farms)
        .values({
          tenantId: producerTenant.id,
          name: "Sitio Horizonte E2E",
          address: {
            street: "Estrada do Campo",
            number: "1200",
            neighborhood: "Zona Rural",
            city: "Ibiuna",
            state: "SP",
            postalCode: "18150-000",
            country: "BR",
          },
          location: [-47.2239, -23.6565],
          baseDeliveryFee: "12.00",
          pricePerKm: "4.50",
          maxDeliveryRadiusKm: "30",
          minOrderValue: "80.00",
          freeShippingThreshold: "200.00",
        })
        .returning({ id: farms.id });

      farmId = farm.id;
    }

    if ((options.seedVehicle || options.seedConfirmedDispatch) && farmId) {
      const [vehicle] = await tx
        .insert(farmVehicles)
        .values({
          tenantId: producerTenant.id,
          farmId,
          label: vehicleLabel,
          vehicleType: "refrigerated_van",
          capacityKg: "900.000",
          refrigeration: true,
          availabilityStatus: "available",
          notes: "Veiculo seeded para a mesa logistica.",
        })
        .returning({ id: farmVehicles.id });

      seededVehicleId = vehicle.id;
    }

    if (pendingDeliveryCount > 0) {
      if (!farmId) {
        throw new Error("Seed de entrega exige fazenda cadastrada.");
      }

      const [category] = await tx
        .insert(productCategories)
        .values({
          name: \`Categoria E2E \${suffix}\`,
          slug: \`categoria-e2e-\${suffix}\`,
        })
        .returning({ id: productCategories.id });

      const [masterProduct] = await tx
        .insert(masterProducts)
        .values({
          name: \`Tomate E2E \${suffix}\`,
          category: "Hortalicas",
          pricingType: "WEIGHT",
        })
        .returning({ id: masterProducts.id });

      const [product] = await tx
        .insert(products)
        .values({
          tenantId: producerTenant.id,
          farmId,
          categoryId: category.id,
          masterProductId: masterProduct.id,
          name: "Tomate Italiano Premium",
          sku: \`E2E-TOM-\${suffix}\`,
          saleUnit: "kg",
          unitWeightG: null,
          pricePerUnit: "10.0000",
          minOrderQty: "1.000",
          isActive: true,
          images: [],
        })
        .returning({ id: products.id });

      const [lot] = await tx
        .insert(productLots)
        .values({
          tenantId: producerTenant.id,
          productId: product.id,
          lotCode: \`LOT-E2E-\${suffix}\`,
          harvestDate: isoDateOffset(-1),
          expiryDate: isoDateOffset(1),
          availableQty: "200.000",
          reservedQty: "0.000",
          pricingType: "WEIGHT",
          freshnessScore: 35,
          storageLocation: "Camara fria A",
          unit: "kg",
          isExpired: false,
        })
        .returning({ id: productLots.id });

      for (let index = 0; index < pendingDeliveryCount; index += 1) {
        const buyerName = \`Restaurante E2E \${suffix} \${index + 1}\`;
        const buyerTenantSlug = \`\${makeSlug(buyerName)}-\${suffix}-\${index + 1}\`;
        const [buyerTenant] = await tx
          .insert(tenants)
          .values({
            name: buyerName,
            slug: buyerTenantSlug,
            type: "BUYER",
            plan: "pro",
          })
          .returning({ id: tenants.id });

        const orderStatus =
          options.seedConfirmedDispatch && index === 0 ? "ready_for_dispatch" : "confirmed";

        const [order] = await tx
          .insert(orders)
          .values({
            buyerTenantId: buyerTenant.id,
            sellerTenantId: producerTenant.id,
            status: orderStatus,
            deliveryStreet: "Rua das Palmeiras",
            deliveryNumber: String(45 + index),
            deliveryCep: "01010-000",
            deliveryCity: "Sao Paulo",
            deliveryState: "SP",
            deliveryAddress: \`Rua das Palmeiras, \${45 + index} - Sao Paulo/SP\`,
            deliveryNotes: "Receber ate as 10h",
            deliveryPoint: {
              type: "Point",
              coordinates: [-46.6503 - index * 0.002, -23.5631 - index * 0.0015],
            },
            deliveryWindowStart: makeFutureDate(2 + index),
            deliveryWindowEnd: makeFutureDate(5 + index),
            deliveryFee: "18.00",
            totalAmount: index === 0 ? "138.0000" : "96.0000",
          })
          .returning({ id: orders.id });

        seededOrderIds.push(order.id);
        seededBuyerNames.push(buyerName);

        await tx.insert(orderItems).values({
          orderId: order.id,
          lotId: lot.id,
          productId: product.id,
          qty: index === 0 ? "12.000" : "8.000",
          unitPrice: "10.0000",
          saleUnit: "kg",
        });
      }

      seededOrderId = seededOrderIds[0] ?? null;

      if (options.seedConfirmedDispatch) {
        if (!seededVehicleId) {
          throw new Error("Seed de dispatch confirmado exige veiculo selecionado.");
        }

        const operationDate = new Date().toISOString().slice(0, 10);

        const [wave] = await tx
          .insert(deliveryDispatchWaves)
          .values({
            tenantId: producerTenant.id,
            farmId,
            operationDate,
            status: "confirmed",
            confidence: "high",
            recommendedVehicleType: "refrigerated_van",
            selectedVehicleId: seededVehicleId,
            selectedVehicleLabel: vehicleLabel,
            recommendationSummary: "Seeded dispatch wave for E2E coverage.",
            recommendationSnapshot: {
              priorityScore: 90,
              urgencyLevel: "high",
              riskLevel: "high",
              confidence: "high",
              suggestedVehicleType: "refrigerated_van",
              explanation: "Seeded dispatch wave for E2E coverage.",
              reasons: ["seeded"],
            },
            confirmedByUserId: producerUser.id,
          })
          .returning({ id: deliveryDispatchWaves.id });

        await tx.insert(deliveryDispatchWaveOrders).values({
          waveId: wave.id,
          orderId: seededOrderIds[0],
          sequence: 1,
          priorityScore: 100,
        });
      }

      return {
        buyerName: seededBuyerNames[0] ?? null,
        buyerNames: seededBuyerNames,
        orderId: seededOrderId,
        orderIds: seededOrderIds,
        producerTenantId: producerTenant.id,
        vehicleLabel,
      };
    }

    return {
      buyerName: null,
      buyerNames: [],
      orderId: null,
      orderIds: [],
      producerTenantId: producerTenant.id,
      vehicleLabel,
    };
  });

  const response = await auth.api.signInEmail({
    asResponse: true,
    body: {
      email: producerEmail,
      password: producerPassword,
    },
  });

  const cookie = parseSetCookieHeader(response.headers.get("set-cookie") ?? "")
    .get("better-auth.session_token")
    ?.value;

  console.log(
    JSON.stringify({
      ...result,
      cookie,
    }),
  );
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
`;

    const tempDir = path.resolve(process.cwd(), ".playwright-tmp");
    mkdirSync(tempDir, { recursive: true });

    const scriptPath = path.join(
        tempDir,
        `create-producer-session-${Date.now()}.ts`,
    );
    writeFileSync(scriptPath, script, "utf8");

    let stdout = "";

    try {
        const result = await execAsync(`pnpm exec tsx "${scriptPath}"`, {
            cwd: process.cwd(),
            env: process.env,
            maxBuffer: 1024 * 1024 * 10,
        });
        stdout = result.stdout;
    } finally {
        rmSync(scriptPath, { force: true });
    }

    const output = stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .at(-1);

    const fixture = output
        ? (JSON.parse(output) as Partial<ProducerDashboardFixture>)
        : undefined;

    if (!fixture?.cookie || !fixture.producerTenantId) {
        throw new Error(
            "Nao foi possivel criar a fixture do produtor para o fluxo E2E.",
        );
    }

    return {
        buyerName: fixture.buyerName ?? null,
        buyerNames: fixture.buyerNames ?? [],
        cookie: fixture.cookie,
        orderId: fixture.orderId ?? null,
        orderIds: fixture.orderIds ?? [],
        producerTenantId: fixture.producerTenantId,
        vehicleLabel: fixture.vehicleLabel ?? null,
    };
}
