import type { FarmAddress } from '@frescari/db';
import { z } from 'zod';

const coordinateSchema = z.number().finite();

const geocodedPointSchema = z.object({
    latitude: coordinateSchema,
    longitude: coordinateSchema,
});

const geoJsonPointSchema = z.object({
    type: z.literal('Point'),
    coordinates: z.tuple([coordinateSchema, coordinateSchema]),
});

const farmAddressSuggestionSchema = z
    .object({
        street: z.string().trim().min(1).optional(),
        number: z.string().trim().min(1).optional(),
        neighborhood: z.string().trim().min(1).optional(),
        city: z.string().trim().min(1).optional(),
        state: z
            .string()
            .trim()
            .regex(/^[A-Z]{2}$/)
            .optional(),
        postalCode: z
            .string()
            .trim()
            .regex(/^\d{5}-?\d{3}$/)
            .optional(),
        country: z
            .string()
            .trim()
            .length(2)
            .optional(),
    })
    .strict();

const farmLocationSearchResultSchema = z.object({
    label: z.string().trim().min(1),
    latitude: coordinateSchema,
    longitude: coordinateSchema,
});

const reverseGeocodedFarmAddressSchema = z.object({
    label: z.string().trim().min(1),
    address: farmAddressSuggestionSchema,
});

export type DeliveryAddress = {
    street: string;
    number: string;
    cep: string;
    city: string;
    state: string;
};

export type GeocodedPoint = z.infer<typeof geocodedPointSchema>;
export type DeliveryPointGeoJson = z.infer<typeof geoJsonPointSchema>;
export type FarmAddressSuggestion = z.infer<typeof farmAddressSuggestionSchema>;
export type FarmLocationSearchResult = z.infer<typeof farmLocationSearchResultSchema>;
export type ReverseGeocodedFarmAddress = z.infer<typeof reverseGeocodedFarmAddressSchema>;

type NominatimSearchResult = {
    lat: string;
    lon: string;
    display_name?: string;
    address?: Record<string, string | undefined>;
};

type NominatimReverseResult = {
    display_name?: string;
    address?: Record<string, string | undefined>;
};

const NOMINATIM_SEARCH_URL =
    process.env.NOMINATIM_SEARCH_URL ?? 'https://nominatim.openstreetmap.org/search';
const NOMINATIM_REVERSE_URL =
    process.env.NOMINATIM_REVERSE_URL ?? 'https://nominatim.openstreetmap.org/reverse';
const NOMINATIM_CONTACT_EMAIL =
    process.env.NOMINATIM_CONTACT_EMAIL ?? 'contato@frescari.local';
const NOMINATIM_TIMEOUT_MS = 8000;

function normalizeCep(cep: string) {
    return cep.replace(/\D/g, '');
}

function extractGeocodedPoint(
    result: NominatimSearchResult | null | undefined,
): GeocodedPoint | null {
    if (!result) {
        return null;
    }

    const latitude = Number(result.lat);
    const longitude = Number(result.lon);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return null;
    }

    return {
        latitude,
        longitude,
    };
}

function formatPostalCode(postalCode: string | undefined) {
    const digits = normalizeCep(postalCode ?? '');

    if (digits.length !== 8) {
        return undefined;
    }

    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

function normalizeCity(address: Record<string, string | undefined>) {
    return (
        address.city ??
        address.town ??
        address.village ??
        address.municipality ??
        address.city_district ??
        address.county
    );
}

function normalizeStateCode(address: Record<string, string | undefined>) {
    const candidate = address['ISO3166-2-lvl4'] ?? address.state_code ?? address.state;

    if (!candidate) {
        return undefined;
    }

    const suffix = candidate.split('-').pop()?.trim().toUpperCase();

    if (!suffix || !/^[A-Z]{2}$/.test(suffix)) {
        return undefined;
    }

    return suffix;
}

function buildLocationLabel(
    label: string | undefined,
    address: Record<string, string | undefined> | undefined,
) {
    const normalizedLabel = label?.trim();

    if (normalizedLabel) {
        return normalizedLabel;
    }

    const city = address ? normalizeCity(address) : undefined;
    const state = address ? normalizeStateCode(address) : undefined;
    const postalCode = address ? formatPostalCode(address.postcode) : undefined;

    return [city, state, postalCode].filter(Boolean).join(' - ') || 'Local encontrado';
}

function mapNominatimAddressToSuggestion(
    address: Record<string, string | undefined> | undefined,
): FarmAddressSuggestion {
    if (!address) {
        return farmAddressSuggestionSchema.parse({});
    }

    const suggestion: Partial<FarmAddress> = {
        street: address.road ?? address.pedestrian ?? address.path ?? address.highway,
        number: address.house_number,
        neighborhood:
            address.suburb ??
            address.neighbourhood ??
            address.hamlet ??
            address.quarter,
        city: normalizeCity(address),
        state: normalizeStateCode(address),
        postalCode: formatPostalCode(address.postcode),
        country: address.country_code?.trim().toUpperCase(),
    };

    return farmAddressSuggestionSchema.parse(
        Object.fromEntries(
            Object.entries(suggestion).filter(([, value]) => typeof value === 'string' && value.trim().length > 0),
        ),
    );
}

async function requestNominatim<T>(url: string): Promise<T | null> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), NOMINATIM_TIMEOUT_MS);

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'User-Agent': `Frescari/1.0 (${NOMINATIM_CONTACT_EMAIL})`,
                'Accept-Language': 'pt-BR,pt;q=0.9',
            },
            signal: controller.signal,
        });

        if (!response.ok) {
            return null;
        }

        return (await response.json()) as T;
    } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
            return null;
        }

        throw error;
    } finally {
        clearTimeout(timeoutId);
    }
}

export function buildDeliveryAddressLine(address: DeliveryAddress) {
    return `${address.street}, ${address.number} - ${address.city}/${address.state.toUpperCase()} - CEP: ${address.cep}`;
}

export function serializeDeliveryPointMetadata(point: GeocodedPoint) {
    return JSON.stringify(geocodedPointSchema.parse(point));
}

export function parseDeliveryPointMetadata(value: string | null | undefined) {
    if (!value) {
        return null;
    }

    try {
        return geocodedPointSchema.parse(JSON.parse(value));
    } catch {
        return null;
    }
}

export function toDeliveryPointGeoJson(point: GeocodedPoint): DeliveryPointGeoJson {
    return geoJsonPointSchema.parse({
        type: 'Point',
        coordinates: [point.longitude, point.latitude],
    });
}

export async function geocodeDeliveryAddress(
    address: DeliveryAddress,
): Promise<GeocodedPoint | null> {
    const normalizedState = address.state.toUpperCase();
    const formattedPostalCode = formatPostalCode(address.cep) ?? address.cep;
    const baseSearchParams = {
        countrycodes: 'br',
        format: 'jsonv2',
        addressdetails: '1',
        limit: '1',
        email: NOMINATIM_CONTACT_EMAIL,
    } satisfies Record<string, string>;

    const searchStrategies = [
        new URLSearchParams({
            ...baseSearchParams,
            street: `${address.street}, ${address.number}`,
            city: address.city,
            state: normalizedState,
            postalcode: normalizeCep(address.cep),
            country: 'Brasil',
        }),
        new URLSearchParams({
            ...baseSearchParams,
            q: `${address.street}, ${address.number} - ${address.city}/${normalizedState} - CEP ${formattedPostalCode}, Brasil`,
        }),
        new URLSearchParams({
            ...baseSearchParams,
            q: `${address.street}, ${address.city}/${normalizedState}, Brasil`,
        }),
        new URLSearchParams({
            ...baseSearchParams,
            postalcode: normalizeCep(address.cep),
            country: 'Brasil',
        }),
        new URLSearchParams({
            ...baseSearchParams,
            q: `${address.city}/${normalizedState}, Brasil`,
        }),
    ];

    for (const params of searchStrategies) {
        const results = await requestNominatim<NominatimSearchResult[]>(
            `${NOMINATIM_SEARCH_URL}?${params.toString()}`,
        );
        const point = extractGeocodedPoint(results?.[0]);

        if (point) {
            return point;
        }
    }

    return null;
}

export async function geocodeFarmLocationQuery(
    query: string,
): Promise<FarmLocationSearchResult | null> {
    const normalizedQuery = query.trim();

    if (normalizedQuery.length < 2) {
        return null;
    }

    const params = new URLSearchParams({
        q: normalizedQuery,
        countrycodes: 'br',
        format: 'jsonv2',
        addressdetails: '1',
        limit: '1',
        email: NOMINATIM_CONTACT_EMAIL,
    });

    const results = await requestNominatim<NominatimSearchResult[]>(
        `${NOMINATIM_SEARCH_URL}?${params.toString()}`,
    );
    const firstResult = results?.[0];

    if (!firstResult) {
        return null;
    }

    const latitude = Number(firstResult.lat);
    const longitude = Number(firstResult.lon);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return null;
    }

    return farmLocationSearchResultSchema.parse({
        label: buildLocationLabel(firstResult.display_name, firstResult.address),
        latitude,
        longitude,
    });
}

export async function reverseGeocodeFarmLocation(
    coordinates: GeocodedPoint,
): Promise<ReverseGeocodedFarmAddress | null> {
    const params = new URLSearchParams({
        lat: String(coordinates.latitude),
        lon: String(coordinates.longitude),
        format: 'jsonv2',
        addressdetails: '1',
        zoom: '18',
        email: NOMINATIM_CONTACT_EMAIL,
    });

    const result = await requestNominatim<NominatimReverseResult>(
        `${NOMINATIM_REVERSE_URL}?${params.toString()}`,
    );

    if (!result?.display_name && !result?.address) {
        return null;
    }

    return reverseGeocodedFarmAddressSchema.parse({
        label: buildLocationLabel(result.display_name, result.address),
        address: mapNominatimAddressToSuggestion(result.address),
    });
}
