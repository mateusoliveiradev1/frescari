"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";

type Step =
  | { kind: "idle" }
  | { kind: "setup"; secret: string; uri: string; backupCodes: string[] };

// "otpauth://totp/Frescari:ana@x.com?secret=ABC...&issuer=Frescari" -> "ABC..."
function readSecret(totpUri: string) {
  try {
    return new URL(totpUri).searchParams.get("secret") ?? "";
  } catch {
    return "";
  }
}

// Groups of 4 are easier to type into an authenticator app.
function groupSecret(secret: string) {
  return secret.replace(/(.{4})/g, "$1 ").trim();
}

const inputClass =
  "w-full rounded-sm border border-soil/15 bg-cream px-3 py-2.5 text-sm text-soil focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20";
const primaryButton =
  "rounded-sm bg-forest px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-cream hover:bg-forest/90 disabled:cursor-not-allowed disabled:opacity-40";

export function TwoFactorSection({
  enabled,
  required,
}: {
  enabled: boolean;
  required: boolean;
}) {
  const [step, setStep] = useState<Step>({ kind: "idle" });
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const startSetup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    const result = await authClient.twoFactor.enable({
      password,
      issuer: "Frescari",
      method: "totp",
    });
    setLoading(false);
    setPassword("");
    const data = result.data;
    if (result.error || !data || !("totpURI" in data)) {
      toast.error("Senha incorreta ou nao foi possivel iniciar a ativacao.");
      return;
    }
    setStep({
      kind: "setup",
      uri: data.totpURI,
      secret: readSecret(data.totpURI),
      backupCodes: data.backupCodes,
    });
  };

  const confirmSetup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    const result = await authClient.twoFactor.verifyTotp({
      code: code.replace(/\s/g, ""),
    });
    setLoading(false);
    if (result.error) {
      toast.error("Codigo invalido. Confira o app e tente de novo.");
      return;
    }
    toast.success("Verificacao em duas etapas ativada.");
    window.location.reload();
  };

  const disable = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    const result = await authClient.twoFactor.disable({ password });
    setLoading(false);
    setPassword("");
    if (result.error) {
      toast.error("Senha incorreta.");
      return;
    }
    toast.success("Verificacao em duas etapas desativada.");
    window.location.reload();
  };

  return (
    <section
      id="duas-etapas"
      className="space-y-5 rounded-sm border border-soil/10 bg-white p-6"
    >
      <div className="space-y-1">
        <h2 className="font-display text-2xl font-bold text-soil">
          Verificacao em duas etapas
        </h2>
        <p className="text-sm text-bark">
          Alem da senha, o login pede um codigo de 6 digitos do app autenticador
          no seu celular. Mesmo que alguem descubra sua senha, nao entra sem o
          celular.
        </p>
        {required && !enabled ? (
          <p className="rounded-sm border border-amber-300/60 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
            Obrigatoria para administradores: ative para acessar o painel
            administrativo.
          </p>
        ) : null}
      </div>

      {enabled ? (
        <form onSubmit={disable} className="space-y-3">
          <p className="text-sm font-semibold text-forest">Ativada.</p>
          {required ? (
            <p className="text-xs text-bark/80">
              Se desativar, voce perde o acesso ao painel administrativo ate
              ativar de novo.
            </p>
          ) : null}
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Sua senha, para desativar"
            autoComplete="current-password"
            className={inputClass}
          />
          <button
            type="submit"
            disabled={loading || !password}
            className="rounded-sm border border-soil/20 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-soil hover:bg-soil/5 disabled:opacity-40"
          >
            Desativar
          </button>
        </form>
      ) : step.kind === "idle" ? (
        <form onSubmit={startSetup} className="space-y-3">
          <p className="text-sm text-bark">
            1. Instale um app autenticador no celular (Google Authenticator ou
            Microsoft Authenticator, gratuitos). 2. Confirme sua senha abaixo.
          </p>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Sua senha"
            autoComplete="current-password"
            className={inputClass}
          />
          <button
            type="submit"
            disabled={loading || !password}
            className={primaryButton}
          >
            {loading ? "Aguarde..." : "Ativar"}
          </button>
        </form>
      ) : (
        <form onSubmit={confirmSetup} className="space-y-5">
          <div className="space-y-2">
            <p className="text-sm font-semibold text-soil">
              No app autenticador, adicione uma conta com esta chave
            </p>
            <p className="text-xs text-bark/80">
              No Google Authenticator: + &gt; Inserir chave de configuracao.
              Nome: Frescari. Tipo: baseada em tempo. No celular, voce tambem
              pode tocar em &quot;Abrir no app&quot;.
            </p>
            <code className="block select-all break-all rounded-sm bg-cream px-3 py-3 font-mono text-base tracking-wider text-soil">
              {groupSecret(step.secret)}
            </code>
            <a
              href={step.uri}
              className="inline-block text-sm font-semibold text-forest hover:underline"
            >
              Abrir no app
            </a>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-semibold text-soil">
              Guarde estes codigos de backup
            </p>
            <p className="text-xs text-bark/80">
              Cada um entra uma vez se voce perder o celular. Guarde num lugar
              seguro (gerenciador de senhas ou papel), fora deste computador.
            </p>
            <ul className="grid grid-cols-2 gap-2 rounded-sm bg-cream p-3 font-mono text-sm text-soil">
              {step.backupCodes.map((backupCode) => (
                <li key={backupCode}>{backupCode}</li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard
                  .writeText(step.backupCodes.join("\n"))
                  .then(() => toast.success("Codigos copiados."));
              }}
              className="text-sm font-semibold text-forest hover:underline"
            >
              Copiar codigos
            </button>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="totp-confirm"
              className="text-sm font-semibold text-soil"
            >
              Digite o codigo de 6 digitos que o app mostra
            </label>
            <input
              id="totp-confirm"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={8}
              placeholder="000000"
              className={`${inputClass} text-center font-mono text-xl tracking-[0.3em]`}
            />
          </div>
          <button
            type="submit"
            disabled={loading || code.replace(/\s/g, "").length < 6}
            className={primaryButton}
          >
            {loading ? "Verificando..." : "Confirmar e ativar"}
          </button>
        </form>
      )}
    </section>
  );
}
