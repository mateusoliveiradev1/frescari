import { LegalDocumentPage } from "@/components/legal-document-page";
import { createLegalMetadata } from "@/lib/legal-documents";

export const metadata = createLegalMetadata("cancelamento-estorno-e-chargeback");

export default function CancellationAndChargebackPolicyPage() {
  return <LegalDocumentPage slug="cancelamento-estorno-e-chargeback" />;
}
