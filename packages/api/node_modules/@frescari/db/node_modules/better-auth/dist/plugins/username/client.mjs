import { USERNAME_ERROR_CODES } from "./error-codes.mjs";

//#region src/plugins/username/client.ts
const usernameClient = () => {
	return {
		id: "username",
		$InferServerPlugin: {},
		atomListeners: [{
			matcher: (path) => path === "/sign-in/username",
			signal: "$sessionSignal"
		}],
		$ERROR_CODES: USERNAME_ERROR_CODES
	};
};

//#endregion
export { usernameClient };
//# sourceMappingURL=client.mjs.map