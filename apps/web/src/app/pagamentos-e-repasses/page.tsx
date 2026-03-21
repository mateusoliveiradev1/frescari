import { LegalDocumentPage } from "@/components/legal-document-page";
import { createLegalMetadata } from "@/lib/legal-documents";

export const metadata = createLegalMetadata("pagamentos-e-repasses");

export default function PaymentsPolicyPage() {
  return <LegalDocumentPage slug="pagamentos-e-repasses" />;
}
