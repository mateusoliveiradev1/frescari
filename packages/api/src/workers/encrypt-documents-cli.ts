import {
  closeDbPools,
  db,
  enableRlsBypassContext,
  tenants,
} from "@frescari/db";
import { and, eq, isNotNull, not, like } from "drizzle-orm";

import { encryptPii, isEncryptedPii, decryptPii } from "../pii-crypto";

/**
 * One-time migration: encrypts producer documents (CPF/CNPJ) written before
 * field encryption existed. Idempotent: already-encrypted rows are skipped,
 * so running it twice changes nothing. Dry run by default; --apply writes.
 *
 *   pnpm --filter @frescari/api pii:encrypt-documents            # dry run
 *   pnpm --filter @frescari/api pii:encrypt-documents --apply    # writes
 *
 * Prints counts only, never a document.
 */
async function main() {
  const apply = process.argv.includes("--apply");

  const summary = await db.transaction(async (tx) => {
    await enableRlsBypassContext(tx);

    const plainRows = await tx
      .select({ id: tenants.id, document: tenants.producerDocumentId })
      .from(tenants)
      .where(
        and(
          isNotNull(tenants.producerDocumentId),
          not(like(tenants.producerDocumentId, "enc:v1:%")),
        ),
      );

    let encrypted = 0;
    for (const row of plainRows) {
      if (!row.document || isEncryptedPii(row.document)) continue;
      const ciphertext = encryptPii(row.document);
      // Round-trip check before writing: never replace a value we could not
      // read back with the current key.
      if (decryptPii(ciphertext) !== row.document) {
        throw new Error(`Round-trip check failed for tenant ${row.id}.`);
      }
      if (apply) {
        await tx
          .update(tenants)
          .set({ producerDocumentId: ciphertext })
          .where(eq(tenants.id, row.id));
      }
      encrypted += 1;
    }

    return { plainRows: plainRows.length, encrypted };
  });

  console.info(
    `[pii:encrypt-documents] ${apply ? "APPLIED" : "DRY RUN"}: ${summary.plainRows} plain document(s) found, ${summary.encrypted} ${apply ? "encrypted" : "would be encrypted"}.`,
  );
}

main()
  .catch((error) => {
    console.error(
      "[pii:encrypt-documents] failed:",
      error instanceof Error ? error.message : error,
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDbPools();
  });
