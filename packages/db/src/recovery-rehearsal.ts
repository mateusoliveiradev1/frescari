import { writeFile } from "node:fs/promises";
import path from "node:path";

import { Pool } from "@neondatabase/serverless";
import { config } from "dotenv";

import { sanitizeEnvValue } from "./env";

config({ path: path.resolve(__dirname, "../../../.env") });

const connectionString = sanitizeEnvValue(
  process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL,
);
const keepSchema = process.env.KEEP_RECOVERY_DRILL_SCHEMA === "1";
const reportPath = sanitizeEnvValue(process.env.RECOVERY_DRILL_REPORT_PATH);

if (!connectionString) {
  throw new Error(
    "DATABASE_ADMIN_URL or DATABASE_URL is required to run the recovery rehearsal.",
  );
}

const criticalTables = [
  "tenants",
  "user",
  "account",
  "session",
  "verification",
  "addresses",
  "farms",
  "product_categories",
  "master_products",
  "products",
  "product_lots",
  "orders",
  "order_items",
  "notifications",
  "farm_vehicles",
  "delivery_dispatch_overrides",
  "delivery_dispatch_waves",
  "delivery_dispatch_wave_orders",
] as const;

type CountRow = {
  count: string;
};

type SettingRow = {
  name: string;
  setting: string;
};

function quoteIdentifier(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function buildDrillSchemaName() {
  const now = new Date();
  const compact = now
    .toISOString()
    .replace(/[-:TZ.]/g, "")
    .slice(0, 14);
  return `recovery_drill_${compact}`;
}

async function getTableCount(pool: Pool, schema: string, table: string) {
  const qualifiedTable = `${quoteIdentifier(schema)}.${quoteIdentifier(table)}`;
  const { rows } = await pool.query<CountRow>(
    `SELECT COUNT(*)::text AS count FROM ${qualifiedTable};`,
  );

  return Number.parseInt(rows[0]?.count ?? "0", 10);
}

async function main() {
  const pool = new Pool({ connectionString });
  const drillSchema = buildDrillSchemaName();

  try {
    const { rows: neonSettingsRows } = await pool.query<SettingRow>(
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

    const neonSettings = Object.fromEntries(
      neonSettingsRows.map((row) => [row.name, row.setting]),
    );

    await pool.query(`CREATE SCHEMA ${quoteIdentifier(drillSchema)};`);

    const rehearsalResults: Array<{
      table: string;
      sourceCount: number;
      restoredCount: number;
    }> = [];

    for (const table of criticalTables) {
      const sourceQualified = `${quoteIdentifier("public")}.${quoteIdentifier(table)}`;
      const targetQualified = `${quoteIdentifier(drillSchema)}.${quoteIdentifier(table)}`;

      await pool.query(
        `CREATE TABLE ${targetQualified} AS TABLE ${sourceQualified} WITH NO DATA;`,
      );
      await pool.query(
        `INSERT INTO ${targetQualified} SELECT * FROM ${sourceQualified};`,
      );

      const sourceCount = await getTableCount(pool, "public", table);
      const restoredCount = await getTableCount(pool, drillSchema, table);

      if (sourceCount !== restoredCount) {
        throw new Error(
          `Recovery rehearsal count mismatch for ${table}: source=${sourceCount}, restored=${restoredCount}.`,
        );
      }

      rehearsalResults.push({
        table,
        sourceCount,
        restoredCount,
      });
    }

    const report = {
      executedAt: new Date().toISOString(),
      drillSchema,
      keepSchema,
      source: "DATABASE_ADMIN_URL_or_DATABASE_URL",
      neon: {
        projectId: neonSettings["neon.project_id"] ?? null,
        branchId: neonSettings["neon.branch_id"] ?? null,
        endpointId: neonSettings["neon.endpoint_id"] ?? null,
        computeId: neonSettings["neon.compute_id"] ?? null,
      },
      tables: rehearsalResults,
    };

    console.log(JSON.stringify(report, null, 2));

    if (reportPath) {
      await writeFile(
        reportPath,
        `${JSON.stringify(report, null, 2)}\n`,
        "utf8",
      );
      console.log(`RECOVERY_DRILL_REPORT=${reportPath}`);
    }
  } finally {
    if (!keepSchema) {
      try {
        await pool.query(
          `DROP SCHEMA IF EXISTS ${quoteIdentifier(drillSchema)} CASCADE;`,
        );
      } catch (error) {
        console.warn(
          `Failed to drop rehearsal schema ${drillSchema}: ${(error as Error).message}`,
        );
      }
    }

    await pool.end();
  }
}

main().catch((error) => {
  console.error(`Recovery rehearsal failed: ${error.message}`);
  process.exit(1);
});
