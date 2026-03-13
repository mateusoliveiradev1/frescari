"use client";

import dynamic from "next/dynamic";

import type { DeliveryMapProps } from "./delivery-map.types";

const DeliveryMapClient = dynamic<DeliveryMapProps>(
    () => import("./delivery-map-client").then((mod) => mod.DeliveryMapClient),
    {
        ssr: false,
        loading: () => (
            <div className="flex h-[640px] w-full items-center justify-center rounded-[28px_18px_24px_18px] border border-soil/10 bg-cream-dark/40 px-6 text-center text-sm text-bark/70 shadow-card">
                Carregando mapa de entregas...
            </div>
        ),
    },
);

export function DeliveryMap(props: DeliveryMapProps) {
    return <DeliveryMapClient {...props} />;
}
