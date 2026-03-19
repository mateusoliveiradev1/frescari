"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@frescari/ui";

interface ScrollRevealProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
    delay?: number;
}

export function ScrollReveal({ children, delay = 0, className, ...props }: ScrollRevealProps) {
    const [isVisible, setIsVisible] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (!entry) {
                    return;
                }

                if (entry.isIntersecting) {
                    setIsVisible(true);
                    observer.unobserve(entry.target);
                }
            },
            {
                threshold: 0.1,
                rootMargin: "50px",
            }
        );

        if (ref.current) {
            observer.observe(ref.current);
        }

        return () => observer.disconnect();
    }, []);

    return (
        <div
            ref={ref}
            className={cn(
                "transition-all duration-1000 ease-out",
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12",
                className
            )}
            style={{ transitionDelay: `${delay}ms` }}
            {...props}
        >
            {children}
        </div>
    );
}
