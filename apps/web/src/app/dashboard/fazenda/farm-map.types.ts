export type FarmCoordinates = {
    latitude: number;
    longitude: number;
};

export const DEFAULT_FARM_COORDINATES: FarmCoordinates = {
    latitude: -14.235004,
    longitude: -51.92528,
};

export type FarmMapProps = {
    value: FarmCoordinates;
    onChange: (coordinates: FarmCoordinates) => void;
    disabled?: boolean;
    className?: string;
};
