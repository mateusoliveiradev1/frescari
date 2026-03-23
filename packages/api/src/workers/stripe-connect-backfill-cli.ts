import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { closeDbPools, db } from "@frescari/db";
import { z } from "zod";

import { syncStripeConnectStatusBatch } from "../stripe-connect";

const cliArgsSchema = z.object({
  continueOnError: z.boolean().default(true),
  limit: z.number().int().min(1).max(100).default(25),
  onlyUnsynced: z.boolean().default(true),
  tenantIds: z.array(z.string().min(1)).optional(),
});

function readArgValue(argv: string[], index: number, flag: string) {
  const value = argv[index + 1];

  if (!value) {
    throw new Error(`${flag} requires a value.`);
  }

  return value;
}

function printHelp() {
  console.info(`Usage: pnpm --filter @frescari/api stripe:connect:backfill -- [options]

Options:
  --limit <n>            Maximum number of tenants to sync in the current run.
  --tenant-id <id>       Restrict the run to a specific tenant. Repeat to include more ids.
  --include-synced       Include already synced tenants in the batch selection.
  --fail-fast            Stop the batch after the first Stripe sync failure.
  --help                 Show this help message.
`);
}

export function parseStripeConnectBackfillCliArgs(
  argv = process.argv.slice(2),
) {
  const tenantIds: string[] = [];
  let continueOnError = true;
  let limit = 25;
  let onlyUnsynced = true;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (!arg) {
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      continue;
    }

    if (arg === "--include-synced") {
      onlyUnsynced = false;
      continue;
    }

    if (arg === "--fail-fast") {
      continueOnError = false;
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
    continueOnError,
    limit,
    onlyUnsynced,
    tenantIds: tenantIds.length > 0 ? tenantIds : undefined,
  });
}

export async function runStripeConnectBackfillCli(
  argv = process.argv.slice(2),
) {
  if (argv.includes("--help") || argv.includes("-h")) {
    printHelp();
    await closeDbPools();
    return;
  }

  const args = parseStripeConnectBackfillCliArgs(argv);

  console.info(
    `[stripe-connect-backfill] starting batch with limit=${args.limit}, onlyUnsynced=${args.onlyUnsynced}, continueOnError=${args.continueOnError}.`,
  );

  try {
    const result = await syncStripeConnectStatusBatch(db, args);

    console.info("[stripe-connect-backfill] batch result:");
    console.info(JSON.stringify(result, null, 2));

    if (result.failed > 0) {
      process.exitCode = 1;
    }
  } finally {
    await closeDbPools();
  }
}

export function isStripeConnectBackfillCliEntryPoint(
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

if (isStripeConnectBackfillCliEntryPoint()) {
  runStripeConnectBackfillCli().catch((error) => {
    console.error("[stripe-connect-backfill] failed:", error);
    void closeDbPools().finally(() => {
      process.exit(1);
    });
  });
}
