import { exec } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

import { loadWebEnv } from "./web-env";

const ADMIN_PASSWORD = "CodexAdmin123!";
const execAsync = promisify(exec);

function formatFixtureDebugLog(stdout: string, stderr: string) {
  const stdoutTail = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(-5)
    .join(" | ");
  const stderrTail = stderr
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(-5)
    .join(" | ");

  const details = [
    stdoutTail ? `stdout: ${stdoutTail}` : "",
    stderrTail ? `stderr: ${stderrTail}` : "",
  ].filter(Boolean);

  return details.length > 0 ? ` (${details.join(" ; ")})` : "";
}

export async function createAdminSessionCookie() {
  loadWebEnv();
  const script = `
import { eq } from "drizzle-orm";
import setCookieParser from "set-cookie-parser";
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
    .set({ emailVerified: true, role: "admin" })
    .where(eq(users.email, email));

  const adminUser = await authDb.query.users.findFirst({
    where: eq(users.email, email),
  });

  if (!adminUser) {
    throw new Error("Nao foi possivel localizar o usuario admin recem-criado.");
  }

  const signInResponse = await auth.api.signInEmail({
    body: {
      email,
      password,
    },
    asResponse: true,
  });

  const responseCookies = setCookieParser.parse(signInResponse, {
    decodeValues: false,
    map: true,
  });
  const signedSessionCookie =
    responseCookies["better-auth.session_token"]?.value ??
    responseCookies["__Secure-better-auth.session_token"]?.value;

  if (!signedSessionCookie) {
    throw new Error("Nao foi possivel extrair o cookie assinado da sessao admin.");
  }

  console.log(JSON.stringify({ cookie: signedSessionCookie }));
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
`;

  const tempDir = path.resolve(process.cwd(), ".playwright-tmp");
  mkdirSync(tempDir, { recursive: true });
  const scriptPath = path.join(
    tempDir,
    `create-admin-session-${Date.now()}.ts`,
  );
  writeFileSync(scriptPath, script, "utf8");

  let stdout = "";
  let stderr = "";

  try {
    const result = await execAsync(`pnpm exec tsx "${scriptPath}"`, {
      cwd: process.cwd(),
      env: process.env,
      maxBuffer: 1024 * 1024 * 10,
    });
    stdout = result.stdout;
    stderr = result.stderr;
  } finally {
    rmSync(scriptPath, { force: true });
  }
  const output = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .at(-1);
  const cookie = output
    ? (JSON.parse(output) as { cookie?: string }).cookie
    : undefined;

  if (!cookie) {
    throw new Error(
      `Nao foi possivel criar a sessao admin para a E2E.${formatFixtureDebugLog(stdout, stderr)}`,
    );
  }

  return cookie;
}
