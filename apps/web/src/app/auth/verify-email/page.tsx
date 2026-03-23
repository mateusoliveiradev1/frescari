import { redirect } from "next/navigation";

import type { EmailVerificationIntent } from "@/lib/email-verification";
import { getPostAuthRedirectPath } from "@/lib/post-auth-redirect";
import { getRequestAuthSession } from "@/lib/server-session";

import { VerifyEmailClient } from "./verify-email-client";

export const dynamic = "force-dynamic";

type VerifyEmailPageProps = {
  searchParams: Promise<{
    email?: string | string[];
    intent?: string | string[];
  }>;
};

function getFirstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeIntent(
  value: string | string[] | undefined,
): EmailVerificationIntent | undefined {
  const normalizedValue = getFirstValue(value);

  if (normalizedValue === "signin" || normalizedValue === "signup") {
    return normalizedValue;
  }

  return undefined;
}

export default async function VerifyEmailPage({
  searchParams,
}: VerifyEmailPageProps) {
  const [session, resolvedSearchParams] = await Promise.all([
    getRequestAuthSession(),
    searchParams,
  ]);

  if (session?.user?.emailVerified) {
    redirect(getPostAuthRedirectPath(session.user));
  }

  return (
    <VerifyEmailClient
      initialEmail={
        session?.user?.email ?? getFirstValue(resolvedSearchParams.email) ?? ""
      }
      initialIntent={normalizeIntent(resolvedSearchParams.intent)}
      signedIn={Boolean(session?.user)}
    />
  );
}
