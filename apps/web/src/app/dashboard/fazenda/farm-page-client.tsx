"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import {
    Button,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    Skeleton,
    SkeletonText,
} from "@frescari/ui";
import type { FarmAddress } from "@frescari/db";
import { LoaderCircle, MapPin, Route, Save, Search, Tractor } from "lucide-react";
import Link from "next/link";
import {
    Controller,
    useForm,
    useWatch,
    type FieldError,
} from "react-hook-form";
import { toast } from "sonner";

import { trpc } from "@/trpc/react";

import { FarmMap } from "./farm-map";
import {
    DEFAULT_FARM_COORDINATES,
    type FarmCoordinates,
    type FarmMapInteractionSource,
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
    deliveryRadiusKm: number;
    pricePerKm: number;
    minOrderValue: number;
    freeShippingThreshold: number | null;
};

type FarmSeed =
    | {
          name?: string | null;
          address?: Partial<FarmAddress> | null;
          location?: FarmCoordinates | null;
          deliveryRadiusKm?: number | string | null;
          maxDeliveryRadiusKm?: number | string | null;
          pricePerKm?: number | string | null;
          minOrderValue?: number | string | null;
          freeShippingThreshold?: number | string | null;
      }
    | null
    | undefined;

type MapFeedbackTone = "loading" | "success" | "error" | "neutral";

type FarmMapSearchResult = {
    label: string;
    latitude: number;
    longitude: number;
};

const fleetVehicleTypeOptions = [
    { value: "motorcycle", label: "Moto" },
    { value: "car", label: "Carro" },
    { value: "pickup", label: "Pickup" },
    { value: "van", label: "Van" },
    { value: "refrigerated_van", label: "Van refrigerada" },
    { value: "truck", label: "Caminhao" },
    { value: "refrigerated_truck", label: "Caminhao refrigerado" },
] as const;

const fleetVehicleStatusOptions = [
    { value: "available", label: "Disponivel" },
    { value: "in_use", label: "Em rota" },
    { value: "maintenance", label: "Manutencao" },
    { value: "offline", label: "Offline" },
] as const;

type FleetVehicleType = (typeof fleetVehicleTypeOptions)[number]["value"];
type FleetVehicleStatus = (typeof fleetVehicleStatusOptions)[number]["value"];

type FleetVehicleView = {
    id: string;
    label: string;
    vehicleType: FleetVehicleType;
    capacityKg: number;
    refrigeration: boolean;
    availabilityStatus: FleetVehicleStatus;
    notes: string | null;
};

type FleetVehicleFormValues = {
    vehicleId?: string;
    label: string;
    vehicleType: FleetVehicleType;
    capacityKg: string;
    refrigeration: boolean;
    availabilityStatus: FleetVehicleStatus;
    notes: string;
};

type FarmAddressSuggestion = {
    label: string;
    address: Partial<FarmAddress>;
} | null;

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
        deliveryRadiusKm: 0,
        pricePerKm: 0,
        minOrderValue: 0,
        freeShippingThreshold: null,
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
        deliveryRadiusKm: coerceNonNegativeInteger(
            farm?.deliveryRadiusKm ?? farm?.maxDeliveryRadiusKm,
            defaults.deliveryRadiusKm,
        ),
        pricePerKm: coerceNonNegativeNumber(
            farm?.pricePerKm,
            defaults.pricePerKm,
        ),
        minOrderValue: coerceNonNegativeNumber(
            farm?.minOrderValue,
            defaults.minOrderValue,
        ),
        freeShippingThreshold: coerceNullableNonNegativeNumber(
            farm?.freeShippingThreshold,
        ),
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

function hasText(value: string | null | undefined): value is string {
    return typeof value === "string" && value.trim().length > 0;
}

function coerceNonNegativeNumber(
    value: number | string | null | undefined,
    fallback = 0,
) {
    const parsedValue =
        typeof value === "number" ? value : Number(value ?? fallback);

    if (!Number.isFinite(parsedValue) || parsedValue < 0) {
        return fallback;
    }

    return parsedValue;
}

function coerceNonNegativeInteger(
    value: number | string | null | undefined,
    fallback = 0,
) {
    return Math.max(0, Math.round(coerceNonNegativeNumber(value, fallback)));
}

function coerceNullableNonNegativeNumber(
    value: number | string | null | undefined,
) {
    if (value === null || value === undefined || value === "") {
        return null;
    }

    const parsedValue = typeof value === "number" ? value : Number(value);

    if (!Number.isFinite(parsedValue) || parsedValue < 0) {
        return null;
    }

    return parsedValue;
}

function getDefaultFleetVehicleFormValues(): FleetVehicleFormValues {
    return {
        vehicleId: undefined,
        label: "",
        vehicleType: "pickup",
        capacityKg: "",
        refrigeration: false,
        availabilityStatus: "available",
        notes: "",
    };
}

function buildFleetVehicleFormValues(
    vehicle: FleetVehicleView,
): FleetVehicleFormValues {
    return {
        vehicleId: vehicle.id,
        label: vehicle.label,
        vehicleType: vehicle.vehicleType,
        capacityKg: String(vehicle.capacityKg),
        refrigeration: vehicle.refrigeration,
        availabilityStatus: vehicle.availabilityStatus,
        notes: vehicle.notes ?? "",
    };
}

function formatVehicleCapacity(value: number) {
    return new Intl.NumberFormat("pt-BR", {
        maximumFractionDigits: 0,
    }).format(value);
}

function buildMapFeedbackClassName(tone: MapFeedbackTone) {
    if (tone === "error") {
        return "border-red-200 bg-red-50 text-red-800";
    }

    if (tone === "success") {
        return "border-emerald-200 bg-emerald-50 text-emerald-800";
    }

    if (tone === "loading") {
        return "border-forest/15 bg-sage/45 text-forest";
    }

    return "border-soil/10 bg-white/80 text-bark/75";
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

function FarmPageSkeleton() {
    return (
        <div className="space-y-8">
            <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <div className="space-y-3">
                    <Skeleton className="h-3 w-32" />
                    <Skeleton className="h-12 w-64" />
                    <SkeletonText className="max-w-3xl" lines={2} />
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                    <Skeleton className="h-11 w-40" />
                    <Skeleton className="h-11 w-44" />
                </div>
            </header>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_360px]">
                <div className="space-y-6">
                    <section className="rounded-[28px_18px_24px_18px] border border-soil/8 bg-cream p-6 shadow-card">
                        <SkeletonText className="max-w-sm" lines={2} />
                        <div className="mt-6 grid gap-5 md:grid-cols-2">
                            <Skeleton className="h-11 md:col-span-2" />
                        </div>
                    </section>

                    <section className="rounded-[24px_16px_22px_20px] border border-soil/8 bg-cream p-6 shadow-card">
                        <SkeletonText className="max-w-md" lines={2} />
                        <div className="mt-6 grid gap-5 md:grid-cols-6">
                            <Skeleton className="h-11 md:col-span-4" />
                            <Skeleton className="h-11 md:col-span-2" />
                            <Skeleton className="h-11 md:col-span-3" />
                            <Skeleton className="h-11 md:col-span-3" />
                            <Skeleton className="h-11 md:col-span-2" />
                            <Skeleton className="h-11 md:col-span-2" />
                            <Skeleton className="h-11 md:col-span-2" />
                            <Skeleton className="h-11 md:col-span-6" />
                        </div>
                    </section>

                    <section className="rounded-[24px_18px_22px_18px] border border-soil/8 bg-cream p-6 shadow-card">
                        <SkeletonText className="max-w-lg" lines={2} />
                        <div className="mt-6 space-y-4">
                            <div className="rounded-[20px] border border-soil/10 bg-cream-dark/35 p-4">
                                <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                                    <div className="flex-1 space-y-2">
                                        <Skeleton className="h-3 w-40" />
                                        <Skeleton className="h-11 w-full" />
                                    </div>
                                    <Skeleton className="h-11 w-48" />
                                </div>
                            </div>
                            <Skeleton className="h-[440px] rounded-[24px]" />
                            <div className="grid gap-4 rounded-[18px] border border-soil/10 bg-cream-dark/35 p-4 md:grid-cols-2">
                                <Skeleton className="h-20" />
                                <Skeleton className="h-20" />
                            </div>
                        </div>
                    </section>
                </div>

                <aside className="space-y-6">
                    <section className="rounded-[18px_24px_18px_22px] border border-soil/8 bg-cream p-6 shadow-card">
                        <SkeletonText className="max-w-xs" lines={2} />
                        <div className="mt-6 space-y-3">
                            <Skeleton className="h-20" />
                            <Skeleton className="h-20" />
                        </div>
                    </section>
                </aside>
            </div>
        </div>
    );
}

export function FarmPageClient() {
    const utils = trpc.useUtils();
    const reverseLookupSequenceRef = useRef(0);
    const [mapSearchQuery, setMapSearchQuery] = useState<string | null>(null);
    const [mapFeedback, setMapFeedback] = useState<{
        tone: MapFeedbackTone;
        message: string;
    } | null>(null);
    const [isVehicleDialogOpen, setIsVehicleDialogOpen] = useState(false);
    const [vehicleForm, setVehicleForm] = useState<FleetVehicleFormValues>(
        getDefaultFleetVehicleFormValues(),
    );
    const currentFarmQuery = trpc.farm.getCurrent.useQuery(undefined, {
        refetchOnWindowFocus: false,
    });
    const vehiclesQuery = trpc.farm.listVehicles.useQuery(undefined, {
        refetchOnWindowFocus: false,
    });
    const isInitialLoading = currentFarmQuery.isLoading && !currentFarmQuery.data;

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

    const searchLocationMutation = trpc.farm.searchLocation.useMutation();
    const reverseGeocodeMutation = trpc.farm.reverseGeocodeLocation.useMutation();
    const upsertVehicleMutation = trpc.farm.upsertVehicle.useMutation({
        onSuccess(_data, variables) {
            void utils.farm.listVehicles.invalidate();
            setVehicleForm(getDefaultFleetVehicleFormValues());
            setIsVehicleDialogOpen(false);

            toast.success(
                variables.vehicleId
                    ? "Veiculo atualizado."
                    : "Veiculo cadastrado.",
                {
                    description:
                        "A frota operacional ja pode ser usada na recomendacao de saida.",
                },
            );
        },
        onError(error) {
            toast.error("Nao foi possivel salvar o veiculo.", {
                description: error.message,
            });
        },
    });
    const deleteVehicleMutation = trpc.farm.deleteVehicle.useMutation({
        onSuccess() {
            void utils.farm.listVehicles.invalidate();
            setVehicleForm(getDefaultFleetVehicleFormValues());
            setIsVehicleDialogOpen(false);

            toast.success("Veiculo removido da frota.");
        },
        onError(error) {
            toast.error("Nao foi possivel remover o veiculo.", {
                description: error.message,
            });
        },
    });

    const {
        control,
        getValues,
        register,
        handleSubmit,
        reset,
        setValue,
        formState: { errors, isDirty },
    } = useForm<FarmFormValues>({
        defaultValues: getDefaultFormValues(),
        mode: "onBlur",
    });

    const watchedLocation = useWatch({
        control,
        name: "location",
    });

    const defaultMapSearchQuery = useMemo(
        () =>
            currentFarmQuery.data?.address?.postalCode ??
            currentFarmQuery.data?.address?.city ??
            "",
        [currentFarmQuery.data],
    );

    useEffect(() => {
        if (!currentFarmQuery.data || isDirty) {
            return;
        }

        reset(parseFarmToFormValues(currentFarmQuery.data));
    }, [currentFarmQuery.data, isDirty, reset]);

    const openCreateVehicleDialog = () => {
        setVehicleForm(getDefaultFleetVehicleFormValues());
        setIsVehicleDialogOpen(true);
    };

    const openEditVehicleDialog = (vehicle: FleetVehicleView) => {
        setVehicleForm(buildFleetVehicleFormValues(vehicle));
        setIsVehicleDialogOpen(true);
    };

    const handleVehicleDialogChange = (open: boolean) => {
        if (!open && (upsertVehicleMutation.isPending || deleteVehicleMutation.isPending)) {
            return;
        }

        setIsVehicleDialogOpen(open);

        if (!open) {
            setVehicleForm(getDefaultFleetVehicleFormValues());
        }
    };

    const handleVehicleFieldChange = <Field extends keyof FleetVehicleFormValues>(
        field: Field,
        value: FleetVehicleFormValues[Field],
    ) => {
        setVehicleForm((currentValue) => ({
            ...currentValue,
            [field]: value,
        }));
    };

    const handleVehicleSubmit = () => {
        const normalizedCapacityKg = Number(vehicleForm.capacityKg);

        if (!vehicleForm.label.trim()) {
            toast.error("Informe um nome para o veiculo.");
            return;
        }

        if (!Number.isFinite(normalizedCapacityKg) || normalizedCapacityKg <= 0) {
            toast.error("Informe uma capacidade valida em quilos.");
            return;
        }

        upsertVehicleMutation.mutate({
            vehicleId: vehicleForm.vehicleId,
            label: vehicleForm.label,
            vehicleType: vehicleForm.vehicleType,
            capacityKg: normalizedCapacityKg,
            refrigeration: vehicleForm.refrigeration,
            availabilityStatus: vehicleForm.availabilityStatus,
            notes: vehicleForm.notes.trim() || null,
        });
    };

    const handleVehicleDelete = () => {
        if (!vehicleForm.vehicleId) {
            return;
        }

        deleteVehicleMutation.mutate({
            vehicleId: vehicleForm.vehicleId,
        });
    };

    const applyAddressSuggestion = (
        suggestion: FarmAddressSuggestion,
        source: "search" | FarmMapInteractionSource,
    ) => {
        if (!suggestion) {
            setMapFeedback({
                tone: "neutral",
                message:
                    source === "search"
                        ? "Mapa centralizado, mas o endereco textual ainda precisa ser ajustado manualmente."
                        : "Ponto atualizado. Se necessario, ajuste o endereco textual manualmente.",
            });
            return;
        }

        const currentAddress = getValues("address");
        const updates: Array<[keyof FarmFormValues["address"], string]> = [];

        const queueUpdate = (
            field: keyof FarmFormValues["address"],
            nextValue: string | undefined,
            mode: "fill-empty" | "replace" = "fill-empty",
        ) => {
            if (!hasText(nextValue)) {
                return;
            }

            const currentValue = currentAddress[field]?.trim() ?? "";
            const normalizedNextValue = nextValue.trim();
            const shouldApply =
                mode === "replace"
                    ? currentValue !== normalizedNextValue
                    : currentValue.length === 0;

            if (shouldApply) {
                updates.push([field, normalizedNextValue]);
            }
        };

        queueUpdate("street", suggestion.address.street);
        queueUpdate("number", suggestion.address.number);
        queueUpdate("neighborhood", suggestion.address.neighborhood);
        queueUpdate("city", suggestion.address.city, "replace");
        queueUpdate("state", suggestion.address.state, "replace");
        queueUpdate("postalCode", suggestion.address.postalCode, "replace");
        queueUpdate("country", suggestion.address.country, "replace");

        for (const [field, value] of updates) {
            setValue(`address.${field}`, value, {
                shouldDirty: true,
                shouldTouch: true,
                shouldValidate: true,
            });
        }

        setMapFeedback({
            tone: "success",
            message:
                updates.length > 0
                    ? `Sugestao do mapa aplicada com base em ${suggestion.label}.`
                    : `Ponto localizado em ${suggestion.label}. Confira os campos do endereco antes de salvar.`,
        });
    };

    const requestAddressSuggestion = async (
        coordinates: FarmCoordinates,
        source: "search" | FarmMapInteractionSource,
    ) => {
        const requestId = reverseLookupSequenceRef.current + 1;
        reverseLookupSequenceRef.current = requestId;

        setMapFeedback({
            tone: "loading",
            message:
                source === "search"
                    ? "Sincronizando o endereco sugerido para esse ponto..."
                    : "Buscando uma sugestao de endereco para o pino...",
        });

        try {
            const suggestion = (await reverseGeocodeMutation.mutateAsync(
                coordinates,
            )) as FarmAddressSuggestion;

            if (requestId !== reverseLookupSequenceRef.current) {
                return;
            }

            applyAddressSuggestion(suggestion, source);
        } catch (error) {
            if (requestId !== reverseLookupSequenceRef.current) {
                return;
            }

            setMapFeedback({
                tone: "error",
                message:
                    error instanceof Error
                        ? error.message
                        : "Nao foi possivel sugerir o endereco a partir do ponto marcado.",
            });
        }
    };

    const handleMapSearchSubmit = async () => {
        const normalizedQuery = (mapSearchQuery ?? defaultMapSearchQuery).trim();

        if (normalizedQuery.length < 2) {
            setMapFeedback({
                tone: "error",
                message: "Informe um CEP ou cidade com ao menos 2 caracteres.",
            });
            return;
        }

        setMapFeedback({
            tone: "loading",
            message: "Buscando a melhor area para centralizar o mapa...",
        });

        try {
            const result = (await searchLocationMutation.mutateAsync({
                query: normalizedQuery,
            })) as FarmMapSearchResult;
            const nextCoordinates = roundCoordinates({
                latitude: result.latitude,
                longitude: result.longitude,
            });

            setValue("location", nextCoordinates, {
                shouldDirty: true,
                shouldTouch: true,
                shouldValidate: true,
            });
            setMapFeedback({
                tone: "success",
                message: `Mapa centralizado em ${result.label}.`,
            });

            await requestAddressSuggestion(nextCoordinates, "search");
        } catch (error) {
            setMapFeedback({
                tone: "error",
                message:
                    error instanceof Error
                        ? error.message
                        : "Nao foi possivel localizar esse CEP ou cidade.",
            });
        }
    };

    const handleMapLocationCommit = async (
        coordinates: FarmCoordinates,
        _source: FarmMapInteractionSource,
    ) => {
        await requestAddressSuggestion(roundCoordinates(coordinates), _source);
    };

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
            deliveryRadiusKm: values.deliveryRadiusKm,
            pricePerKm: values.pricePerKm,
            minOrderValue: values.minOrderValue,
            freeShippingThreshold: values.freeShippingThreshold,
        });
    });

    const coordinates = watchedLocation ?? DEFAULT_FARM_COORDINATES;
    const farmStatusLabel = currentFarmQuery.isLoading
        ? "Carregando cadastro"
        : currentFarmQuery.data
          ? "Cadastro encontrado"
          : "Primeiro cadastro";

    if (isInitialLoading) {
        return (
            <>
                 <FarmPageSkeleton />
            </>
        );
    }

    return (
        <>
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
                            form="farm-form"
                            isPending={saveMutation.isPending}
                            type="submit"
                        >
                            <Save className="h-4 w-4" />
                            Salvar fazenda
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
                                <div className="rounded-[20px] border border-soil/10 bg-cream-dark/35 p-4">
                                    <div
                                        aria-label="Buscar localizacao da fazenda no mapa"
                                        className="flex flex-col gap-3 lg:flex-row lg:items-end"
                                        role="search"
                                    >
                                        <div className="flex-1 space-y-1.5">
                                            <label
                                                className="font-sans text-[10px] font-bold uppercase tracking-[0.15em] text-bark"
                                                htmlFor="farm-map-search"
                                            >
                                                Buscar por CEP ou cidade
                                            </label>
                                            <input
                                                className={baseInputClassName}
                                                id="farm-map-search"
                                                onChange={(event) =>
                                                    setMapSearchQuery(
                                                        event.target.value,
                                                    )
                                                }
                                                onKeyDown={(event) => {
                                                    if (event.key !== "Enter") {
                                                        return;
                                                    }

                                                    event.preventDefault();
                                                    void handleMapSearchSubmit();
                                                }}
                                                placeholder="Ex: 18150-000 ou Ibiuna"
                                                value={mapSearchQuery ?? defaultMapSearchQuery}
                                            />
                                            <p className="text-xs text-bark/60">
                                                O mapa faz um voo suave ate a
                                                regiao encontrada e ajuda a
                                                sugerir o endereco.
                                            </p>
                                        </div>

                                        <Button
                                            className="justify-center"
                                            isPending={searchLocationMutation.isPending}
                                            onClick={() => {
                                                void handleMapSearchSubmit();
                                            }}
                                            type="button"
                                        >
                                            <Search className="h-4 w-4" />
                                            Encontrar no mapa
                                        </Button>
                                    </div>

                                    {mapFeedback ? (
                                        <div
                                            aria-live="polite"
                                            className={`mt-4 flex items-start gap-3 rounded-[16px] border px-4 py-3 text-sm leading-6 ${buildMapFeedbackClassName(
                                                mapFeedback.tone,
                                            )}`}
                                            role={
                                                mapFeedback.tone === "error"
                                                    ? "alert"
                                                    : "status"
                                            }
                                        >
                                            {mapFeedback.tone === "loading" ? (
                                                <LoaderCircle className="mt-0.5 h-4 w-4 animate-spin shrink-0" />
                                            ) : (
                                                <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                                            )}
                                            <p>{mapFeedback.message}</p>
                                        </div>
                                    ) : null}
                                </div>

                                <Controller
                                    control={control}
                                    name="location"
                                    render={({ field }) => (
                                        <FarmMap
                                            disabled={saveMutation.isPending}
                                            onChange={field.onChange}
                                            onLocationCommit={
                                                handleMapLocationCommit
                                            }
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

                                <div className="grid gap-4 md:grid-cols-2">
                                    <FieldShell
                                        error={errors.deliveryRadiusKm?.message}
                                        htmlFor="farm-delivery-radius-km"
                                        label="Raio Maximo de Entrega (Km)"
                                    >
                                        <input
                                            className={buildInputClassName(
                                                errors.deliveryRadiusKm,
                                            )}
                                            id="farm-delivery-radius-km"
                                            inputMode="numeric"
                                            min={0}
                                            placeholder="Ex: 30"
                                            step={1}
                                            type="number"
                                            {...register("deliveryRadiusKm", {
                                                setValueAs: (value) =>
                                                    coerceNonNegativeInteger(
                                                        value,
                                                    ),
                                                validate: (value) =>
                                                    Number.isInteger(value) ||
                                                    "Informe um raio inteiro igual ou maior que zero.",
                                            })}
                                        />
                                    </FieldShell>

                                    <FieldShell
                                        error={errors.pricePerKm?.message}
                                        htmlFor="farm-price-per-km"
                                        label="Taxa de Frete (R$ por Km)"
                                    >
                                        <input
                                            className={buildInputClassName(
                                                errors.pricePerKm,
                                            )}
                                            id="farm-price-per-km"
                                            inputMode="decimal"
                                            min={0}
                                            placeholder="Ex: 4,50"
                                            step="0.01"
                                            type="number"
                                            {...register("pricePerKm", {
                                                setValueAs: (value) =>
                                                    coerceNonNegativeNumber(
                                                    value,
                                                    ),
                                                validate: (value) =>
                                                    Number.isFinite(value) &&
                                                    value >= 0
                                                        ? true
                                                        : "Informe uma taxa igual ou maior que zero.",
                                            })}
                                        />
                                    </FieldShell>

                                    <FieldShell
                                        error={errors.minOrderValue?.message}
                                        htmlFor="farm-min-order-value"
                                        label="Valor Minimo do Pedido"
                                    >
                                        <input
                                            className={buildInputClassName(
                                                errors.minOrderValue,
                                            )}
                                            id="farm-min-order-value"
                                            inputMode="decimal"
                                            min={0}
                                            placeholder="Ex: 50,00"
                                            step="0.01"
                                            type="number"
                                            {...register("minOrderValue", {
                                                setValueAs: (value) =>
                                                    coerceNonNegativeNumber(
                                                        value,
                                                    ),
                                                validate: (value) =>
                                                    Number.isFinite(value) &&
                                                    value >= 0
                                                        ? true
                                                        : "Informe um valor igual ou maior que zero.",
                                            })}
                                        />
                                    </FieldShell>

                                    <FieldShell
                                        error={
                                            errors.freeShippingThreshold
                                                ?.message
                                        }
                                        hint="Opcional. Deixe em branco para nao oferecer frete gratis."
                                        htmlFor="farm-free-shipping-threshold"
                                        label="Frete Gratis a partir de"
                                    >
                                        <Controller
                                            control={control}
                                            name="freeShippingThreshold"
                                            render={({ field }) => (
                                                <input
                                                    className={buildInputClassName(
                                                        errors.freeShippingThreshold,
                                                    )}
                                                    id="farm-free-shipping-threshold"
                                                    inputMode="decimal"
                                                    min={0}
                                                    onBlur={field.onBlur}
                                                    onChange={(event) => {
                                                        field.onChange(
                                                            coerceNullableNonNegativeNumber(
                                                                event.target.value,
                                                            ),
                                                        );
                                                    }}
                                                    placeholder="Ex: 120,00"
                                                    ref={field.ref}
                                                    step="0.01"
                                                    type="number"
                                                    value={field.value ?? ""}
                                                />
                                            )}
                                        />
                                    </FieldShell>
                                </div>
                            </div>
                        </section>
                    </form>

                    <aside className="space-y-6">
                        <section className="rounded-[18px_24px_18px_22px] border border-soil/8 bg-cream p-6 shadow-card">
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                    <p className="font-sans text-[10px] font-bold uppercase tracking-[0.18em] text-bark/65">
                                        Frota operacional
                                    </p>
                                    <h2 className="mt-2 font-display text-2xl font-black text-soil">
                                        Veiculos usados nas saidas
                                    </h2>
                                    <p className="mt-3 text-sm leading-6 text-bark/70">
                                        Esse catalogo alimenta a recomendacao de veiculo e a confirmacao manual da saida no painel de entregas.
                                    </p>
                                </div>

                                <Button
                                    disabled={!currentFarmQuery.data}
                                    onClick={openCreateVehicleDialog}
                                    type="button"
                                    variant="secondary"
                                >
                                    Cadastrar veiculo
                                </Button>
                            </div>

                            {!currentFarmQuery.data ? (
                                <div className="mt-6 rounded-[18px] border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-6 text-amber-900">
                                    Salve a fazenda e a localizacao primeiro para habilitar o cadastro da frota.
                                </div>
                            ) : vehiclesQuery.isLoading && !vehiclesQuery.data ? (
                                <div className="mt-6 space-y-3">
                                    <Skeleton className="h-24 rounded-[18px]" />
                                    <Skeleton className="h-24 rounded-[18px]" />
                                </div>
                            ) : vehiclesQuery.data && vehiclesQuery.data.length > 0 ? (
                                <div className="mt-6 space-y-3">
                                    {vehiclesQuery.data.map((vehicle) => (
                                        <button
                                            className="w-full rounded-[18px] border border-soil/10 bg-cream-dark/35 px-4 py-4 text-left transition hover:border-forest/20 hover:bg-white/85"
                                            key={vehicle.id}
                                            onClick={() => openEditVehicleDialog(vehicle)}
                                            type="button"
                                        >
                                            <div className="flex items-start justify-between gap-4">
                                                <div>
                                                    <p className="font-semibold text-soil">
                                                        {vehicle.label}
                                                    </p>
                                                    <p className="mt-1 text-sm text-bark/70">
                                                        {
                                                            fleetVehicleTypeOptions.find(
                                                                (option) =>
                                                                    option.value === vehicle.vehicleType,
                                                            )?.label
                                                        }{" "}
                                                        · {formatVehicleCapacity(vehicle.capacityKg)} kg
                                                    </p>
                                                </div>

                                                <span className="rounded-full border border-forest/10 bg-white/80 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-forest">
                                                    {
                                                        fleetVehicleStatusOptions.find(
                                                            (option) =>
                                                                option.value === vehicle.availabilityStatus,
                                                        )?.label
                                                    }
                                                </span>
                                            </div>

                                            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-bark/70">
                                                <span className="rounded-full border border-soil/10 bg-white/75 px-2.5 py-1">
                                                    {vehicle.refrigeration
                                                        ? "Refrigerado"
                                                        : "Carga seca"}
                                                </span>
                                                {vehicle.notes ? (
                                                    <span className="line-clamp-1">
                                                        {vehicle.notes}
                                                    </span>
                                                ) : null}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="mt-6 rounded-[18px] border border-soil/10 bg-cream-dark/35 px-4 py-4 text-sm leading-6 text-bark/75">
                                    Nenhum veiculo cadastrado ainda. Comece com a frota que realmente opera as saidas do dia.
                                </div>
                            )}
                        </section>

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

            <Dialog
                onOpenChange={handleVehicleDialogChange}
                open={isVehicleDialogOpen}
            >
                <DialogContent className="max-w-2xl border-soil/10 bg-cream p-0">
                    <DialogHeader className="border-b border-soil/10 px-6 py-5">
                        <DialogTitle className="font-display text-2xl font-black text-soil">
                            {vehicleForm.vehicleId
                                ? "Editar veiculo"
                                : "Cadastrar veiculo"}
                        </DialogTitle>
                        <DialogDescription className="text-sm leading-6 text-bark/70">
                            Mantenha aqui apenas os veiculos que participam da operacao real de saida.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 px-6 py-6 md:grid-cols-2">
                        <div className="space-y-1.5 md:col-span-2">
                            <label
                                className="font-sans text-[10px] font-bold uppercase tracking-[0.15em] text-bark"
                                htmlFor="fleet-vehicle-label"
                            >
                                Nome operacional
                            </label>
                            <input
                                className={baseInputClassName}
                                id="fleet-vehicle-label"
                                onChange={(event) =>
                                    handleVehicleFieldChange("label", event.target.value)
                                }
                                placeholder="Ex: Van refrigerada principal"
                                value={vehicleForm.label}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label
                                className="font-sans text-[10px] font-bold uppercase tracking-[0.15em] text-bark"
                                htmlFor="fleet-vehicle-type"
                            >
                                Tipo
                            </label>
                            <select
                                className={baseInputClassName}
                                id="fleet-vehicle-type"
                                onChange={(event) =>
                                    handleVehicleFieldChange(
                                        "vehicleType",
                                        event.target.value as FleetVehicleType,
                                    )
                                }
                                value={vehicleForm.vehicleType}
                            >
                                {fleetVehicleTypeOptions.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-1.5">
                            <label
                                className="font-sans text-[10px] font-bold uppercase tracking-[0.15em] text-bark"
                                htmlFor="fleet-vehicle-capacity"
                            >
                                Capacidade (kg)
                            </label>
                            <input
                                className={baseInputClassName}
                                id="fleet-vehicle-capacity"
                                inputMode="decimal"
                                min={0}
                                onChange={(event) =>
                                    handleVehicleFieldChange("capacityKg", event.target.value)
                                }
                                placeholder="Ex: 850"
                                step="0.01"
                                type="number"
                                value={vehicleForm.capacityKg}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label
                                className="font-sans text-[10px] font-bold uppercase tracking-[0.15em] text-bark"
                                htmlFor="fleet-vehicle-status"
                            >
                                Disponibilidade
                            </label>
                            <select
                                className={baseInputClassName}
                                id="fleet-vehicle-status"
                                onChange={(event) =>
                                    handleVehicleFieldChange(
                                        "availabilityStatus",
                                        event.target.value as FleetVehicleStatus,
                                    )
                                }
                                value={vehicleForm.availabilityStatus}
                            >
                                {fleetVehicleStatusOptions.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <label className="flex items-center gap-3 rounded-[18px] border border-soil/10 bg-cream-dark/35 px-4 py-3 text-sm text-soil">
                            <input
                                checked={vehicleForm.refrigeration}
                                className="h-4 w-4 rounded border-soil/30 text-forest focus:ring-forest"
                                onChange={(event) =>
                                    handleVehicleFieldChange(
                                        "refrigeration",
                                        event.target.checked,
                                    )
                                }
                                type="checkbox"
                            />
                            Usa refrigeracao para pereciveis
                        </label>

                        <div className="space-y-1.5 md:col-span-2">
                            <label
                                className="font-sans text-[10px] font-bold uppercase tracking-[0.15em] text-bark"
                                htmlFor="fleet-vehicle-notes"
                            >
                                Observacoes
                            </label>
                            <textarea
                                className={`${baseInputClassName} min-h-[110px] resize-y`}
                                id="fleet-vehicle-notes"
                                onChange={(event) =>
                                    handleVehicleFieldChange("notes", event.target.value)
                                }
                                placeholder="Ex: Sai cedo para entregas urbanas e volta para segunda carga."
                                value={vehicleForm.notes}
                            />
                        </div>
                    </div>

                    <DialogFooter className="border-t border-soil/10 px-6 py-5 sm:justify-between">
                        {vehicleForm.vehicleId ? (
                            <Button
                                isPending={deleteVehicleMutation.isPending}
                                onClick={handleVehicleDelete}
                                type="button"
                                variant="danger"
                            >
                                Remover veiculo
                            </Button>
                        ) : (
                            <div />
                        )}

                        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
                            <Button
                                onClick={() => handleVehicleDialogChange(false)}
                                type="button"
                                variant="ghost"
                            >
                                Cancelar
                            </Button>
                            <Button
                                isPending={upsertVehicleMutation.isPending}
                                onClick={handleVehicleSubmit}
                                type="button"
                            >
                                {vehicleForm.vehicleId
                                    ? "Salvar alteracoes"
                                    : "Cadastrar veiculo"}
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
