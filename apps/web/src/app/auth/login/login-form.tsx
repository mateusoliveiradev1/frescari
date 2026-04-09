"use client";

import { useState, type FormEvent, type InputHTMLAttributes } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";

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
  invalid?: boolean;
};

function AuthField({
  id,
  label,
  hint,
  className,
  invalid = false,
  ...props
}: FieldProps) {
  return (
    <div className="space-y-2.5">
      <label
        className="font-sans text-sm font-medium tracking-[-0.01em] text-soil"
        htmlFor={id}
      >
        {label}
      </label>
      <input
        className={[
          "w-full rounded-[16px] border px-4 py-3.5 font-sans text-[15px] text-soil",
          "bg-white/92 shadow-[inset_0_1px_0_rgba(249,246,240,0.92),0_10px_24px_-22px_rgba(13,51,33,0.35)]",
          "placeholder:text-bark/42",
          "transition-[border-color,box-shadow,background-color] duration-200",
          invalid
            ? "border-red-300 bg-red-50/70"
            : "border-soil/12 hover:border-soil/20",
          "focus-visible:outline-none focus-visible:border-forest/50 focus-visible:ring-4 focus-visible:ring-forest/8",
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
  const [showPassword, setShowPassword] = useState(false);
  const canSubmit =
    email.trim().length > 0 && password.trim().length > 0 && !loading;
  const essentialLegalLinks = legalDocumentLinks.filter(
    (item) => item.slug === "termos" || item.slug === "privacidade",
  );

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
    <div className="min-h-screen overflow-x-clip bg-cream">
      <div className="grid min-h-screen lg:grid-cols-[0.94fr_1.06fr]">
        <aside className="relative hidden overflow-hidden border-r border-white/8 bg-forest lg:flex">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(249,246,240,0.14),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(185,214,196,0.12),transparent_28%),linear-gradient(155deg,rgba(13,51,33,1),rgba(9,37,24,0.94))]" />
          <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle,rgba(249,246,240,0.35)_1px,transparent_1px)] [background-size:26px_26px]" />
          <div className="absolute inset-y-10 left-10 w-px bg-white/8 xl:left-14" />

          <div className="relative z-10 flex w-full flex-col p-12 xl:p-16">
            <BrandLogo showDescriptor size="md" variant="inverse" />

            <div className="flex flex-1 items-center">
              <div className="max-w-[35rem] space-y-8">
                <div className="space-y-4">
                  <h2 className="max-w-[30rem] font-display text-5xl font-black italic leading-[0.92] tracking-[-0.05em] text-cream xl:text-[4.4rem]">
                    Entre e continue de onde parou.
                  </h2>
                  <p className="max-w-[30rem] font-sans text-base leading-7 text-sage/78">
                    Use seu email e senha para voltar ao catalogo, acompanhar
                    pedidos e manter o contato com produtores em um fluxo direto
                    e elegante.
                  </p>
                </div>

                <div className="rounded-[30px] border border-white/12 bg-white/7 px-6 py-6 shadow-[0_30px_70px_-44px_rgba(0,0,0,0.6)] backdrop-blur-sm">
                  <div className="border-b border-white/10 pb-4">
                    <p className="font-sans text-[10px] font-bold uppercase tracking-[0.18em] text-sage/64">
                      Ao entrar
                    </p>
                    <p className="mt-2 font-sans text-sm leading-6 text-cream">
                      Seu acesso devolve a voce o que importa, sem excesso de
                      interface.
                    </p>
                  </div>

                  <div className="mt-5 space-y-4">
                    {[
                      [
                        "Acompanhe pedidos",
                        "Consulte historico, status e proximos passos em poucos cliques.",
                      ],
                      [
                        "Veja disponibilidade",
                        "Retome a busca por produtos com leitura clara e sem atrito.",
                      ],
                      [
                        "Fale com seguranca",
                        "Volte para a sua conta com direcionamento automatico para a area certa.",
                      ],
                    ].map(([title, copy]) => (
                      <div className="flex gap-4" key={title}>
                        <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-sage shadow-[0_0_0_4px_rgba(185,214,196,0.12)]" />
                        <div>
                          <p className="font-sans text-sm font-semibold tracking-[-0.01em] text-cream">
                            {title}
                          </p>
                          <p className="mt-1 font-sans text-sm leading-6 text-sage/74">
                            {copy}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/6 px-4 py-3 backdrop-blur-sm">
                  <span className="h-2.5 w-2.5 rounded-full bg-sage" />
                  <p className="font-sans text-xs leading-5 text-sage/76">
                    Se o email ainda nao estiver confirmado, o fluxo leva voce
                    para a verificacao automaticamente.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </aside>

        <main className="flex w-full min-w-0 items-center justify-center px-5 py-5 sm:px-6 sm:py-10 lg:px-12">
          <div className="w-full min-w-0 max-w-[34rem]">
            <div className="mb-4 flex justify-center lg:hidden">
              <BrandLogo size="sm" />
            </div>

            <section className="surface-panel overflow-hidden rounded-[34px] p-4 sm:p-8">
              <div className="rounded-[26px] border border-white/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.88),rgba(249,246,240,0.74))] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] sm:px-6 sm:py-5">
                <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.18em] text-bark/68">
                  Acesso
                </p>
                <h1 className="font-display text-4xl font-black tracking-[-0.05em] text-soil sm:text-5xl">
                  Entrar na conta
                </h1>
                <p className="mt-3 max-w-xl font-sans text-sm leading-6 text-bark/76 sm:text-[15px]">
                  Use seu email e senha para voltar ao seu painel com um fluxo
                  mais claro, rapido e confiavel.
                </p>
              </div>

              <div className="mt-5 rounded-[28px] border border-soil/8 bg-white/70 px-4 py-5 shadow-[0_16px_34px_-28px_rgba(13,51,33,0.35)] sm:px-5 sm:py-6">
                {error ? <ErrorAlert message={error} /> : null}

                <form className="space-y-5" noValidate onSubmit={handleLogin}>
                  <AuthField
                    aria-invalid={Boolean(error)}
                    autoCapitalize="none"
                    autoComplete="email"
                    autoCorrect="off"
                    disabled={loading}
                    id="email"
                    invalid={Boolean(error)}
                    label="E-mail de acesso"
                    name="email"
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="compras@empresa.com"
                    required
                    spellCheck={false}
                    type="email"
                    value={email}
                  />

                  <div className="space-y-2.5">
                    <label
                      className="font-sans text-sm font-medium tracking-[-0.01em] text-soil"
                      htmlFor="password"
                    >
                      Senha
                    </label>
                    <div className="relative">
                      <input
                        aria-invalid={Boolean(error)}
                        autoComplete="current-password"
                        className={[
                          "w-full rounded-[16px] border bg-white/92 px-4 py-3.5 pr-12 font-sans text-[15px] text-soil",
                          "shadow-[inset_0_1px_0_rgba(249,246,240,0.92),0_10px_24px_-22px_rgba(13,51,33,0.35)]",
                          "placeholder:text-bark/42 transition-[border-color,box-shadow,background-color] duration-200",
                          error
                            ? "border-red-300 bg-red-50/70"
                            : "border-soil/12 hover:border-soil/20",
                          "focus-visible:outline-none focus-visible:border-forest/50 focus-visible:ring-4 focus-visible:ring-forest/8",
                        ].join(" ")}
                        disabled={loading}
                        id="password"
                        name="password"
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder="Digite sua senha"
                        required
                        type={showPassword ? "text" : "password"}
                        value={password}
                      />
                      <button
                        aria-label={
                          showPassword ? "Ocultar senha" : "Mostrar senha"
                        }
                        className="absolute inset-y-0 right-3 inline-flex items-center justify-center text-bark/48 transition-colors hover:text-forest focus-visible:outline-none"
                        onClick={() => setShowPassword((current) => !current)}
                        type="button"
                      >
                        {showPassword ? (
                          <EyeOff aria-hidden="true" className="h-4 w-4" />
                        ) : (
                          <Eye aria-hidden="true" className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    <p className="px-1 font-sans text-xs leading-5 text-bark/62">
                      Use a mesma senha cadastrada para liberar seu acesso.
                    </p>
                  </div>

                  <Button
                    className="h-13 w-full rounded-[18px] text-sm shadow-[0_20px_42px_-24px_rgba(13,51,33,0.46)] disabled:border-soil/8 disabled:bg-soil/8 disabled:text-bark/48 disabled:shadow-none"
                    data-loading={loading}
                    disabled={!canSubmit}
                    size="lg"
                    type="submit"
                    variant="primary"
                  >
                    {loading ? "Entrando..." : "Entrar na conta"}
                  </Button>
                </form>
              </div>

              <div className="mt-4 flex flex-col gap-2 border-t border-soil/10 pt-4 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
                <p className="font-sans text-sm leading-6 text-bark/74">
                  Ainda nao tem conta?
                </p>
                <Link
                  className="font-sans text-sm font-bold text-forest underline-offset-4 transition-[color] hover:text-soil hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
                  href="/auth/register"
                >
                  Criar conta
                </Link>
              </div>

              <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-center sm:justify-start sm:text-left">
                {essentialLegalLinks.map((item) => (
                  <Link
                    className="font-sans text-[10px] font-bold uppercase tracking-[0.14em] text-bark/62 underline-offset-4 transition-[color] hover:text-forest hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
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
