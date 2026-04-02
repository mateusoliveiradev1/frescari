# ADR 007 — PostGIS para dados geoespaciais

**Status:** Aceito
**Data:** 2026-02

---

## Contexto

A Frescari precisa calcular a distância entre endereços de compradores e fazendas para determinar viabilidade e custo do frete. Precisávamos de uma solução que: (a) persistisse coordenadas geograficamente eficientes, (b) calculasse distâncias no banco sem round-trip ao servidor, (c) suportasse queries de raio (fazendas dentro de X km).

## Decisão

Usar **PostGIS** (extensão do PostgreSQL) para armazenar e consultar dados geoespaciais:

- `farms.location` — `geometry(POINT, 4326)` — localização da fazenda
- `addresses.location` — `geometry(POINT, 4326)` — localização do endereço do comprador
- Cálculo de distância: `ST_DistanceSphere(farm.location, address.location)` diretamente no SQL
- Geocodificação: `packages/api/src/geocoding.ts` via API Nominatim/OSM

## Alternativas consideradas

| Alternativa | Por que descartada |
|-------------|-------------------|
| Haversine na aplicação (lat/lng em colunas separadas) | Cálculo no servidor Python/TypeScript; sem capacidade de queries espaciais eficientes; mais lento |
| Google Maps API | Custo por request; lock-in com Google; dados de lat/lng podem ser obtidos gratuitamente via OSM |
| Mapbox Geocoding | Serviço pago; OSM/Nominatim é suficiente para o volume do MVP |
| Elasticsearch com geo_point | Infraestrutura separada desnecessária; PostgreSQL já suporta via PostGIS |

## Consequências

- `ST_DistanceSphere` calcula distância em metros usando coordenadas WGS84 (EPSG:4326)
- Geocodificação acontece uma única vez na criação do endereço/fazenda (não em cada pedido)
- `NOMINATIM_CONTACT_EMAIL` configurado como user-agent respeitoso para a API OSM
- `farm.maxDeliveryRadiusKm` limita raio máximo; pedidos fora do raio são bloqueados
- Custom Drizzle type `postgisPoint` encapsula a serialização/deserialização de `geometry(POINT, 4326)`
- Trade-off: PostGIS adiciona dependência de extensão ao banco; Neon PostgreSQL suporta nativamente
