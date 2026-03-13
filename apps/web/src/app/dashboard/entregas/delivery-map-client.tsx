"use client";

import { useEffect, useMemo } from "react";

import { cn } from "@frescari/ui";
import { divIcon, latLngBounds } from "leaflet";
import { MapContainer, Marker, TileLayer, Tooltip, useMap } from "react-leaflet";

import type { DeliveryMapProps, PendingDelivery } from "./delivery-map.types";

const DEFAULT_CENTER = {
    latitude: -23.55052,
    longitude: -46.633308,
};

const BASE_ZOOM = 11;
const SINGLE_POINT_ZOOM = 13;

type ValidOrigin = NonNullable<PendingDelivery["origin"]> & {
    latitude: number;
    longitude: number;
};

type ValidDestination = NonNullable<PendingDelivery["destination"]> & {
    latitude: number;
    longitude: number;
};

type DeliveryWithValidDestination = PendingDelivery & {
    destination: ValidDestination;
};

const originPinIcon = divIcon({
    className: "delivery-origin-pin",
    iconSize: [30, 42],
    iconAnchor: [15, 42],
    popupAnchor: [0, -34],
    html: `
        <div style="position:relative;width:30px;height:42px;display:flex;align-items:flex-start;justify-content:center;">
            <span style="display:block;width:30px;height:30px;border-radius:9999px 9999px 9999px 0;background:#0d3321;transform:rotate(-45deg);box-shadow:0 14px 30px rgba(13,51,33,0.28);border:2px solid rgba(249,246,240,0.94);"></span>
            <span style="position:absolute;top:8px;left:50%;width:10px;height:10px;margin-left:-5px;border-radius:9999px;background:#f9f6f0;"></span>
        </div>
    `,
});

function createDestinationPinIcon(isSelected: boolean) {
    return divIcon({
        className: "delivery-destination-pin",
        iconSize: [26, 38],
        iconAnchor: [13, 38],
        popupAnchor: [0, -32],
        html: `
            <div style="position:relative;width:26px;height:38px;display:flex;align-items:flex-start;justify-content:center;">
                <span style="display:block;width:26px;height:26px;border-radius:9999px 9999px 9999px 0;background:${isSelected ? "#e84c1e" : "#a65b3a"};transform:rotate(-45deg);box-shadow:${isSelected ? "0 14px 28px rgba(232,76,30,0.35)" : "0 12px 24px rgba(166,91,58,0.22)"};border:2px solid rgba(249,246,240,0.92);"></span>
                <span style="position:absolute;top:7px;left:50%;width:8px;height:8px;margin-left:-4px;border-radius:9999px;background:#fff7ef;"></span>
            </div>
        `,
    });
}

function formatDistance(distanceKm: number | null) {
    if (distanceKm === null) {
        return "distância indisponível";
    }

    return `${distanceKm.toFixed(2)} km`;
}

function isValidCoordinate(value: number | null | undefined): value is number {
    return typeof value === "number" && Number.isFinite(value);
}

function extractUniqueOrigins(deliveries: PendingDelivery[]) {
    const originsByFarm = new Map<string, ValidOrigin>();

    for (const delivery of deliveries) {
        const origin = delivery.origin;

        if (
            !origin?.farmId ||
            !isValidCoordinate(origin.latitude) ||
            !isValidCoordinate(origin.longitude)
        ) {
            continue;
        }

        originsByFarm.set(origin.farmId, {
            ...origin,
            latitude: origin.latitude,
            longitude: origin.longitude,
        });
    }

    return Array.from(originsByFarm.values());
}

function computeMapFocus(deliveries: PendingDelivery[], selectedOrderId: string | null) {
    const selectedDelivery = deliveries.find((delivery) => delivery.orderId === selectedOrderId);

    if (selectedDelivery) {
        const selectedPoints: Array<[number, number]> = [];
        const selectedOrigin = selectedDelivery.origin;
        const selectedDestination = selectedDelivery.destination;

        if (selectedOrigin && selectedOrigin.latitude !== null && selectedOrigin.longitude !== null) {
            selectedPoints.push([
                selectedOrigin.latitude,
                selectedOrigin.longitude,
            ]);
        }

        if (selectedDestination && selectedDestination.latitude !== null && selectedDestination.longitude !== null) {
            selectedPoints.push([
                selectedDestination.latitude,
                selectedDestination.longitude,
            ]);
        }

        if (selectedPoints.length > 0) {
            return selectedPoints;
        }
    }

    const allPoints: Array<[number, number]> = [];

    for (const delivery of deliveries) {
        const origin = delivery.origin;
        const destination = delivery.destination;

        if (origin && origin.latitude !== null && origin.longitude !== null) {
            allPoints.push([origin.latitude, origin.longitude]);
        }

        if (destination && destination.latitude !== null && destination.longitude !== null) {
            allPoints.push([destination.latitude, destination.longitude]);
        }
    }

    return allPoints;
}

function MapViewport({
    deliveries,
    selectedOrderId,
}: {
    deliveries: PendingDelivery[];
    selectedOrderId: string | null;
}) {
    const map = useMap();

    useEffect(() => {
        const focusPoints = computeMapFocus(deliveries, selectedOrderId);

        if (focusPoints.length === 0) {
            map.setView([DEFAULT_CENTER.latitude, DEFAULT_CENTER.longitude], BASE_ZOOM, {
                animate: true,
            });
            return;
        }

        if (focusPoints.length === 1) {
            map.setView(focusPoints[0], SINGLE_POINT_ZOOM, {
                animate: true,
            });
            return;
        }

        map.fitBounds(latLngBounds(focusPoints), {
            animate: true,
            maxZoom: 13,
            padding: [48, 48],
        });
    }, [deliveries, map, selectedOrderId]);

    return null;
}

export function DeliveryMapClient({
    deliveries,
    selectedOrderId,
    onSelect,
}: DeliveryMapProps) {
    const origins = useMemo(() => extractUniqueOrigins(deliveries), [deliveries]);
    const destinationMarkers = useMemo(
        () =>
            deliveries.filter(
                (delivery): delivery is DeliveryWithValidDestination =>
                    Boolean(
                        delivery.destination &&
                        isValidCoordinate(delivery.destination.latitude) &&
                        isValidCoordinate(delivery.destination.longitude),
                    ),
            ),
        [deliveries],
    );

    return (
        <div
            className={cn(
                "relative isolate z-0 overflow-hidden rounded-[28px_18px_24px_18px] border border-soil/10 bg-cream shadow-card",
            )}
        >
            <MapContainer
                center={[DEFAULT_CENTER.latitude, DEFAULT_CENTER.longitude]}
                zoom={BASE_ZOOM}
                scrollWheelZoom
                className="relative z-0 h-[640px] w-full"
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <MapViewport deliveries={deliveries} selectedOrderId={selectedOrderId} />

                {origins.map((origin) => (
                    <Marker
                        key={origin.farmId}
                        icon={originPinIcon}
                        position={[origin.latitude, origin.longitude]}
                    >
                        <Tooltip direction="top" offset={[0, -20]} opacity={1}>
                            <div className="space-y-1">
                                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-bark/65">
                                    Origem
                                </p>
                                <p className="font-semibold text-soil">{origin.farmName}</p>
                            </div>
                        </Tooltip>
                    </Marker>
                ))}

                {destinationMarkers.map((delivery) => {
                    const destination = delivery.destination;

                    if (!destination || !isValidCoordinate(destination.latitude) || !isValidCoordinate(destination.longitude)) {
                        return null;
                    }

                    const isSelected = delivery.orderId === selectedOrderId;

                    return (
                        <Marker
                            key={delivery.orderId}
                            eventHandlers={{
                                click: () => onSelect(delivery.orderId),
                            }}
                            icon={createDestinationPinIcon(isSelected)}
                            position={[destination.latitude, destination.longitude]}
                        >
                            <Tooltip direction="top" offset={[0, -18]} opacity={1}>
                                <div className="space-y-1">
                                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-bark/65">
                                        Destino
                                    </p>
                                    <p className="font-semibold text-soil">{delivery.buyerName}</p>
                                    <p className="text-xs text-bark/75">{formatDistance(delivery.distanceKm)}</p>
                                </div>
                            </Tooltip>
                        </Marker>
                    );
                })}
            </MapContainer>
        </div>
    );
}
