import { TenantDetailClient } from "./tenant-detail-client";

export const dynamic = "force-dynamic";

export default async function TenantDetailPage({
    params,
}: {
    params: Promise<{ tenantId: string }>;
}) {
    const { tenantId } = await params;

    return <TenantDetailClient tenantId={tenantId} />;
}
