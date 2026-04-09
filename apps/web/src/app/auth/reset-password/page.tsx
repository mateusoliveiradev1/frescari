import { readPasswordResetPageState } from "@/lib/password-reset";

import { ResetPasswordForm } from "./reset-password-form";

type ResetPasswordPageProps = {
  searchParams: Promise<{
    token?: string | string[];
    error?: string | string[];
  }>;
};

function getFirstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ResetPasswordPage({
  searchParams,
}: ResetPasswordPageProps) {
  const resolvedSearchParams = await searchParams;
  const params = new URLSearchParams();
  const token = getFirstValue(resolvedSearchParams.token);
  const error = getFirstValue(resolvedSearchParams.error);

  if (token) {
    params.set("token", token);
  }

  if (error) {
    params.set("error", error);
  }

  const pageState = readPasswordResetPageState(params);

  return <ResetPasswordForm error={pageState.error} token={pageState.token} />;
}
