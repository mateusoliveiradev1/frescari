// Extra columns Better Auth keeps on the user row. Both decide what the user
// may do (role) and whose data they see (tenantId), so the public auth
// endpoints (sign-up, update-user) must never accept them from the client:
// `input: false` makes Better Auth reject them with 400 on update and ignore
// them on sign-up (role falls back to its default). They are written only by
// our own server code (onboarding, admin) straight to the database.
export const userAdditionalFields = {
  role: {
    type: "string",
    required: false,
    defaultValue: "buyer",
    input: false,
  },
  tenantId: {
    type: "string",
    required: false,
    input: false,
  },
} as const;
