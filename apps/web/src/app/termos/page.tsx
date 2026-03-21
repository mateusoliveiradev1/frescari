import { LegalDocumentPage } from "@/components/legal-document-page";
import { createLegalMetadata } from "@/lib/legal-documents";

export const metadata = createLegalMetadata("termos");

export default function TermsPage() {
  return <LegalDocumentPage slug="termos" />;
}
