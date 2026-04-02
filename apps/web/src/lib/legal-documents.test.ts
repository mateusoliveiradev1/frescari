import assert from "node:assert/strict";
import test from "node:test";
import {
  LEGAL_VERSION,
  createLegalMetadata,
  getLegalDocument,
  legalDocumentLinks,
} from "@/lib/legal-documents";

test("legal registry exposes the current V2 documents", () => {
  assert.equal(LEGAL_VERSION, "2026-04-02-v2");
  assert.deepEqual(
    legalDocumentLinks.map((entry) => entry.slug),
    [
      "termos",
      "privacidade",
      "marketplace",
      "pagamentos-e-repasses",
      "cancelamento-estorno-e-chargeback",
      "cookies",
    ],
  );

  for (const entry of legalDocumentLinks) {
    const document = getLegalDocument(entry.slug);
    const metadata = createLegalMetadata(entry.slug);
    const robots = metadata.robots;

    assert.equal(document.slug, entry.slug);
    assert.ok(document.title.length > 0);
    assert.ok(document.sections.length > 0);
    assert.ok(robots && typeof robots !== "string");
    assert.equal(robots.index, true);
    assert.equal(robots.follow, true);
  }
});
