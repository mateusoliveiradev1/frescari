import Link from "next/link";
import { redirect } from "next/navigation";

import { BrandLogo } from "@/components/brand-logo";
import { buildVerifyEmailPendingPath } from "@/lib/email-verification";
import { getPostAuthRedirectPath } from "@/lib/post-auth-redirect";
import { getRequestAuthSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

export default async function VerifiedPage() {
  const session = await getRequestAuthSession();

  if (session?.user?.emailVerified) {
    redirect(getPostAuthRedirectPath(session.user));
  }

  const retryPath = buildVerifyEmailPendingPath({
    email: session?.user?.email,
    intent: "signin",
  });

  return (
    <div className="min-h-screen bg-cream">
      <div className="flex min-h-screen items-center justify-center px-6 py-10 lg:px-12">
        <div className="w-full max-w-[38rem]">
          <div className="mb-8 flex justify-center">
            <BrandLogo size="sm" />
          </div>

          <section className="surface-panel rounded-[32px] p-7 text-center sm:p-9">
            <p className="field-label">Confirmacao em processamento</p>
            <h1 className="mt-3 font-display text-4xl font-black tracking-[-0.05em] text-soil sm:text-5xl">
              Estamos finalizando seu acesso
            </h1>
            <p className="mt-4 font-sans text-sm leading-6 text-bark/76">
              Se esta pagina nao avancar sozinha, volte para a etapa de
              verificacao e solicite um link novo. O acesso so e liberado com o
              link mais recente.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Link
                className="inline-flex items-center justify-center rounded-[18px] bg-forest px-5 py-3 font-sans text-sm font-bold text-cream shadow-[0_20px_42px_-24px_rgba(13,51,33,0.46)] transition-[background-color] hover:bg-soil focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
                href={retryPath}
              >
                Voltar para confirmar email
              </Link>
              <Link
                className="inline-flex items-center justify-center rounded-[18px] border border-forest/12 bg-white px-5 py-3 font-sans text-sm font-bold text-forest transition-[color,border-color] hover:border-forest hover:text-soil focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
                href="/auth/login"
              >
                Ir para login
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
