const stripTrailingSlashes = (value: string) => value.replace(/\/+$/, "");

const ensureAbsoluteUrl = (value: string): string => {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return stripTrailingSlashes(trimmed);
  }

  return `https://${stripTrailingSlashes(trimmed)}`;
};

export function getVercelDeploymentUrl(): string | null {
  const candidate =
    process.env.VERCEL_BRANCH_URL?.trim() || process.env.VERCEL_URL?.trim();

  if (!candidate) {
    return null;
  }

  return ensureAbsoluteUrl(candidate);
}

export function getAppUrl(): string {
  const configuredUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_BETTER_AUTH_URL?.trim();

  if (configuredUrl) {
    return ensureAbsoluteUrl(configuredUrl);
  }

  const vercelUrl = getVercelDeploymentUrl();

  if (vercelUrl) {
    return vercelUrl;
  }

  return process.env.NODE_ENV === "production"
    ? "https://frescari.com.br"
    : "http://localhost:3000";
}
