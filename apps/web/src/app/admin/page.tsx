import { AdminOverview } from "./admin-overview";
import { isAdminRole } from "@/lib/role-routing";
import { getRequestAuthSession } from "@/lib/server-session";
import { getAuthedServerTrpc } from "@/trpc/server";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
    const session = await getRequestAuthSession();
    const initialData =
        session?.user && isAdminRole(session.user.role)
            ? await (await getAuthedServerTrpc()).admin.getDashboardOverview({
                  periodDays: 30,
              })
            : undefined;

    return <AdminOverview initialData={initialData} />;
}
