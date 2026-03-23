import { getHomePathForRole, isAdminRole } from "@/lib/role-routing";

type PostAuthRedirectInput = {
  emailVerified?: boolean | null;
  role?: string | null;
  tenantId?: string | null;
};

export function getPostAuthRedirectPath({
  emailVerified,
  role,
  tenantId,
}: PostAuthRedirectInput) {
  if (emailVerified === false) {
    return "/auth/verify-email";
  }

  if (isAdminRole(role)) {
    return "/admin";
  }

  if (!tenantId) {
    return "/onboarding";
  }

  return getHomePathForRole(role);
}
