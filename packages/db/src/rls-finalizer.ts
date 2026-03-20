import { readFile } from "node:fs/promises";
import path from "node:path";

const finalRlsPath = path.resolve(__dirname, "../finalize-rls.sql");
const statementBreakpoint = "--> statement-breakpoint";

type SqlExecutor = {
  query(statement: string): Promise<unknown>;
};

export async function getFinalRlsStatements() {
  const sql = await readFile(finalRlsPath, "utf8");

  return sql
    .split(statementBreakpoint)
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);
}

export async function applyFinalRlsState(executor: SqlExecutor) {
  for (const statement of await getFinalRlsStatements()) {
    await executor.query(statement);
  }
}

export { finalRlsPath };
