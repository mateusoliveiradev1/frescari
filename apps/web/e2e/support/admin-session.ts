import { exec } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

const ADMIN_PASSWORD = "CodexAdmin123!";
const execAsync = promisify(exec);

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

export async function createAdminSessionCookie() {
    loadWebEnv();
    const script = `
import { parseSetCookieHeader } from "better-auth/cookies";
import { eq } from "drizzle-orm";
import { authDb, users } from "@frescari/db";
import { auth } from "../src/lib/auth";

(async () => {
  const email = \`codex.admin.\${Date.now()}.\${Math.random().toString(36).slice(2)}@example.com\`;
  const password = ${JSON.stringify(ADMIN_PASSWORD)};

  await auth.api.signUpEmail({
    body: {
      email,
      name: "Codex Admin",
      password,
    },
  });

  await authDb
    .update(users)
    .set({ role: "admin" })
    .where(eq(users.email, email));

  const response = await auth.api.signInEmail({
    asResponse: true,
    body: {
      email,
      password,
    },
  });

  const cookie = parseSetCookieHeader(response.headers.get("set-cookie") ?? "")
    .get("better-auth.session_token")
    ?.value;

  console.log(JSON.stringify({ cookie }));
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
`;

    const tempDir = path.resolve(process.cwd(), ".playwright-tmp");
    mkdirSync(tempDir, { recursive: true });
    const scriptPath = path.join(tempDir, `create-admin-session-${Date.now()}.ts`);
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
    const cookie = output ? (JSON.parse(output) as { cookie?: string }).cookie : undefined;

    if (!cookie) {
        throw new Error("Nao foi possivel criar a sessao admin para a E2E.");
    }

    return cookie;
}
