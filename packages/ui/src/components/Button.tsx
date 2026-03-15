import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { Loader2 } from "lucide-react"
import { cn } from "../lib/utils"

const buttonVariants = cva(
    // ── Base: editorial, precise, non-generic
    [
        "relative inline-flex min-h-[44px] min-w-[44px] items-center justify-center whitespace-nowrap",
        "font-sans font-semibold text-sm tracking-wide uppercase",
        "transition-[background-color,border-color,color,box-shadow,transform] duration-200 ease-out",
        "cursor-pointer select-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2 focus-visible:ring-offset-cream",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-40",
        "data-[loading=true]:cursor-wait",
        "active:scale-[0.99]",
    ].join(" "),
    {
        variants: {
            variant: {
                primary: [
                    "bg-forest text-white",
                    "border border-forest",
                    "hover:bg-forest-hover hover:border-forest-hover",
                    "hover:shadow-[0_18px_32px_-28px_rgba(13,51,33,0.65)]",
                ].join(" "),
                secondary: [
                    "bg-sage/60 text-forest",
                    "border border-forest/15",
                    "hover:bg-forest-light hover:border-forest/35",
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
                    "border border-forest/15",
                    "hover:bg-sage/45 hover:border-forest/35",
                ].join(" "),
                link: "h-auto min-h-0 min-w-0 w-auto text-forest underline-offset-4 hover:underline bg-transparent border-none p-0 normal-case tracking-normal",
            },
            size: {
                default: "h-11 px-6 py-3 rounded-sm",
                sm: "h-11 px-4 py-2 text-xs rounded-sm",
                lg: "h-13 px-8 py-4 text-base rounded-sm",
                icon: "h-11 w-11 rounded-sm p-0",
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
    isLoading?: boolean
    isPending?: boolean
    loadingIndicator?: React.ReactNode
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    (
        {
            className,
            variant,
            size,
            asChild = false,
            isLoading = false,
            isPending = false,
            loadingIndicator,
            disabled,
            children,
            onClick,
            tabIndex,
            ...props
        },
        ref
    ) => {
        const isBusy = isLoading || isPending
        const isDisabled = disabled || isBusy
        const classes = cn(
            buttonVariants({ variant, size, className }),
            asChild && disabled && "pointer-events-none opacity-40",
            asChild && isBusy && "pointer-events-none opacity-80"
        )

        if (asChild) {
            const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
                if (isDisabled) {
                    event.preventDefault()
                    event.stopPropagation()
                    return
                }

                onClick?.(event)
            }

            return (
                <Slot
                    className={classes}
                    ref={ref as React.Ref<HTMLElement>}
                    aria-busy={isBusy || undefined}
                    aria-disabled={isDisabled || undefined}
                    data-loading={isBusy ? "true" : undefined}
                    onClick={handleClick}
                    tabIndex={isDisabled ? -1 : tabIndex}
                    {...props}
                >
                    {children}
                </Slot>
            )
        }

        return (
            <button
                className={classes}
                ref={ref}
                disabled={isDisabled}
                aria-busy={isBusy || undefined}
                data-loading={isBusy ? "true" : undefined}
                onClick={onClick}
                tabIndex={tabIndex}
                {...props}
            >
                <span
                    className={cn(
                        "inline-flex items-center justify-center gap-2",
                        isBusy && "opacity-0"
                    )}
                >
                    {children}
                </span>
                {isBusy ? (
                    <span className="absolute inset-0 flex items-center justify-center">
                        {loadingIndicator ?? (
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        )}
                        <span className="sr-only">Carregando</span>
                    </span>
                ) : null}
            </button>
        )
    }
)
Button.displayName = "Button"

export { Button, buttonVariants }
