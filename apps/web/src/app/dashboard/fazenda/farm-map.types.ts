export type FarmCoordinates = {
    latitude: number;
    longitude: number;
};

export const DEFAULT_FARM_COORDINATES: FarmCoordinates = {
    latitude: -14.235004,
    longitude: -51.92528,
};

export type FarmMapInteractionSource = "click" | "drag";

export type FarmMapProps = {
    value: FarmCoordinates;
    onChange: (coordinates: FarmCoordinates) => void;
    onLocationCommit?: (
        coordinates: FarmCoordinates,
        source: FarmMapInteractionSource,
    ) => Promise<void> | void;
    disabled?: boolean;
    className?: string;
};
