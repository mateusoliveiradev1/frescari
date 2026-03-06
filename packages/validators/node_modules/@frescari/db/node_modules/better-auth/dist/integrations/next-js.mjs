import { parseSetCookieHeader } from "../cookies/cookie-utils.mjs";
import "../cookies/index.mjs";
import { setShouldSkipSessionRefresh } from "../api/state/should-session-refresh.mjs";
import { createAuthMiddleware } from "@better-auth/core/api";

//#region src/integrations/next-js.ts
function toNextJsHandler(auth) {
	const handler = async (request) => {
		return "handler" in auth ? auth.handler(request) : auth(request);
	};
	return {
		GET: handler,
		POST: handler,
		PATCH: handler,
		PUT: handler,
		DELETE: handler
	};
}
const nextCookies = () => {
	return {
		id: "next-cookies",
		hooks: {
			before: [{
				matcher(ctx) {
					return ctx.path === "/get-session";
				},
				handler: createAuthMiddleware(async () => {
					let cookieStore;
					try {
						const { cookies } = await import("next/headers.js");
						cookieStore = await cookies();
					} catch {
						return;
					}
					try {
						cookieStore.set("__better-auth-cookie-store", "1", { maxAge: 0 });
						cookieStore.delete("__better-auth-cookie-store");
					} catch {
						await setShouldSkipSessionRefresh(true);
					}
				})
			}],
			after: [{
				matcher(ctx) {
					return true;
				},
				handler: createAuthMiddleware(async (ctx) => {
					const returned = ctx.context.responseHeaders;
					if ("_flag" in ctx && ctx._flag === "router") return;
					if (returned instanceof Headers) {
						const setCookies = returned?.get("set-cookie");
						if (!setCookies) return;
						const parsed = parseSetCookieHeader(setCookies);
						const { cookies } = await import("next/headers.js");
						let cookieHelper;
						try {
							cookieHelper = await cookies();
						} catch (error) {
							if (error instanceof Error && error.message.startsWith("`cookies` was called outside a request scope.")) return;
							throw error;
						}
						parsed.forEach((value, key) => {
							if (!key) return;
							const opts = {
								sameSite: value.samesite,
								secure: value.secure,
								maxAge: value["max-age"],
								httpOnly: value.httponly,
								domain: value.domain,
								path: value.path
							};
							try {
								cookieHelper.set(key, value.value, opts);
							} catch {}
						});
						return;
					}
				})
			}]
		}
	};
};

//#endregion
export { nextCookies, toNextJsHandler };
//# sourceMappingURL=next-js.mjs.map