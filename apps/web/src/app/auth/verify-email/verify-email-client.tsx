"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";

import { BrandLogo } from "@/components/brand-logo";
import { authClient } from "@/lib/auth-client";
import {
  EMAIL_VERIFICATION_CALLBACK_PATH,
  type EmailVerificationIntent,
} from "@/lib/email-verification";
import { Button } from "@frescari/ui";

type VerifyEmailClientProps = {
  initialEmail: string;
  initialIntent?: EmailVerificationIntent;
  signedIn: boolean;
};

function StatusNotice({
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
        {tone === "error" ? "Nao foi possivel reenviar" : "Link reenviado"}
      </p>
      <p className="mt-2 font-sans text-sm leading-6">{message}</p>
    </div>
  );
}

function getIntentCopy(intent?: EmailVerificationIntent) {
  if (intent === "signup") {
    return {
      eyebrow: "Cadastro em espera",
      heading: "Verifique seu email para liberar o primeiro acesso",
      supporting:
        "Se o email informado puder receber acesso, voce vai encontrar um link de confirmacao na caixa de entrada. Depois disso, seguimos para o onboarding.",
      secondaryLabel: "Voltar ao cadastro",
      secondaryHref: "/auth/register",
    };
  }

  return {
    eyebrow: "Acesso em espera",
    heading: "Confirme seu email para concluir a entrada",
    supporting:
      "Se o email informado puder receber acesso, o link mais recente vai destravar a sua entrada na plataforma.",
    secondaryLabel: "Voltar ao login",
    secondaryHref: "/auth/login",
  };
}

export function VerifyEmailClient({
  initialEmail,
  initialIntent,
  signedIn,
}: VerifyEmailClientProps) {
  const copy = getIntentCopy(initialIntent);
  const genericResendError =
    "Nao foi possivel solicitar um novo link agora. Aguarde um instante e tente novamente.";
  const [email, setEmail] = useState(initialEmail);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleResend = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    const normalizedEmail = email.trim();

    if (!normalizedEmail) {
      setError("Informe o email que deve receber o link de confirmacao.");
      return;
    }

    setLoading(true);

    try {
      await authClient.sendVerificationEmail(
        {
          email: normalizedEmail,
          callbackURL: EMAIL_VERIFICATION_CALLBACK_PATH,
        },
        {
          onSuccess: () => {
            setSuccess(
              "Se o email informado puder receber acesso, enviamos um novo link de confirmacao.",
            );
          },
          onError: (context) => {
            const code = context.error.code ?? "";
            const messageMap: Record<string, string> = {
              INVALID_EMAIL: "Use um email valido para reenviar o link.",
              TOO_MANY_REQUESTS:
                "Muitos pedidos em pouco tempo. Aguarde um instante antes de tentar novamente.",
            };

            setError(messageMap[code] || genericResendError);
          },
        },
      );
    } catch {
      setError(genericResendError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-cream">
      <div className="flex min-h-screen items-center justify-center px-6 py-10 lg:px-12">
        <div className="w-full max-w-[40rem]">
          <div className="mb-8 flex justify-center">
            <BrandLogo size="sm" />
          </div>

          <section className="surface-panel rounded-[32px] p-7 sm:p-9">
            <div className="space-y-3">
              <p className="field-label">{copy.eyebrow}</p>
              <h1 className="font-display text-4xl font-black tracking-[-0.05em] text-soil sm:text-5xl">
                {copy.heading}
              </h1>
              <p className="max-w-2xl font-sans text-sm leading-6 text-bark/76">
                {copy.supporting}
              </p>
            </div>

            <div className="mt-6 rounded-[24px] border border-forest/10 bg-white px-4 py-4">
              <p className="font-sans text-[10px] font-bold uppercase tracking-[0.16em] text-forest">
                Email em uso
              </p>
              <p className="mt-2 break-all font-sans text-base leading-7 text-soil">
                {email.trim() ||
                  "Informe abaixo o email que precisa receber o link."}
              </p>
              <p className="mt-3 font-sans text-sm leading-6 text-bark/70">
                {signedIn
                  ? "Sua sessao so fica pronta depois da confirmacao."
                  : "Abra o link mais recente recebido nesse endereco para seguir."}
              </p>
            </div>

            <div className="mt-8 space-y-5">
              {error ? <StatusNotice message={error} tone="error" /> : null}
              {success ? (
                <StatusNotice message={success} tone="success" />
              ) : null}

              <form className="space-y-5" noValidate onSubmit={handleResend}>
                <div className="space-y-2">
                  <label className="field-label" htmlFor="verification-email">
                    Reenviar link para
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
                    id="verification-email"
                    name="verification-email"
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="voce@empresa.com"
                    required
                    spellCheck={false}
                    type="email"
                    value={email}
                  />
                  <p className="font-sans text-xs leading-5 text-bark/68">
                    O reenvio usa sempre um link novo e invalida o link antigo.
                  </p>
                </div>

                <Button
                  className="h-13 w-full rounded-[18px] text-sm shadow-[0_20px_42px_-24px_rgba(13,51,33,0.46)]"
                  data-loading={loading}
                  disabled={loading}
                  size="lg"
                  type="submit"
                  variant="primary"
                >
                  {loading ? "Reenviando..." : "Reenviar link de confirmacao"}
                </Button>
              </form>
            </div>

            <div className="mt-8 flex flex-col gap-3 border-t border-soil/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
              <p className="font-sans text-sm leading-6 text-bark/74">
                Se o link expirou ou a caixa de entrada atrasou, voce pode pedir
                outro acima sem perder o fluxo.
              </p>
              <Link
                className="font-sans text-sm font-bold text-forest underline-offset-4 transition-[color] hover:text-soil hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
                href={copy.secondaryHref}
              >
                {copy.secondaryLabel}
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
