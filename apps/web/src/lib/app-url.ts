const stripTrailingSlashes = (value: string) => value.replace(/\/+$/, "");

export const normalizeUrl = (value: string): string => {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return stripTrailingSlashes(trimmed);
  }

  return `https://${stripTrailingSlashes(trimmed)}`;
};

export function getConfiguredUrl(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  const normalized = normalizeUrl(value);

  return normalized || null;
}

export function getVercelDeploymentUrl(): string | null {
  const candidate =
    process.env.VERCEL_BRANCH_URL?.trim() || process.env.VERCEL_URL?.trim();

  if (!candidate) {
    return null;
  }

  return normalizeUrl(candidate);
}

export function getAppUrl(): string {
  const configuredUrl =
    getConfiguredUrl(process.env.NEXT_PUBLIC_APP_URL) ||
    getConfiguredUrl(process.env.NEXT_PUBLIC_BETTER_AUTH_URL);

  if (configuredUrl) {
    return configuredUrl;
  }

  const vercelUrl = getVercelDeploymentUrl();

  if (vercelUrl) {
    return vercelUrl;
  }

  return process.env.NODE_ENV === "production"
    ? "https://frescari.com.br"
    : "http://localhost:3000";
}
