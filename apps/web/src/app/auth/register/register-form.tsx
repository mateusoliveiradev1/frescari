"use client";

import { useState, type FormEvent, type InputHTMLAttributes } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Eye, EyeOff, X } from "lucide-react";

import { BrandLogo } from "@/components/brand-logo";
import { authClient } from "@/lib/auth-client";
import {
  buildVerifyEmailPendingPath,
  EMAIL_VERIFICATION_CALLBACK_PATH,
} from "@/lib/email-verification";
import {
  LEGAL_CONSENT_REQUIRED_CODE,
  LEGAL_VERSION_MISMATCH_CODE,
} from "@/lib/legal-consent";
import { LEGAL_VERSION, legalDocumentLinks } from "@/lib/legal-documents";
import {
  getPasswordCriteria,
  isStrongPassword,
  PASSWORD_MIN_LENGTH,
  PASSWORD_POLICY_MESSAGE,
} from "@/lib/password-policy";
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

function PasswordRule({ met, text }: { met: boolean; text: string }) {
  return (
    <li className="flex items-center gap-2.5 font-sans text-sm leading-6">
      {met ? (
        <Check aria-hidden="true" className="h-4 w-4 shrink-0 text-forest" />
      ) : (
        <X aria-hidden="true" className="h-4 w-4 shrink-0 text-bark/34" />
      )}
      <span className={met ? "font-medium text-forest" : "text-bark/58"}>
        {text}
      </span>
    </li>
  );
}

export function RegisterForm() {
  const router = useRouter();
  const genericRegisterError =
    "Nao foi possivel concluir o cadastro agora. Revise os dados e tente novamente.";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [acceptedLegal, setAcceptedLegal] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const passwordCriteria = getPasswordCriteria(password);
  const passwordIsStrong = isStrongPassword(password);
  const hasPasswordInput = password.trim().length > 0;
  const canSubmit =
    name.trim().length > 0 &&
    email.trim().length > 0 &&
    passwordIsStrong &&
    acceptedLegal &&
    !loading;
  const essentialLegalLinks = legalDocumentLinks.filter(
    (item) => item.slug === "termos" || item.slug === "privacidade",
  );
  const complementaryLegalLinks = legalDocumentLinks.filter(
    (item) => item.slug !== "termos" && item.slug !== "privacidade",
  );

  const handleRegister = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (!passwordIsStrong) {
      setError(PASSWORD_POLICY_MESSAGE);
      return;
    }

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
        callbackURL: EMAIL_VERIFICATION_CALLBACK_PATH,
      } as Parameters<typeof authClient.signUp.email>[0];

      await authClient.signUp.email(signUpPayload, {
        onSuccess: () => {
          router.refresh();
          router.replace(
            buildVerifyEmailPendingPath({
              email,
              intent: "signup",
            }),
          );
        },
        onError: (context) => {
          const code = context.error.code ?? "";
          const messageMap: Record<string, string> = {
            INVALID_EMAIL: "Use um email valido para continuar.",
            PASSWORD_TOO_SHORT: `A senha precisa ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`,
            WEAK_PASSWORD: PASSWORD_POLICY_MESSAGE,
            TOO_MANY_REQUESTS:
              "Muitas tentativas em pouco tempo. Aguarde um instante e tente novamente.",
            [LEGAL_CONSENT_REQUIRED_CODE]:
              "Para criar a conta, aceite os documentos juridicos da plataforma.",
            [LEGAL_VERSION_MISMATCH_CODE]:
              "Os documentos juridicos foram atualizados. Recarregue a pagina e confirme novamente.",
          };

          setError(messageMap[code] || genericRegisterError);
        },
      });
    } catch {
      setError(genericRegisterError);
    } finally {
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
                    Seu acesso comeca aqui.
                  </h2>
                  <p className="max-w-[30rem] font-sans text-base leading-7 text-sage/78">
                    Crie sua conta, confirme o email e entre na plataforma com
                    um fluxo mais claro, seguro e elegante.
                  </p>
                </div>

                <div className="rounded-[30px] border border-white/12 bg-white/7 px-6 py-6 shadow-[0_30px_70px_-44px_rgba(0,0,0,0.6)] backdrop-blur-sm">
                  <div className="border-b border-white/10 pb-4">
                    <p className="font-sans text-[10px] font-bold uppercase tracking-[0.18em] text-sage/64">
                      O que voce encontra aqui
                    </p>
                    <p className="mt-2 font-sans text-sm leading-6 text-cream">
                      Um cadastro direto, com o essencial para entrar bem.
                    </p>
                  </div>

                  <div className="mt-5 space-y-4">
                    {[
                      [
                        "Preencha o essencial",
                        "Nome, email e senha segura em uma unica etapa objetiva.",
                      ],
                      [
                        "Confirme seu email",
                        "A verificacao protege o acesso e deixa a entrada mais segura.",
                      ],
                      [
                        "Entre na plataforma",
                        "Depois da confirmacao, sua conta fica pronta para seguir.",
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
                    A confirmacao por email libera o acesso com mais seguranca.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </aside>

        <main className="flex w-full min-w-0 items-center justify-center px-5 py-10 sm:px-6 lg:px-12">
          <div className="w-full min-w-0 max-w-[34rem]">
            <div className="mb-6 flex justify-center lg:hidden">
              <BrandLogo size="sm" />
            </div>

            <section className="surface-panel overflow-hidden rounded-[34px] p-5 sm:p-8">
              <div className="rounded-[26px] border border-white/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.88),rgba(249,246,240,0.74))] px-5 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] sm:px-6">
                <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.18em] text-bark/68">
                  Cadastro
                </p>
                <h1 className="font-display text-4xl font-black tracking-[-0.05em] text-soil sm:text-5xl">
                  Criar conta
                </h1>
                <p className="mt-3 max-w-xl font-sans text-sm leading-6 text-bark/76 sm:text-[15px]">
                  Crie seu acesso, confirme o email e entre na plataforma com um
                  fluxo mais claro e seguro.
                </p>
              </div>

              <div className="mt-6 rounded-[28px] border border-soil/8 bg-white/70 px-4 py-5 shadow-[0_16px_34px_-28px_rgba(13,51,33,0.35)] sm:px-5 sm:py-6">
                {error ? <StatusAlert message={error} tone="error" /> : null}

                <form
                  className="space-y-5"
                  noValidate
                  onSubmit={handleRegister}
                >
                  <AuthField
                    autoComplete="name"
                    disabled={loading}
                    id="name"
                    invalid={Boolean(error)}
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
                    invalid={Boolean(error)}
                    label="E-mail de acesso"
                    name="email"
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="voce@empresa.com"
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
                      Senha segura
                    </label>
                    <div className="relative">
                      <input
                        aria-invalid={hasPasswordInput && !passwordIsStrong}
                        autoComplete="new-password"
                        className={[
                          "w-full rounded-[16px] border bg-white/92 px-4 py-3.5 pr-12 font-sans text-[15px] text-soil",
                          "shadow-[inset_0_1px_0_rgba(249,246,240,0.92),0_10px_24px_-22px_rgba(13,51,33,0.35)]",
                          "placeholder:text-bark/42 transition-[border-color,box-shadow,background-color] duration-200",
                          hasPasswordInput && !passwordIsStrong
                            ? "border-forest/22"
                            : "border-soil/12 hover:border-soil/20",
                          "focus-visible:outline-none focus-visible:border-forest/60 focus-visible:ring-4 focus-visible:ring-forest/8",
                        ].join(" ")}
                        disabled={loading}
                        id="password"
                        minLength={PASSWORD_MIN_LENGTH}
                        name="password"
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder="Crie uma senha segura"
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
                    {hasPasswordInput ? (
                      <div
                        aria-live="polite"
                        className="rounded-[18px] border border-soil/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.86),rgba(249,246,240,0.82))] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.92)]"
                      >
                        <ul className="space-y-1.5">
                          <PasswordRule
                            met={passwordCriteria.hasMinLength}
                            text={`Minimo de ${PASSWORD_MIN_LENGTH} caracteres`}
                          />
                          <PasswordRule
                            met={passwordCriteria.hasUppercase}
                            text="Letra maiuscula"
                          />
                          <PasswordRule
                            met={passwordCriteria.hasLowercase}
                            text="Letra minuscula"
                          />
                          <PasswordRule
                            met={passwordCriteria.hasNumber}
                            text="Numero"
                          />
                        </ul>
                      </div>
                    ) : (
                      <p className="px-1 font-sans text-xs leading-5 text-bark/62">
                        Use uma senha unica para sua conta.
                      </p>
                    )}
                  </div>

                  <div className="rounded-[24px] border border-soil/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.86),rgba(249,246,240,0.82))] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.92)]">
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
                          Ao criar a conta, voce confirma que leu e aceita os
                          documentos essenciais da Frescari.
                        </label>
                        <div className="flex flex-wrap gap-x-4 gap-y-2">
                          {essentialLegalLinks.map((item) => (
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
                        <details className="rounded-[18px] border border-soil/10 bg-white/60 px-4 py-3">
                          <summary className="cursor-pointer font-sans text-[11px] font-bold uppercase tracking-[0.14em] text-bark/72">
                            Ver politicas complementares
                          </summary>
                          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
                            {complementaryLegalLinks.map((item) => (
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
                        </details>
                      </div>
                    </div>
                  </div>

                  <Button
                    className="h-13 w-full rounded-[18px] text-sm shadow-[0_20px_42px_-24px_rgba(13,51,33,0.46)] disabled:border-soil/8 disabled:bg-soil/8 disabled:text-bark/48 disabled:shadow-none"
                    data-loading={loading}
                    disabled={!canSubmit}
                    size="lg"
                    type="submit"
                    variant="primary"
                  >
                    {loading
                      ? "Criando conta..."
                      : "Criar conta e receber link"}
                  </Button>
                </form>
              </div>

              <div className="mt-6 flex flex-col gap-2 border-t border-soil/10 pt-5 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
                <p className="font-sans text-sm leading-6 text-bark/74">
                  Ja possui uma conta?
                </p>
                <Link
                  className="font-sans text-sm font-bold text-forest underline-offset-4 transition-[color] hover:text-soil hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
                  href="/auth/login"
                >
                  Fazer login
                </Link>
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
