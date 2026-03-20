import path from "node:path";

import { Pool } from "@neondatabase/serverless";
import { config } from "dotenv";

import { applyFinalRlsState } from "./rls-finalizer";

config({ path: path.resolve(__dirname, "../../../.env") });

const connectionString =
  process.env.DATABASE_ADMIN_URL || process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_ADMIN_URL or DATABASE_URL is required to apply the final RLS state.",
  );
}

const pool = new Pool({ connectionString });

async function main() {
  try {
    await applyFinalRlsState(pool);
    console.log("Final RLS state applied successfully.");
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Final RLS state failed:", error);
  process.exit(1);
});
