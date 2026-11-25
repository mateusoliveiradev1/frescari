"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import { authClient } from "@/lib/auth-client";
import { getPostAuthRedirectPath } from "@/lib/post-auth-redirect";

// Second step of sign-in for accounts with two-factor authentication:
// the 6-digit code from the authenticator app, or a backup code.
export default function TwoFactorChallengePage() {
  const [code, setCode] = useState("");
  const [useBackup, setUseBackup] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const finishSignIn = async () => {
    const session = await authClient.getSession();
    const user = session.data?.user as
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
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    const trimmed = code.trim();
    const result = useBackup
      ? await authClient.twoFactor.verifyBackupCode({ code: trimmed })
      : await authClient.twoFactor.verifyTotp({
          code: trimmed.replace(/\s/g, ""),
        });

    if (result.error) {
      setLoading(false);
      setError(
        useBackup
          ? "Codigo de backup invalido ou ja usado."
          : "Codigo invalido ou expirado. Confira o app e tente de novo.",
      );
      return;
    }

    await finishSignIn();
  };

  return (
    <main className="flex min-h-[80vh] items-center justify-center bg-cream px-6 py-16">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-5 rounded-[28px] border border-soil/10 bg-white p-8 shadow-sm"
      >
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-forest">
            Verificacao em duas etapas
          </p>
          <h1 className="font-display text-3xl font-black text-soil">
            {useBackup ? "Codigo de backup" : "Codigo do app"}
          </h1>
          <p className="text-sm text-bark">
            {useBackup
              ? "Digite um dos codigos de backup que voce guardou quando ativou a verificacao."
              : "Abra o app autenticador (Google Authenticator, Microsoft Authenticator...) e digite o codigo de 6 digitos da Frescari."}
          </p>
        </div>

        <input
          value={code}
          onChange={(event) => setCode(event.target.value)}
          inputMode={useBackup ? "text" : "numeric"}
          autoComplete="one-time-code"
          autoFocus
          maxLength={useBackup ? 32 : 8}
          placeholder={useBackup ? "xxxxx-xxxxx" : "000000"}
          aria-label={useBackup ? "Codigo de backup" : "Codigo de 6 digitos"}
          className="w-full rounded-sm border border-soil/15 bg-cream px-4 py-3 text-center font-mono text-2xl tracking-[0.3em] text-soil focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20"
        />

        {error ? (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={loading || code.trim().length < 6}
          className="w-full rounded-sm bg-forest px-4 py-3 text-sm font-bold uppercase tracking-wider text-cream hover:bg-forest/90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? "Verificando..." : "Entrar"}
        </button>

        <div className="flex items-center justify-between text-sm">
          <button
            type="button"
            onClick={() => {
              setUseBackup((value) => !value);
              setCode("");
              setError("");
            }}
            className="font-semibold text-forest hover:underline"
          >
            {useBackup ? "Usar o app" : "Perdi o celular"}
          </button>
          <Link href="/auth/login" className="text-bark hover:underline">
            Voltar ao login
          </Link>
        </div>
      </form>
    </main>
  );
}
