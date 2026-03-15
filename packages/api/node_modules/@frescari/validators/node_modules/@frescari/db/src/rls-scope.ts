import { sql } from 'drizzle-orm';

type RlsContextExecutor = {
    execute(query: ReturnType<typeof sql>): Promise<unknown>;
};

const CURRENT_TENANT_SETTING = 'app.current_tenant';
const CURRENT_USER_SETTING = 'app.current_user';
const BYPASS_RLS_SETTING = 'app.bypass_rls';
const CATALOG_PUBLIC_READ_SETTING = 'app.allow_catalog_public_read';
const PRODUCT_LOT_PUBLIC_READ_SETTING = 'app.allow_product_lot_public_read';

type RlsContextInput = {
    allowCatalogPublicRead?: boolean;
    bypass?: boolean;
    tenantId?: string | null;
    userId?: string | null;
};

async function setLocalConfig(
    executor: RlsContextExecutor,
    key: string,
    value: string,
) {
    await executor.execute(sql`select set_config(${key}, ${value}, true)`);
}

async function setRlsContext(
    executor: RlsContextExecutor,
    input: RlsContextInput,
) {
    const allowCatalogPublicRead = input.allowCatalogPublicRead ?? false;
    const bypass = input.bypass ?? false;

    await setLocalConfig(executor, CURRENT_TENANT_SETTING, input.tenantId ?? '');
    await setLocalConfig(executor, CURRENT_USER_SETTING, input.userId ?? '');
    await setLocalConfig(executor, BYPASS_RLS_SETTING, bypass ? 'on' : 'off');
    await setLocalConfig(
        executor,
        CATALOG_PUBLIC_READ_SETTING,
        allowCatalogPublicRead ? 'on' : 'off',
    );
    await setLocalConfig(
        executor,
        PRODUCT_LOT_PUBLIC_READ_SETTING,
        allowCatalogPublicRead ? 'on' : 'off',
    );
}

export async function enableAuthenticatedRlsContext(
    executor: RlsContextExecutor,
    input: {
        tenantId?: string | null;
        userId: string;
    },
) {
    await setRlsContext(executor, {
        tenantId: input.tenantId ?? '',
        userId: input.userId,
    });
}

export async function enableTenantRlsContext(
    executor: RlsContextExecutor,
    tenantId: string,
) {
    await setRlsContext(executor, {
        tenantId,
    });
}

export async function enableTenantCatalogReadContext(
    executor: RlsContextExecutor,
    input: {
        tenantId?: string | null;
        userId?: string | null;
    },
) {
    await setRlsContext(executor, {
        allowCatalogPublicRead: true,
        tenantId: input.tenantId ?? '',
        userId: input.userId ?? '',
    });
}

export async function enableCatalogPublicReadContext(
    executor: RlsContextExecutor,
) {
    await setRlsContext(executor, {
        allowCatalogPublicRead: true,
    });
}

export async function enableRlsBypassContext(
    executor: RlsContextExecutor,
) {
    await setRlsContext(executor, {
        bypass: true,
    });
}
