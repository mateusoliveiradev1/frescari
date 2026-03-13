import test from 'node:test';
import assert from 'node:assert/strict';

import {
    buildDeliveryAddressLine,
    geocodeDeliveryAddress,
    parseDeliveryPointMetadata,
    serializeDeliveryPointMetadata,
    toDeliveryPointGeoJson,
} from './geocoding';

test('delivery point metadata round-trips into GeoJSON', () => {
    const metadataValue = serializeDeliveryPointMetadata({
        latitude: -21.1767,
        longitude: -47.8103,
    });

    assert.equal(
        buildDeliveryAddressLine({
            street: 'Rua Marechal Deodoro da Fonseca',
            number: '923',
            cep: '15820-031',
            city: 'Pirangi',
            state: 'sp',
        }),
        'Rua Marechal Deodoro da Fonseca, 923 - Pirangi/SP - CEP: 15820-031',
    );

    assert.deepEqual(parseDeliveryPointMetadata(metadataValue), {
        latitude: -21.1767,
        longitude: -47.8103,
    });
    assert.equal(parseDeliveryPointMetadata('{"latitude":"x"}'), null);
    assert.deepEqual(
        toDeliveryPointGeoJson({
            latitude: -21.1767,
            longitude: -47.8103,
        }),
        {
            type: 'Point',
            coordinates: [-47.8103, -21.1767],
        },
    );
});

test('geocodeDeliveryAddress requests Nominatim and returns the first valid point', async () => {
    const originalFetch = globalThis.fetch;
    let requestedUrl = '';
    let requestedHeaders: HeadersInit | undefined;

    globalThis.fetch = (async (input, init) => {
        requestedUrl = String(input);
        requestedHeaders = init?.headers;

        return {
            ok: true,
            json: async () => [{ lat: '-21.1767', lon: '-47.8103' }],
        } as Response;
    }) as typeof fetch;

    try {
        const result = await geocodeDeliveryAddress({
            street: 'Rua Marechal Deodoro da Fonseca',
            number: '923',
            cep: '15820-031',
            city: 'Pirangi',
            state: 'sp',
        });

        assert.deepEqual(result, {
            latitude: -21.1767,
            longitude: -47.8103,
        });
        assert.match(requestedUrl, /countrycodes=br/);
        assert.match(requestedUrl, /postalcode=15820031/);
        assert.match(requestedUrl, /street=923\+Rua\+Marechal\+Deodoro\+da\+Fonseca/);
        assert.ok(requestedHeaders);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test('geocodeDeliveryAddress returns null when Nominatim has no match', async () => {
    const originalFetch = globalThis.fetch;

    globalThis.fetch = (async () =>
        ({
            ok: true,
            json: async () => [],
        }) as Response) as typeof fetch;

    try {
        const result = await geocodeDeliveryAddress({
            street: 'Endereco inexistente',
            number: '0',
            cep: '00000-000',
            city: 'Cidade Fantasma',
            state: 'SP',
        });

        assert.equal(result, null);
    } finally {
        globalThis.fetch = originalFetch;
    }
});
