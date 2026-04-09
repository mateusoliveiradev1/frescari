#!/usr/bin/env node

import { randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "..");
const vercelCwd = resolve(repoRoot, "apps", "web");

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const overwriteExisting =
  args.has("--overwrite-existing") || args.has("--sync-existing");
const targets = args.has("--production-only")
  ? ["production"]
  : ["production", "preview"];

const previewEnvFiles = [
  resolve(repoRoot, "apps", "web", ".env.local"),
  resolve(repoRoot, ".env.local"),
  resolve(repoRoot, ".env"),
];

const productionEnvFile = resolve(repoRoot, ".env.vercel.production");

const envFiles = [
  ...previewEnvFiles,
  resolve(repoRoot, ".env.vercel.production"),
];

const parsedEnvFiles = envFiles.flatMap((filePath) =>
  existsSync(filePath) ? [{ filePath, values: parseEnvFile(filePath) }] : [],
);
const parsedEnvFileMap = new Map(
  parsedEnvFiles.map(({ filePath, values }) => [filePath, values]),
);

const sharedConfigs = [
  { key: "BETTER_AUTH_SECRET", sensitive: true },
  { key: "RESEND_API_KEY", sensitive: true },
  { key: "AUTH_EMAIL_FROM", sensitive: false },
  { key: "AUTH_EMAIL_FROM_NAME", sensitive: false },
  { key: "AUTH_EMAIL_REPLY_TO", sensitive: false },
  { key: "STRIPE_SECRET_KEY", sensitive: true },
  { key: "STRIPE_WEBHOOK_SECRET", sensitive: true },
  { key: "UPLOADTHING_TOKEN", sensitive: true },
  { key: "STRIPE_CONNECT_MODE", sensitive: false },
];

const productionOnlyConfigs = [
  { key: "BETTER_AUTH_URL", sensitive: false },
  { key: "NEXT_PUBLIC_APP_URL", sensitive: false },
  { key: "NEXT_PUBLIC_BETTER_AUTH_URL", sensitive: false },
  { key: "NEXT_PUBLIC_TRPC_URL", sensitive: false },
  { key: "NEXT_PUBLIC_LEGAL_OPERATOR_NAME", sensitive: false },
  { key: "NEXT_PUBLIC_LEGAL_OPERATOR_DOCUMENT_KIND", sensitive: false },
  { key: "NEXT_PUBLIC_LEGAL_OPERATOR_DOCUMENT", sensitive: false },
  { key: "NEXT_PUBLIC_LEGAL_OPERATOR_ADDRESS", sensitive: false },
  { key: "NEXT_PUBLIC_LEGAL_SUPPORT_EMAIL", sensitive: false },
  { key: "NEXT_PUBLIC_LEGAL_PRIVACY_EMAIL", sensitive: false },
];

async function main() {
  assertInsideLinkedVercelProject();

  const existingByTarget = new Map();

  for (const target of targets) {
    existingByTarget.set(target, await listRemoteEnvKeys(target));
  }

  const cronTargetsMissing = targets.filter(
    (target) => !existingByTarget.get(target)?.has("CRON_SECRET"),
  );

  if (cronTargetsMissing.length > 0) {
    const cronSecret = process.env.CRON_SECRET || generateCronSecret();
    const shouldRotateExisting =
      process.env.CRON_SECRET ||
      cronTargetsMissing.length === targets.length ||
      args.has("--rotate-cron-secret");

    if (!shouldRotateExisting) {
      throw new Error(
        "CRON_SECRET exists only in part of the requested targets. Provide CRON_SECRET explicitly or rerun with --rotate-cron-secret.",
      );
    }

    for (const target of targets) {
      await upsertEnvVar({
        key: "CRON_SECRET",
        value: cronSecret,
        target,
        sensitive: true,
      });
    }

    logStep(`CRON_SECRET aligned across: ${targets.join(", ")}`);
  } else {
    logStep(`CRON_SECRET already present in: ${targets.join(", ")}`);
  }

  for (const config of sharedConfigs) {
    const value = readSharedValue(config.key);

    if (!value) {
      continue;
    }

    for (const target of targets) {
      const existsRemotely = existingByTarget.get(target)?.has(config.key);

      if (existsRemotely && !overwriteExisting) {
        logStep(`Skipping existing ${config.key} in ${target}`);
        continue;
      }

      await upsertEnvVar({
        key: config.key,
        value,
        target,
        sensitive: config.sensitive,
        overwrite: existsRemotely,
      });
    }
  }

  // Database URLs must stay environment-specific.
  if (targets.includes("preview")) {
    const existsRemotely = existingByTarget.get("preview")?.has("DATABASE_URL");

    if (existsRemotely && !overwriteExisting) {
      logStep("Skipping existing DATABASE_URL in preview");
    } else {
      const value = readPreviewValue("DATABASE_URL");

      if (value) {
        await upsertEnvVar({
          key: "DATABASE_URL",
          value,
          target: "preview",
          sensitive: true,
          overwrite: existsRemotely,
        });
      }
    }
  }

  if (targets.includes("production")) {
    const existsRemotely = existingByTarget.get("production")?.has("DATABASE_URL");

    if (existsRemotely && !overwriteExisting) {
      logStep("Skipping existing DATABASE_URL in production");
    } else {
      const value = readProductionDatabaseValue();

      if (!value) {
        logStep(
          "No production source found for DATABASE_URL; skipping production database configuration",
        );
      } else {
        await upsertEnvVar({
          key: "DATABASE_URL",
          value,
          target: "production",
          sensitive: true,
          overwrite: existsRemotely,
        });
      }
    }
  }

  for (const config of productionOnlyConfigs) {
    const existsRemotely = existingByTarget.get("production")?.has(config.key);

    if (existsRemotely && !overwriteExisting) {
      logStep(`Skipping existing ${config.key} in production`);
      continue;
    }

    const value = readProductionValue(config.key);

    if (!value) {
      logStep(`No production source found for ${config.key}; skipping`);
      continue;
    }

    await upsertEnvVar({
      key: config.key,
      value,
      target: "production",
      sensitive: config.sensitive,
      overwrite: existsRemotely,
    });
  }

  for (const mapping of [
    {
      sourceKey: "VERCEL_PREVIEW_APP_URL",
      targetKey: "NEXT_PUBLIC_APP_URL",
    },
    {
      sourceKey: "VERCEL_PREVIEW_AUTH_URL",
      targetKey: "BETTER_AUTH_URL",
    },
    {
      sourceKey: "VERCEL_PREVIEW_AUTH_URL",
      targetKey: "NEXT_PUBLIC_BETTER_AUTH_URL",
    },
    {
      sourceKey: "VERCEL_PREVIEW_TRPC_URL",
      targetKey: "NEXT_PUBLIC_TRPC_URL",
    },
  ]) {
    if (!targets.includes("preview")) {
      continue;
    }

    const existsRemotely = existingByTarget.get("preview")?.has(mapping.targetKey);

    if (existsRemotely && !overwriteExisting) {
      logStep(`Skipping existing ${mapping.targetKey} in preview`);
      continue;
    }

    const value = sanitizeValue(process.env[mapping.sourceKey]);

    if (!value) {
      continue;
    }

    await upsertEnvVar({
      key: mapping.targetKey,
      value,
      target: "preview",
      sensitive: false,
      overwrite: existsRemotely,
    });
  }

  logStep(dryRun ? "Dry-run finished" : "Vercel env bootstrap finished");
}

function assertInsideLinkedVercelProject() {
  const projectConfigPath = resolve(vercelCwd, ".vercel", "project.json");

  if (!existsSync(projectConfigPath)) {
    throw new Error(
      "apps/web is not linked to a Vercel project. Run `vercel link` first.",
    );
  }
}

function parseEnvFile(filePath) {
  const entries = {};
  const contents = readFileSync(filePath, "utf8");

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const equalsIndex = line.indexOf("=");

    if (equalsIndex <= 0) {
      continue;
    }

    const key = line.slice(0, equalsIndex).trim();
    let value = line.slice(equalsIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    entries[key] = value;
  }

  return entries;
}

function sanitizeValue(value) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function readSharedValue(key) {
  const directValue = sanitizeValue(process.env[key]);

  if (directValue) {
    return directValue;
  }

  for (const source of parsedEnvFiles) {
    const value = sanitizeValue(source.values[key]);

    if (value) {
      return value;
    }
  }

  return null;
}

function readPreviewValue(key) {
  const explicitOverride = sanitizeValue(process.env[`VERCEL_PREVIEW_${key}`]);

  if (explicitOverride) {
    return explicitOverride;
  }

  const directValue = sanitizeValue(process.env[key]);

  if (directValue) {
    return directValue;
  }

  return readValueFromFiles(key, previewEnvFiles);
}

function readProductionDatabaseValue() {
  const explicitOverride = sanitizeValue(process.env.VERCEL_PRODUCTION_DATABASE_URL);

  if (explicitOverride) {
    return explicitOverride;
  }

  return readValueFromFiles("DATABASE_URL", [productionEnvFile]);
}

function readProductionValue(key) {
  const explicitOverride = sanitizeValue(
    process.env[`VERCEL_PRODUCTION_${key}`],
  );

  if (explicitOverride) {
    return explicitOverride;
  }

  const productionValue = readValueFromFiles(key, [productionEnvFile], {
    skipLocalhost: true,
  });

  if (productionValue) {
    return productionValue;
  }

  return readValueFromFiles(key, previewEnvFiles, { skipLocalhost: true });
}

function readValueFromFiles(key, filePaths, options = {}) {
  const { skipLocalhost = false } = options;

  for (const filePath of filePaths) {
    const values = parsedEnvFileMap.get(filePath);
    const value = sanitizeValue(values?.[key]);

    if (!value) {
      continue;
    }

    if (skipLocalhost && /localhost|127\.0\.0\.1/i.test(value)) {
      continue;
    }

    return value;
  }

  return null;
}

function generateCronSecret() {
  return randomBytes(48).toString("base64url");
}

async function listRemoteEnvKeys(target) {
  const { stdout } = await runVercel(["env", "list", target], {
    captureOutput: true,
  });

  const keys = new Set();

  for (const line of stdout.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s+/);

    if (!match) {
      continue;
    }

    keys.add(match[1]);
  }

  return keys;
}

async function upsertEnvVar({ key, value, target, sensitive, overwrite = false }) {
  const action = overwrite ? "update" : "set";
  logStep(
    `${dryRun ? "Would " : ""}${action === "update" ? "update" : "set"} ${key} in ${target}`,
  );

  if (dryRun) {
    return;
  }

  const args = ["env", "add", key, target, "--force", "--yes"];

  if (sensitive) {
    args.push("--sensitive");
  }

  await runVercel(args, { input: `${value}\n` });
}

function runVercel(args, options = {}) {
  const { input, captureOutput = false } = options;

  return new Promise((resolvePromise, rejectPromise) => {
    const useShell = process.platform === "win32";
    const command = "npx";
    const child = spawn(command, ["vercel", ...args], {
      cwd: vercelCwd,
      env: {
        ...process.env,
        CI: "1",
        FORCE_COLOR: "0",
      },
      shell: useShell,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      stdout += text;
      if (!captureOutput) {
        process.stdout.write(text);
      }
    });

    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      stderr += text;
      if (!captureOutput) {
        process.stderr.write(text);
      }
    });

    child.on("error", rejectPromise);

    child.on("close", (code) => {
      if (code === 0) {
        resolvePromise({ stdout, stderr });
        return;
      }

      rejectPromise(
        new Error(
          `vercel ${args.join(" ")} failed with exit code ${code}\n${stdout}\n${stderr}`.trim(),
        ),
      );
    });

    if (input) {
      child.stdin.write(input);
    }

    child.stdin.end();
  });
}

function logStep(message) {
  console.log(`[setup-vercel-env] ${message}`);
}

main().catch((error) => {
  console.error(`[setup-vercel-env] ${error.message}`);
  process.exitCode = 1;
});
