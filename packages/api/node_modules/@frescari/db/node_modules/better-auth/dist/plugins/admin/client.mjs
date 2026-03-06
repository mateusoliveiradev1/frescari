import { adminAc, userAc } from "./access/statement.mjs";
import "./access/index.mjs";
import { ADMIN_ERROR_CODES } from "./error-codes.mjs";
import { hasPermission } from "./has-permission.mjs";

//#region src/plugins/admin/client.ts
const adminClient = (options) => {
	const roles = {
		admin: adminAc,
		user: userAc,
		...options?.roles
	};
	return {
		id: "admin-client",
		$InferServerPlugin: {},
		getActions: () => ({ admin: { checkRolePermission: (data) => {
			return hasPermission({
				role: data.role,
				options: {
					ac: options?.ac,
					roles
				},
				permissions: data.permissions
			});
		} } }),
		pathMethods: {
			"/admin/list-users": "GET",
			"/admin/stop-impersonating": "POST"
		},
		$ERROR_CODES: ADMIN_ERROR_CODES
	};
};

//#endregion
export { adminClient };
//# sourceMappingURL=client.mjs.map