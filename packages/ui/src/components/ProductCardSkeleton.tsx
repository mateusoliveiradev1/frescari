import * as React from "react"
import { cn } from "../lib/utils"

// Matches new ProductCard proportions
const Shimmer = ({
    className,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
    <div
        className={cn(
            "animate-pulse bg-gradient-to-r from-sage/60 via-cream-dark to-sage/60 bg-[length:200%_100%]",
            className
        )}
        {...props}
    />
)

export interface ProductCardSkeletonProps
    extends React.HTMLAttributes<HTMLDivElement> {
    isLastChance?: boolean
}

export function ProductCardSkeleton({
    className,
    isLastChance = false,
    ...props
}: ProductCardSkeletonProps) {
    return (
        <div
            className={cn(
                "relative flex flex-col overflow-hidden rounded-sm bg-cream",
                "border shadow-card",
                isLastChance ? "border-ember/25" : "border-soil/10",
                className
            )}
            aria-hidden="true"
            {...props}
        >
            {/* Image placeholder */}
            <div className="relative w-full aspect-[4/3] bg-sage/40 overflow-hidden">
                <Shimmer className="w-full h-full" />
                {/* Badge placeholder */}
                <div className="absolute top-3 left-3">
                    <Shimmer className="h-5 w-24 rounded-full" />
                </div>
                {/* Stock placeholder */}
                <div className="absolute top-3 right-3">
                    <Shimmer className="h-5 w-12 rounded-[2px]" />
                </div>
            </div>

            {/* Body */}
            <div className="flex flex-col flex-1 p-4 gap-2">
                {/* Farm name + harvest date */}
                <div className="flex items-center gap-2">
                    <Shimmer className="h-3 w-24 rounded-[2px]" />
                    <Shimmer className="h-3 w-16 rounded-[2px]" />
                </div>
                {/* Lot code */}
                <Shimmer className="h-3 w-14 rounded-[2px]" />
                {/* Product name */}
                <div className="space-y-1.5">
                    <Shimmer className="h-5 w-4/5 rounded-[2px]" />
                    <Shimmer className="h-5 w-3/5 rounded-[2px]" />
                </div>
                {/* Price */}
                <div className="mt-auto pt-2 flex items-end justify-between">
                    <Shimmer className="h-7 w-28 rounded-[2px]" />
                    {isLastChance && <Shimmer className="h-5 w-10 rounded-sm" />}
                </div>
            </div>

            {/* CTA */}
            <div className="px-4 pb-4">
                <Shimmer className="h-11 w-full rounded-sm" />
            </div>
        </div>
    )
}
