import { Pool } from "@neondatabase/serverless";
import { config } from "dotenv";
import path from "path";

import { sanitizeEnvValue } from "./env";

config({ path: path.resolve(__dirname, "../../../.env") });

const connectionString = sanitizeEnvValue(
  process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL,
);
const expectedBranchId = sanitizeEnvValue(process.env.EXPECTED_NEON_BRANCH_ID);

if (!connectionString) {
  throw new Error(
    "DATABASE_ADMIN_URL or DATABASE_URL is required to inspect the Neon target.",
  );
}

type SettingRow = {
  name: string;
  setting: string;
};

async function main() {
  const pool = new Pool({ connectionString });

  try {
    const { rows } = await pool.query<SettingRow>(
      `
        SELECT name, setting
        FROM pg_settings
        WHERE name IN (
          'neon.project_id',
          'neon.branch_id',
          'neon.endpoint_id',
          'neon.compute_id'
        )
        ORDER BY name;
      `,
    );

    const settings = Object.fromEntries(
      rows.map((row) => [row.name, row.setting]),
    );

    const branchId = settings["neon.branch_id"];

    if (!branchId) {
      throw new Error("Could not resolve neon.branch_id from pg_settings.");
    }

    for (const [label, key] of [
      ["NEON_PROJECT_ID", "neon.project_id"],
      ["NEON_BRANCH_ID", "neon.branch_id"],
      ["NEON_ENDPOINT_ID", "neon.endpoint_id"],
      ["NEON_COMPUTE_ID", "neon.compute_id"],
    ] as const) {
      const value = settings[key];

      if (value) {
        console.log(`${label}=${value}`);
      }
    }

    if (expectedBranchId && branchId !== expectedBranchId) {
      throw new Error(
        `Expected Neon branch ${expectedBranchId}, but the workflow is targeting ${branchId}.`,
      );
    }

    if (expectedBranchId) {
      console.log("NEON_BRANCH_CHECK=matched");
    } else {
      console.log("NEON_BRANCH_CHECK=skipped");
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(`Neon target inspection failed: ${error.message}`);
  process.exit(1);
});
