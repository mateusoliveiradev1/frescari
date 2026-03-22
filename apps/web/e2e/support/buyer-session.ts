import { exec } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

const BUYER_PASSWORD = "CodexBuyer123!";
const execAsync = promisify(exec);

export type BuyerJourneyFixture = {
  addressTitle: string;
  cookie: string;
  formattedAddress: string;
  orderId: string;
  primaryFarmId: string;
  primaryFarmName: string;
  primaryLotId: string;
  primaryProductName: string;
  secondaryFarmId: string;
  secondaryFarmName: string;
  secondaryLotId: string;
  secondaryProductName: string;
  sellerName: string;
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

export async function createBuyerJourneyFixture(): Promise<BuyerJourneyFixture> {
  loadWebEnv();

  const script = `
import { parseSetCookieHeader } from "better-auth/cookies";
import { eq } from "drizzle-orm";
import {
  addresses,
  authDb,
  enableRlsBypassContext,
  farms,
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

const buyerPassword = ${JSON.stringify(BUYER_PASSWORD)};

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

(async () => {
  const suffix = \`\${Date.now()}-\${Math.random().toString(36).slice(2, 8)}\`;
  const buyerEmail = \`codex.buyer.\${suffix}@example.com\`;
  const buyerName = \`Comprador E2E \${suffix}\`;
  const buyerTenantName = \`Mercearia E2E \${suffix}\`;
  const buyerTenantSlug = \`\${makeSlug(buyerTenantName)}-\${suffix}\`;
  const addressTitle = "Entrega principal";
  const formattedAddress = "Rua E2E, 123 - Sao Paulo/SP";
  const sellerName = \`Fazenda Aurora E2E \${suffix}\`;
  const secondarySellerName = \`Sitio Vale Verde E2E \${suffix}\`;
  const primaryProductName = \`Tomate Italiano E2E \${suffix}\`;
  const secondaryProductName = \`Alface Crespa E2E \${suffix}\`;

  await auth.api.signUpEmail({
    body: {
      email: buyerEmail,
      name: buyerName,
      password: buyerPassword,
    },
  });

  const buyerUser = await authDb.query.users.findFirst({
    where: eq(users.email, buyerEmail),
  });

  if (!buyerUser) {
    throw new Error("Nao foi possivel localizar o usuario comprador recem-criado.");
  }

  const result = await authDb.transaction(async (tx) => {
    await enableRlsBypassContext(tx);

    const [buyerTenant] = await tx
      .insert(tenants)
      .values({
        name: buyerTenantName,
        slug: buyerTenantSlug,
        type: "BUYER",
        plan: "pro",
      })
      .returning({ id: tenants.id });

    await tx
      .update(users)
      .set({
        role: "buyer",
        tenantId: buyerTenant.id,
      })
      .where(eq(users.id, buyerUser.id));

    await tx.insert(addresses).values({
      tenantId: buyerTenant.id,
      title: addressTitle,
      zipcode: "01010-000",
      street: "Rua E2E",
      number: "123",
      neighborhood: "Centro",
      city: "Sao Paulo",
      state: "SP",
      country: "BR",
      complement: "Conjunto 4",
      formattedAddress,
      isDefault: true,
      location: [-46.6333, -23.5505],
    });

    const [primaryProducerTenant] = await tx
      .insert(tenants)
      .values({
        name: sellerName,
        slug: \`\${makeSlug(sellerName)}-\${suffix}\`,
        type: "PRODUCER",
        plan: "pro",
        stripeAccountId: \`acct_e2e_primary_\${suffix}\`,
      })
      .returning({ id: tenants.id });

    const [secondaryProducerTenant] = await tx
      .insert(tenants)
      .values({
        name: secondarySellerName,
        slug: \`\${makeSlug(secondarySellerName)}-\${suffix}\`,
        type: "PRODUCER",
        plan: "pro",
        stripeAccountId: \`acct_e2e_secondary_\${suffix}\`,
      })
      .returning({ id: tenants.id });

    const [primaryFarm] = await tx
      .insert(farms)
      .values({
        tenantId: primaryProducerTenant.id,
        name: sellerName,
        address: {
          street: "Estrada da Aurora",
          number: "1200",
          neighborhood: "Zona Rural",
          city: "Sao Paulo",
          state: "SP",
          postalCode: "01010-000",
          country: "BR",
        },
        location: [-46.628, -23.548],
        baseDeliveryFee: "8.00",
        pricePerKm: "1.50",
        maxDeliveryRadiusKm: "40.00",
        minOrderValue: "10.00",
        freeShippingThreshold: "60.00",
      })
      .returning({ id: farms.id });

    const [secondaryFarm] = await tx
      .insert(farms)
      .values({
        tenantId: secondaryProducerTenant.id,
        name: secondarySellerName,
        address: {
          street: "Estrada do Vale",
          number: "88",
          neighborhood: "Zona Rural",
          city: "Sao Paulo",
          state: "SP",
          postalCode: "01010-000",
          country: "BR",
        },
        location: [-46.6375, -23.5555],
        baseDeliveryFee: "7.50",
        pricePerKm: "1.25",
        maxDeliveryRadiusKm: "40.00",
        minOrderValue: "10.00",
        freeShippingThreshold: "55.00",
      })
      .returning({ id: farms.id });

    const [primaryCategory] = await tx
      .insert(productCategories)
      .values({
        name: \`Categoria Aurora \${suffix}\`,
        slug: \`categoria-aurora-\${suffix}\`,
      })
      .returning({ id: productCategories.id });

    const [secondaryCategory] = await tx
      .insert(productCategories)
      .values({
        name: \`Categoria Vale \${suffix}\`,
        slug: \`categoria-vale-\${suffix}\`,
      })
      .returning({ id: productCategories.id });

    const [primaryMasterProduct] = await tx
      .insert(masterProducts)
      .values({
        name: primaryProductName,
        category: "Hortalicas",
        pricingType: "UNIT",
      })
      .returning({ id: masterProducts.id });

    const [secondaryMasterProduct] = await tx
      .insert(masterProducts)
      .values({
        name: secondaryProductName,
        category: "Folhosas",
        pricingType: "UNIT",
      })
      .returning({ id: masterProducts.id });

    const [primaryProduct] = await tx
      .insert(products)
      .values({
        tenantId: primaryProducerTenant.id,
        farmId: primaryFarm.id,
        categoryId: primaryCategory.id,
        masterProductId: primaryMasterProduct.id,
        sku: \`E2E-TOM-\${suffix}\`,
        name: primaryProductName,
        saleUnit: "unit",
        unitWeightG: null,
        pricePerUnit: "24.9000",
        minOrderQty: "1.000",
        images: [],
        isActive: true,
      })
      .returning({ id: products.id });

    const [secondaryProduct] = await tx
      .insert(products)
      .values({
        tenantId: secondaryProducerTenant.id,
        farmId: secondaryFarm.id,
        categoryId: secondaryCategory.id,
        masterProductId: secondaryMasterProduct.id,
        sku: \`E2E-ALF-\${suffix}\`,
        name: secondaryProductName,
        saleUnit: "unit",
        unitWeightG: null,
        pricePerUnit: "14.5000",
        minOrderQty: "1.000",
        images: [],
        isActive: true,
      })
      .returning({ id: products.id });

    const [primaryLot] = await tx
      .insert(productLots)
      .values({
        tenantId: primaryProducerTenant.id,
        productId: primaryProduct.id,
        lotCode: \`LOT-AURORA-\${suffix}\`,
        harvestDate: isoDateOffset(-1),
        expiryDate: isoDateOffset(7),
        availableQty: "40.000",
        reservedQty: "0.000",
        pricingType: "UNIT",
        freshnessScore: 92,
        storageLocation: "Camara fria A",
        unit: "un",
        isExpired: false,
      })
      .returning({ id: productLots.id });

    const [secondaryLot] = await tx
      .insert(productLots)
      .values({
        tenantId: secondaryProducerTenant.id,
        productId: secondaryProduct.id,
        lotCode: \`LOT-VALE-\${suffix}\`,
        harvestDate: isoDateOffset(-1),
        expiryDate: isoDateOffset(6),
        availableQty: "55.000",
        reservedQty: "0.000",
        pricingType: "UNIT",
        freshnessScore: 88,
        storageLocation: "Estoque fresco B",
        unit: "un",
        isExpired: false,
      })
      .returning({ id: productLots.id });

    const [order] = await tx
      .insert(orders)
      .values({
        buyerTenantId: buyerTenant.id,
        sellerTenantId: primaryProducerTenant.id,
        status: "confirmed",
        deliveryStreet: "Rua E2E",
        deliveryNumber: "123",
        deliveryCep: "01010-000",
        deliveryCity: "Sao Paulo",
        deliveryState: "SP",
        deliveryAddress: formattedAddress,
        deliveryNotes: "Tocar interfone",
        deliveryPoint: {
          type: "Point",
          coordinates: [-46.6333, -23.5505],
        },
        deliveryFee: "9.00",
        totalAmount: "58.8000",
      })
      .returning({ id: orders.id });

    await tx.insert(orderItems).values({
      orderId: order.id,
      lotId: primaryLot.id,
      productId: primaryProduct.id,
      qty: "2.000",
      unitPrice: "24.9000",
      saleUnit: "unit",
    });

    return {
      addressTitle,
      formattedAddress,
      orderId: order.id,
      primaryFarmId: primaryFarm.id,
      primaryFarmName: primaryFarm.name,
      primaryLotId: primaryLot.id,
      primaryProductName,
      secondaryFarmId: secondaryFarm.id,
      secondaryFarmName: secondaryFarm.name,
      secondaryLotId: secondaryLot.id,
      secondaryProductName,
      sellerName,
    };
  });

  const response = await auth.api.signInEmail({
    asResponse: true,
    body: {
      email: buyerEmail,
      password: buyerPassword,
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
    `create-buyer-session-${Date.now()}.ts`,
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
    ? (JSON.parse(output) as Partial<BuyerJourneyFixture>)
    : undefined;

  if (
    !fixture?.cookie ||
    !fixture.primaryFarmId ||
    !fixture.primaryLotId ||
    !fixture.secondaryFarmId ||
    !fixture.secondaryLotId ||
    !fixture.orderId
  ) {
    throw new Error(
      "Nao foi possivel criar a fixture do comprador para o fluxo E2E.",
    );
  }

  return {
    addressTitle: fixture.addressTitle ?? "Entrega principal",
    cookie: fixture.cookie,
    formattedAddress: fixture.formattedAddress ?? "",
    orderId: fixture.orderId,
    primaryFarmId: fixture.primaryFarmId,
    primaryFarmName: fixture.primaryFarmName ?? "",
    primaryLotId: fixture.primaryLotId,
    primaryProductName: fixture.primaryProductName ?? "",
    secondaryFarmId: fixture.secondaryFarmId,
    secondaryFarmName: fixture.secondaryFarmName ?? "",
    secondaryLotId: fixture.secondaryLotId,
    secondaryProductName: fixture.secondaryProductName ?? "",
    sellerName: fixture.sellerName ?? "",
  };
}
