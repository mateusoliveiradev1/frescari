import assert from "node:assert/strict";
import test from "node:test";
import {
  LEGAL_VERSION,
  createLegalMetadata,
  getLegalDocument,
  getLegalDocumentJsonLd,
  legalDocumentLinks,
} from "@/lib/legal-documents";

test("legal registry exposes the current V3 documents", () => {
  assert.equal(LEGAL_VERSION, "2026-04-08-v3");
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
    const allText = document.sections
      .flatMap((section) => [...section.paragraphs, ...(section.bullets ?? [])])
      .join("\n");

    assert.equal(document.slug, entry.slug);
    assert.ok(document.title.length > 0);
    assert.ok(document.sections.length > 0);
    assert.equal(document.status, "Versao vigente - V3");
    assert.equal(document.effectiveDate, "8 de abril de 2026");
    assert.equal(document.effectiveDateIso, "2026-04-08");
    assert.equal(document.updatedAt, "8 de abril de 2026");
    assert.equal(document.updatedAtIso, "2026-04-08");
    assert.ok(robots && typeof robots !== "string");
    assert.equal(robots.index, true);
    assert.equal(robots.follow, true);
    assert.ok(metadata.alternates?.canonical);
    assert.ok(metadata.openGraph?.url);
    assert.ok(metadata.twitter?.images);
    assert.equal(allText.includes("[RAZAO SOCIAL]"), false);
    assert.equal(allText.includes("[XX.XXX.XXX/XXXX-XX]"), false);
    assert.equal(allText.includes("[ENDERECO COMPLETO, CIDADE/UF]"), false);
    assert.equal(allText.includes("[EMAIL DE SUPORTE]"), false);
    assert.equal(allText.includes("[EMAIL DE PRIVACIDADE]"), false);
    assert.equal(allText.includes("[CIDADE/UF]"), false);
  }
});

test("legal pages expose structured data with stable canonical dates", () => {
  const jsonLd = getLegalDocumentJsonLd("termos") as {
    "@type": string;
    dateModified: string;
    datePublished: string;
    url: string;
  };

  assert.equal(jsonLd["@type"], "WebPage");
  assert.equal(jsonLd.datePublished, "2026-04-08");
  assert.equal(jsonLd.dateModified, "2026-04-08");
  assert.equal(jsonLd.url, "http://localhost:3000/termos");
});
