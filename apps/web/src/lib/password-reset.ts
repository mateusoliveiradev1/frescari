import { getAppUrl } from "./app-url";

export const FORGOT_PASSWORD_PATH = "/auth/forgot-password";
export const RESET_PASSWORD_PATH = "/auth/reset-password";

type PasswordResetPageError = "INVALID_TOKEN";

function trimToNull(value: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizePasswordResetError(
  value: string | null,
): PasswordResetPageError | null {
  if (value === "INVALID_TOKEN") {
    return value;
  }

  return null;
}

export function buildResetPasswordRedirectUrl(baseUrl = getAppUrl()) {
  return `${baseUrl.replace(/\/+$/, "")}${RESET_PASSWORD_PATH}`;
}

export function readPasswordResetPageState(searchParams: URLSearchParams) {
  return {
    token: trimToNull(searchParams.get("token")),
    error: normalizePasswordResetError(searchParams.get("error")),
  } as const;
}
