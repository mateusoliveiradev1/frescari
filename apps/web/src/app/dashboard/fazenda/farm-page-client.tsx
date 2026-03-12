"use client";

import { useEffect, type ReactNode } from "react";

import { Button } from "@frescari/ui";
import type { FarmAddress } from "@frescari/db";
import { LoaderCircle, MapPin, Route, Save, Tractor } from "lucide-react";
import Link from "next/link";
import {
    Controller,
    useForm,
    useWatch,
    type FieldError,
} from "react-hook-form";
import { Toaster, toast } from "sonner";

import { trpc } from "@/trpc/react";

import { FarmMap } from "./farm-map";
import {
    DEFAULT_FARM_COORDINATES,
    type FarmCoordinates,
} from "./farm-map.types";

type FarmFormValues = {
    name: string;
    address: {
        street: string;
        number: string;
        neighborhood: string;
        city: string;
        state: string;
        postalCode: string;
        country: string;
        complement: string;
    };
    location: FarmCoordinates;
};

type FarmSeed =
    | {
          name?: string | null;
          address?: Partial<FarmAddress> | null;
          location?: FarmCoordinates | null;
      }
    | null
    | undefined;

const baseInputClassName =
    "w-full rounded-sm border border-soil/15 bg-cream px-4 py-3 font-sans text-sm text-soil outline-none transition focus:border-forest focus:ring-2 focus:ring-forest/15 placeholder:text-bark/35";

function buildInputClassName(error?: FieldError) {
    if (error) {
        return `${baseInputClassName} border-red-300 focus:border-red-500 focus:ring-red-100`;
    }

    return baseInputClassName;
}

function getDefaultFormValues(): FarmFormValues {
    return {
        name: "",
        address: {
            street: "",
            number: "",
            neighborhood: "",
            city: "",
            state: "",
            postalCode: "",
            country: "BR",
            complement: "",
        },
        location: DEFAULT_FARM_COORDINATES,
    };
}

function parseFarmToFormValues(farm: FarmSeed): FarmFormValues {
    const defaults = getDefaultFormValues();

    return {
        name: farm?.name ?? defaults.name,
        address: {
            street: farm?.address?.street ?? defaults.address.street,
            number: farm?.address?.number ?? defaults.address.number,
            neighborhood:
                farm?.address?.neighborhood ?? defaults.address.neighborhood,
            city: farm?.address?.city ?? defaults.address.city,
            state: farm?.address?.state ?? defaults.address.state,
            postalCode:
                farm?.address?.postalCode ?? defaults.address.postalCode,
            country: farm?.address?.country ?? defaults.address.country,
            complement:
                farm?.address?.complement ?? defaults.address.complement,
        },
        location: farm?.location ?? defaults.location,
    };
}

function optionalTrimmedValue(value: string) {
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : undefined;
}

function roundCoordinates(coordinates: FarmCoordinates): FarmCoordinates {
    return {
        latitude: Number(coordinates.latitude.toFixed(6)),
        longitude: Number(coordinates.longitude.toFixed(6)),
    };
}

function FieldShell({
    label,
    htmlFor,
    error,
    hint,
    children,
}: {
    label: string;
    htmlFor: string;
    error?: string;
    hint?: string;
    children: ReactNode;
}) {
    return (
        <div className="space-y-1.5">
            <label
                className="font-sans text-[10px] font-bold uppercase tracking-[0.15em] text-bark"
                htmlFor={htmlFor}
            >
                {label}
            </label>
            {children}
            {error ? (
                <p className="text-xs font-medium text-red-700">{error}</p>
            ) : hint ? (
                <p className="text-xs text-bark/60">{hint}</p>
            ) : null}
        </div>
    );
}

function SummaryItem({
    label,
    value,
}: {
    label: string;
    value: string;
}) {
    return (
        <div className="rounded-sm border border-soil/10 bg-cream-dark/35 px-4 py-3">
            <p className="font-sans text-[10px] font-bold uppercase tracking-[0.16em] text-bark/65">
                {label}
            </p>
            <p className="mt-2 font-display text-lg font-black text-soil">
                {value}
            </p>
        </div>
    );
}

export function FarmPageClient() {
    const utils = trpc.useUtils();
    const currentFarmQuery = trpc.farm.getCurrent.useQuery(undefined, {
        refetchOnWindowFocus: false,
    });

    const saveMutation = trpc.farm.saveLocation.useMutation({
        onSuccess(data) {
            reset(parseFarmToFormValues(data));
            void utils.farm.getCurrent.invalidate();

            toast.success("Dados da fazenda salvos.", {
                description:
                    "Nome, endereço e geolocalização foram atualizados com sucesso.",
            });
        },
        onError(error) {
            toast.error("Não foi possível salvar a fazenda.", {
                description: error.message,
            });
        },
    });

    const {
        control,
        register,
        handleSubmit,
        reset,
        formState: { errors, isDirty },
    } = useForm<FarmFormValues>({
        defaultValues: getDefaultFormValues(),
        mode: "onBlur",
    });

    const watchedLocation = useWatch({
        control,
        name: "location",
    });

    useEffect(() => {
        if (!currentFarmQuery.data || isDirty) {
            return;
        }

        reset(parseFarmToFormValues(currentFarmQuery.data));
    }, [currentFarmQuery.data, isDirty, reset]);

    const onSubmit = handleSubmit(async (values) => {
        await saveMutation.mutateAsync({
            name: values.name.trim(),
            address: {
                street: values.address.street.trim(),
                number: values.address.number.trim(),
                neighborhood: optionalTrimmedValue(values.address.neighborhood),
                city: values.address.city.trim(),
                state: values.address.state.trim().toUpperCase(),
                postalCode: values.address.postalCode.trim(),
                country:
                    values.address.country.trim().toUpperCase() || "BR",
                complement: optionalTrimmedValue(values.address.complement),
            },
            location: roundCoordinates(values.location),
        });
    });

    const coordinates = watchedLocation ?? DEFAULT_FARM_COORDINATES;
    const farmStatusLabel = currentFarmQuery.isLoading
        ? "Carregando cadastro"
        : currentFarmQuery.data
          ? "Cadastro encontrado"
          : "Primeiro cadastro";

    return (
        <>
            <Toaster position="bottom-right" richColors />

            <div className="space-y-8">
                <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                    <div className="space-y-2">
                        <p className="font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-bark/70">
                            Painel do Produtor
                        </p>
                        <h1 className="font-display text-4xl font-black text-soil">
                            Minha Fazenda
                        </h1>
                        <p className="max-w-3xl text-sm leading-6 text-bark/80">
                            Cadastre o nome oficial da fazenda, mantenha o
                            endereço estruturado em dia e marque o ponto exato
                            no mapa para dar precisão operacional ao seu
                            painel.
                        </p>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row">
                        <Button asChild className="justify-center" variant="ghost">
                            <Link href="/dashboard">Voltar ao painel</Link>
                        </Button>
                        <Button
                            className="justify-center"
                            disabled={saveMutation.isPending}
                            form="farm-form"
                            type="submit"
                        >
                            {saveMutation.isPending ? (
                                <>
                                    <LoaderCircle className="h-4 w-4 animate-spin" />
                                    Salvando
                                </>
                            ) : (
                                <>
                                    <Save className="h-4 w-4" />
                                    Salvar fazenda
                                </>
                            )}
                        </Button>
                    </div>
                </header>

                <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_360px]">
                    <form
                        className="space-y-6"
                        id="farm-form"
                        onSubmit={onSubmit}
                    >
                        <section className="rounded-[28px_18px_24px_18px] border border-soil/8 bg-cream p-6 shadow-card">
                            <div className="flex flex-col gap-4 border-b border-soil/10 pb-5 sm:flex-row sm:items-end sm:justify-between">
                                <div>
                                    <p className="font-sans text-[10px] font-bold uppercase tracking-[0.18em] text-bark/65">
                                        Identificação
                                    </p>
                                    <h2 className="mt-2 font-display text-2xl font-black text-soil">
                                        Dados principais da propriedade
                                    </h2>
                                </div>
                                <div className="inline-flex w-fit items-center gap-2 rounded-full border border-soil/10 bg-cream-dark/55 px-3 py-1.5 text-[11px] font-semibold text-bark/75">
                                    <Tractor className="h-3.5 w-3.5" />
                                    {farmStatusLabel}
                                </div>
                            </div>

                            <div className="mt-6 grid gap-5 md:grid-cols-2">
                                <div className="md:col-span-2">
                                    <FieldShell
                                        error={errors.name?.message}
                                        htmlFor="farm-name"
                                        hint="Use o nome reconhecido pela sua operação ou pelos compradores."
                                        label="Nome da Fazenda"
                                    >
                                        <input
                                            autoComplete="organization"
                                            className={buildInputClassName(
                                                errors.name,
                                            )}
                                            id="farm-name"
                                            placeholder="Ex: Fazenda Boa Colheita"
                                            {...register("name", {
                                                required:
                                                    "Informe o nome da fazenda.",
                                                validate: (value) =>
                                                    value.trim().length >= 2 ||
                                                    "Use ao menos 2 caracteres.",
                                            })}
                                        />
                                    </FieldShell>
                                </div>
                            </div>
                        </section>

                        <section className="rounded-[24px_16px_22px_20px] border border-soil/8 bg-cream p-6 shadow-card">
                            <div className="border-b border-soil/10 pb-5">
                                <p className="font-sans text-[10px] font-bold uppercase tracking-[0.18em] text-bark/65">
                                    Endereço estruturado
                                </p>
                                <h2 className="mt-2 font-display text-2xl font-black text-soil">
                                    Logradouro completo para operação e entrega
                                </h2>
                            </div>

                            <div className="mt-6 grid gap-5 md:grid-cols-6">
                                <div className="md:col-span-4">
                                    <FieldShell
                                        error={errors.address?.street?.message}
                                        htmlFor="farm-street"
                                        label="Rua"
                                    >
                                        <input
                                            autoComplete="address-line1"
                                            className={buildInputClassName(
                                                errors.address?.street,
                                            )}
                                            id="farm-street"
                                            placeholder="Ex: Estrada do Bairro Verde"
                                            {...register("address.street", {
                                                required: "Informe a rua.",
                                                validate: (value) =>
                                                    value.trim().length >= 2 ||
                                                    "Rua inválida.",
                                            })}
                                        />
                                    </FieldShell>
                                </div>

                                <div className="md:col-span-2">
                                    <FieldShell
                                        error={errors.address?.number?.message}
                                        htmlFor="farm-number"
                                        label="Número"
                                    >
                                        <input
                                            autoComplete="address-line2"
                                            className={buildInputClassName(
                                                errors.address?.number,
                                            )}
                                            id="farm-number"
                                            placeholder="Ex: 1200"
                                            {...register("address.number", {
                                                required:
                                                    "Informe o número do endereço.",
                                                validate: (value) =>
                                                    value.trim().length >= 1 ||
                                                    "Número inválido.",
                                            })}
                                        />
                                    </FieldShell>
                                </div>

                                <div className="md:col-span-3">
                                    <FieldShell
                                        error={
                                            errors.address?.neighborhood?.message
                                        }
                                        htmlFor="farm-neighborhood"
                                        hint="Opcional"
                                        label="Bairro"
                                    >
                                        <input
                                            autoComplete="address-level3"
                                            className={buildInputClassName(
                                                errors.address?.neighborhood,
                                            )}
                                            id="farm-neighborhood"
                                            placeholder="Ex: Capão Alto"
                                            {...register(
                                                "address.neighborhood",
                                                {
                                                    validate: (value) =>
                                                        value.trim().length ===
                                                            0 ||
                                                        value.trim().length >=
                                                            2 ||
                                                        "Bairro inválido.",
                                                },
                                            )}
                                        />
                                    </FieldShell>
                                </div>

                                <div className="md:col-span-3">
                                    <FieldShell
                                        error={errors.address?.city?.message}
                                        htmlFor="farm-city"
                                        label="Cidade"
                                    >
                                        <input
                                            autoComplete="address-level2"
                                            className={buildInputClassName(
                                                errors.address?.city,
                                            )}
                                            id="farm-city"
                                            placeholder="Ex: Ibiúna"
                                            {...register("address.city", {
                                                required: "Informe a cidade.",
                                                validate: (value) =>
                                                    value.trim().length >= 2 ||
                                                    "Cidade inválida.",
                                            })}
                                        />
                                    </FieldShell>
                                </div>

                                <div className="md:col-span-2">
                                    <FieldShell
                                        error={errors.address?.state?.message}
                                        htmlFor="farm-state"
                                        label="Estado (UF)"
                                    >
                                        <input
                                            autoComplete="address-level1"
                                            className={buildInputClassName(
                                                errors.address?.state,
                                            )}
                                            id="farm-state"
                                            maxLength={2}
                                            placeholder="SP"
                                            {...register("address.state", {
                                                required: "Informe a UF.",
                                                setValueAs: (value) =>
                                                    String(value ?? "")
                                                        .trim()
                                                        .toUpperCase(),
                                                validate: (value) =>
                                                    /^[A-Z]{2}$/.test(value) ||
                                                    "Use a UF com 2 letras.",
                                            })}
                                        />
                                    </FieldShell>
                                </div>

                                <div className="md:col-span-2">
                                    <FieldShell
                                        error={
                                            errors.address?.postalCode?.message
                                        }
                                        htmlFor="farm-postal-code"
                                        label="CEP"
                                    >
                                        <input
                                            autoComplete="postal-code"
                                            className={buildInputClassName(
                                                errors.address?.postalCode,
                                            )}
                                            id="farm-postal-code"
                                            inputMode="numeric"
                                            placeholder="18150-000"
                                            {...register("address.postalCode", {
                                                required: "Informe o CEP.",
                                                validate: (value) =>
                                                    /^\d{5}-?\d{3}$/.test(
                                                        value.trim(),
                                                    ) ||
                                                    "CEP inválido. Use 00000-000.",
                                            })}
                                        />
                                    </FieldShell>
                                </div>

                                <div className="md:col-span-2">
                                    <FieldShell
                                        error={errors.address?.country?.message}
                                        htmlFor="farm-country"
                                        label="País"
                                    >
                                        <input
                                            autoComplete="country"
                                            className={buildInputClassName(
                                                errors.address?.country,
                                            )}
                                            id="farm-country"
                                            maxLength={2}
                                            placeholder="BR"
                                            {...register("address.country", {
                                                required: "Informe o país.",
                                                setValueAs: (value) =>
                                                    String(value ?? "")
                                                        .trim()
                                                        .toUpperCase(),
                                                validate: (value) =>
                                                    /^[A-Z]{2}$/.test(value) ||
                                                    "Use o código ISO com 2 letras.",
                                            })}
                                        />
                                    </FieldShell>
                                </div>

                                <div className="md:col-span-6">
                                    <FieldShell
                                        error={errors.address?.complement?.message}
                                        htmlFor="farm-complement"
                                        hint="Opcional"
                                        label="Complemento"
                                    >
                                        <input
                                            autoComplete="off"
                                            className={buildInputClassName(
                                                errors.address?.complement,
                                            )}
                                            id="farm-complement"
                                            placeholder="Ex: Portão 2, referência do galpão"
                                            {...register("address.complement", {
                                                validate: (value) =>
                                                    value.trim().length === 0 ||
                                                    value.trim().length >= 1 ||
                                                    "Complemento inválido.",
                                            })}
                                        />
                                    </FieldShell>
                                </div>
                            </div>
                        </section>

                        <section className="rounded-[24px_18px_22px_18px] border border-soil/8 bg-cream p-6 shadow-card">
                            <div className="flex flex-col gap-4 border-b border-soil/10 pb-5 lg:flex-row lg:items-end lg:justify-between">
                                <div>
                                    <p className="font-sans text-[10px] font-bold uppercase tracking-[0.18em] text-bark/65">
                                        Localização exata
                                    </p>
                                    <h2 className="mt-2 font-display text-2xl font-black text-soil">
                                        Clique no mapa ou arraste o pino
                                    </h2>
                                </div>
                                <p className="max-w-md text-sm leading-6 text-bark/70">
                                    O ponto abaixo deve representar o local real
                                    da fazenda. Esse dado sustenta buscas por
                                    proximidade e futuras regras logísticas.
                                </p>
                            </div>

                            <div className="mt-6 space-y-4">
                                <Controller
                                    control={control}
                                    name="location"
                                    render={({ field }) => (
                                        <FarmMap
                                            disabled={saveMutation.isPending}
                                            onChange={field.onChange}
                                            value={field.value}
                                        />
                                    )}
                                />

                                <div className="grid gap-4 rounded-[18px] border border-soil/10 bg-cream-dark/35 p-4 md:grid-cols-2">
                                    <SummaryItem
                                        label="Latitude"
                                        value={coordinates.latitude.toFixed(6)}
                                    />
                                    <SummaryItem
                                        label="Longitude"
                                        value={coordinates.longitude.toFixed(6)}
                                    />
                                </div>
                            </div>
                        </section>
                    </form>

                    <aside className="space-y-6">
                        <section className="rounded-[18px_24px_18px_22px] border border-soil/8 bg-cream p-6 shadow-card">
                            <p className="font-sans text-[10px] font-bold uppercase tracking-[0.18em] text-bark/65">
                                Coordenadas atuais
                            </p>
                            <h2 className="mt-2 font-display text-2xl font-black text-soil">
                                Ponto confirmado no mapa
                            </h2>

                            <div className="mt-6 space-y-3">
                                <SummaryItem
                                    label="Latitude"
                                    value={coordinates.latitude.toFixed(6)}
                                />
                                <SummaryItem
                                    label="Longitude"
                                    value={coordinates.longitude.toFixed(6)}
                                />
                            </div>

                            <div className="mt-6 rounded-[18px] border border-soil/10 bg-cream-dark/45 p-4 text-sm leading-6 text-bark/75">
                                <p className="font-semibold text-soil">
                                    Estado do formulário
                                </p>
                                <p className="mt-2">
                                    {isDirty
                                        ? "Existem alterações pendentes para salvar."
                                        : "Os dados exibidos refletem o último estado sincronizado."}
                                </p>
                                {currentFarmQuery.error ? (
                                    <p className="mt-3 text-red-700">
                                        {currentFarmQuery.error.message}
                                    </p>
                                ) : null}
                            </div>
                        </section>

                        <section className="rounded-[18px_22px_24px_18px] bg-forest p-6 text-cream shadow-card">
                            <p className="font-sans text-[10px] font-bold uppercase tracking-[0.18em] text-cream/70">
                                Guia rápido
                            </p>
                            <h2 className="mt-2 font-display text-2xl font-black">
                                Como marcar a fazenda com precisão
                            </h2>

                            <div className="mt-6 space-y-4 text-sm leading-6 text-cream/82">
                                <div className="flex gap-3">
                                    <MapPin className="mt-1 h-4 w-4 shrink-0" />
                                    <p>
                                        Clique diretamente no mapa para mover o
                                        pino até a entrada, sede ou ponto de
                                        referência principal da propriedade.
                                    </p>
                                </div>

                                <div className="flex gap-3">
                                    <Route className="mt-1 h-4 w-4 shrink-0" />
                                    <p>
                                        Se precisar de mais precisão, arraste o
                                        pino até a posição exata antes de salvar.
                                    </p>
                                </div>

                                <div className="flex gap-3">
                                    <Save className="mt-1 h-4 w-4 shrink-0" />
                                    <p>
                                        O botão salvar persiste nome, endereço e
                                        coordenadas em uma única operação via
                                        tRPC.
                                    </p>
                                </div>
                            </div>
                        </section>
                    </aside>
                </div>
            </div>
        </>
    );
}
