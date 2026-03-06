import { UnionToIntersection } from "./helper.mjs";
import { BetterAuthOptions, BetterAuthPlugin } from "@better-auth/core";
import { Account, InferDBFieldsFromOptionsInput, InferDBFieldsFromPluginsInput, RateLimit, Session as Session$1, User as User$1, Verification } from "@better-auth/core/db";

//#region src/types/models.d.ts
type AdditionalUserFieldsInput<Options extends BetterAuthOptions> = InferDBFieldsFromPluginsInput<"user", Options["plugins"]> & InferDBFieldsFromOptionsInput<Options["user"]>;
type AdditionalSessionFieldsInput<Options extends BetterAuthOptions> = InferDBFieldsFromPluginsInput<"session", Options["plugins"]> & InferDBFieldsFromOptionsInput<Options["session"]>;
type InferPluginTypes<O extends BetterAuthOptions> = O["plugins"] extends Array<infer P> ? UnionToIntersection<P extends BetterAuthPlugin ? P["$Infer"] extends Record<string, any> ? P["$Infer"] : {} : {}> : {};
//#endregion
export { type Account, AdditionalSessionFieldsInput, AdditionalUserFieldsInput, InferPluginTypes, type RateLimit, type Session$1 as Session, type User$1 as User, type Verification };
//# sourceMappingURL=models.d.mts.map