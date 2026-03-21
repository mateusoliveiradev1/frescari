import { getHomePathForRole, isAdminRole } from "@/lib/role-routing";

type PostAuthRedirectInput = {
  role?: string | null;
  tenantId?: string | null;
};

export function getPostAuthRedirectPath({
  role,
  tenantId,
}: PostAuthRedirectInput) {
  if (isAdminRole(role)) {
    return "/admin";
  }

  if (!tenantId) {
    return "/onboarding";
  }

  return getHomePathForRole(role);
}
