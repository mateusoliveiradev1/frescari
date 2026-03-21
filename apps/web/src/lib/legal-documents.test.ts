import assert from "node:assert/strict";
import test from "node:test";
import {
  LEGAL_VERSION,
  createLegalMetadata,
  getLegalDocument,
  legalDocumentLinks,
} from "@/lib/legal-documents";

test("legal registry exposes the current V1 documents", () => {
  assert.equal(LEGAL_VERSION, "2026-03-21-v1");
  assert.equal(legalDocumentLinks.length, 4);

  for (const entry of legalDocumentLinks) {
    const document = getLegalDocument(entry.slug);
    const metadata = createLegalMetadata(entry.slug);
    const robots = metadata.robots;

    assert.equal(document.slug, entry.slug);
    assert.ok(document.title.length > 0);
    assert.ok(document.sections.length > 0);
    assert.ok(robots && typeof robots !== "string");
    assert.equal(robots.index, false);
    assert.equal(robots.follow, false);
  }
});
