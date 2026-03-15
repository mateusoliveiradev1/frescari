import { and, isNull, sql, type SQL } from 'drizzle-orm';

import { productLots } from './schema';

type ProductLotContextExecutor = {
    execute(query: ReturnType<typeof sql>): Promise<unknown>;
};

const PRODUCT_LOT_TENANT_SETTING = 'app.current_tenant';
const PRODUCT_LOT_BYPASS_SETTING = 'app.bypass_rls';
const PRODUCT_LOT_PUBLIC_READ_SETTING = 'app.allow_product_lot_public_read';

async function setLocalConfig(
    executor: ProductLotContextExecutor,
    key: string,
    value: string,
) {
    await executor.execute(sql`select set_config(${key}, ${value}, true)`);
}

export async function enableProductLotTenantContext(
    executor: ProductLotContextExecutor,
    tenantId: string,
) {
    await setLocalConfig(executor, PRODUCT_LOT_TENANT_SETTING, tenantId);
    await setLocalConfig(executor, PRODUCT_LOT_BYPASS_SETTING, 'off');
    await setLocalConfig(executor, PRODUCT_LOT_PUBLIC_READ_SETTING, 'off');
}

export async function enableProductLotPublicReadContext(
    executor: ProductLotContextExecutor,
) {
    await setLocalConfig(executor, PRODUCT_LOT_TENANT_SETTING, '');
    await setLocalConfig(executor, PRODUCT_LOT_BYPASS_SETTING, 'off');
    await setLocalConfig(executor, PRODUCT_LOT_PUBLIC_READ_SETTING, 'on');
}

export async function enableProductLotBypassContext(
    executor: ProductLotContextExecutor,
) {
    await setLocalConfig(executor, PRODUCT_LOT_TENANT_SETTING, '');
    await setLocalConfig(executor, PRODUCT_LOT_BYPASS_SETTING, 'on');
    await setLocalConfig(executor, PRODUCT_LOT_PUBLIC_READ_SETTING, 'off');
}

export function activeProductLotWhere(...conditions: Array<SQL | undefined>) {
    const filteredConditions = conditions.filter(
        (condition): condition is SQL => condition !== undefined,
    );

    return and(isNull(productLots.deletedAt), ...filteredConditions);
}
