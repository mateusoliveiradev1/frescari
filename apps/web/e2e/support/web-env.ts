import { readFileSync } from "node:fs";
import path from "node:path";

const ENV_FILENAMES = [".env", ".env.local"] as const;

function parseEnvContents(envContents: string): Record<string, string> {
  const parsedEnv: Record<string, string> = {};

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

    parsedEnv[key] = value;
  }

  return parsedEnv;
}

export function getWebEnv(cwd: string = process.cwd()): Record<string, string> {
  const mergedEnv: Record<string, string> = {};

  for (const filename of ENV_FILENAMES) {
    const envPath = path.resolve(cwd, filename);
    let envContents = "";

    try {
      envContents = readFileSync(envPath, "utf8");
    } catch {
      continue;
    }

    Object.assign(mergedEnv, parseEnvContents(envContents));
  }

  return mergedEnv;
}

export function loadWebEnv(
  targetEnv: NodeJS.ProcessEnv = process.env,
  cwd: string = process.cwd(),
): NodeJS.ProcessEnv {
  const webEnv = getWebEnv(cwd);

  for (const [key, value] of Object.entries(webEnv)) {
    targetEnv[key] = value;
  }

  return targetEnv;
}
