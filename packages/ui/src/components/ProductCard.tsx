"use client"

import * as React from "react"
import Image from "next/image"
import { cn } from "../lib/utils"
import { Badge } from "./Badge"
import { Button } from "./Button"

const UNIT_LABELS: Record<string, string> = {
    kg: "/kg",
    g: "/g",
    unit: "/un",
    box: "/cx",
    dozen: "/dz",
    bunch: "/maco",
}

function formatUnit(saleUnit: string): string {
    return UNIT_LABELS[saleUnit] ?? "/un"
}

function formatHarvestDate(dateStr: string): string {
    try {
        const date = new Date(`${dateStr}T00:00:00`)
        const day = String(date.getDate()).padStart(2, "0")
        const month = String(date.getMonth() + 1).padStart(2, "0")
        const year = date.getFullYear()

        return `Colhido ${day}/${month}/${year}`
    } catch {
        return ""
    }
}

export interface ProductCardProps extends React.HTMLAttributes<HTMLDivElement> {
    lotCode: string
    productName: string
    finalPrice: number
    originalPrice?: number
    priceOverride?: number | null
    availableQty: number
    status: "fresco" | "last_chance" | "vencido"
    isLastChance?: boolean
    saleUnit?: string
    unit?: string
    farmName?: string
    harvestDate?: string
    imageUrl?: string | null
    priority?: boolean
    onReserve?: () => void
    onOpenDetails?: () => void
}

export function ProductCard({
    lotCode,
    productName,
    finalPrice,
    originalPrice,
    priceOverride,
    availableQty,
    status = "fresco",
    isLastChance: _deprecatedIsLastChance,
    saleUnit = "unit",
    unit,
    farmName,
    harvestDate,
    imageUrl,
    onReserve,
    onOpenDetails,
    priority = false,
    className,
    ...props
}: ProductCardProps) {
    void _deprecatedIsLastChance

    const displayOriginal = originalPrice ?? (priceOverride != null ? Number(priceOverride) : undefined)
    const isLastChance = status === "last_chance"
    const isExpired = status === "vencido"
    const [hasImageError, setHasImageError] = React.useState(false)

    React.useEffect(() => {
        setHasImageError(false)
    }, [imageUrl])

    const displayImage = Boolean(imageUrl) && !hasImageError
    const stockUnit = unit || formatUnit(saleUnit).replace("/", "")
    const priceUnit = stockUnit
    const isUnavailable = availableQty <= 0 || isExpired

    return (
        <article
            className={cn(
                "group/product relative flex flex-col overflow-hidden rounded-[24px] border bg-white",
                "border-soil/10 shadow-[0_18px_38px_-32px_rgba(13,51,33,0.42)]",
                "transition-[transform,border-color,box-shadow,background-color] duration-200 ease-out",
                "hover:-translate-y-1 hover:border-forest/18 hover:shadow-[0_28px_48px_-34px_rgba(13,51,33,0.52)]",
                isLastChance && [
                    "border-ember/30",
                    "shadow-[0_18px_40px_-34px_rgba(232,76,30,0.42)]",
                    "hover:border-ember/45 hover:shadow-[0_32px_54px_-34px_rgba(232,76,30,0.4)]",
                ].join(" "),
                className,
            )}
            {...props}
        >
            <button
                aria-label={`Ver detalhes de ${productName}`}
                className="relative w-full overflow-hidden bg-sage/30 text-left aspect-[4/3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-inset"
                onClick={onOpenDetails}
                type="button"
            >
                {displayImage ? (
                    <Image
                        alt={productName}
                        className="object-cover transition-transform duration-300 group-hover/product:scale-[1.03]"
                        fill
                        onError={() => setHasImageError(true)}
                        priority={priority}
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        src={imageUrl as string}
                    />
                ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-sage/50 via-cream to-sage/25">
                        <svg
                            aria-hidden="true"
                            className="opacity-50"
                            fill="none"
                            height="40"
                            viewBox="0 0 64 64"
                            width="40"
                        >
                            <path
                                d="M32 8 C32 8 10 20 10 38 C10 52 20 58 32 58 C44 58 54 52 54 38 C54 20 32 8 32 8Z"
                                fill="#e8f0e3"
                                stroke="#0d3321"
                                strokeWidth="1.5"
                            />
                            <path
                                d="M32 58 C32 58 32 32 32 20"
                                stroke="#0d3321"
                                strokeLinecap="round"
                                strokeWidth="1.5"
                            />
                        </svg>
                        <span className="font-sans text-[10px] font-bold uppercase tracking-[0.18em] text-bark/58">
                            Imagem indisponivel
                        </span>
                    </div>
                )}

                {isLastChance ? (
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ember/12 via-transparent to-transparent" />
                ) : null}

                <div className="absolute left-3 top-3 z-10">
                    {availableQty <= 0 ? (
                        <div className="rounded-full border border-red-200 bg-red-50 px-2.5 py-1 font-sans text-[10px] font-bold uppercase tracking-[0.12em] text-red-700">
                            Esgotado
                        </div>
                    ) : isExpired ? (
                        <Badge className="border-red-200 bg-red-50 text-red-700" variant="destructive">
                            Fora da janela
                        </Badge>
                    ) : isLastChance ? (
                        <Badge variant="LastChance">Ultima safra</Badge>
                    ) : (
                        <Badge variant="default">Fresco do dia</Badge>
                    )}
                </div>

                <div className="absolute right-3 top-3 z-10">
                    <span
                        className={cn(
                            "rounded-full px-2.5 py-1 font-sans text-[10px] font-bold uppercase tracking-[0.12em]",
                            isUnavailable
                                ? "bg-red-500 text-white"
                                : isLastChance
                                  ? "border border-ember/20 bg-white/95 text-ember"
                                  : "border border-soil/10 bg-white/92 text-bark",
                        )}
                    >
                        {availableQty} {stockUnit}
                    </span>
                </div>
            </button>

            <div className="flex flex-1 flex-col gap-3 p-4">
                <div className="flex flex-wrap items-center gap-2">
                    {farmName ? (
                        <span className="font-sans text-[9px] font-bold uppercase tracking-[0.16em] text-forest/72">
                            {farmName}
                        </span>
                    ) : null}
                    {harvestDate ? (
                        <span className="font-sans text-[9px] font-medium uppercase tracking-[0.12em] text-bark/52">
                            {formatHarvestDate(harvestDate)}
                        </span>
                    ) : null}
                </div>

                <p
                    className="font-sans text-[9px] font-bold uppercase tracking-[0.16em] text-bark/48"
                    id={`lot-${lotCode}`}
                >
                    Lote {lotCode}
                </p>

                <button
                    className="min-h-[44px] min-w-[44px] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                    onClick={onOpenDetails}
                    type="button"
                >
                    <h3
                        className={cn(
                            "font-display text-[1.35rem] font-black leading-tight tracking-[-0.03em] transition-[color] duration-150",
                            isLastChance ? "text-soil group-hover/product:text-ember" : "text-soil group-hover/product:text-forest",
                        )}
                    >
                        {productName}
                    </h3>
                </button>

                <div className="mt-auto flex items-end justify-between gap-3 pt-1">
                    <div className="flex min-w-0 flex-col gap-1">
                        {isLastChance && displayOriginal != null && displayOriginal !== finalPrice ? (
                            <span className="font-sans text-xs leading-none text-bark/46 line-through">
                                {displayOriginal.toLocaleString("pt-BR", {
                                    style: "currency",
                                    currency: "BRL",
                                })}
                            </span>
                        ) : null}

                        <span
                            className={cn(
                                "font-display text-[1.75rem] font-black tracking-[-0.03em] leading-none",
                                isUnavailable ? "text-bark/50" : isLastChance ? "text-ember" : "text-forest",
                            )}
                        >
                            {finalPrice.toLocaleString("pt-BR", {
                                style: "currency",
                                currency: "BRL",
                            })}
                            <span className="ml-1 font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-bark/58">
                                /{priceUnit}
                            </span>
                        </span>
                    </div>

                    {isLastChance && displayOriginal !== finalPrice ? (
                        <span className="rounded-full border border-ember/20 bg-ember/10 px-2.5 py-1 font-sans text-[10px] font-bold uppercase tracking-[0.12em] text-ember">
                            Oferta final
                        </span>
                    ) : null}
                </div>
            </div>

            <div className="px-4 pb-4 pt-1">
                <Button
                    aria-label={`Reservar lote de ${productName}`}
                    className="w-full"
                    disabled={isUnavailable}
                    onClick={onReserve}
                    size="default"
                    variant={isLastChance ? "lastChance" : "primary"}
                >
                    {availableQty <= 0 ? "Esgotado" : isExpired ? "Janela encerrada" : isLastChance ? "Garantir lote" : "Reservar lote"}
                </Button>
            </div>
        </article>
    )
}
