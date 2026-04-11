"use client";

import * as React from "react";
import type { inferRouterOutputs } from "@trpc/server";
import {
  AlertCircle,
  Building2,
  Factory,
  FileText,
  PhoneCall,
  RefreshCw,
  Save,
  ShieldAlert,
  UserSquare2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import type { AppRouter } from "@frescari/api";
import { Button, Skeleton, SkeletonText } from "@frescari/ui";

import { trpc } from "@/trpc/react";

export type RegistrationFormOverview =
  inferRouterOutputs<AppRouter>["account"]["getOverview"];

export type RegistrationFormUser = {
  email: string | null;
  id: string;
  image: string | null;
  name: string | null;
  role: string | null;
  tenantId: string | null;
};

export type RegistrationFormTenant = {
  id: string;
  name: string;
  producerContactName: string | null;
  producerDocumentId: string | null;
  producerLegalEntityType: "PF" | "PJ" | null;
  producerLegalName: string | null;
  producerPhone: string | null;
  type: "BUYER" | "PRODUCER" | null;
};

export type RegistrationFormFlags = {
  canAccessAddresses: boolean;
  canManageRegistration: boolean;
  hasTenant: boolean;
  isAdmin: boolean;
  isBuyer: boolean;
  isProducer: boolean;
};

type BuyerRegistrationInput = {
  companyName: string;
  type: "buyer";
};

type ProducerRegistrationInput = {
  contactName: string;
  documentId: string;
  legalEntityType: "PF" | "PJ";
  legalName: string;
  phone: string;
  publicName: string;
  type: "producer";
};

type RegistrationFormInput = BuyerRegistrationInput | ProducerRegistrationInput;

type ProducerFormState = {
  contactName: string;
  documentId: string;
  legalEntityType: "PF" | "PJ";
  legalName: string;
  phone: string;
  publicName: string;
};

type RegistrationFormViewProps = {
  flags: RegistrationFormFlags | null;
  isLoading: boolean;
  loadError: string | null;
  onRetry?: () => Promise<unknown> | unknown;
  onSave?: (input: RegistrationFormInput) => Promise<unknown> | unknown;
  tenant: RegistrationFormTenant | null;
  user: RegistrationFormUser | null;
};

type RegistrationFormProps = {
  initialOverview?: RegistrationFormOverview;
};

const inputClassName =
  "w-full rounded-sm border border-soil/15 bg-cream px-4 py-3 font-sans text-sm text-soil outline-none transition focus:border-forest focus:ring-2 focus:ring-forest/15 placeholder:text-bark/35";
const labelClassName =
  "font-sans text-[10px] font-bold uppercase tracking-[0.14em] text-bark";

function normalizeWhitespace(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeDigits(value: string) {
  return value.replace(/\D/g, "");
}

function normalizeBrazilPhone(value: string) {
  const digits = normalizeDigits(value);

  if (
    (digits.length === 12 || digits.length === 13) &&
    digits.startsWith("55")
  ) {
    return digits.slice(2);
  }

  return digits;
}

function getSafeMessage(error: unknown) {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "Nao foi possivel atualizar o cadastro da conta.";
}

function logRegistrationUpdateError(error: unknown) {
  console.error("[account.registration.update]", error);
}

function buildProducerFormState(
  tenant: RegistrationFormTenant | null,
): ProducerFormState {
  return {
    contactName: tenant?.producerContactName ?? "",
    documentId: tenant?.producerDocumentId ?? "",
    legalEntityType: tenant?.producerLegalEntityType ?? "PF",
    legalName: tenant?.producerLegalName ?? "",
    phone: tenant?.producerPhone ?? "",
    publicName: tenant?.name ?? "",
  };
}

function buildProducerRegistrationInput(
  form: ProducerFormState,
): ProducerRegistrationInput {
  return {
    contactName: normalizeWhitespace(form.contactName),
    documentId: normalizeDigits(form.documentId),
    legalEntityType: form.legalEntityType,
    legalName: normalizeWhitespace(form.legalName),
    phone: normalizeBrazilPhone(form.phone),
    publicName: normalizeWhitespace(form.publicName),
    type: "producer",
  };
}

function producerInputsEqual(
  left: ProducerRegistrationInput,
  right: ProducerRegistrationInput,
) {
  return (
    left.contactName === right.contactName &&
    left.documentId === right.documentId &&
    left.legalEntityType === right.legalEntityType &&
    left.legalName === right.legalName &&
    left.phone === right.phone &&
    left.publicName === right.publicName
  );
}

function RegistrationLoadingState() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="font-sans text-[11px] font-bold uppercase tracking-[0.22em] text-bark/70">
          Conta
        </p>
        <h2 className="font-display text-3xl font-black text-soil">
          Preparando seus dados.
        </h2>
        <p className="font-sans text-sm text-bark">
          Carregando as informacoes principais do seu acesso.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <section className="rounded-[22px] border border-soil/8 bg-cream p-6 shadow-card">
          <Skeleton className="h-14 w-14 rounded-full" />
          <div className="mt-5">
            <Skeleton className="h-6 w-40" />
            <div className="mt-3">
              <SkeletonText lines={3} />
            </div>
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

function RegistrationErrorState({
  loadError,
  onRetry,
}: Pick<RegistrationFormViewProps, "loadError" | "onRetry">) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="font-sans text-[11px] font-bold uppercase tracking-[0.22em] text-bark/70">
          Conta
        </p>
        <h2 className="font-display text-3xl font-black text-soil">
          Nao conseguimos carregar esses dados.
        </h2>
        <p className="font-sans text-sm text-bark">
          Tente novamente em alguns instantes.
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
                Falha ao carregar os dados
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

function RegistrationBlockedState() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="font-sans text-[11px] font-bold uppercase tracking-[0.22em] text-bark/70">
          Conta
        </p>
        <h2 className="font-display text-3xl font-black text-soil">
          Dados da conta indisponiveis para este acesso.
        </h2>
        <p className="max-w-2xl font-sans text-sm leading-6 text-bark/80">
          Voce ainda pode revisar seus dados pessoais e sua seguranca nas outras
          abas da sua area Frescari.
        </p>
      </div>

      <section className="rounded-[22px] border border-soil/10 bg-cream p-6 shadow-card">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-sage/45 text-forest">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div className="space-y-2">
            <p className="font-display text-2xl font-black text-soil">
              Sem edicao por aqui
            </p>
            <p className="font-sans text-sm leading-6 text-bark/80">
              Quando esse acesso estiver liberado, os dados comerciais vao
              aparecer nesta mesma tela.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function RegistrationMissingTenantState() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="font-sans text-[11px] font-bold uppercase tracking-[0.22em] text-bark/70">
          Conta
        </p>
        <h2 className="font-display text-3xl font-black text-soil">
          Ainda nao encontramos os dados da conta.
        </h2>
        <p className="max-w-2xl font-sans text-sm leading-6 text-bark/80">
          Assim que a configuracao inicial for concluida, os campos comerciais
          aparecem automaticamente aqui.
        </p>
      </div>
    </div>
  );
}

function BuyerRegistrationPanel({
  buyerCanSubmit,
  buyerCompanyName,
  isSaving,
  onBuyerNameChange,
  onRetry,
  onSubmit,
  submitError,
  successMessage,
}: {
  buyerCanSubmit: boolean;
  buyerCompanyName: string;
  isSaving: boolean;
  onBuyerNameChange: (
    event:
      | React.ChangeEvent<HTMLInputElement>
      | React.FormEvent<HTMLInputElement>,
  ) => void;
  onRetry?: () => Promise<unknown> | unknown;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => Promise<void> | void;
  submitError: string | null;
  successMessage: string | null;
}) {
  return (
    <form className="mt-6 space-y-4" onSubmit={onSubmit}>
      <div className="space-y-1.5">
        <label className={labelClassName} htmlFor="registration-company-name">
          Nome da empresa
        </label>
        <div className="relative">
          <Building2 className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-bark/45" />
          <input
            className={`${inputClassName} pl-11`}
            id="registration-company-name"
            onChange={onBuyerNameChange}
            onInput={onBuyerNameChange}
            placeholder="Ex: Mercado Central"
            value={buyerCompanyName}
          />
        </div>
        <p className="font-sans text-xs leading-5 text-bark/68">
          Use o nome que identifica sua compra na Frescari.
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
        <Button type="submit" disabled={!buyerCanSubmit} isLoading={isSaving}>
          <Save className="h-4 w-4" />
          Salvar cadastro
        </Button>

        {onRetry ? (
          <Button type="button" variant="ghost" onClick={() => void onRetry()}>
            <RefreshCw className="h-4 w-4" />
            Recarregar dados
          </Button>
        ) : null}
      </div>
    </form>
  );
}

function ProducerRegistrationPanel({
  isSaving,
  onFieldChange,
  onRetry,
  onSubmit,
  producerCanSubmit,
  producerDocumentLabel,
  producerDocumentPlaceholder,
  producerForm,
  submitError,
  successMessage,
}: {
  isSaving: boolean;
  onFieldChange: (
    field: keyof ProducerFormState,
    value: string | ProducerFormState["legalEntityType"],
  ) => void;
  onRetry?: () => Promise<unknown> | unknown;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => Promise<void> | void;
  producerCanSubmit: boolean;
  producerDocumentLabel: string;
  producerDocumentPlaceholder: string;
  producerForm: ProducerFormState;
  submitError: string | null;
  successMessage: string | null;
}) {
  return (
    <form className="mt-6 space-y-5" onSubmit={onSubmit}>
      <div className="space-y-2 rounded-[18px] border border-forest/12 bg-sage/20 p-4">
        <p className="font-sans text-[10px] font-bold uppercase tracking-[0.18em] text-bark/65">
          Tipo de cadastro
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {(["PF", "PJ"] as const).map((option) => (
            <button
              aria-pressed={producerForm.legalEntityType === option}
              className={`rounded-sm border px-4 py-3 text-left font-sans text-sm font-bold transition-colors ${
                producerForm.legalEntityType === option
                  ? "border-forest bg-forest text-white"
                  : "border-soil/10 bg-white text-soil hover:border-forest/30"
              }`}
              key={option}
              onClick={() => onFieldChange("legalEntityType", option)}
              type="button"
            >
              {option === "PF" ? "Pessoa fisica" : "Pessoa juridica"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className={labelClassName} htmlFor="registration-public-name">
            Nome publico
          </label>
          <div className="relative">
            <Factory className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-bark/45" />
            <input
              className={`${inputClassName} pl-11`}
              id="registration-public-name"
              onChange={(event) =>
                onFieldChange("publicName", event.currentTarget.value)
              }
              onInput={(event) =>
                onFieldChange("publicName", event.currentTarget.value)
              }
              placeholder="Ex: Fazenda Sao Joao"
              value={producerForm.publicName}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className={labelClassName} htmlFor="registration-legal-name">
            Nome legal
          </label>
          <div className="relative">
            <FileText className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-bark/45" />
            <input
              className={`${inputClassName} pl-11`}
              id="registration-legal-name"
              onChange={(event) =>
                onFieldChange("legalName", event.currentTarget.value)
              }
              onInput={(event) =>
                onFieldChange("legalName", event.currentTarget.value)
              }
              placeholder={
                producerForm.legalEntityType === "PJ"
                  ? "Ex: Sao Joao Hortifruti Ltda"
                  : "Ex: Maria Aparecida Silva"
              }
              value={producerForm.legalName}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className={labelClassName} htmlFor="registration-document-id">
            {producerDocumentLabel}
          </label>
          <div className="relative">
            <FileText className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-bark/45" />
            <input
              className={`${inputClassName} pl-11`}
              id="registration-document-id"
              inputMode="numeric"
              onChange={(event) =>
                onFieldChange("documentId", event.currentTarget.value)
              }
              onInput={(event) =>
                onFieldChange("documentId", event.currentTarget.value)
              }
              placeholder={producerDocumentPlaceholder}
              value={producerForm.documentId}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className={labelClassName} htmlFor="registration-contact-name">
            Responsavel principal
          </label>
          <div className="relative">
            <UserSquare2 className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-bark/45" />
            <input
              className={`${inputClassName} pl-11`}
              id="registration-contact-name"
              onChange={(event) =>
                onFieldChange("contactName", event.currentTarget.value)
              }
              onInput={(event) =>
                onFieldChange("contactName", event.currentTarget.value)
              }
              placeholder="Ex: Joao Pedro"
              value={producerForm.contactName}
            />
          </div>
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <label className={labelClassName} htmlFor="registration-phone">
            Telefone comercial
          </label>
          <div className="relative">
            <PhoneCall className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-bark/45" />
            <input
              className={`${inputClassName} pl-11`}
              id="registration-phone"
              inputMode="tel"
              onChange={(event) =>
                onFieldChange("phone", event.currentTarget.value)
              }
              onInput={(event) =>
                onFieldChange("phone", event.currentTarget.value)
              }
              placeholder="Ex: (11) 99876-5432"
              value={producerForm.phone}
            />
          </div>
        </div>
      </div>

      <div className="rounded-[18px] border border-soil/10 bg-white/75 px-4 py-3">
        <p className="font-sans text-xs leading-5 text-bark/70">
          Documento e telefone sao conferidos antes de salvar para manter os
          dados consistentes.
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
        <Button
          type="submit"
          disabled={!producerCanSubmit}
          isLoading={isSaving}
        >
          <Save className="h-4 w-4" />
          Salvar cadastro
        </Button>

        {onRetry ? (
          <Button type="button" variant="ghost" onClick={() => void onRetry()}>
            <RefreshCw className="h-4 w-4" />
            Recarregar dados
          </Button>
        ) : null}
      </div>
    </form>
  );
}

export function RegistrationFormView({
  flags,
  isLoading,
  loadError,
  onRetry,
  onSave,
  tenant,
}: RegistrationFormViewProps) {
  const [buyerCompanyName, setBuyerCompanyName] = React.useState(
    tenant?.name ?? "",
  );
  const [buyerBaselineName, setBuyerBaselineName] = React.useState(
    tenant?.name ?? "",
  );
  const [producerForm, setProducerForm] = React.useState<ProducerFormState>(
    buildProducerFormState(tenant),
  );
  const [producerBaseline, setProducerBaseline] =
    React.useState<ProducerRegistrationInput>(
      buildProducerRegistrationInput(buildProducerFormState(tenant)),
    );
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(
    null,
  );
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    const nextBuyerName = tenant?.name ?? "";
    const nextProducerForm = buildProducerFormState(tenant);

    setBuyerCompanyName(nextBuyerName);
    setBuyerBaselineName(nextBuyerName);
    setProducerForm(nextProducerForm);
    setProducerBaseline(buildProducerRegistrationInput(nextProducerForm));
    setSubmitError(null);
    setSuccessMessage(null);
  }, [tenant]);

  if (isLoading) {
    return <RegistrationLoadingState />;
  }

  if (loadError) {
    return <RegistrationErrorState loadError={loadError} onRetry={onRetry} />;
  }

  if (!flags?.canManageRegistration) {
    return <RegistrationBlockedState />;
  }

  if (!tenant || !flags.hasTenant) {
    return <RegistrationMissingTenantState />;
  }

  const registrationLabel = flags.isProducer ? "Negocio" : "Empresa";
  const trimmedBuyerCompanyName = normalizeWhitespace(buyerCompanyName);
  const trimmedBuyerBaselineName = normalizeWhitespace(buyerBaselineName);
  const buyerHasValidName = trimmedBuyerCompanyName.length >= 2;
  const buyerHasChanges = trimmedBuyerCompanyName !== trimmedBuyerBaselineName;
  const buyerCanSubmit =
    flags.isBuyer && buyerHasValidName && buyerHasChanges && !isSaving;

  const normalizedProducerInput = buildProducerRegistrationInput(producerForm);
  const producerHasRequiredFields =
    normalizedProducerInput.publicName.length >= 2 &&
    normalizedProducerInput.legalName.length >= 2 &&
    normalizedProducerInput.contactName.length >= 2 &&
    normalizedProducerInput.documentId.length > 0 &&
    normalizedProducerInput.phone.length > 0;
  const producerHasChanges = !producerInputsEqual(
    normalizedProducerInput,
    producerBaseline,
  );
  const producerCanSubmit =
    flags.isProducer &&
    producerHasRequiredFields &&
    producerHasChanges &&
    !isSaving;
  const producerDocumentLabel =
    producerForm.legalEntityType === "PJ" ? "CNPJ" : "CPF";
  const producerDocumentPlaceholder =
    producerForm.legalEntityType === "PJ"
      ? "Ex: 12.345.678/0001-90"
      : "Ex: 123.456.789-09";

  const handleBuyerNameChange = (
    event:
      | React.ChangeEvent<HTMLInputElement>
      | React.FormEvent<HTMLInputElement>,
  ) => {
    setBuyerCompanyName(event.currentTarget.value);
    setSubmitError(null);
    setSuccessMessage(null);
  };

  const handleProducerFieldChange = (
    field: keyof ProducerFormState,
    value: string | ProducerFormState["legalEntityType"],
  ) => {
    setProducerForm((current) => ({
      ...current,
      [field]: value,
    }));
    setSubmitError(null);
    setSuccessMessage(null);
  };

  const handleBuyerSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!buyerCanSubmit) {
      return;
    }

    setIsSaving(true);
    setSubmitError(null);
    setSuccessMessage(null);

    try {
      await onSave?.({
        companyName: trimmedBuyerCompanyName,
        type: "buyer",
      });
      setBuyerBaselineName(trimmedBuyerCompanyName);
      setSuccessMessage("Cadastro atualizado com sucesso.");
    } catch (error) {
      setSubmitError(getSafeMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  const handleProducerSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    if (!producerCanSubmit) {
      return;
    }

    setIsSaving(true);
    setSubmitError(null);
    setSuccessMessage(null);

    try {
      await onSave?.(normalizedProducerInput);
      setProducerBaseline(normalizedProducerInput);
      setSuccessMessage("Cadastro atualizado com sucesso.");
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
          {registrationLabel}
        </p>
        <h2 className="font-display text-3xl font-black text-soil">
          Dados do seu negocio.
        </h2>
        <p className="max-w-2xl font-sans text-sm leading-6 text-bark/80">
          Mantenha as informacoes comerciais atualizadas para pedidos, contato e
          documentos ficarem claros.
        </p>
      </div>

      <section className="rounded-[22px] border border-soil/8 bg-cream p-5 shadow-card sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-sage text-forest shadow-sm">
              {flags.isProducer ? (
                <Factory className="h-6 w-6" />
              ) : (
                <Building2 className="h-6 w-6" />
              )}
            </div>

            <div className="space-y-2">
              <p className="font-display text-2xl font-black text-soil">
                {tenant.name}
              </p>
              <p className="font-sans text-sm leading-6 text-bark/80">
                {flags.isProducer
                  ? "Atualize como seu negocio aparece para compradores e pedidos."
                  : "Mantenha o nome da empresa claro para compras e contatos."}
              </p>
            </div>
          </div>
          <p className="rounded-full border border-forest/12 bg-sage/35 px-4 py-2 font-sans text-xs font-bold text-forest">
            {flags.isProducer
              ? "Visivel para compradores"
              : "Usado nas suas compras"}
          </p>
        </div>

        {flags.isBuyer ? (
          <BuyerRegistrationPanel
            buyerCanSubmit={buyerCanSubmit}
            buyerCompanyName={buyerCompanyName}
            isSaving={isSaving}
            onBuyerNameChange={handleBuyerNameChange}
            onRetry={onRetry}
            onSubmit={handleBuyerSubmit}
            submitError={submitError}
            successMessage={successMessage}
          />
        ) : null}

        {flags.isProducer ? (
          <ProducerRegistrationPanel
            isSaving={isSaving}
            onFieldChange={handleProducerFieldChange}
            onRetry={onRetry}
            onSubmit={handleProducerSubmit}
            producerCanSubmit={producerCanSubmit}
            producerDocumentLabel={producerDocumentLabel}
            producerDocumentPlaceholder={producerDocumentPlaceholder}
            producerForm={producerForm}
            submitError={submitError}
            successMessage={successMessage}
          />
        ) : null}
      </section>
    </div>
  );
}

export default function RegistrationForm({
  initialOverview,
}: RegistrationFormProps) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const { data, error, isLoading, refetch } = trpc.account.getOverview.useQuery(
    undefined,
    {
      initialData: initialOverview,
      staleTime: 30_000,
    },
  );
  const updateRegistration = trpc.account.updateRegistration.useMutation();

  const handleSave = async (input: RegistrationFormInput) => {
    try {
      await updateRegistration.mutateAsync(input);
      await utils.account.getOverview.invalidate();
      toast.success("Cadastro atualizado com sucesso.");
      React.startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      logRegistrationUpdateError(error);
      const message = getSafeMessage(error);
      toast.error(message);
      throw new Error(message);
    }
  };

  return (
    <RegistrationFormView
      flags={data?.flags ?? null}
      isLoading={isLoading}
      loadError={error?.message ?? null}
      onRetry={async () => {
        await refetch();
      }}
      onSave={handleSave}
      tenant={data?.tenant ?? null}
      user={data?.user ?? null}
    />
  );
}
