import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { and, asc, eq, inArray, isNotNull } from "drizzle-orm";
import { z } from "zod";

import { closeDbPools, db, tenants } from "@frescari/db";

import {
  deriveStripeConnectStatus,
  hasLegacyUnsyncedStripeConnect,
  type StripeConnectState,
  type TenantStripeConnectSnapshot,
} from "../utils/stripe-connect-status";

const cliArgsSchema = z.object({
  failOnLegacy: z.boolean().default(false),
  json: z.boolean().default(false),
  limit: z.number().int().min(1).max(200).default(50),
  tenantIds: z.array(z.string().min(1)).optional(),
});

export type StripeConnectLegacyAuditCliArgs = z.infer<typeof cliArgsSchema>;

export type StripeConnectLegacyAuditSource = {
  accountId: string;
  snapshot: TenantStripeConnectSnapshot;
  tenantId: string;
  tenantName: string;
};

export type StripeConnectLegacyAuditItem = {
  accountId: string;
  canReceivePayments: boolean;
  disabledReason: string | null;
  legacyUnsynced: boolean;
  missingFields: string[];
  state: StripeConnectState;
  syncedAt: Date | null;
  tenantId: string;
  tenantName: string;
};

export type StripeConnectLegacyAuditReport = {
  items: StripeConnectLegacyAuditItem[];
  summary: {
    byState: Record<StripeConnectState, number>;
    legacyUnsynced: number;
    total: number;
  };
};

function readArgValue(argv: string[], index: number, flag: string) {
  const value = argv[index + 1];

  if (!value) {
    throw new Error(`${flag} requires a value.`);
  }

  return value;
}

function printHelp() {
  console.info(`Usage: pnpm --filter @frescari/api stripe:connect:audit-legacy [options]

Options:
  --limit <n>            Maximum number of producer tenants to inspect.
  --tenant-id <id>       Restrict the audit to a specific tenant. Repeatable.
  --json                 Print the full report as JSON.
  --fail-on-legacy       Exit with code 1 when any legacy unsynced account remains.
  --help                 Show this help message.
`);
}

export function parseStripeConnectLegacyAuditCliArgs(
  argv = process.argv.slice(2),
) {
  const tenantIds: string[] = [];
  let failOnLegacy = false;
  let json = false;
  let limit = 50;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (!arg) {
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      continue;
    }

    if (arg === "--json") {
      json = true;
      continue;
    }

    if (arg === "--fail-on-legacy") {
      failOnLegacy = true;
      continue;
    }

    if (arg === "--limit") {
      limit = Number(readArgValue(argv, index, "--limit"));
      index += 1;
      continue;
    }

    if (arg.startsWith("--limit=")) {
      limit = Number(arg.slice("--limit=".length));
      continue;
    }

    if (arg === "--tenant-id") {
      tenantIds.push(readArgValue(argv, index, "--tenant-id"));
      index += 1;
      continue;
    }

    if (arg.startsWith("--tenant-id=")) {
      tenantIds.push(arg.slice("--tenant-id=".length));
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return cliArgsSchema.parse({
    failOnLegacy,
    json,
    limit,
    tenantIds: tenantIds.length > 0 ? tenantIds : undefined,
  });
}

export function buildStripeConnectLegacyAuditReport(
  entries: StripeConnectLegacyAuditSource[],
): StripeConnectLegacyAuditReport {
  const summary: StripeConnectLegacyAuditReport["summary"] = {
    byState: {
      not_started: 0,
      pending_information: 0,
      ready: 0,
      restricted: 0,
      under_review: 0,
    },
    legacyUnsynced: 0,
    total: entries.length,
  };

  const items = entries.map((entry) => {
    const status = deriveStripeConnectStatus(entry.snapshot);
    const legacyUnsynced = hasLegacyUnsyncedStripeConnect(entry.snapshot);

    summary.byState[status.state] += 1;

    if (legacyUnsynced) {
      summary.legacyUnsynced += 1;
    }

    return {
      accountId: entry.accountId,
      canReceivePayments: status.canReceivePayments,
      disabledReason: status.disabledReason,
      legacyUnsynced,
      missingFields: status.missingFields,
      state: status.state,
      syncedAt: status.syncedAt,
      tenantId: entry.tenantId,
      tenantName: entry.tenantName,
    } satisfies StripeConnectLegacyAuditItem;
  });

  return {
    items,
    summary,
  };
}

export function shouldFailStripeConnectLegacyAudit(
  args: StripeConnectLegacyAuditCliArgs,
  report: StripeConnectLegacyAuditReport,
) {
  return args.failOnLegacy && report.summary.legacyUnsynced > 0;
}

function printTextReport(report: StripeConnectLegacyAuditReport) {
  console.info("[stripe-connect-legacy-audit] summary:");
  console.info(JSON.stringify(report.summary, null, 2));

  const legacyTenants = report.items.filter((item) => item.legacyUnsynced);

  if (legacyTenants.length === 0) {
    console.info(
      "[stripe-connect-legacy-audit] no legacy unsynced producer accounts were found.",
    );
    return;
  }

  console.info("[stripe-connect-legacy-audit] legacy unsynced tenants:");

  for (const tenant of legacyTenants) {
    console.info(
      `- ${tenant.tenantId} | ${tenant.tenantName} | ${tenant.accountId}`,
    );
  }
}

export async function runStripeConnectLegacyAuditCli(
  argv = process.argv.slice(2),
) {
  if (argv.includes("--help") || argv.includes("-h")) {
    printHelp();
    await closeDbPools();
    return;
  }

  const args = parseStripeConnectLegacyAuditCliArgs(argv);
  const whereClauses = [
    eq(tenants.type, "PRODUCER"),
    isNotNull(tenants.stripeAccountId),
  ];

  if (args.tenantIds?.length) {
    whereClauses.push(inArray(tenants.id, args.tenantIds));
  }

  try {
    const rows = await db
      .select({
        stripeAccountId: tenants.stripeAccountId,
        stripeChargesEnabled: tenants.stripeChargesEnabled,
        stripeDetailsSubmitted: tenants.stripeDetailsSubmitted,
        stripePayoutsEnabled: tenants.stripePayoutsEnabled,
        stripeRequirementsCurrentlyDue: tenants.stripeRequirementsCurrentlyDue,
        stripeRequirementsDisabledReason:
          tenants.stripeRequirementsDisabledReason,
        stripeRequirementsEventuallyDue:
          tenants.stripeRequirementsEventuallyDue,
        stripeRequirementsPastDue: tenants.stripeRequirementsPastDue,
        stripeStatusSyncedAt: tenants.stripeStatusSyncedAt,
        tenantId: tenants.id,
        tenantName: tenants.name,
      })
      .from(tenants)
      .where(and(...whereClauses))
      .orderBy(asc(tenants.createdAt))
      .limit(args.limit);

    const report = buildStripeConnectLegacyAuditReport(
      rows
        .filter(
          (row): row is typeof row & { stripeAccountId: string } =>
            typeof row.stripeAccountId === "string" &&
            row.stripeAccountId.length > 0,
        )
        .map((row) => ({
          accountId: row.stripeAccountId,
          snapshot: {
            stripeAccountId: row.stripeAccountId,
            stripeChargesEnabled: row.stripeChargesEnabled,
            stripeDetailsSubmitted: row.stripeDetailsSubmitted,
            stripePayoutsEnabled: row.stripePayoutsEnabled,
            stripeRequirementsCurrentlyDue: row.stripeRequirementsCurrentlyDue,
            stripeRequirementsDisabledReason:
              row.stripeRequirementsDisabledReason,
            stripeRequirementsEventuallyDue:
              row.stripeRequirementsEventuallyDue,
            stripeRequirementsPastDue: row.stripeRequirementsPastDue,
            stripeStatusSyncedAt: row.stripeStatusSyncedAt,
          },
          tenantId: row.tenantId,
          tenantName: row.tenantName,
        })),
    );

    if (args.json) {
      console.info(JSON.stringify(report, null, 2));
    } else {
      printTextReport(report);
    }

    if (shouldFailStripeConnectLegacyAudit(args, report)) {
      process.exitCode = 1;
    }
  } finally {
    await closeDbPools();
  }
}

export function isStripeConnectLegacyAuditCliEntryPoint(
  metaUrl = import.meta.url,
  argv = process.argv,
) {
  const entryPoint = argv[1];

  if (!entryPoint) {
    return false;
  }

  try {
    return resolve(fileURLToPath(metaUrl)) === resolve(entryPoint);
  } catch {
    return false;
  }
}

if (isStripeConnectLegacyAuditCliEntryPoint()) {
  runStripeConnectLegacyAuditCli().catch((error) => {
    console.error("[stripe-connect-legacy-audit] failed:", error);
    void closeDbPools().finally(() => {
      process.exit(1);
    });
  });
}
