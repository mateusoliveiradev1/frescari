import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../lib/utils"

const skeletonVariants = cva("animate-pulse bg-muted", {
    variants: {
        shape: {
            rounded: "rounded-md",
            pill: "rounded-full",
            square: "rounded-none",
        },
        tone: {
            default: "",
            subtle: "bg-muted/70",
        },
    },
    defaultVariants: {
        shape: "rounded",
        tone: "default",
    },
})

export interface SkeletonProps
    extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof skeletonVariants> {}

function Skeleton({ className, shape, tone, ...props }: SkeletonProps) {
    return (
        <div
            aria-hidden="true"
            className={cn(skeletonVariants({ shape, tone }), className)}
            {...props}
        />
    )
}

const skeletonAvatarVariants = cva("shrink-0 rounded-full", {
    variants: {
        size: {
            sm: "h-10 w-10",
            md: "h-11 w-11",
            lg: "h-14 w-14",
        },
    },
    defaultVariants: {
        size: "md",
    },
})

export interface SkeletonAvatarProps
    extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof skeletonAvatarVariants> {}

function SkeletonAvatar({
    className,
    size,
    ...props
}: SkeletonAvatarProps) {
    return (
        <Skeleton
            shape="pill"
            className={cn(skeletonAvatarVariants({ size }), className)}
            {...props}
        />
    )
}

export interface SkeletonTextProps
    extends React.HTMLAttributes<HTMLDivElement> {
    lines?: number
    lineClassName?: string
}

function SkeletonText({
    className,
    lines = 3,
    lineClassName,
    ...props
}: SkeletonTextProps) {
    return (
        <div className={cn("space-y-2", className)} {...props}>
            {Array.from({ length: lines }).map((_, index) => (
                <Skeleton
                    key={index}
                    className={cn(
                        "h-4 w-full",
                        index === lines - 1 && lines > 1 && "w-3/4",
                        lineClassName
                    )}
                />
            ))}
        </div>
    )
}

export interface SkeletonCardProps
    extends React.HTMLAttributes<HTMLDivElement> {
    showAvatar?: boolean
}

function SkeletonCard({
    className,
    showAvatar = true,
    ...props
}: SkeletonCardProps) {
    return (
        <div
            aria-hidden="true"
            className={cn(
                "overflow-hidden rounded-lg border border-border/40 bg-card p-4",
                className
            )}
            {...props}
        >
            <Skeleton className="mb-4 h-40 w-full" />
            <div className="space-y-4">
                <div className="flex items-center gap-3">
                    {showAvatar ? <SkeletonAvatar size="sm" /> : null}
                    <div className="flex-1">
                        <SkeletonText lines={2} />
                    </div>
                </div>
                <div className="space-y-2">
                    <Skeleton className="h-4 w-5/6" />
                    <Skeleton className="h-4 w-2/3" />
                </div>
                <div className="flex items-center justify-between pt-2">
                    <Skeleton className="h-5 w-20" />
                    <Skeleton className="h-10 w-28" />
                </div>
            </div>
        </div>
    )
}

export {
    Skeleton,
    SkeletonText,
    SkeletonAvatar,
    SkeletonCard,
    skeletonVariants,
}
