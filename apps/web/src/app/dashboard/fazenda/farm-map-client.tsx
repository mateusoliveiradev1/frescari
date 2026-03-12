"use client";

import { useEffect, useMemo } from "react";

import { cn } from "@frescari/ui";
import {
    MapContainer,
    Marker,
    TileLayer,
    useMap,
    useMapEvents,
} from "react-leaflet";
import {
    divIcon,
    type LeafletEventHandlerFnMap,
    type Marker as LeafletMarker,
} from "leaflet";

import {
    DEFAULT_FARM_COORDINATES,
    type FarmCoordinates,
    type FarmMapProps,
} from "./farm-map.types";

const DEFAULT_ZOOM = 5;
const FOCUSED_ZOOM = 14;

const farmPinIcon = divIcon({
    className: "farm-map-pin",
    iconSize: [28, 40],
    iconAnchor: [14, 40],
    popupAnchor: [0, -34],
    html: `
        <div style="position:relative;width:28px;height:40px;display:flex;align-items:flex-start;justify-content:center;">
            <span style="display:block;width:28px;height:28px;border-radius:9999px 9999px 9999px 0;background:#0d3321;transform:rotate(-45deg);box-shadow:0 12px 30px rgba(13,51,33,0.28);border:2px solid rgba(249,246,240,0.92);"></span>
            <span style="position:absolute;top:8px;left:50%;width:8px;height:8px;margin-left:-4px;border-radius:9999px;background:#f9f6f0;"></span>
        </div>
    `,
});

function roundCoordinates(coordinates: FarmCoordinates): FarmCoordinates {
    return {
        latitude: Number(coordinates.latitude.toFixed(6)),
        longitude: Number(coordinates.longitude.toFixed(6)),
    };
}

function isDefaultCoordinates(coordinates: FarmCoordinates) {
    return (
        coordinates.latitude === DEFAULT_FARM_COORDINATES.latitude &&
        coordinates.longitude === DEFAULT_FARM_COORDINATES.longitude
    );
}

function MapClickHandler({
    disabled,
    onChange,
}: {
    disabled: boolean;
    onChange: (coordinates: FarmCoordinates) => void;
}) {
    useMapEvents({
        click(event) {
            if (disabled) {
                return;
            }

            onChange(
                roundCoordinates({
                    latitude: event.latlng.lat,
                    longitude: event.latlng.lng,
                }),
            );
        },
    });

    return null;
}

function MapViewport({
    coordinates,
    zoom,
}: {
    coordinates: FarmCoordinates;
    zoom: number;
}) {
    const map = useMap();

    useEffect(() => {
        map.setView([coordinates.latitude, coordinates.longitude], zoom, {
            animate: true,
        });
    }, [coordinates.latitude, coordinates.longitude, map, zoom]);

    return null;
}

export function FarmMapClient({
    value,
    onChange,
    disabled = false,
    className,
}: FarmMapProps) {
    const coordinates = roundCoordinates(value);

    const zoomLevel = isDefaultCoordinates(coordinates)
        ? DEFAULT_ZOOM
        : FOCUSED_ZOOM;

    const markerEvents = useMemo<LeafletEventHandlerFnMap>(
        () =>
            disabled
                ? {}
                : {
                      dragend(event) {
                          const marker = event.target as LeafletMarker;
                          const latlng = marker.getLatLng();

                          onChange(
                              roundCoordinates({
                                  latitude: latlng.lat,
                                  longitude: latlng.lng,
                              }),
                          );
                      },
                  },
        [disabled, onChange],
    );

    return (
        <div
            className={cn(
                "overflow-hidden rounded-[24px_18px_22px_18px] border border-soil/10 bg-cream shadow-card",
                className,
            )}
        >
            <MapContainer
                center={[coordinates.latitude, coordinates.longitude]}
                zoom={zoomLevel}
                scrollWheelZoom={!disabled}
                className="h-[420px] w-full"
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <MapClickHandler disabled={disabled} onChange={onChange} />
                <MapViewport coordinates={coordinates} zoom={zoomLevel} />
                <Marker
                    draggable={!disabled}
                    eventHandlers={markerEvents}
                    icon={farmPinIcon}
                    position={[coordinates.latitude, coordinates.longitude]}
                />
            </MapContainer>
        </div>
    );
}
