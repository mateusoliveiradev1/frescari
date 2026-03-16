export function isAdminRole(role?: string | null) {
    return role === "admin";
}

export function getHomePathForRole(role?: string | null) {
    return isAdminRole(role) ? "/admin" : "/dashboard";
}
