"use client";

import * as React from "react";
import type { inferRouterOutputs } from "@trpc/server";
import { AlertCircle, Mail, RefreshCw, Save, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import type { AppRouter } from "@frescari/api";
import { Button, Skeleton, SkeletonText } from "@frescari/ui";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/trpc/react";

export type ProfileFormOverview =
  inferRouterOutputs<AppRouter>["account"]["getOverview"];

export type ProfileFormUser = {
  email: string | null;
  id: string;
  image: string | null;
  name: string | null;
  role: string | null;
  tenantId: string | null;
};

type ProfileFormViewProps = {
  isLoading: boolean;
  loadError: string | null;
  onRetry?: () => Promise<unknown> | unknown;
  onSave?: (input: { name: string }) => Promise<unknown> | unknown;
  user: ProfileFormUser | null;
};

type ProfileFormProps = {
  initialOverview?: ProfileFormOverview;
};

const inputClassName =
  "w-full rounded-sm border border-soil/15 bg-cream px-4 py-3 font-sans text-sm text-soil outline-none transition focus:border-forest focus:ring-2 focus:ring-forest/15 placeholder:text-bark/35";
const readOnlyInputClassName =
  "w-full rounded-sm border border-soil/10 bg-cream-dark/35 px-4 py-3 font-sans text-sm text-bark/75 outline-none";
const labelClassName =
  "font-sans text-[10px] font-bold uppercase tracking-[0.14em] text-bark";

function getSafeMessage(error: unknown) {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "Nao foi possivel atualizar seu perfil.";
}

function getProfileInitial(
  name: string | null | undefined,
  email: string | null,
) {
  const safeName = name?.trim();

  if (safeName && safeName.length > 0) {
    return safeName.slice(0, 1).toUpperCase();
  }

  const safeEmail = email?.trim();

  if (safeEmail && safeEmail.length > 0) {
    return safeEmail.slice(0, 1).toUpperCase();
  }

  return "U";
}

function logProfileUpdateError(error: unknown) {
  console.error("[account.profile.updateUser]", error);
}

function ProfileLoadingState() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="font-sans text-[11px] font-bold uppercase tracking-[0.22em] text-bark/70">
          Perfil
        </p>
        <h2 className="font-display text-3xl font-black text-soil">
          Preparando seu perfil.
        </h2>
        <p className="font-sans text-sm text-bark">
          Carregando os dados principais da sua conta.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <section className="rounded-[22px] border border-soil/8 bg-cream p-6 shadow-card">
          <div className="space-y-4">
            <Skeleton className="h-16 w-16 rounded-full" />
            <Skeleton className="h-6 w-40" />
            <SkeletonText lines={3} />
          </div>
        </section>

        <section className="rounded-[22px] border border-soil/8 bg-cream p-6 shadow-card">
          <SkeletonText lines={2} />
          <div className="mt-6 space-y-4">
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-48" />
          </div>
        </section>
      </div>
    </div>
  );
}

function ProfileErrorState({
  loadError,
  onRetry,
}: Pick<ProfileFormViewProps, "loadError" | "onRetry">) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="font-sans text-[11px] font-bold uppercase tracking-[0.22em] text-bark/70">
          Perfil
        </p>
        <h2 className="font-display text-3xl font-black text-soil">
          Nao conseguimos abrir seu perfil.
        </h2>
        <p className="font-sans text-sm text-bark">
          Nao foi possivel carregar o perfil agora.
        </p>
      </div>

      <section className="rounded-[22px] border border-destructive/20 bg-red-50/80 p-6 shadow-card">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertCircle className="h-5 w-5" />
          </div>
          <div className="space-y-3">
            <div className="space-y-1">
              <p className="font-display text-2xl font-black text-soil">
                Falha ao carregar os dados pessoais
              </p>
              <p className="font-sans text-sm leading-6 text-bark/80">
                {loadError || "Tente novamente em alguns instantes."}
              </p>
            </div>

            {onRetry ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => void onRetry()}
              >
                <RefreshCw className="h-4 w-4" />
                Tentar novamente
              </Button>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}

export function ProfileFormView({
  isLoading,
  loadError,
  onRetry,
  onSave,
  user,
}: ProfileFormViewProps) {
  const [name, setName] = React.useState(user?.name ?? "");
  const [baselineName, setBaselineName] = React.useState(user?.name ?? "");
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(
    null,
  );
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    const nextName = user?.name ?? "";

    setName(nextName);
    setBaselineName(nextName);
    setSubmitError(null);
    setSuccessMessage(null);
  }, [user?.id, user?.name]);

  if (isLoading) {
    return <ProfileLoadingState />;
  }

  if (loadError) {
    return <ProfileErrorState loadError={loadError} onRetry={onRetry} />;
  }

  if (!user) {
    return (
      <div className="space-y-3">
        <h2 className="font-display text-3xl font-black text-soil">Perfil</h2>
        <p className="font-sans text-sm text-bark">
          Os dados do perfil nao ficaram disponiveis para esta sessao.
        </p>
      </div>
    );
  }

  const trimmedName = name.trim();
  const trimmedBaselineName = baselineName.trim();
  const hasValidName = trimmedName.length > 0;
  const hasChanges = trimmedName !== trimmedBaselineName;
  const canSubmit = hasValidName && hasChanges && !isSaving;
  const helperMessage = !hasValidName
    ? "Informe o nome que deve aparecer na sua conta."
    : hasChanges
      ? "Voce esta atualizando como seu nome aparece na Frescari."
      : "Atualize o nome somente quando quiser refletir uma mudanca real.";

  const handleNameChange = (
    event:
      | React.ChangeEvent<HTMLInputElement>
      | React.FormEvent<HTMLInputElement>,
  ) => {
    const nextValue = event.currentTarget.value;

    setName(nextValue);
    setSubmitError(null);
    setSuccessMessage(null);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canSubmit) {
      return;
    }

    setIsSaving(true);
    setSubmitError(null);
    setSuccessMessage(null);

    try {
      await onSave?.({ name: trimmedName });
      setBaselineName(trimmedName);
      setSuccessMessage("Perfil atualizado com sucesso.");
    } catch (error) {
      setSubmitError(getSafeMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="font-sans text-[11px] font-bold uppercase tracking-[0.22em] text-bark/70">
          Perfil
        </p>
        <h2 className="font-display text-3xl font-black text-soil">
          Seu perfil na Frescari.
        </h2>
        <p className="max-w-2xl font-sans text-sm leading-6 text-bark/80">
          Mantenha seu nome de exibicao atualizado para que pedidos, mensagens e
          documentos aparecam com clareza.
        </p>
      </div>

      <section className="rounded-[22px] border border-soil/8 bg-cream p-5 shadow-card sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-sage text-forest shadow-sm">
              {user.image ? (
                // eslint-disable-next-line @next/next/no-img-element -- auth avatars may come from arbitrary providers.
                <img
                  alt={`Avatar de ${user.name ?? "usuario"}`}
                  className="h-full w-full object-cover"
                  src={user.image}
                />
              ) : (
                <span className="font-display text-2xl font-black">
                  {getProfileInitial(user.name, user.email)}
                </span>
              )}
            </div>

            <div className="space-y-2">
              <p className="font-display text-2xl font-black text-soil">
                {trimmedName || "Conta sem nome definido"}
              </p>
              <p className="font-sans text-sm leading-6 text-bark/80">
                Esse nome aparece nos pontos principais da sua conta.
              </p>
            </div>
          </div>
          <p className="rounded-full border border-forest/12 bg-sage/35 px-4 py-2 font-sans text-xs font-bold text-forest">
            Seu email fica visivel para conferencia e continua protegido.
          </p>
        </div>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <label className={labelClassName} htmlFor="profile-name">
              Nome
            </label>
            <div className="relative">
              <UserRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-bark/45" />
              <input
                aria-invalid={hasValidName ? "false" : "true"}
                className={`${inputClassName} pl-11`}
                id="profile-name"
                onChange={handleNameChange}
                onInput={handleNameChange}
                placeholder="Como seu nome deve aparecer"
                value={name}
              />
            </div>
            <p className="font-sans text-xs leading-5 text-bark/68">
              {helperMessage}
            </p>
          </div>

          <div className="space-y-1.5">
            <label className={labelClassName} htmlFor="profile-email">
              Email
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-bark/45" />
              <input
                className={`${readOnlyInputClassName} pl-11`}
                disabled
                id="profile-email"
                value={user.email ?? ""}
              />
            </div>
            <p className="font-sans text-xs leading-5 text-bark/68">
              Para alterar o email de acesso, fale com o suporte da Frescari.
            </p>
          </div>

          {submitError ? (
            <div
              aria-live="assertive"
              className="rounded-[18px] border border-destructive/20 bg-red-50 px-4 py-3"
              role="alert"
            >
              <p className="font-sans text-sm leading-6 text-destructive">
                {submitError}
              </p>
            </div>
          ) : null}

          {successMessage ? (
            <div
              aria-live="polite"
              className="rounded-[18px] border border-forest/15 bg-sage/25 px-4 py-3"
            >
              <p className="font-sans text-sm leading-6 text-forest">
                {successMessage}
              </p>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3 pt-2">
            <Button type="submit" disabled={!canSubmit} isLoading={isSaving}>
              <Save className="h-4 w-4" />
              Salvar perfil
            </Button>

            {onRetry ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => void onRetry()}
              >
                <RefreshCw className="h-4 w-4" />
                Recarregar dados
              </Button>
            ) : null}
          </div>
        </form>
      </section>
    </div>
  );
}

export default function ProfileForm({ initialOverview }: ProfileFormProps) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const { data, error, isLoading, refetch } = trpc.account.getOverview.useQuery(
    undefined,
    {
      initialData: initialOverview,
      staleTime: 30_000,
    },
  );

  const handleSave = React.useCallback(
    async ({ name }: { name: string }) => {
      const result = await authClient.updateUser({ name });

      if (result.error) {
        logProfileUpdateError(result.error);
        toast.error(
          result.error.message || "Nao foi possivel atualizar seu perfil.",
        );
        throw new Error(
          result.error.message || "Nao foi possivel atualizar seu perfil.",
        );
      }

      await utils.account.getOverview.invalidate();
      toast.success("Perfil atualizado com sucesso.");
      React.startTransition(() => {
        router.refresh();
      });
    },
    [router, utils.account.getOverview],
  );

  return (
    <ProfileFormView
      isLoading={isLoading}
      loadError={error?.message ?? null}
      onRetry={async () => {
        await refetch();
      }}
      onSave={handleSave}
      user={data?.user ?? null}
    />
  );
}
