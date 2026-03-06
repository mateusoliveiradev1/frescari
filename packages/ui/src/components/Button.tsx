import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../lib/utils"

const buttonVariants = cva(
    // ── Base: editorial, precise, non-generic
    [
        "inline-flex items-center justify-center whitespace-nowrap",
        "font-sans font-semibold text-sm tracking-wide uppercase",
        "transition-all duration-200 ease-out",
        "cursor-pointer select-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2",
        "disabled:pointer-events-none disabled:opacity-40",
        "active:scale-[0.98]",
    ].join(" "),
    {
        variants: {
            variant: {
                primary: [
                    "bg-forest text-white",
                    "border border-forest",
                    "hover:bg-forest-hover hover:border-forest-hover",
                    "hover:shadow-[0_4px_20px_-4px_rgba(13,51,33,0.4)]",
                ].join(" "),
                secondary: [
                    "bg-sage text-forest",
                    "border border-forest/20",
                    "hover:bg-forest-light hover:border-forest/40",
                ].join(" "),
                lastChance: [
                    "bg-ember text-white",
                    "border border-ember",
                    "hover:bg-ember-hover hover:border-ember-hover",
                    "hover:shadow-ember-glow",
                    "animate-[pulse-ember_2.4s_ease-in-out_infinite]",
                ].join(" "),
                danger: [
                    "bg-destructive text-white",
                    "border border-destructive",
                    "hover:opacity-90",
                ].join(" "),
                ghost: [
                    "bg-transparent text-forest",
                    "border border-forest/25",
                    "hover:bg-sage hover:border-forest/50",
                ].join(" "),
                link: "text-forest underline-offset-4 hover:underline bg-transparent border-none p-0 normal-case tracking-normal",
            },
            size: {
                default: "h-11 px-6 py-3 rounded-sm",
                sm: "h-9 px-4 py-2 text-xs rounded-sm",
                lg: "h-13 px-8 py-4 text-base rounded-sm",
                icon: "h-10 w-10 rounded-sm",
            },
        },
        defaultVariants: {
            variant: "primary",
            size: "default",
        },
    }
)

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
    asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, size, asChild = false, ...props }, ref) => {
        const Comp = asChild ? Slot : "button"
        return (
            <Comp
                className={cn(buttonVariants({ variant, size, className }))}
                ref={ref}
                {...props}
            />
        )
    }
)
Button.displayName = "Button"

export { Button, buttonVariants }
