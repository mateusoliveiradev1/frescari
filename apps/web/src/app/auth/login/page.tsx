import { redirect } from "next/navigation";

import { getPostAuthRedirectPath } from "@/lib/post-auth-redirect";
import { getRequestAuthSession } from "@/lib/server-session";

import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const session = await getRequestAuthSession();

  if (session?.user) {
    redirect(getPostAuthRedirectPath(session.user));
  }

  return <LoginForm />;
}
