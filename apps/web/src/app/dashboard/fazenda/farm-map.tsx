"use client";

import dynamic from "next/dynamic";

import type { FarmMapProps } from "./farm-map.types";

const FarmMapClient = dynamic<FarmMapProps>(
    () => import("./farm-map-client").then((mod) => mod.FarmMapClient),
    {
        ssr: false,
        loading: () => (
            <div className="flex h-[420px] w-full items-center justify-center rounded-[24px_18px_22px_18px] border border-soil/10 bg-cream-dark/40 px-6 text-center text-sm text-bark/70 shadow-card">
                Carregando mapa interativo...
            </div>
        ),
    },
);

export function FarmMap(props: FarmMapProps) {
    return <FarmMapClient {...props} />;
}
