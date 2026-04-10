"use client";

import * as React from "react";
import {
  LoaderCircle,
  MapPin,
  Pencil,
  Plus,
  Trash2,
  Truck,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button, Skeleton, SkeletonText } from "@frescari/ui";
import { trpc } from "@/trpc/react";

type SavedAddress = {
  id: string;
  title: string;
  zipcode: string;
  street: string;
  number: string;
  neighborhood: string | null;
  city: string;
  state: string;
  country: string;
  complement: string | null;
  formattedAddress: string;
  isDefault: boolean;
};

type AddressFormState = {
  title: string;
  zipcode: string;
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  state: string;
  complement: string;
};

const inputClassName =
  "w-full rounded-sm border border-soil/15 bg-cream px-4 py-3 font-sans text-sm text-soil outline-none transition focus:border-forest focus:ring-2 focus:ring-forest/15 placeholder:text-bark/35";

function getInitialFormState(hasAddresses = false): AddressFormState {
  return {
    title: hasAddresses ? "Entrega secundaria" : "Principal",
    zipcode: "",
    street: "",
    number: "",
    neighborhood: "",
    city: "",
    state: "",
    complement: "",
  };
}

function formatZipcodeInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  return digits.length <= 5
    ? digits
    : `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

function formatStateInput(value: string) {
  return value
    .replace(/[^a-z]/gi, "")
    .slice(0, 2)
    .toUpperCase();
}

function getOptionalValue(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function getNullableValue(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function buildCreateAddressPayload(form: AddressFormState) {
  return {
    title: form.title.trim(),
    zipcode: formatZipcodeInput(form.zipcode),
    street: form.street.trim(),
    number: form.number.trim(),
    neighborhood: getOptionalValue(form.neighborhood),
    city: form.city.trim(),
    state: formatStateInput(form.state),
    country: "BR" as const,
    complement: getOptionalValue(form.complement),
  };
}

function buildUpdateAddressPayload(addressId: string, form: AddressFormState) {
  return {
    id: addressId,
    title: form.title.trim(),
    zipcode: formatZipcodeInput(form.zipcode),
    street: form.street.trim(),
    number: form.number.trim(),
    neighborhood: getNullableValue(form.neighborhood),
    city: form.city.trim(),
    state: formatStateInput(form.state),
    country: "BR" as const,
    complement: getNullableValue(form.complement),
  };
}

function mapAddressToForm(address: SavedAddress): AddressFormState {
  return {
    title: address.title,
    zipcode: address.zipcode,
    street: address.street,
    number: address.number,
    neighborhood: address.neighborhood ?? "",
    city: address.city,
    state: address.state,
    complement: address.complement ?? "",
  };
}

function logAddressMutationError(
  label: string,
  error: {
    message: string;
    data?: {
      code?: string;
      httpStatus?: number;
      zodError?: unknown;
    } | null;
  },
) {
  console.error(label, {
    message: error.message,
    code: error.data?.code,
    httpStatus: error.data?.httpStatus,
    zodError: error.data?.zodError,
  });
}

function AddressCardSkeleton() {
  return (
    <div className="rounded-[22px] border border-soil/8 bg-cream p-6 shadow-card">
      <Skeleton className="h-4 w-32" />
      <SkeletonText className="mt-4 max-w-xl" lines={3} />
    </div>
  );
}

export default function BuyerProfilePageClient() {
  const utils = trpc.useUtils();
  const [editingAddressId, setEditingAddressId] = React.useState<string | null>(
    null,
  );
  const [form, setForm] = React.useState<AddressFormState>(() =>
    getInitialFormState(),
  );

  const defaultAddressQuery = trpc.addresses.getDefaultAddress.useQuery();
  const addressesQuery = trpc.addresses.getAddresses.useQuery();

  const savedAddresses = (addressesQuery.data ?? []) as SavedAddress[];
  const defaultAddress = (defaultAddressQuery.data ??
    null) as SavedAddress | null;
  const isEditing = editingAddressId !== null;

  const resetForm = React.useCallback((addressCount: number) => {
    setEditingAddressId(null);
    setForm(getInitialFormState(addressCount > 0));
  }, []);

  const invalidateAddressQueries = React.useCallback(async () => {
    await Promise.all([
      utils.addresses.getDefaultAddress.invalidate(),
      utils.addresses.getAddresses.invalidate(),
    ]);
  }, [utils]);

  const createAddress = trpc.addresses.createAddress.useMutation({
    onSuccess: async (address) => {
      await invalidateAddressQueries();
      resetForm(savedAddresses.length + 1);
      toast.success(
        address.isDefault
          ? "Endereco padrao salvo com sucesso."
          : "Endereco salvo com sucesso.",
      );
    },
    onError: (error) => {
      logAddressMutationError("[addresses.createAddress]", error);
      toast.error(error.message || "Nao foi possivel salvar o endereco.");
    },
  });

  const updateAddress = trpc.addresses.updateAddress.useMutation({
    onSuccess: async () => {
      await invalidateAddressQueries();
      resetForm(savedAddresses.length);
      toast.success("Endereco atualizado com sucesso.");
    },
    onError: (error) => {
      logAddressMutationError("[addresses.updateAddress]", error);
      toast.error(error.message || "Nao foi possivel atualizar o endereco.");
    },
  });

  const deleteAddress = trpc.addresses.deleteAddress.useMutation({
    onSuccess: async (result) => {
      await invalidateAddressQueries();
      if (editingAddressId === result.id) {
        resetForm(Math.max(savedAddresses.length - 1, 0));
      }
      toast.success("Endereco excluido com sucesso.");
    },
    onError: (error) => {
      logAddressMutationError("[addresses.deleteAddress]", error);
      toast.error(error.message || "Nao foi possivel excluir o endereco.");
    },
  });

  const isSubmitting = createAddress.isPending || updateAddress.isPending;
  const isMutating = isSubmitting || deleteAddress.isPending;

  const handleChange =
    (field: keyof AddressFormState) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setForm((current) => ({
        ...current,
        [field]: event.target.value,
      }));
    };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (editingAddressId) {
      updateAddress.mutate(buildUpdateAddressPayload(editingAddressId, form));
      return;
    }

    createAddress.mutate(buildCreateAddressPayload(form));
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="font-display text-3xl font-black text-soil">
          Enderecos
        </h2>
        <p className="max-w-2xl font-sans text-sm leading-6 text-bark/80">
          O checkout usa o endereco padrao para calcular frete por fazenda. O
          primeiro endereco salvo vira padrao automaticamente.
        </p>
      </div>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_420px]">
        <div className="space-y-6">
          {defaultAddressQuery.isLoading ? (
            <AddressCardSkeleton />
          ) : defaultAddress ? (
            <section className="rounded-[22px] border border-soil/8 bg-cream p-6 shadow-card">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-2">
                  <p className="font-sans text-[10px] font-bold uppercase tracking-[0.18em] text-bark/65">
                    Endereco padrao do checkout
                  </p>
                  <h2 className="font-display text-2xl font-black text-soil">
                    {defaultAddress.title}
                  </h2>
                </div>
                <span className="inline-flex items-center rounded-full border border-forest/15 bg-sage px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-forest">
                  Padrao
                </span>
              </div>

              <div className="mt-5 rounded-[20px] border border-soil/10 bg-white/80 p-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-forest text-cream">
                    <MapPin className="h-5 w-5" />
                  </div>
                  <div className="space-y-2">
                    <p className="font-sans text-sm font-semibold text-soil">
                      {defaultAddress.formattedAddress}
                    </p>
                    <p className="font-sans text-xs leading-5 text-bark/75">
                      Esse endereco sera usado para calcular a cobertura e o
                      frete no carrinho.
                    </p>
                  </div>
                </div>
              </div>
            </section>
          ) : (
            <section className="rounded-[22px] border border-dashed border-forest/20 bg-sage/20 p-8 shadow-card">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-forest shadow-sm">
                  <Truck className="h-5 w-5" />
                </div>
                <div className="space-y-2">
                  <p className="font-display text-2xl font-black text-soil">
                    Nenhum endereco cadastrado ainda
                  </p>
                  <p className="max-w-xl font-sans text-sm leading-6 text-bark/80">
                    Cadastre o primeiro endereco para liberar o calculo de frete
                    por produtor no carrinho.
                  </p>
                </div>
              </div>
            </section>
          )}

          <section className="rounded-[22px] border border-soil/8 bg-cream p-6 shadow-card">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-2">
                <p className="font-sans text-[10px] font-bold uppercase tracking-[0.18em] text-bark/65">
                  Enderecos salvos
                </p>
                <h2 className="font-display text-2xl font-black text-soil">
                  Gerenciar entregas
                </h2>
              </div>
              <span className="inline-flex items-center rounded-full border border-soil/10 bg-cream-dark/35 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-bark/70">
                {savedAddresses.length} salvos
              </span>
            </div>

            <div className="mt-5 space-y-4">
              {addressesQuery.isLoading ? (
                <AddressCardSkeleton />
              ) : savedAddresses.length > 0 ? (
                savedAddresses.map((address) => (
                  <article
                    key={address.id}
                    className={`rounded-[20px] border p-5 ${
                      editingAddressId === address.id
                        ? "border-forest/30 bg-sage/20"
                        : "border-soil/10 bg-white/80"
                    }`}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-display text-xl font-black text-soil">
                            {address.title}
                          </h3>
                          {address.isDefault ? (
                            <span className="inline-flex items-center rounded-full border border-forest/15 bg-sage px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-forest">
                              Padrao
                            </span>
                          ) : null}
                        </div>
                        <p className="font-sans text-sm leading-6 text-bark/80">
                          {address.formattedAddress}
                        </p>
                        <p className="font-sans text-xs text-bark/65">
                          {address.city}/{address.state} - {address.zipcode}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={isMutating}
                          onClick={() => {
                            setEditingAddressId(address.id);
                            setForm(mapAddressToForm(address));
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                          Editar
                        </Button>
                        <Button
                          type="button"
                          variant="danger"
                          size="sm"
                          disabled={isMutating}
                          onClick={() => {
                            const confirmationMessage = address.isDefault
                              ? "Tem certeza que deseja excluir este endereco? Se houver outro endereco salvo, ele passara a ser o endereco padrao do checkout."
                              : "Tem certeza que deseja excluir este endereco?";

                            if (window.confirm(confirmationMessage)) {
                              deleteAddress.mutate({ id: address.id });
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                          Excluir
                        </Button>
                      </div>
                    </div>
                  </article>
                ))
              ) : (
                <div className="rounded-[20px] border border-dashed border-soil/15 bg-white/70 px-5 py-8 text-center">
                  <p className="font-display text-xl font-black text-soil">
                    Sua lista ainda esta vazia
                  </p>
                  <p className="mx-auto mt-2 max-w-lg font-sans text-sm leading-6 text-bark/75">
                    Assim que voce salvar o primeiro endereco, ele aparecera
                    aqui com acoes de edicao e exclusao.
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>

        <section className="rounded-[24px_18px_22px_20px] border border-soil/8 bg-cream p-6 shadow-card">
          <div className="space-y-2">
            <p className="font-sans text-[10px] font-bold uppercase tracking-[0.18em] text-bark/65">
              {isEditing ? "Edicao em andamento" : "Novo endereco"}
            </p>
            <h2 className="font-display text-2xl font-black text-soil">
              {isEditing ? "Editar entrega" : "Cadastrar entrega"}
            </h2>
          </div>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-1.5">
              <label className="font-sans text-[10px] font-bold uppercase tracking-[0.14em] text-bark">
                Titulo
              </label>
              <input
                className={inputClassName}
                onChange={handleChange("title")}
                placeholder="Ex: Escritorio, Loja, Matriz"
                value={form.title}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_108px]">
              <div className="space-y-1.5">
                <label className="font-sans text-[10px] font-bold uppercase tracking-[0.14em] text-bark">
                  Rua
                </label>
                <input
                  className={inputClassName}
                  onChange={handleChange("street")}
                  placeholder="Rua das Hortas"
                  value={form.street}
                />
              </div>
              <div className="space-y-1.5">
                <label className="font-sans text-[10px] font-bold uppercase tracking-[0.14em] text-bark">
                  Numero
                </label>
                <input
                  className={inputClassName}
                  onChange={handleChange("number")}
                  placeholder="123"
                  value={form.number}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <label className="font-sans text-[10px] font-bold uppercase tracking-[0.14em] text-bark">
                  Bairro
                </label>
                <input
                  className={inputClassName}
                  onChange={handleChange("neighborhood")}
                  placeholder="Centro"
                  value={form.neighborhood}
                />
              </div>
              <div className="space-y-1.5">
                <label className="font-sans text-[10px] font-bold uppercase tracking-[0.14em] text-bark">
                  Complemento
                </label>
                <input
                  className={inputClassName}
                  onChange={handleChange("complement")}
                  placeholder="Sala 4, bloco B"
                  value={form.complement}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-[124px_minmax(0,1fr)_96px]">
              <div className="space-y-1.5">
                <label className="font-sans text-[10px] font-bold uppercase tracking-[0.14em] text-bark">
                  CEP
                </label>
                <input
                  className={inputClassName}
                  inputMode="numeric"
                  maxLength={9}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      zipcode: formatZipcodeInput(event.target.value),
                    }))
                  }
                  placeholder="01234-567"
                  value={form.zipcode}
                />
              </div>
              <div className="space-y-1.5">
                <label className="font-sans text-[10px] font-bold uppercase tracking-[0.14em] text-bark">
                  Cidade
                </label>
                <input
                  className={inputClassName}
                  onChange={handleChange("city")}
                  placeholder="Sao Paulo"
                  value={form.city}
                />
              </div>
              <div className="space-y-1.5">
                <label className="font-sans text-[10px] font-bold uppercase tracking-[0.14em] text-bark">
                  UF
                </label>
                <input
                  className={`${inputClassName} uppercase`}
                  maxLength={2}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      state: formatStateInput(event.target.value),
                    }))
                  }
                  placeholder="SP"
                  value={form.state}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <Button
                className="flex-1 justify-center"
                disabled={isSubmitting}
                type="submit"
              >
                {isSubmitting ? (
                  <>
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    {isEditing
                      ? "Atualizando endereco..."
                      : "Salvando endereco..."}
                  </>
                ) : isEditing ? (
                  <>
                    <Pencil className="h-4 w-4" />
                    Atualizar endereco
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Salvar endereco
                  </>
                )}
              </Button>

              <Button
                type="button"
                variant="ghost"
                disabled={isMutating}
                onClick={() => resetForm(savedAddresses.length)}
              >
                <X className="h-4 w-4" />
                Cancelar
              </Button>
            </div>
          </form>
        </section>
      </section>
    </div>
  );
}
