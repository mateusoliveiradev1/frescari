type SupportedRole = 'producer' | 'buyer';
type TenantType = 'PRODUCER' | 'BUYER' | null | undefined;

const expectedTenantTypeByRole: Record<SupportedRole, Exclude<TenantType, null | undefined>> = {
    producer: 'PRODUCER',
    buyer: 'BUYER',
};

export function isTenantTypeCompatibleWithRole(role: SupportedRole, tenantType: TenantType): boolean {
    return tenantType === expectedTenantTypeByRole[role];
}

export function getTenantTypeMismatchMessage(role: SupportedRole, tenantType: TenantType): string {
    const roleLabel = role === 'producer' ? 'produtor' : 'comprador';
    const tenantLabel = tenantType ?? 'SEM_TIPO';

    return `Conta inconsistente: usuário ${roleLabel} vinculado a organização ${tenantLabel}.`;
}
