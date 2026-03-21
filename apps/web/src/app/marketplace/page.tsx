import { LegalDocumentPage } from "@/components/legal-document-page";
import { createLegalMetadata } from "@/lib/legal-documents";

export const metadata = createLegalMetadata("marketplace");

export default function MarketplaceTermsPage() {
  return <LegalDocumentPage slug="marketplace" />;
}
