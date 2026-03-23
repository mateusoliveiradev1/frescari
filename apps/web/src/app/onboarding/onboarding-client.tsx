"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ShoppingBag, Sprout } from "lucide-react";

import { Button } from "@frescari/ui";

import { trpc } from "@/trpc/react";

type TenantType = "PRODUCER" | "BUYER";
type ProducerLegalEntityType = "PF" | "PJ";

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

const inputClassName =
  "w-full px-4 py-3 rounded-md border border-soil/15 bg-white font-sans text-sm text-soil placeholder:text-bark/40 focus:outline-none focus:ring-2 focus:ring-forest/30 focus:border-forest transition-all";

export function OnboardingClient() {
  const router = useRouter();
  const [selectedType, setSelectedType] = useState<TenantType | null>(null);
  const [buyerCompanyName, setBuyerCompanyName] = useState("");
  const [producerForm, setProducerForm] = useState({
    contactName: "",
    documentId: "",
    legalEntityType: "PF" as ProducerLegalEntityType,
    legalName: "",
    phone: "",
    publicName: "",
  });

  const setupAccount = trpc.onboarding.setupAccount.useMutation({
    onSuccess: (data: { tenantId: string; type: string | null }) => {
      if (data.type === "BUYER") {
        router.push("/catalogo");
      } else {
        router.push("/dashboard");
      }
    },
  });

  const producerDocumentLabel =
    producerForm.legalEntityType === "PJ" ? "CNPJ" : "CPF";
  const producerDocumentPlaceholder =
    producerForm.legalEntityType === "PJ"
      ? "Ex: 12.345.678/0001-99"
      : "Ex: 123.456.789-09";
  const producerDocumentLength =
    producerForm.legalEntityType === "PJ" ? 14 : 11;
  const producerDocumentDigits = normalizeDigits(producerForm.documentId);
  const producerPhoneDigits = normalizeBrazilPhone(producerForm.phone);
  const isBuyerReady = buyerCompanyName.trim().length >= 2;
  const isProducerReady =
    producerForm.publicName.trim().length >= 2 &&
    producerForm.legalName.trim().length >= 2 &&
    producerForm.contactName.trim().length >= 2 &&
    producerDocumentDigits.length === producerDocumentLength &&
    (producerPhoneDigits.length === 10 || producerPhoneDigits.length === 11);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    if (selectedType === "BUYER") {
      if (!isBuyerReady) {
        return;
      }

      setupAccount.mutate({
        companyName: buyerCompanyName.trim(),
        type: "BUYER",
      });
      return;
    }

    if (selectedType !== "PRODUCER" || !isProducerReady) {
      return;
    }

    setupAccount.mutate({
      contactName: producerForm.contactName.trim(),
      documentId: producerDocumentDigits,
      legalEntityType: producerForm.legalEntityType,
      legalName: producerForm.legalName.trim(),
      phone: producerPhoneDigits,
      publicName: producerForm.publicName.trim(),
      type: "PRODUCER",
    });
  };

  function updateProducerField(
    field: keyof typeof producerForm,
    value: string,
  ) {
    setProducerForm((currentValue) => ({
      ...currentValue,
      [field]: value,
    }));
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-forest rounded-md mb-5">
            <span className="font-display text-white font-black text-2xl italic leading-none">
              F
            </span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-soil italic tracking-tight">
            Bem-vindo ao Frescari
          </h1>
          <p className="font-sans text-sm text-bark mt-2 max-w-md mx-auto">
            Para comecar, escolha seu perfil e preencha apenas o minimo
            necessario para liberar sua conta.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setSelectedType("PRODUCER")}
              className={`group relative flex flex-col items-center gap-3 p-6 rounded-lg border-2 transition-all duration-200 cursor-pointer ${
                selectedType === "PRODUCER"
                  ? "border-forest bg-forest/5 shadow-md"
                  : "border-soil/10 bg-white hover:border-forest/40 hover:shadow-sm"
              }`}
            >
              <div
                className={`w-12 h-12 rounded-md flex items-center justify-center transition-colors ${
                  selectedType === "PRODUCER"
                    ? "bg-forest"
                    : "bg-sage group-hover:bg-forest/20"
                }`}
              >
                <Sprout
                  className={`w-6 h-6 ${
                    selectedType === "PRODUCER" ? "text-white" : "text-forest"
                  }`}
                />
              </div>
              <div className="text-center">
                <p className="font-sans text-sm font-semibold text-soil">
                  Sou Produtor
                </p>
                <p className="font-sans text-[11px] text-bark mt-0.5">
                  Vendo hortifruti
                </p>
              </div>
              {selectedType === "PRODUCER" && (
                <div className="absolute top-2 right-2 w-5 h-5 bg-forest rounded-full flex items-center justify-center">
                  <svg
                    className="w-3 h-3 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
              )}
            </button>

            <button
              type="button"
              onClick={() => setSelectedType("BUYER")}
              className={`group relative flex flex-col items-center gap-3 p-6 rounded-lg border-2 transition-all duration-200 cursor-pointer ${
                selectedType === "BUYER"
                  ? "border-forest bg-forest/5 shadow-md"
                  : "border-soil/10 bg-white hover:border-forest/40 hover:shadow-sm"
              }`}
            >
              <div
                className={`w-12 h-12 rounded-md flex items-center justify-center transition-colors ${
                  selectedType === "BUYER"
                    ? "bg-forest"
                    : "bg-sage group-hover:bg-forest/20"
                }`}
              >
                <ShoppingBag
                  className={`w-6 h-6 ${
                    selectedType === "BUYER" ? "text-white" : "text-forest"
                  }`}
                />
              </div>
              <div className="text-center">
                <p className="font-sans text-sm font-semibold text-soil">
                  Sou Comprador
                </p>
                <p className="font-sans text-[11px] text-bark mt-0.5">
                  Compro hortifruti
                </p>
              </div>
              {selectedType === "BUYER" && (
                <div className="absolute top-2 right-2 w-5 h-5 bg-forest rounded-full flex items-center justify-center">
                  <svg
                    className="w-3 h-3 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
              )}
            </button>
          </div>

          {selectedType === "BUYER" && (
            <div className="space-y-2 animate-[slide-up-fade_0.3s_ease-out]">
              <label
                htmlFor="buyerCompanyName"
                className="block font-sans text-xs font-bold uppercase tracking-wider text-bark"
              >
                Nome do restaurante / sacolao
              </label>
              <input
                id="buyerCompanyName"
                type="text"
                value={buyerCompanyName}
                onChange={(event) => setBuyerCompanyName(event.target.value)}
                placeholder="Ex: Restaurante Sabor da Terra"
                className={inputClassName}
                autoFocus
                required
                minLength={2}
                maxLength={120}
              />
            </div>
          )}

          {selectedType === "PRODUCER" && (
            <div className="space-y-5 animate-[slide-up-fade_0.3s_ease-out]">
              <div className="rounded-lg border border-forest/15 bg-forest/5 px-4 py-3">
                <p className="font-sans text-xs text-bark">
                  Primeiro coletamos seus dados basicos. Banco, documentos e
                  exigencias regulatorias ficam para a etapa seguinte no Stripe.
                </p>
              </div>

              <div className="space-y-2">
                <span className="block font-sans text-xs font-bold uppercase tracking-wider text-bark">
                  Tipo de cadastro
                </span>
                <div className="grid grid-cols-2 gap-3">
                  {(["PF", "PJ"] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() =>
                        updateProducerField("legalEntityType", option)
                      }
                      className={`rounded-md border px-4 py-3 text-sm font-semibold transition-colors ${
                        producerForm.legalEntityType === option
                          ? "border-forest bg-forest text-white"
                          : "border-soil/10 bg-white text-soil hover:border-forest/40"
                      }`}
                    >
                      {option === "PF" ? "Pessoa fisica" : "Pessoa juridica"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label
                    htmlFor="producerPublicName"
                    className="block font-sans text-xs font-bold uppercase tracking-wider text-bark"
                  >
                    Nome publico da fazenda / marca
                  </label>
                  <input
                    id="producerPublicName"
                    type="text"
                    value={producerForm.publicName}
                    onChange={(event) =>
                      updateProducerField("publicName", event.target.value)
                    }
                    placeholder="Ex: Fazenda Sao Joao"
                    className={inputClassName}
                    autoFocus
                    required
                    minLength={2}
                    maxLength={120}
                  />
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="producerLegalName"
                    className="block font-sans text-xs font-bold uppercase tracking-wider text-bark"
                  >
                    Nome legal
                  </label>
                  <input
                    id="producerLegalName"
                    type="text"
                    value={producerForm.legalName}
                    onChange={(event) =>
                      updateProducerField("legalName", event.target.value)
                    }
                    placeholder={
                      producerForm.legalEntityType === "PJ"
                        ? "Ex: Sao Joao Hortifruti Ltda"
                        : "Ex: Maria Aparecida Silva"
                    }
                    className={inputClassName}
                    required
                    minLength={2}
                    maxLength={160}
                  />
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="producerDocumentId"
                    className="block font-sans text-xs font-bold uppercase tracking-wider text-bark"
                  >
                    {producerDocumentLabel}
                  </label>
                  <input
                    id="producerDocumentId"
                    type="text"
                    inputMode="numeric"
                    value={producerForm.documentId}
                    onChange={(event) =>
                      updateProducerField("documentId", event.target.value)
                    }
                    placeholder={producerDocumentPlaceholder}
                    className={inputClassName}
                    required
                    minLength={producerDocumentLength}
                    maxLength={18}
                  />
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="producerContactName"
                    className="block font-sans text-xs font-bold uppercase tracking-wider text-bark"
                  >
                    Responsavel principal
                  </label>
                  <input
                    id="producerContactName"
                    type="text"
                    value={producerForm.contactName}
                    onChange={(event) =>
                      updateProducerField("contactName", event.target.value)
                    }
                    placeholder="Ex: Joao Pedro"
                    className={inputClassName}
                    required
                    minLength={2}
                    maxLength={120}
                  />
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <label
                    htmlFor="producerPhone"
                    className="block font-sans text-xs font-bold uppercase tracking-wider text-bark"
                  >
                    Telefone com DDD
                  </label>
                  <input
                    id="producerPhone"
                    type="tel"
                    inputMode="tel"
                    value={producerForm.phone}
                    onChange={(event) =>
                      updateProducerField("phone", event.target.value)
                    }
                    placeholder="Ex: (11) 99876-5432"
                    className={inputClassName}
                    required
                    minLength={10}
                    maxLength={20}
                  />
                </div>
              </div>
            </div>
          )}

          {setupAccount.error && (
            <div className="px-4 py-3 rounded-md bg-red-50 border border-red-200">
              <p className="font-sans text-xs text-red-700">
                {setupAccount.error.message}
              </p>
            </div>
          )}

          <Button
            className="w-full normal-case tracking-normal"
            type="submit"
            disabled={
              !selectedType ||
              (selectedType === "BUYER" ? !isBuyerReady : !isProducerReady)
            }
            isPending={setupAccount.isPending}
          >
            <>
              Continuar
              <ArrowRight className="w-4 h-4" />
            </>
          </Button>
        </form>
      </div>
    </main>
  );
}
