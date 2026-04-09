"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import { authClient } from "@/lib/auth-client";
import { buildResetPasswordRedirectUrl } from "@/lib/password-reset";
import { Button } from "@frescari/ui";

type RequestPasswordResetPayload = {
  email: string;
  redirectTo: string;
};

type RequestPasswordResetContext = {
  error: {
    code?: string | null;
  };
};

type RequestPasswordResetCallbacks = {
  onSuccess?: () => void;
  onError?: (context: RequestPasswordResetContext) => void;
};

type RequestPasswordResetFn = (
  payload: RequestPasswordResetPayload,
  callbacks?: RequestPasswordResetCallbacks,
) => Promise<unknown>;

type ForgotPasswordFormProps = {
  emailDeliveryConfigured?: boolean;
  requestPasswordReset?: RequestPasswordResetFn;
  resetPasswordRedirectUrl?: string;
};

const GENERIC_SUCCESS_MESSAGE =
  "Se o email informado puder receber acesso, enviaremos um link para redefinir sua senha.";
const LOCAL_LOG_ONLY_SUCCESS_MESSAGE =
  "O envio por e-mail nao esta configurado neste ambiente. O link de redefinicao foi registrado apenas no log do servidor.";
const GENERIC_ERROR_MESSAGE =
  "Nao foi possivel solicitar a redefinicao agora. Aguarde um instante e tente novamente.";

function getDefaultResetRedirectUrl() {
  if (typeof window !== "undefined") {
    return buildResetPasswordRedirectUrl(window.location.origin);
  }

  return buildResetPasswordRedirectUrl();
}

function StatusCard({
  eyebrow,
  message,
  tone,
}: {
  eyebrow: string;
  message: string;
  tone: "error" | "success";
}) {
  const classes =
    tone === "error"
      ? "border-red-200 bg-red-50 text-red-800"
      : "border-emerald-200 bg-emerald-50 text-emerald-800";

  return (
    <div
      aria-live={tone === "error" ? "assertive" : "polite"}
      className={`rounded-[20px] border px-4 py-4 ${classes}`}
      role={tone === "error" ? "alert" : "status"}
    >
      <p className="font-sans text-[10px] font-bold uppercase tracking-[0.18em]">
        {eyebrow}
      </p>
      <p className="mt-2 font-sans text-sm leading-6">{message}</p>
    </div>
  );
}

export function ForgotPasswordForm({
  emailDeliveryConfigured = true,
  requestPasswordReset = authClient.requestPasswordReset as RequestPasswordResetFn,
  resetPasswordRedirectUrl = getDefaultResetRedirectUrl(),
}: ForgotPasswordFormProps) {
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const canSubmit = !loading;
  const successEyebrow = emailDeliveryConfigured
    ? "Link solicitado"
    : "Ambiente local";
  const successMessage = emailDeliveryConfigured
    ? GENERIC_SUCCESS_MESSAGE
    : LOCAL_LOG_ONLY_SUCCESS_MESSAGE;
  const successHint = emailDeliveryConfigured
    ? "Quando o link chegar, abra o email mais recente para seguir."
    : "Abra o terminal do servidor local para copiar o link mais recente e continuar o teste.";

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    const formData = new FormData(event.currentTarget);
    const normalizedEmail = String(
      formData.get("forgot-password-email") ?? "",
    ).trim();

    if (!normalizedEmail) {
      setError("Informe o email que deve receber o link.");
      return;
    }

    setLoading(true);

    try {
      let didError = false;

      await requestPasswordReset(
        {
          email: normalizedEmail,
          redirectTo: resetPasswordRedirectUrl,
        },
        {
          onSuccess: () => {
            setSuccess(true);
          },
          onError: (context) => {
            didError = true;
            const code = context.error.code ?? "";
            const messageMap: Record<string, string> = {
              INVALID_EMAIL: "Use um email valido para receber o link.",
              TOO_MANY_REQUESTS:
                "Muitas tentativas em pouco tempo. Aguarde um instante antes de tentar novamente.",
              RATE_LIMITED:
                "Muitas tentativas em pouco tempo. Aguarde um instante antes de tentar novamente.",
            };

            setError(messageMap[code] || GENERIC_ERROR_MESSAGE);
          },
        },
      );

      if (!didError) {
        setSuccess(true);
      }
    } catch {
      setError(GENERIC_ERROR_MESSAGE);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-cream">
      <div className="flex min-h-screen items-center justify-center px-6 py-10 lg:px-12">
        <section className="surface-panel w-full max-w-[38rem] rounded-[32px] p-7 sm:p-9">
          <div className="space-y-3">
            <p className="field-label">Recuperar acesso</p>
            <h1 className="font-display text-4xl font-black tracking-[-0.05em] text-soil sm:text-5xl">
              Esqueceu sua senha?
            </h1>
            <p className="max-w-2xl font-sans text-sm leading-6 text-bark/76">
              Informe o email da sua conta para receber um link seguro de
              redefinicao.
            </p>
          </div>

          <div className="mt-6 space-y-5">
            {error ? (
              <StatusCard
                eyebrow="Nao foi possivel enviar"
                message={error}
                tone="error"
              />
            ) : null}

            {success ? (
              <div className="space-y-4">
                <StatusCard
                  eyebrow={successEyebrow}
                  message={successMessage}
                  tone="success"
                />
                <div className="flex flex-col gap-3 border-t border-soil/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="font-sans text-sm leading-6 text-bark/72">
                    {successHint}
                  </p>
                  <Link
                    className="font-sans text-sm font-bold text-forest underline-offset-4 transition-[color] hover:text-soil hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
                    href="/auth/login"
                  >
                    Voltar ao login
                  </Link>
                </div>
              </div>
            ) : (
              <form className="space-y-5" noValidate onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <label
                    className="field-label"
                    htmlFor="forgot-password-email"
                  >
                    E-mail para recuperar acesso
                  </label>
                  <input
                    autoCapitalize="none"
                    autoComplete="email"
                    autoCorrect="off"
                    className={[
                      "input-shell w-full rounded-[18px] px-4 py-3.5 font-sans text-sm text-soil",
                      "placeholder:text-bark/42",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2 focus-visible:ring-offset-cream",
                    ].join(" ")}
                    disabled={loading}
                    id="forgot-password-email"
                    name="forgot-password-email"
                    placeholder="voce@empresa.com"
                    required
                    spellCheck={false}
                    type="email"
                  />
                  <p className="font-sans text-xs leading-5 text-bark/68">
                    O retorno sera sempre discreto para proteger o acesso da sua
                    conta.
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
                  {loading ? "Enviando..." : "Enviar link de redefinicao"}
                </Button>
              </form>
            )}
          </div>

          {!success ? (
            <div className="mt-8 flex flex-col gap-3 border-t border-soil/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
              <p className="font-sans text-sm leading-6 text-bark/74">
                Se voce lembrar da senha, pode voltar e entrar normalmente.
              </p>
              <Link
                className="font-sans text-sm font-bold text-forest underline-offset-4 transition-[color] hover:text-soil hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
                href="/auth/login"
              >
                Voltar ao login
              </Link>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
