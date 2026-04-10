"use client";

import { useState, type FormEvent as ReactFormEvent } from "react";

import {
  PasswordRequirements,
  type PasswordRequirementItem,
} from "@/components/auth/password-requirements";
import { authClient } from "@/lib/auth-client";
import {
  PASSWORD_MIN_LENGTH,
  PASSWORD_POLICY_MESSAGE,
  getPasswordCriteria,
  isStrongPassword,
} from "@/lib/password-policy";
import { Button } from "@frescari/ui";

type ChangePasswordContext = {
  error: {
    code?: string | null;
  };
};

type ChangePasswordCallbacks = {
  onSuccess?: () => void;
  onError?: (context: ChangePasswordContext) => void;
};

type ChangePasswordFn = (
  payload: {
    currentPassword: string;
    newPassword: string;
    revokeOtherSessions: boolean;
  },
  callbacks?: ChangePasswordCallbacks,
) => Promise<unknown>;

type ChangePasswordFormProps = {
  changePassword?: ChangePasswordFn;
};

const GENERIC_ERROR_MESSAGE =
  "Nao foi possivel atualizar a senha agora. Tente novamente em instantes.";
const INVALID_CURRENT_PASSWORD_MESSAGE = "Senha atual incorreta.";
const RATE_LIMIT_MESSAGE =
  "Muitas tentativas consecutivas. Aguarde um momento antes de tentar novamente.";
const SESSION_FRESHNESS_MESSAGE =
  "Sua sessao precisa ser revalidada antes de trocar a senha.";
const SUCCESS_MESSAGE = "Senha atualizada com sucesso.";

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

function getChangePasswordErrorMessage(code?: string | null) {
  if (code === "INVALID_PASSWORD" || code === "INVALID_CURRENT_PASSWORD") {
    return INVALID_CURRENT_PASSWORD_MESSAGE;
  }

  if (code === "SESSION_NOT_FRESH" || code === "FRESH_SESSION_REQUIRED") {
    return SESSION_FRESHNESS_MESSAGE;
  }

  if (code === "RATE_LIMITED" || code === "TOO_MANY_REQUESTS") {
    return RATE_LIMIT_MESSAGE;
  }

  return GENERIC_ERROR_MESSAGE;
}

export function ChangePasswordForm({
  changePassword = authClient.changePassword as ChangePasswordFn,
}: ChangePasswordFormProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const passwordCriteria = getPasswordCriteria(newPassword);
  const hasCurrentPassword = currentPassword.length > 0;
  const hasNewPassword = newPassword.length > 0;
  const hasConfirmation = confirmation.length > 0;
  const passwordsMatch = hasConfirmation && newPassword === confirmation;
  const showConfirmationError = hasConfirmation && !passwordsMatch;
  const isPasswordStrong =
    passwordCriteria.hasMinLength &&
    passwordCriteria.hasUppercase &&
    passwordCriteria.hasLowercase &&
    passwordCriteria.hasNumber;
  const canSubmit =
    !loading &&
    hasCurrentPassword &&
    isPasswordStrong &&
    hasConfirmation &&
    passwordsMatch;

  const passwordRequirementItems: PasswordRequirementItem[] = [
    {
      key: "min-length",
      met: passwordCriteria.hasMinLength,
      text: `Minimo de ${PASSWORD_MIN_LENGTH} caracteres`,
    },
    {
      key: "uppercase",
      met: passwordCriteria.hasUppercase,
      text: "Letra maiuscula",
    },
    {
      key: "lowercase",
      met: passwordCriteria.hasLowercase,
      text: "Letra minuscula",
    },
    {
      key: "number",
      met: passwordCriteria.hasNumber,
      text: "Numero",
    },
    {
      key: "match",
      met: passwordsMatch,
      text: "Senhas iguais",
    },
  ];

  const confirmationMessage = !hasConfirmation
    ? "Repita a nova senha exatamente como foi digitada acima."
    : passwordsMatch
      ? "As senhas coincidem."
      : "As senhas precisam ser iguais.";

  const resetMessages = () => {
    if (feedback) {
      setFeedback("");
    }

    if (success) {
      setSuccess(false);
    }
  };

  const handleCurrentPasswordInput = (
    event: ReactFormEvent<HTMLInputElement>,
  ) => {
    setCurrentPassword(event.currentTarget.value);
    resetMessages();
  };

  const handleNewPasswordInput = (event: ReactFormEvent<HTMLInputElement>) => {
    setNewPassword(event.currentTarget.value);
    resetMessages();
  };

  const handleConfirmationInput = (event: ReactFormEvent<HTMLInputElement>) => {
    setConfirmation(event.currentTarget.value);
    resetMessages();
  };

  const handleSubmit = async (event: ReactFormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback("");
    setSuccess(false);

    const formData = new FormData(event.currentTarget);
    const nextCurrentPassword = String(formData.get("current-password") ?? "");
    const nextPassword = String(formData.get("new-password") ?? "");
    const nextConfirmation = String(formData.get("confirm-password") ?? "");

    if (nextCurrentPassword.length === 0) {
      setFeedback("Informe sua senha atual.");
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

      await changePassword(
        {
          currentPassword: nextCurrentPassword,
          newPassword: nextPassword,
          revokeOtherSessions: true,
        },
        {
          onSuccess: () => {
            setSuccess(true);
            setCurrentPassword("");
            setNewPassword("");
            setConfirmation("");
          },
          onError: (context) => {
            didError = true;
            setFeedback(getChangePasswordErrorMessage(context.error.code));
          },
        },
      );

      if (!didError) {
        setSuccess(true);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmation("");
      }
    } catch {
      setFeedback(GENERIC_ERROR_MESSAGE);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="font-sans text-[11px] font-bold uppercase tracking-[0.22em] text-bark/70">
          Seguranca
        </p>
        <h2 className="font-display text-3xl font-black text-soil">
          Troque a senha com a sessao atual.
        </h2>
        <p className="max-w-2xl font-sans text-sm leading-6 text-bark/80">
          A troca exige sua senha atual e encerra as outras sessoes para manter
          a conta protegida.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <section className="rounded-[22px] border border-soil/8 bg-cream p-6 shadow-card">
          <div className="space-y-5">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-sage text-forest shadow-sm">
              <span className="font-display text-2xl font-black">01</span>
            </div>

            <div className="space-y-2">
              <p className="font-display text-2xl font-black text-soil">
                O que muda ao salvar
              </p>
              <p className="font-sans text-sm leading-6 text-bark/80">
                A senha da conta passa a valer imediatamente e outras sessoes
                abertas sao revogadas.
              </p>
            </div>

            <div className="rounded-[20px] border border-soil/10 bg-white/80 p-4">
              <p className="font-sans text-[10px] font-bold uppercase tracking-[0.18em] text-bark/65">
                Checklist
              </p>
              <ul className="mt-3 space-y-2 font-sans text-sm leading-6 text-bark/80">
                <li>Confirmar senha atual</li>
                <li>Criar uma senha forte</li>
                <li>Revogar outras sessoes ativas</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="rounded-[22px] border border-soil/8 bg-cream p-6 shadow-card">
          <div className="space-y-2">
            <p className="font-sans text-[10px] font-bold uppercase tracking-[0.18em] text-bark/65">
              Atualizacao autenticada
            </p>
            <h3 className="font-display text-2xl font-black text-soil">
              Nova senha da conta
            </h3>
            <p className="font-sans text-sm leading-6 text-bark/80">
              Use uma combinacao forte e diferente da senha anterior.
            </p>
          </div>

          <div className="mt-6 space-y-5">
            {feedback ? (
              <StatusCard
                eyebrow="Nao foi possivel atualizar"
                message={feedback}
                tone="error"
              />
            ) : null}

            {success ? (
              <StatusCard
                eyebrow="Senha atualizada"
                message={SUCCESS_MESSAGE}
                tone="success"
              />
            ) : null}

            <form className="space-y-5" noValidate onSubmit={handleSubmit}>
              <div className="space-y-2">
                <label
                  className="field-label"
                  htmlFor="change-password-current"
                >
                  Senha atual
                </label>
                <input
                  autoComplete="current-password"
                  className="input-shell w-full rounded-[18px] px-4 py-3.5 font-sans text-sm text-soil placeholder:text-bark/42 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
                  disabled={loading}
                  id="change-password-current"
                  name="current-password"
                  onInput={handleCurrentPasswordInput}
                  placeholder="Digite sua senha atual"
                  required
                  type="password"
                  value={currentPassword}
                />
              </div>

              <div className="space-y-2">
                <label className="field-label" htmlFor="change-password-new">
                  Nova senha
                </label>
                <input
                  aria-invalid={hasNewPassword && !isPasswordStrong}
                  autoComplete="new-password"
                  className="input-shell w-full rounded-[18px] px-4 py-3.5 font-sans text-sm text-soil placeholder:text-bark/42 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
                  disabled={loading}
                  id="change-password-new"
                  name="new-password"
                  onInput={handleNewPasswordInput}
                  placeholder="Digite sua nova senha"
                  required
                  type="password"
                  value={newPassword}
                />
              </div>

              <PasswordRequirements items={passwordRequirementItems} />

              <div className="space-y-2">
                <label
                  className="field-label"
                  htmlFor="change-password-confirm"
                >
                  Confirmar nova senha
                </label>
                <input
                  aria-invalid={showConfirmationError}
                  autoComplete="new-password"
                  className={[
                    "input-shell w-full rounded-[18px] px-4 py-3.5 font-sans text-sm text-soil placeholder:text-bark/42 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2 focus-visible:ring-offset-cream",
                    showConfirmationError ? "border-red-300 bg-red-50/60" : "",
                  ].join(" ")}
                  disabled={loading}
                  id="change-password-confirm"
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

              <div className="rounded-[18px] border border-soil/10 bg-white/75 px-4 py-3">
                <p className="font-sans text-xs leading-5 text-bark/70">
                  Ao confirmar, outras sessoes abertas serao encerradas para
                  manter a conta protegida.
                </p>
              </div>

              <Button
                className="h-13 w-full rounded-[18px] text-sm shadow-[0_20px_42px_-24px_rgba(13,51,33,0.46)] disabled:border-soil/8 disabled:bg-soil/8 disabled:text-bark/48 disabled:shadow-none"
                data-loading={loading}
                disabled={!canSubmit}
                isLoading={loading}
                size="lg"
                type="submit"
                variant="primary"
              >
                {loading ? "Atualizando..." : "Atualizar senha"}
              </Button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}

export default ChangePasswordForm;
