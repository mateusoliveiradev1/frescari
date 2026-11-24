import assert from "node:assert/strict";
import test from "node:test";

// The legal module reads the operator env once, at import, so set it first.
process.env.NEXT_PUBLIC_LEGAL_OPERATOR_NAME = "Fulano de Tal";
process.env.NEXT_PUBLIC_LEGAL_OPERATOR_DOCUMENT_KIND = "CPF";
process.env.NEXT_PUBLIC_LEGAL_OPERATOR_DOCUMENT = "12345678909";
process.env.NEXT_PUBLIC_LEGAL_OPERATOR_ADDRESS = "Rua Exemplo, 1, Cidade - UF";

test("an operator identified by CPF is never labelled CNPJ, and no placeholder leaks", async () => {
  const { getLegalDocument, legalDocumentLinks } =
    await import("@/lib/legal-documents");

  for (const entry of legalDocumentLinks) {
    const document = getLegalDocument(entry.slug);
    const allText = document.sections
      .flatMap((section) => [...section.paragraphs, ...(section.bullets ?? [])])
      .join("\n");

    assert.doesNotMatch(allText, /CNPJ 12345678909/, entry.slug);
    assert.doesNotMatch(allText, /\[[A-Z][A-Z ,/.X0-9-]{3,}\]/, entry.slug);
  }

  const cookies = getLegalDocument("cookies")
    .sections.flatMap((section) => section.paragraphs)
    .join("\n");
  assert.match(
    cookies,
    /Fulano de Tal, inscrito\(a\) no CPF sob o numero 12345678909/,
  );
});
