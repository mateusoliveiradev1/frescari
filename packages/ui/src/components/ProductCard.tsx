import * as React from "react"
import Image from "next/image"
import { cn } from "../lib/utils"
import { Badge } from "./Badge"
import { Button } from "./Button"

// ─────────────────────────────────────────────
// ProductCard — Frescari Design System
// Aesthetic: Organic Editorial Luxury
// ─────────────────────────────────────────────

/** Maps saleUnit enum → human-readable suffix */
const UNIT_LABELS: Record<string, string> = {
    kg: "/kg",
    g: "/g",
    unit: "/un",
    box: "/cx",
    dozen: "/dz",
    bunch: "/mç",
}

function formatUnit(saleUnit: string): string {
    return UNIT_LABELS[saleUnit] ?? "/un"
}

function formatHarvestDate(dateStr: string): string {
    try {
        const d = new Date(dateStr + "T00:00:00")
        const day = String(d.getDate()).padStart(2, "0")
        const month = String(d.getMonth() + 1).padStart(2, "0")
        const year = d.getFullYear()
        return `Colhido ${day}/${month}/${year}`
    } catch {
        return ""
    }
}

export interface ProductCardProps extends React.HTMLAttributes<HTMLDivElement> {
    lotCode: string
    productName: string
    /** Discounted or final price in BRL */
    finalPrice: number
    /** Original price before discount (shown as strikethrough on Last Chance) */
    originalPrice?: number
    /** @deprecated — use originalPrice instead */
    priceOverride?: number | null
    availableQty: number
    /** Computed status from backend: fresco | last_chance | vencido */
    status: 'fresco' | 'last_chance' | 'vencido';
    /** @deprecated — price logic now uses 'status' */
    isLastChance?: boolean;
    /** Enum: kg | g | unit | box | dozen | bunch */
    saleUnit?: string;
    /** Dynamic unit string (e.g., 'kg', 'cx', 'un') */
    unit?: string;
    farmName?: string;
    harvestDate?: string;
    imageUrl?: string | null;
    onReserve?: () => void;
    onOpenDetails?: () => void;
}

export function ProductCard({
    lotCode,
    productName,
    finalPrice,
    originalPrice,
    priceOverride,
    availableQty,
    status = 'fresco',
    isLastChance: propsLastChance,
    saleUnit = "unit",
    unit,
    farmName,
    harvestDate,
    imageUrl,
    onReserve,
    onOpenDetails,
    className,
    ...props
}: ProductCardProps) {
    const displayOriginal = originalPrice ?? (priceOverride != null ? Number(priceOverride) : undefined)
    const isLastChance = status === 'last_chance';
    const isExpired = status === 'vencido';

    return (
        <article
            className={cn(
                // ── Card shell
                "group relative flex flex-col overflow-hidden",
                "bg-cream border rounded-sm cursor-pointer",
                "transition-all duration-200 ease-out will-change-transform",
                // ── Default state
                "border-soil/10 shadow-card",
                // ── Hover: subtle organic lift
                "hover:-translate-y-1 hover:shadow-card-hover",
                // ── Last Chance override — ember accent
                isLastChance && [
                    "border-ember/35",
                    "shadow-[0_2px_12px_-4px_rgba(232,76,30,0.18)]",
                    "hover:shadow-[0_14px_40px_-12px_rgba(232,76,30,0.28),0_4px_16px_-4px_rgba(13,51,33,0.1)]",
                    "hover:-translate-y-[5px]",
                ].join(" "),
                className
            )}
            {...props}
        >
            {/* ── Image area ── */}
            <button
                className="relative w-full aspect-[4/3] overflow-hidden bg-sage/50 text-left"
                onClick={onOpenDetails}
                type="button"
                aria-label={`Ver detalhes de ${productName}`}
            >
                {imageUrl ? (
                    <Image
                        src={imageUrl}
                        alt={productName}
                        fill
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        loading="lazy"
                    />
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <svg width="40" height="40" viewBox="0 0 64 64" fill="none" aria-hidden="true" className="opacity-30">
                            <path
                                d="M32 8 C32 8 10 20 10 38 C10 52 20 58 32 58 C44 58 54 52 54 38 C54 20 32 8 32 8Z"
                                fill="#e8f0e3" stroke="#0d3321" strokeWidth="1.5"
                            />
                            <path d="M32 58 C32 58 32 32 32 20" stroke="#0d3321" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                    </div>
                )}

                {/* Last Chance ember wash overlay */}
                {isLastChance && (
                    <div className="absolute inset-0 bg-gradient-to-t from-ember/12 via-transparent to-transparent pointer-events-none" />
                )}

                {/* ── Badge — top-left absolute ── */}
                <div className="absolute top-3 left-3 z-10">
                    {availableQty <= 0 ? (
                        <div className="px-2.5 py-1 rounded-[3px] bg-red-100 text-red-700 font-sans text-[10px] font-bold uppercase tracking-wider shadow-sm border border-red-200">
                            Esgotado
                        </div>
                    ) : isExpired ? (
                        <Badge variant="destructive" className="bg-red-50 text-red-600 border-red-100 font-bold tracking-tight">Vencido ⚠️</Badge>
                    ) : isLastChance ? (
                        <Badge variant="LastChance">Última Colheita 🔥</Badge>
                    ) : (
                        <Badge variant="default">
                            <span className="relative flex h-1.5 w-1.5 mr-0.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-forest/60 opacity-75" />
                                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-forest" />
                            </span>
                            Fresco
                        </Badge>
                    )}
                </div>

                {/* Stock counter — top right */}
                <div className="absolute top-3 right-3 z-10">
                    <span className={cn(
                        "font-sans text-[9px] font-bold uppercase tracking-wider",
                        "px-2 py-1 rounded-[2px]",
                        (availableQty <= 0 || isExpired)
                            ? "bg-red-500 text-white"
                            : isLastChance
                                ? "bg-ember text-white"
                                : "bg-cream/90 text-bark backdrop-blur-sm border border-soil/10"
                    )}>
                        {availableQty} {unit || formatUnit(saleUnit).replace("/", "")}
                    </span>
                </div>
            </button>

            {/* ── Body ── */}
            <div className="flex flex-col flex-1 p-4 gap-2">
                {/* Farm provenance + harvest date — micro labels */}
                <div className="flex items-center gap-2 flex-wrap">
                    {farmName && (
                        <span className="font-sans text-[9px] font-bold uppercase tracking-[0.15em] text-forest/70">
                            🌱 {farmName}
                        </span>
                    )}
                    {harvestDate && (
                        <span className="font-sans text-[9px] font-medium uppercase tracking-[0.1em] text-bark/50">
                            {formatHarvestDate(harvestDate)}
                        </span>
                    )}
                </div>

                {/* Lot code — micro label */}
                <p className="font-sans text-[9px] font-bold uppercase tracking-[0.15em] text-bark/50">
                    Lote {lotCode}
                </p>

                <button
                    className="text-left group/title"
                    onClick={onOpenDetails}
                    type="button"
                >
                    <h3 className={cn(
                        "font-display text-lg font-bold leading-tight",
                        "transition-colors duration-150",
                        isLastChance
                            ? "text-soil group-hover/title:text-ember"
                            : "text-soil group-hover/title:text-forest"
                    )}>
                        {productName}
                    </h3>
                </button>

                {/* ── Price block ── */}
                <div className="mt-auto flex items-end justify-between pt-2">
                    <div className="flex flex-col gap-0.5">
                        {/* Strikethrough original price */}
                        {isLastChance && displayOriginal != null && displayOriginal !== finalPrice && (
                            <span className="font-sans text-xs line-through text-bark/50 leading-none">
                                {displayOriginal.toLocaleString("pt-BR", {
                                    style: "currency",
                                    currency: "BRL",
                                })}
                            </span>
                        )}
                        {/* Final price */}
                        <span className={cn(
                            "font-display font-black text-2xl tracking-tight leading-none",
                            (availableQty <= 0 || isExpired) ? "text-bark/50" : isLastChance ? "text-ember" : "text-forest"
                        )}>
                            {finalPrice.toLocaleString("pt-BR", {
                                style: "currency",
                                currency: "BRL",
                            })}
                            <span className="font-sans text-[10px] font-normal text-bark/60 ml-1">
                                /{unit || saleUnit}
                            </span>
                        </span>
                    </div>

                    {/* Freshness / discount indicator for Last Chance */}
                    {isLastChance && (
                        <span className="font-sans text-[9px] font-bold text-ember bg-ember/10 px-2 py-0.5 rounded-sm">
                            -40%
                        </span>
                    )}
                </div>
            </div>

            {/* ── CTA ── */}
            <div className="px-4 pb-4">
                <Button
                    variant={isLastChance ? "lastChance" : "primary"}
                    size="default"
                    className="w-full"
                    onClick={onReserve}
                    aria-label={`Reservar lote de ${productName}`}
                    disabled={availableQty <= 0 || isExpired}
                >
                    {availableQty <= 0 ? "Esgotado" : isExpired ? "Vencido" : isLastChance ? "Garantir Agora" : "Reservar Lote"}
                </Button>
            </div>
        </article>
    )
}
