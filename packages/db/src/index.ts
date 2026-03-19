import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";
export const connectionString =
  process.env.DATABASE_URL ||
  "postgres://mock:mock@ep-mock-123456.us-east-2.aws.neon.tech/neondb";
export const adminConnectionString =
  process.env.DATABASE_ADMIN_URL ||
  process.env.DATABASE_URL ||
  connectionString;
const authConnectionString = process.env.DATABASE_URL || connectionString;

// Neon requires legitimate postgres format. Provide a mock proxy pattern for static builds.
const connectionUrl =
  process.env.NODE_ENV === "production" && !process.env.DATABASE_URL
    ? "postgres://mock:mock@ep-mock-123456.us-east-2.aws.neon.tech/neondb"
    : connectionString;
// Runtime auth flows must use the same restricted role as the application.
// DATABASE_ADMIN_URL stays reserved for migrations/bootstrap only.
const authConnectionUrl =
  process.env.NODE_ENV === "production" && !process.env.DATABASE_URL
    ? "postgres://mock:mock@ep-mock-123456.us-east-2.aws.neon.tech/neondb"
    : authConnectionString;

function createPool(connectionString: string, label: "app" | "auth") {
  const pool = new Pool({ connectionString });

  // Pool errors can surface from idle connections after a network reset.
  // Handle them explicitly so workers don't emit raw uncaught socket errors.
  pool.on("error", (error: Error) => {
    console.error(`[db:${label}] pool error:`, error);
  });

  return pool;
}

export const client = createPool(connectionUrl, "app");
export const authClient = createPool(authConnectionUrl, "auth");

export const db = drizzle(client, { schema });
export const authDb = drizzle(authClient, { schema });
export type AppDb = Omit<typeof db, "$client">;

export async function closeDbPools() {
  await Promise.allSettled([client.end(), authClient.end()]);
}

export * from "./schema";
export * from "./connection-string";
export * from "./rls-scope";
export * from "./product-lot-scope";
