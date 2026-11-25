"use client";

import { useEffect, useMemo, useRef } from "react";

import { cn } from "@frescari/ui";
import {
  MapContainer,
  Marker,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import {
  divIcon,
  type LeafletEventHandlerFnMap,
  type Marker as LeafletMarker,
} from "leaflet";

import { BRAZIL_BOUNDS, isWithinBrazil } from "@frescari/validators";

import {
  DEFAULT_FARM_COORDINATES,
  type FarmCoordinates,
  type FarmMapInteractionSource,
  type FarmMapProps,
} from "./farm-map.types";

const DEFAULT_ZOOM = 5;
const FOCUSED_ZOOM = 13;

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
  onLocationCommit,
  onRejectedLocation,
}: {
  disabled: boolean;
  onChange: (coordinates: FarmCoordinates) => void;
  onRejectedLocation?: (coordinates: FarmCoordinates) => void;
  onLocationCommit?: (
    coordinates: FarmCoordinates,
    source: FarmMapInteractionSource,
  ) => Promise<void> | void;
}) {
  useMapEvents({
    click(event) {
      if (disabled) {
        return;
      }

      const nextCoordinates = roundCoordinates({
        latitude: event.latlng.lat,
        longitude: event.latlng.lng,
      });

      if (!isWithinBrazil(nextCoordinates)) {
        onRejectedLocation?.(nextCoordinates);
        return;
      }

      onChange(nextCoordinates);
      void onLocationCommit?.(nextCoordinates, "click");
    },
  });

  return null;
}

// Leaflet measures its container once, at creation. When the container gets its
// final size later (dynamic import, layout shift, sidebar), Leaflet keeps the old
// size and converts clicks to the wrong coordinates, e.g. a click on Brazil lands
// in the Atlantic. Re-measure whenever the container is resized.
function MapSizeSync() {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    const frame = window.requestAnimationFrame(() => map.invalidateSize());

    if (typeof ResizeObserver === "undefined") {
      return () => window.cancelAnimationFrame(frame);
    }

    const observer = new ResizeObserver(() => {
      map.invalidateSize();
    });
    observer.observe(container);

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [map]);

  return null;
}

const BRAZIL_MAX_BOUNDS: [[number, number], [number, number]] = [
  [BRAZIL_BOUNDS.minLatitude - 2, BRAZIL_BOUNDS.minLongitude - 2],
  [BRAZIL_BOUNDS.maxLatitude + 2, BRAZIL_BOUNDS.maxLongitude + 2],
];

function MapViewport({
  coordinates,
  zoom,
}: {
  coordinates: FarmCoordinates;
  zoom: number;
}) {
  const map = useMap();
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      map.setView([coordinates.latitude, coordinates.longitude], zoom, {
        animate: false,
      });

      return;
    }

    map.flyTo([coordinates.latitude, coordinates.longitude], zoom, {
      animate: true,
      duration: 1.35,
    });
  }, [coordinates.latitude, coordinates.longitude, map, zoom]);

  return null;
}

export function FarmMapClient({
  value,
  onChange,
  onLocationCommit,
  onRejectedLocation,
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
              const nextCoordinates = roundCoordinates({
                latitude: latlng.lat,
                longitude: latlng.lng,
              });

              if (!isWithinBrazil(nextCoordinates)) {
                marker.setLatLng([coordinates.latitude, coordinates.longitude]);
                onRejectedLocation?.(nextCoordinates);
                return;
              }

              onChange(nextCoordinates);
              void onLocationCommit?.(nextCoordinates, "drag");
            },
          },
    [
      coordinates.latitude,
      coordinates.longitude,
      disabled,
      onChange,
      onLocationCommit,
      onRejectedLocation,
    ],
  );

  return (
    <div
      aria-describedby="farm-map-instructions"
      className={cn(
        "relative isolate z-0 overflow-hidden rounded-[24px_18px_22px_18px] border border-soil/10 bg-cream shadow-card",
        className,
      )}
    >
      <p className="sr-only" id="farm-map-instructions">
        Arraste o pino para o local exato da sua porteira ou produção. Também e
        possível clicar no mapa para reposicionar o ponto.
      </p>

      <div className="border-b border-soil/8 bg-white/75 px-4 py-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-bark/65">
          Ponto operacional
        </p>
        <p className="mt-1 text-sm leading-6 text-bark/75">
          Marque a porteira, o patio de carga ou o centro produtivo com
          precisão.
        </p>
      </div>

      <MapContainer
        center={[coordinates.latitude, coordinates.longitude]}
        zoom={zoomLevel}
        minZoom={4}
        maxBounds={BRAZIL_MAX_BOUNDS}
        maxBoundsViscosity={1}
        scrollWheelZoom={!disabled}
        className="relative z-0 h-[420px] w-full"
      >
        <MapSizeSync />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapClickHandler
          disabled={disabled}
          onChange={onChange}
          onLocationCommit={onLocationCommit}
          onRejectedLocation={onRejectedLocation}
        />
        <MapViewport coordinates={coordinates} zoom={zoomLevel} />
        <Marker
          draggable={!disabled}
          eventHandlers={markerEvents}
          icon={farmPinIcon}
          position={[coordinates.latitude, coordinates.longitude]}
        >
          <Tooltip
            className="farm-map-tooltip"
            direction="top"
            offset={[0, -18]}
            opacity={1}
            permanent
          >
            <span>
              Arraste-me para o local exato da sua porteira / produção
            </span>
          </Tooltip>
        </Marker>
      </MapContainer>

      <style jsx global>{`
        .farm-map-tooltip {
          background: transparent;
          border: none;
          box-shadow: none;
        }

        .farm-map-tooltip::before {
          display: none;
        }

        .farm-map-tooltip .leaflet-tooltip-content {
          max-width: 240px;
          border: 1px solid rgba(44, 32, 24, 0.08);
          border-radius: 18px;
          background: rgba(249, 246, 240, 0.98);
          color: #2c2018;
          padding: 10px 14px;
          text-align: center;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          line-height: 1.6;
          box-shadow: 0 22px 44px rgba(44, 32, 24, 0.12);
        }
      `}</style>
    </div>
  );
}
