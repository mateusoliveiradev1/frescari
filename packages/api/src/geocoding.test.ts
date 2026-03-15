import assert from 'node:assert/strict';
import test from 'node:test';

import { geocodeDeliveryAddress } from './geocoding';

test('geocodeDeliveryAddress falls back to textual search when structured search has no result', async () => {
    const originalFetch = globalThis.fetch;
    const requestedUrls: string[] = [];
    let attempt = 0;

    globalThis.fetch = (async (input: string | URL | Request) => {
        const url =
            typeof input === 'string'
                ? input
                : input instanceof URL
                  ? input.toString()
                  : input.url;

        requestedUrls.push(url);

        const body =
            attempt++ === 0
                ? []
                : [
                      {
                          lat: '-23.561684',
                          lon: '-46.656139',
                      },
                  ];

        return new Response(JSON.stringify(body), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }) as typeof fetch;

    try {
        const point = await geocodeDeliveryAddress({
            street: 'Avenida Paulista',
            number: '1000',
            cep: '01310-100',
            city: 'Sao Paulo',
            state: 'SP',
        });

        assert.deepEqual(point, {
            latitude: -23.561684,
            longitude: -46.656139,
        });
        assert.equal(requestedUrls.length, 2);

        const firstRequest = new URL(requestedUrls[0] ?? '');
        const secondRequest = new URL(requestedUrls[1] ?? '');

        assert.equal(firstRequest.searchParams.get('street'), 'Avenida Paulista, 1000');
        assert.match(secondRequest.searchParams.get('q') ?? '', /Avenida Paulista, 1000/);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test('geocodeDeliveryAddress falls back to zipcode and then city center when street lookups fail', async () => {
    const originalFetch = globalThis.fetch;
    const requestedUrls: string[] = [];
    let attempt = 0;

    globalThis.fetch = (async (input: string | URL | Request) => {
        const url =
            typeof input === 'string'
                ? input
                : input instanceof URL
                  ? input.toString()
                  : input.url;

        requestedUrls.push(url);

        const body =
            attempt++ < 4
                ? []
                : [
                      {
                          lat: '-21.091234',
                          lon: '-48.660321',
                      },
                  ];

        return new Response(JSON.stringify(body), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }) as typeof fetch;

    try {
        const point = await geocodeDeliveryAddress({
            street: 'Rua Projetada 7',
            number: '45',
            cep: '15820-000',
            city: 'Pirangi',
            state: 'SP',
        });

        assert.deepEqual(point, {
            latitude: -21.091234,
            longitude: -48.660321,
        });
        assert.equal(requestedUrls.length, 5);

        const zipcodeRequest = new URL(requestedUrls[3] ?? '');
        const cityFallbackRequest = new URL(requestedUrls[4] ?? '');

        assert.equal(zipcodeRequest.searchParams.get('postalcode'), '15820000');
        assert.equal(cityFallbackRequest.searchParams.get('q'), 'Pirangi/SP, Brasil');
    } finally {
        globalThis.fetch = originalFetch;
    }
});
