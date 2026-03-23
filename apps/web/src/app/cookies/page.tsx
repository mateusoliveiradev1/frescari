import { LegalDocumentPage } from "@/components/legal-document-page";
import { createLegalMetadata } from "@/lib/legal-documents";

export const metadata = createLegalMetadata("cookies");

export default function CookiesPolicyPage() {
  return <LegalDocumentPage slug="cookies" />;
}
