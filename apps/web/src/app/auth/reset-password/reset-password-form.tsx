"use client";

import Link from "next/link";
import { useState, type FormEvent as ReactFormEvent } from "react";

import { authClient } from "@/lib/auth-client";
import {
  PASSWORD_MIN_LENGTH,
  PASSWORD_POLICY_MESSAGE,
  getPasswordCriteria,
  isStrongPassword,
} from "@/lib/password-policy";
import { Button } from "@frescari/ui";

type ResetPasswordContext = {
  error: {
    code?: string | null;
  };
};

type ResetPasswordCallbacks = {
  onSuccess?: () => void;
  onError?: (context: ResetPasswordContext) => void;
};

type ResetPasswordFn = (
  payload: {
    newPassword: string;
    token: string;
  },
  callbacks?: ResetPasswordCallbacks,
) => Promise<unknown>;

type ResetPasswordFormProps = {
  token: string | null;
  error?: "INVALID_TOKEN" | null;
  resetPassword?: ResetPasswordFn;
};

const INVALID_LINK_MESSAGE = "Link invalido ou expirado.";
const GENERIC_ERROR_MESSAGE =
  "Nao foi possivel redefinir a senha agora. Tente novamente em instantes.";

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

function PasswordCriteriaList({ password }: { password: string }) {
  const criteria = getPasswordCriteria(password);

  const items = [
    {
      key: "min-length",
      label: `Minimo de ${PASSWORD_MIN_LENGTH} caracteres`,
      met: criteria.hasMinLength,
    },
    {
      key: "uppercase",
      label: "Letra maiuscula",
      met: criteria.hasUppercase,
    },
    {
      key: "lowercase",
      label: "Letra minuscula",
      met: criteria.hasLowercase,
    },
    {
      key: "number",
      label: "Numero",
      met: criteria.hasNumber,
    },
  ];

  return (
    <ul className="space-y-1.5 rounded-[18px] border border-soil/8 bg-white/65 px-4 py-4 font-sans text-sm leading-6 text-bark/66">
      {items.map((item) => (
        <li
          className={`flex items-center gap-3 ${
            item.met ? "font-semibold text-forest" : "text-bark/66"
          }`}
          data-met={item.met}
          key={item.key}
        >
          <span
            aria-hidden="true"
            className={`inline-flex min-w-[2.1rem] items-center justify-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] ${
              item.met
                ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                : "border-soil/12 bg-white text-bark/42"
            }`}
          >
            {item.met ? "OK" : "--"}
          </span>
          <span>{item.label}</span>
        </li>
      ))}
    </ul>
  );
}

export function ResetPasswordForm({
  token,
  error = null,
  resetPassword = authClient.resetPassword as ResetPasswordFn,
}: ResetPasswordFormProps) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [invalidToken, setInvalidToken] = useState(
    error === "INVALID_TOKEN" || !token,
  );

  const passwordCriteria = getPasswordCriteria(password);
  const isPasswordStrong =
    passwordCriteria.hasMinLength &&
    passwordCriteria.hasUppercase &&
    passwordCriteria.hasLowercase &&
    passwordCriteria.hasNumber;
  const hasConfirmation = confirmation.trim().length > 0;
  const passwordsMatch = hasConfirmation && password === confirmation;
  const showConfirmationError = hasConfirmation && !passwordsMatch;
  const confirmationMessage = !hasConfirmation
    ? "Repita a senha exatamente como foi digitada acima."
    : passwordsMatch
      ? "As senhas coincidem."
      : "As senhas precisam ser iguais.";
  const canSubmit =
    !loading &&
    !invalidToken &&
    isPasswordStrong &&
    hasConfirmation &&
    passwordsMatch;

  const handlePasswordInput = (event: ReactFormEvent<HTMLInputElement>) => {
    setPassword(event.currentTarget.value);

    if (feedback) {
      setFeedback("");
    }
  };

  const handleConfirmationInput = (event: ReactFormEvent<HTMLInputElement>) => {
    setConfirmation(event.currentTarget.value);

    if (feedback) {
      setFeedback("");
    }
  };

  const handleSubmit = async (event: ReactFormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback("");

    const formData = new FormData(event.currentTarget);
    const nextPassword = String(formData.get("new-password") ?? "").trim();
    const nextConfirmation = String(
      formData.get("confirm-password") ?? "",
    ).trim();

    if (!token) {
      setInvalidToken(true);
      setFeedback(INVALID_LINK_MESSAGE);
      return;
    }

    if (!isStrongPassword(nextPassword)) {
      setFeedback(PASSWORD_POLICY_MESSAGE);
      return;
    }

    if (nextPassword !== nextConfirmation) {
      setFeedback("As senhas precisam ser iguais.");
      return;
    }

    setLoading(true);

    try {
      let didError = false;

      await resetPassword(
        {
          newPassword: nextPassword,
          token,
        },
        {
          onSuccess: () => {
            setSuccess(true);
          },
          onError: (context) => {
            didError = true;
            const code = context.error.code ?? "";

            if (code === "INVALID_TOKEN") {
              setInvalidToken(true);
              setFeedback(INVALID_LINK_MESSAGE);
              return;
            }

            setFeedback(GENERIC_ERROR_MESSAGE);
          },
        },
      );

      if (!didError) {
        setSuccess(true);
      }
    } catch {
      setFeedback(GENERIC_ERROR_MESSAGE);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-cream">
        <div className="flex min-h-screen items-center justify-center px-6 py-10 lg:px-12">
          <section className="surface-panel w-full max-w-[38rem] rounded-[32px] p-7 sm:p-9">
            <StatusCard
              eyebrow="Senha atualizada"
              message="Senha atualizada com sucesso."
              tone="success"
            />
            <div className="mt-6 flex flex-col gap-3 border-t border-soil/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
              <p className="font-sans text-sm leading-6 text-bark/72">
                Use sua nova senha para entrar novamente na plataforma.
              </p>
              <Link
                className="font-sans text-sm font-bold text-forest underline-offset-4 transition-[color] hover:text-soil hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
                href="/auth/login"
              >
                Ir para o login
              </Link>
            </div>
          </section>
        </div>
      </div>
    );
  }

  if (invalidToken) {
    return (
      <div className="min-h-screen bg-cream">
        <div className="flex min-h-screen items-center justify-center px-6 py-10 lg:px-12">
          <section className="surface-panel w-full max-w-[38rem] rounded-[32px] p-7 sm:p-9">
            <StatusCard
              eyebrow="Link indisponivel"
              message={INVALID_LINK_MESSAGE}
              tone="error"
            />
            <div className="mt-6 flex flex-col gap-3 border-t border-soil/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
              <p className="font-sans text-sm leading-6 text-bark/72">
                Solicite um novo email para continuar com seguranca.
              </p>
              <Link
                className="font-sans text-sm font-bold text-forest underline-offset-4 transition-[color] hover:text-soil hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
                href="/auth/forgot-password"
              >
                Pedir novo link
              </Link>
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream">
      <div className="flex min-h-screen items-center justify-center px-6 py-10 lg:px-12">
        <section className="surface-panel w-full max-w-[38rem] rounded-[32px] p-7 sm:p-9">
          <div className="space-y-3">
            <p className="field-label">Nova senha</p>
            <h1 className="font-display text-4xl font-black tracking-[-0.05em] text-soil sm:text-5xl">
              Redefina sua senha
            </h1>
            <p className="max-w-2xl font-sans text-sm leading-6 text-bark/76">
              Escolha uma senha forte para concluir o acesso com seguranca.
            </p>
          </div>

          <div className="mt-6 space-y-5">
            {feedback ? (
              <StatusCard
                eyebrow="Nao foi possivel redefinir"
                message={feedback}
                tone="error"
              />
            ) : null}

            <form className="space-y-5" noValidate onSubmit={handleSubmit}>
              <div className="space-y-2">
                <label className="field-label" htmlFor="reset-password-new">
                  Nova senha
                </label>
                <input
                  autoComplete="new-password"
                  className={[
                    "input-shell w-full rounded-[18px] px-4 py-3.5 font-sans text-sm text-soil",
                    "placeholder:text-bark/42",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2 focus-visible:ring-offset-cream",
                  ].join(" ")}
                  disabled={loading}
                  id="reset-password-new"
                  name="new-password"
                  onInput={handlePasswordInput}
                  placeholder="Digite sua nova senha"
                  required
                  type="password"
                  value={password}
                />
              </div>

              <PasswordCriteriaList password={password} />

              <div className="space-y-2">
                <label className="field-label" htmlFor="reset-password-confirm">
                  Confirmar nova senha
                </label>
                <input
                  aria-invalid={showConfirmationError}
                  autoComplete="new-password"
                  className={[
                    "input-shell w-full rounded-[18px] px-4 py-3.5 font-sans text-sm text-soil",
                    showConfirmationError ? "border-red-300 bg-red-50/60" : "",
                    "placeholder:text-bark/42",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2 focus-visible:ring-offset-cream",
                  ].join(" ")}
                  disabled={loading}
                  id="reset-password-confirm"
                  name="confirm-password"
                  onInput={handleConfirmationInput}
                  placeholder="Repita sua nova senha"
                  required
                  type="password"
                  value={confirmation}
                />
              </div>

              <p
                className={`font-sans text-xs leading-5 ${
                  hasConfirmation
                    ? passwordsMatch
                      ? "text-emerald-700"
                      : "text-red-700"
                    : "text-bark/66"
                }`}
              >
                {confirmationMessage}
              </p>

              <p
                className={`font-sans text-xs leading-5 ${
                  password.length > 0 && !isPasswordStrong
                    ? "text-red-700"
                    : "text-bark/66"
                }`}
              >
                {PASSWORD_POLICY_MESSAGE}
              </p>

              <Button
                className="h-13 w-full rounded-[18px] text-sm shadow-[0_20px_42px_-24px_rgba(13,51,33,0.46)] disabled:border-soil/8 disabled:bg-soil/8 disabled:text-bark/48 disabled:shadow-none"
                data-loading={loading}
                disabled={!canSubmit}
                size="lg"
                type="submit"
                variant="primary"
              >
                {loading ? "Salvando..." : "Redefinir senha"}
              </Button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
