import { and, isNull, type SQL } from 'drizzle-orm';

import { productLots } from './schema';
import {
    enableCatalogPublicReadContext,
    enableRlsBypassContext,
    enableTenantRlsContext,
} from './rls-scope';

type ProductLotContextExecutor = Parameters<
    typeof enableCatalogPublicReadContext
>[0];

export async function enableProductLotTenantContext(
    executor: ProductLotContextExecutor,
    tenantId: string,
) {
    await enableTenantRlsContext(executor, tenantId);
}

export async function enableProductLotPublicReadContext(
    executor: ProductLotContextExecutor,
) {
    await enableCatalogPublicReadContext(executor);
}

export async function enableProductLotBypassContext(
    executor: ProductLotContextExecutor,
) {
    await enableRlsBypassContext(executor);
}

export function activeProductLotWhere(...conditions: Array<SQL | undefined>) {
    const filteredConditions = conditions.filter(
        (condition): condition is SQL => condition !== undefined,
    );

    return and(isNull(productLots.deletedAt), ...filteredConditions);
}
