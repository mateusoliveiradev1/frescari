import * as React from "react"
import { cn } from "../lib/utils"
import { Badge } from "./Badge"
import { Button } from "./Button"

// ─────────────────────────────────────────────
// ProductCard — Frescari Design System
// Aesthetic: Organic Editorial Luxury
// ─────────────────────────────────────────────

export interface ProductCardProps extends React.HTMLAttributes<HTMLDivElement> {
    lotCode: string
    productName: string
    /** Price in BRL (number, not string) */
    finalPrice: number
    /** Original price shown as strikethrough on Last Chance items */
    priceOverride?: number | null
    availableQty: number
    isLastChance?: boolean
    onReserve?: () => void
}

export function ProductCard({
    lotCode,
    productName,
    finalPrice,
    priceOverride,
    availableQty,
    isLastChance = false,
    onReserve,
    className,
    ...props
}: ProductCardProps) {
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
            <div className="relative w-full aspect-[4/3] overflow-hidden bg-sage/50">
                {/* Image placeholder with label */}
                <div className="absolute inset-0 flex items-center justify-center">
                    <span className="font-sans text-xs text-soil/30 italic">
                        Imagem da colheita
                    </span>
                </div>

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
                    ) : isLastChance ? (
                        <Badge variant="LastChance">Última Chance</Badge>
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
                        availableQty <= 0
                            ? "bg-red-500 text-white"
                            : isLastChance
                                ? "bg-ember text-white"
                                : "bg-cream/90 text-bark backdrop-blur-sm border border-soil/10"
                    )}>
                        {availableQty} un.
                    </span>
                </div>
            </div>

            {/* ── Body ── */}
            <div className="flex flex-col flex-1 p-4 gap-3">
                {/* Lot code — micro label */}
                <p className="font-sans text-[9px] font-bold uppercase tracking-[0.15em] text-bark/70">
                    Lote {lotCode}
                </p>

                {/* Product name — display headline */}
                <h3 className={cn(
                    "font-display text-lg font-bold leading-tight",
                    "transition-colors duration-150",
                    isLastChance
                        ? "text-soil group-hover:text-ember"
                        : "text-soil group-hover:text-forest"
                )}>
                    {productName}
                </h3>

                {/* ── Price block ── */}
                <div className="mt-auto flex items-end justify-between">
                    <div className="flex flex-col gap-0.5">
                        {/* Strikethrough original price */}
                        {isLastChance && priceOverride != null && (
                            <span className="font-sans text-xs line-through text-bark/50 leading-none">
                                {Number(priceOverride).toLocaleString("pt-BR", {
                                    style: "currency",
                                    currency: "BRL",
                                })}
                            </span>
                        )}
                        {/* Final price */}
                        <span className={cn(
                            "font-display font-black text-2xl tracking-tight leading-none",
                            availableQty <= 0 ? "text-bark/50" : isLastChance ? "text-ember" : "text-forest"
                        )}>
                            {finalPrice.toLocaleString("pt-BR", {
                                style: "currency",
                                currency: "BRL",
                            })}
                            <span className="font-sans text-[10px] font-normal text-bark/60 ml-1">
                                / un
                            </span>
                        </span>
                    </div>
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
                    disabled={availableQty <= 0}
                >
                    {availableQty <= 0 ? "Esgotado" : isLastChance ? "Garantir Agora" : "Reservar Lote"}
                </Button>
            </div>
        </article>
    )
}
