import { GENERIC_OAUTH_ERROR_CODES } from "./error-codes.mjs";

//#region src/plugins/generic-oauth/client.ts
const genericOAuthClient = () => {
	return {
		id: "generic-oauth-client",
		$InferServerPlugin: {},
		$ERROR_CODES: GENERIC_OAUTH_ERROR_CODES
	};
};

//#endregion
export { genericOAuthClient };
//# sourceMappingURL=client.mjs.map