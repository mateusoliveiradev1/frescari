"use client";

import { useState, type FormEvent, type InputHTMLAttributes } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { BrandLogo } from "@/components/brand-logo";
import { authClient } from "@/lib/auth-client";
import {
  LEGAL_CONSENT_REQUIRED_CODE,
  LEGAL_VERSION_MISMATCH_CODE,
} from "@/lib/legal-consent";
import { LEGAL_VERSION, legalDocumentLinks } from "@/lib/legal-documents";
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

function StatusAlert({
  message,
  tone,
}: {
  message: string;
  tone: "error" | "success";
}) {
  const classes =
    tone === "error"
      ? "border-red-200 bg-red-50 text-red-800"
      : "border-emerald-200 bg-emerald-50 text-emerald-800";

  const eyebrowTone = tone === "error" ? "text-red-700" : "text-emerald-700";

  return (
    <div
      aria-live={tone === "error" ? "assertive" : "polite"}
      className={`rounded-[20px] border px-4 py-4 ${classes}`}
      role={tone === "error" ? "alert" : "status"}
    >
      <p
        className={`font-sans text-[10px] font-bold uppercase tracking-[0.18em] ${eyebrowTone}`}
      >
        {tone === "error" ? "Nao foi possivel criar a conta" : "Conta criada"}
      </p>
      <p className="mt-2 font-sans text-sm leading-6">{message}</p>
    </div>
  );
}

export function RegisterForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [acceptedLegal, setAcceptedLegal] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!acceptedLegal) {
      setError(
        "Para criar a conta, aceite os documentos juridicos da plataforma.",
      );
      return;
    }

    setLoading(true);

    try {
      const signUpPayload = {
        email,
        name,
        password,
        acceptedLegal: true,
        acceptedLegalVersion: LEGAL_VERSION,
        acceptedLegalSource: "auth_register_page",
      } as Parameters<typeof authClient.signUp.email>[0];

      await authClient.signUp.email(signUpPayload, {
        onSuccess: () => {
          setSuccess(
            "Conta criada com sucesso. Estamos preparando seu onboarding.",
          );
          router.refresh();
          window.setTimeout(() => {
            router.push("/onboarding");
          }, 800);
        },
        onError: (context) => {
          const code = context.error.code ?? "";
          const messageMap: Record<string, string> = {
            USER_ALREADY_EXISTS:
              "Este email ja esta cadastrado. Tente entrar com sua conta atual.",
            INVALID_EMAIL: "Use um email valido para continuar.",
            PASSWORD_TOO_SHORT: "A senha precisa ter pelo menos 6 caracteres.",
            WEAK_PASSWORD:
              "Use uma senha mais forte, combinando letras e numeros.",
            [LEGAL_CONSENT_REQUIRED_CODE]:
              "Para criar a conta, aceite os documentos juridicos da plataforma.",
            [LEGAL_VERSION_MISMATCH_CODE]:
              "Os documentos juridicos foram atualizados. Recarregue a pagina e confirme novamente.",
          };

          setError(
            messageMap[code] ||
              context.error.message ||
              "Nao foi possivel concluir o cadastro.",
          );
        },
      });
    } catch (caughtError: unknown) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Erro inesperado ao criar a conta.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-cream">
      <div className="grid min-h-screen lg:grid-cols-[0.96fr_1.04fr]">
        <aside className="relative hidden overflow-hidden border-r border-white/8 bg-forest lg:flex">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(249,246,240,0.12),transparent_36%),linear-gradient(145deg,rgba(13,51,33,1),rgba(9,37,24,0.95))]" />
          <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle,rgba(249,246,240,0.35)_1px,transparent_1px)] [background-size:26px_26px]" />

          <div className="relative z-10 flex w-full flex-col justify-between p-12 xl:p-16">
            <BrandLogo showDescriptor size="md" variant="inverse" />

            <div className="space-y-8">
              <div className="space-y-4">
                <p className="font-sans text-[10px] font-bold uppercase tracking-[0.22em] text-sage/70">
                  Entrada premium para um marketplace local
                </p>
                <h2 className="max-w-md font-display text-5xl font-black italic leading-[0.92] tracking-[-0.05em] text-cream">
                  O cadastro precisa inspirar confianca antes do primeiro
                  pedido.
                </h2>
              </div>

              <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
                {[
                  [
                    "Fluxo limpo",
                    "Menos poluicao visual, mais clareza na decisao de seguir.",
                  ],
                  [
                    "Sem ambiguidades",
                    "Campos, estados e mensagens escritos para contexto B2B.",
                  ],
                  [
                    "Entrada pronta",
                    "Depois do cadastro o usuario ja entra no onboarding certo.",
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

            <div className="grid grid-cols-3 gap-3">
              {[
                ["B2B", "operacao"],
                ["Local", "origem"],
                ["Premium", "interface"],
              ].map(([value, label]) => (
                <div
                  className="rounded-[22px] border border-white/10 bg-white/6 px-4 py-4 text-center backdrop-blur-sm"
                  key={value}
                >
                  <p className="font-display text-2xl font-black italic text-cream">
                    {value}
                  </p>
                  <p className="mt-1 font-sans text-[10px] font-bold uppercase tracking-[0.18em] text-sage/60">
                    {label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </aside>

        <main className="flex items-center justify-center px-6 py-10 lg:px-12">
          <div className="w-full max-w-[35rem]">
            <div className="mb-8 flex lg:hidden">
              <BrandLogo size="sm" />
            </div>

            <section className="surface-panel rounded-[32px] p-7 sm:p-9">
              <div className="space-y-3">
                <p className="field-label">Cadastro</p>
                <h1 className="font-display text-4xl font-black tracking-[-0.05em] text-soil sm:text-5xl">
                  Criar conta
                </h1>
                <p className="max-w-xl font-sans text-sm leading-6 text-bark/76">
                  Abra seu acesso e siga direto para configurar perfil,
                  enderecos e preferencia de compra ou venda sem ruido
                  desnecessario.
                </p>
              </div>

              <div className="mt-6 grid gap-3 rounded-[24px] border border-forest/10 bg-white px-4 py-4 sm:grid-cols-3">
                {[
                  ["Confianca", "Superficie limpa e mensagens objetivas."],
                  [
                    "Clareza",
                    "Campos com hierarquia e orientacao visual melhor.",
                  ],
                  ["Conversao", "Menos atrito para chegar ao onboarding."],
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
                {error ? <StatusAlert message={error} tone="error" /> : null}
                {success ? (
                  <StatusAlert message={success} tone="success" />
                ) : null}

                <form
                  className="space-y-5"
                  noValidate
                  onSubmit={handleRegister}
                >
                  <AuthField
                    autoComplete="name"
                    disabled={loading}
                    id="name"
                    label="Nome completo"
                    name="name"
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Ex.: Maria Silva"
                    required
                    type="text"
                    value={name}
                  />

                  <AuthField
                    autoCapitalize="none"
                    autoComplete="email"
                    autoCorrect="off"
                    disabled={loading}
                    id="email"
                    label="Email de acesso"
                    name="email"
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="voce@empresa.com"
                    required
                    spellCheck={false}
                    type="email"
                    value={email}
                  />

                  <AuthField
                    autoComplete="new-password"
                    disabled={loading}
                    hint="Minimo de 6 caracteres. Prefira uma senha unica para sua operacao."
                    id="password"
                    label="Senha"
                    minLength={6}
                    name="password"
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Crie uma senha segura"
                    required
                    type="password"
                    value={password}
                  />

                  <div className="rounded-[24px] border border-forest/10 bg-white px-4 py-4">
                    <div className="flex items-start gap-3">
                      <input
                        checked={acceptedLegal}
                        className="mt-1 h-4 w-4 rounded border border-soil/22 text-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
                        disabled={loading}
                        id="accept-legal"
                        name="accept-legal"
                        onChange={(event) =>
                          setAcceptedLegal(event.target.checked)
                        }
                        required
                        type="checkbox"
                      />
                      <div className="space-y-3">
                        <label
                          className="font-sans text-sm leading-6 text-bark/82"
                          htmlFor="accept-legal"
                        >
                          Ao criar a conta, voce declara que leu e aceita os
                          documentos juridicos da Frescari desta versao interna
                          de revisao.
                        </label>
                        <div className="flex flex-wrap gap-x-4 gap-y-2">
                          {legalDocumentLinks.map((item) => (
                            <Link
                              className="font-sans text-xs font-bold uppercase tracking-[0.14em] text-forest underline-offset-4 transition-[color] hover:text-soil hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
                              href={item.href}
                              key={item.href}
                              rel="noreferrer"
                              target="_blank"
                            >
                              {item.label}
                            </Link>
                          ))}
                        </div>
                        <p className="font-sans text-[11px] leading-5 text-bark/62">
                          Versao juridica em uso: {LEGAL_VERSION}. Esta base
                          sera revisada pelo advogado antes da abertura publica
                          do dominio.
                        </p>
                      </div>
                    </div>
                  </div>

                  <Button
                    className="h-13 w-full rounded-[18px] text-sm shadow-[0_20px_42px_-24px_rgba(13,51,33,0.46)]"
                    data-loading={loading}
                    disabled={loading}
                    size="lg"
                    type="submit"
                    variant="primary"
                  >
                    {loading ? "Criando conta..." : "Criar conta e continuar"}
                  </Button>
                </form>
              </div>

              <div className="mt-8 flex flex-col gap-3 border-t border-soil/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
                <p className="font-sans text-sm leading-6 text-bark/74">
                  Ja tem acesso? Entre e volte ao catalogo ou ao painel da sua
                  operacao.
                </p>
                <Link
                  className="font-sans text-sm font-bold text-forest underline-offset-4 transition-[color] hover:text-soil hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
                  href="/auth/login"
                >
                  Entrar agora
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
