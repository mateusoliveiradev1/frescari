import { LegalDocumentPage } from "@/components/legal-document-page";
import { createLegalMetadata } from "@/lib/legal-documents";

export const metadata = createLegalMetadata("privacidade");

export default function PrivacyPage() {
  return <LegalDocumentPage slug="privacidade" />;
}
