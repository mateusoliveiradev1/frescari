export const DEFAULT_LEGAL_ACCEPTANCE_SOURCE = "auth_register_page";
export const LEGAL_CONSENT_REQUIRED_CODE = "LEGAL_CONSENT_REQUIRED";
export const LEGAL_VERSION_MISMATCH_CODE = "LEGAL_VERSION_MISMATCH";

export type LegalConsentPayload = {
  acceptedLegal: boolean;
  acceptedLegalVersion: string | null;
  acceptedLegalSource: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readHeader(
  headersLike: Headers | null | undefined,
  name: string,
): string | null {
  return headersLike?.get(name) ?? headersLike?.get(name.toLowerCase()) ?? null;
}

export function isEmailPasswordSignUpRequest(requestUrl?: string | null) {
  return (
    typeof requestUrl === "string" && requestUrl.includes("/sign-up/email")
  );
}

export function extractLegalConsentPayload(body: unknown): LegalConsentPayload {
  if (!isRecord(body)) {
    return {
      acceptedLegal: false,
      acceptedLegalVersion: null,
      acceptedLegalSource: DEFAULT_LEGAL_ACCEPTANCE_SOURCE,
    };
  }

  return {
    acceptedLegal: body.acceptedLegal === true,
    acceptedLegalVersion:
      typeof body.acceptedLegalVersion === "string"
        ? body.acceptedLegalVersion
        : null,
    acceptedLegalSource:
      typeof body.acceptedLegalSource === "string" &&
      body.acceptedLegalSource.trim().length > 0
        ? body.acceptedLegalSource.trim()
        : DEFAULT_LEGAL_ACCEPTANCE_SOURCE,
  };
}

export function extractIpAddress(headersLike?: Headers | null) {
  const rawValue =
    readHeader(headersLike, "x-forwarded-for") ??
    readHeader(headersLike, "x-real-ip") ??
    readHeader(headersLike, "cf-connecting-ip");

  if (!rawValue) {
    return null;
  }

  const firstHop = rawValue
    .split(",")
    .map((segment) => segment.trim())
    .find(Boolean);

  return firstHop ?? null;
}

export function extractUserAgent(headersLike?: Headers | null) {
  return readHeader(headersLike, "user-agent");
}
