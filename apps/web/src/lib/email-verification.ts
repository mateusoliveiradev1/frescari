export const EMAIL_VERIFICATION_CALLBACK_PATH = "/auth/verified";
export const EMAIL_VERIFICATION_PENDING_PATH = "/auth/verify-email";

export type EmailVerificationIntent = "signin" | "signup";

type BuildVerifyEmailPendingPathInput = {
  email?: string | null;
  intent?: EmailVerificationIntent | null;
};

export function buildVerifyEmailPendingPath({
  email,
  intent,
}: BuildVerifyEmailPendingPathInput = {}) {
  const query = new URLSearchParams();
  const normalizedEmail = email?.trim();

  if (normalizedEmail) {
    query.set("email", normalizedEmail);
  }

  if (intent === "signin" || intent === "signup") {
    query.set("intent", intent);
  }

  const serializedQuery = query.toString();

  return serializedQuery
    ? `${EMAIL_VERIFICATION_PENDING_PATH}?${serializedQuery}`
    : EMAIL_VERIFICATION_PENDING_PATH;
}
