import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../lib/utils"

const badgeVariants = cva(
    // ── Base: micro, pill-shaped, precise
    [
        "inline-flex items-center gap-1",
        "font-sans font-semibold text-[10px] uppercase tracking-widest",
        "transition-all duration-200 ease-out",
    ].join(" "),
    {
        variants: {
            variant: {
                default: [
                    // Fresco — sage pill with forest text
                    "px-2.5 py-1 rounded-full",
                    "bg-sage text-forest border border-forest/20",
                ].join(" "),
                secondary: [
                    "px-2.5 py-1 rounded-full",
                    "bg-cream-dark text-soil border border-soil/15",
                ].join(" "),
                organic: [
                    // Organic farm origin badge — outline
                    "px-2.5 py-1 rounded-full",
                    "bg-transparent text-forest border border-forest/40",
                    "hover:bg-sage",
                ].join(" "),
                LastChance: [
                    // Urgency — ember solid, pulsing
                    "px-3 py-1 rounded-[3px]",
                    "bg-ember text-white border border-ember",
                    "animate-[pulse-ember_1.8s_ease-in-out_infinite]",
                    "shadow-[0_2px_8px_-2px_rgba(232,76,30,0.5)]",
                ].join(" "),
                destructive: [
                    "px-2.5 py-1 rounded-full",
                    "bg-destructive text-white border border-destructive",
                ].join(" "),
                outline: [
                    "px-2.5 py-1 rounded-full",
                    "bg-transparent text-foreground border border-border",
                ].join(" "),
            },
        },
        defaultVariants: {
            variant: "default",
        },
    }
)

export interface BadgeProps
    extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> { }

function Badge({ className, variant, ...props }: BadgeProps) {
    return (
        <div className={cn(badgeVariants({ variant }), className)} {...props} />
    )
}

export { Badge, badgeVariants }
