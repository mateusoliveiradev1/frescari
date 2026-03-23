"use client";

import { useState, type FormEvent, type InputHTMLAttributes } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { BrandLogo } from "@/components/brand-logo";
import { authClient } from "@/lib/auth-client";
import {
  buildVerifyEmailPendingPath,
  EMAIL_VERIFICATION_CALLBACK_PATH,
} from "@/lib/email-verification";
import { legalDocumentLinks } from "@/lib/legal-documents";
import { getPostAuthRedirectPath } from "@/lib/post-auth-redirect";
import { Button } from "@frescari/ui";

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: string;
  hint?: string;
};

function AuthField({ id, label, hint, className, ...props }: FieldProps) {
  return (
    <div className="space-y-2">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <input
        className={[
          "input-shell w-full rounded-[18px] px-4 py-3.5 font-sans text-sm text-soil",
          "placeholder:text-bark/42",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2 focus-visible:ring-offset-cream",
          className,
        ].join(" ")}
        id={id}
        {...props}
      />
      {hint ? (
        <p className="font-sans text-xs leading-5 text-bark/68">{hint}</p>
      ) : null}
    </div>
  );
}

function ErrorAlert({ message }: { message: string }) {
  return (
    <div
      aria-live="assertive"
      className="rounded-[20px] border border-red-200 bg-red-50 px-4 py-4"
      role="alert"
    >
      <p className="font-sans text-[10px] font-bold uppercase tracking-[0.18em] text-red-700">
        Falha no acesso
      </p>
      <p className="mt-2 font-sans text-sm leading-6 text-red-800">{message}</p>
    </div>
  );
}

export function LoginForm() {
  const router = useRouter();
  const genericLoginError =
    "Nao foi possivel entrar. Revise suas credenciais e tente novamente.";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      await authClient.signIn.email(
        {
          email,
          password,
          callbackURL: EMAIL_VERIFICATION_CALLBACK_PATH,
        },
        {
          onSuccess: () => {
            void authClient
              .getSession()
              .then((sessionResponse) => {
                const user = sessionResponse.data?.user as
                  | {
                      emailVerified?: boolean | null;
                      role?: string | null;
                      tenantId?: string | null;
                    }
                  | undefined;

                window.location.href = getPostAuthRedirectPath({
                  emailVerified: user?.emailVerified,
                  role: user?.role,
                  tenantId: user?.tenantId,
                });
              })
              .catch(() => {
                window.location.href = "/dashboard";
              });
          },
          onError: (context) => {
            const code = context.error.code ?? "";

            if (code === "EMAIL_NOT_VERIFIED") {
              setLoading(false);
              router.replace(
                buildVerifyEmailPendingPath({
                  email,
                  intent: "signin",
                }),
              );
              return;
            }

            const messageMap: Record<string, string> = {
              INVALID_EMAIL: "Use um email valido para continuar.",
              INVALID_EMAIL_OR_PASSWORD:
                "Email ou senha invalidos. Revise as credenciais e tente novamente.",
              TOO_MANY_REQUESTS:
                "Muitas tentativas em pouco tempo. Aguarde um instante e tente novamente.",
            };

            setError(messageMap[code] || genericLoginError);
            setLoading(false);
          },
        },
      );
    } catch {
      setError(genericLoginError);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-cream">
      <div className="grid min-h-screen lg:grid-cols-[0.92fr_1.08fr]">
        <aside className="relative hidden overflow-hidden border-r border-white/8 bg-forest lg:flex">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(249,246,240,0.14),transparent_34%),linear-gradient(145deg,rgba(13,51,33,1),rgba(9,37,24,0.94))]" />
          <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle,rgba(249,246,240,0.35)_1px,transparent_1px)] [background-size:26px_26px]" />

          <div className="relative z-10 flex w-full flex-col justify-between p-12 xl:p-16">
            <BrandLogo showDescriptor size="md" variant="inverse" />

            <div className="space-y-8">
              <div className="space-y-4">
                <p className="font-sans text-[10px] font-bold uppercase tracking-[0.22em] text-sage/70">
                  Plataforma B2B de hortifruti
                </p>
                <h2 className="max-w-md font-display text-5xl font-black italic leading-[0.92] tracking-[-0.05em] text-cream">
                  O abastecimento local fica mais claro quando a interface nao
                  atrapalha.
                </h2>
              </div>

              <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
                {[
                  [
                    "Compra por lote",
                    "Oferta com leitura rapida de origem, frescor e disponibilidade.",
                  ],
                  [
                    "Checkout por fazenda",
                    "Menos ruido logistico e mais previsibilidade no fechamento.",
                  ],
                  [
                    "Operacao premium",
                    "Estados, formularios e feedback visual pensados para agilidade.",
                  ],
                ].map(([title, copy]) => (
                  <div
                    className="rounded-[24px] border border-white/10 bg-white/6 px-5 py-5 backdrop-blur-sm"
                    key={title}
                  >
                    <p className="font-sans text-xs font-bold uppercase tracking-[0.18em] text-cream">
                      {title}
                    </p>
                    <p className="mt-3 font-sans text-sm leading-6 text-sage/78">
                      {copy}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <p className="font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-sage/44">
              Frescari marketplace
            </p>
          </div>
        </aside>

        <main className="flex items-center justify-center px-6 py-10 lg:px-12">
          <div className="w-full max-w-[34rem]">
            <div className="mb-8 flex lg:hidden">
              <BrandLogo size="sm" />
            </div>

            <section className="surface-panel rounded-[32px] p-7 sm:p-9">
              <div className="space-y-3">
                <p className="field-label">Acesso</p>
                <h1 className="font-display text-4xl font-black tracking-[-0.05em] text-soil sm:text-5xl">
                  Entrar na Frescari
                </h1>
                <p className="max-w-xl font-sans text-sm leading-6 text-bark/76">
                  Entre para acompanhar pedidos, disponibilidade e
                  relacionamento com produtores sem perder tempo com fluxo
                  confuso.
                </p>
              </div>

              <div className="mt-6 grid gap-3 rounded-[24px] border border-forest/10 bg-white px-4 py-4 sm:grid-cols-3">
                {[
                  [
                    "Sinal claro",
                    "Campos e estados com contraste e foco real.",
                  ],
                  ["Menos atrito", "Validacao e retorno visual mais legiveis."],
                  [
                    "Fluxo rapido",
                    "Acesso feito para voltar ao catalogo em poucos passos.",
                  ],
                ].map(([title, copy]) => (
                  <div key={title}>
                    <p className="font-sans text-[10px] font-bold uppercase tracking-[0.16em] text-forest">
                      {title}
                    </p>
                    <p className="mt-2 font-sans text-sm leading-6 text-bark/72">
                      {copy}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-8 space-y-5">
                {error ? <ErrorAlert message={error} /> : null}

                <form className="space-y-5" noValidate onSubmit={handleLogin}>
                  <AuthField
                    aria-invalid={Boolean(error)}
                    autoCapitalize="none"
                    autoComplete="email"
                    autoCorrect="off"
                    disabled={loading}
                    id="email"
                    label="Email"
                    name="email"
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="compras@empresa.com"
                    required
                    spellCheck={false}
                    type="email"
                    value={email}
                  />

                  <AuthField
                    aria-invalid={Boolean(error)}
                    autoComplete="current-password"
                    disabled={loading}
                    hint="Use a senha cadastrada para liberar catalogo, pedidos e checkout."
                    id="password"
                    label="Senha"
                    name="password"
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Digite sua senha"
                    required
                    type="password"
                    value={password}
                  />

                  <Button
                    className="h-13 w-full rounded-[18px] text-sm shadow-[0_20px_42px_-24px_rgba(13,51,33,0.46)]"
                    data-loading={loading}
                    disabled={loading}
                    size="lg"
                    type="submit"
                    variant="primary"
                  >
                    {loading ? "Entrando..." : "Entrar"}
                  </Button>
                </form>
              </div>

              <div className="mt-8 flex flex-col gap-3 border-t border-soil/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
                <p className="font-sans text-sm leading-6 text-bark/74">
                  Ainda nao tem conta? Cadastre seu acesso e siga para o
                  onboarding.
                </p>
                <Link
                  className="font-sans text-sm font-bold text-forest underline-offset-4 transition-[color] hover:text-soil hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
                  href="/auth/register"
                >
                  Criar conta
                </Link>
              </div>

              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 border-t border-soil/8 pt-4">
                {legalDocumentLinks.map((item) => (
                  <Link
                    className="font-sans text-[11px] font-bold uppercase tracking-[0.14em] text-bark/72 underline-offset-4 transition-[color] hover:text-forest hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
                    href={item.href}
                    key={item.href}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
