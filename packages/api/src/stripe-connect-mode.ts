export type StripeConnectMode = 'connect' | 'platform_only';

export function getStripeConnectMode(): StripeConnectMode {
    return process.env.STRIPE_CONNECT_MODE?.trim().toLowerCase() === 'platform_only'
        ? 'platform_only'
        : 'connect';
}

export function isPlatformOnlyStripeMode() {
    return getStripeConnectMode() === 'platform_only';
}

export function getStripeConnectOnboardingDisabledMessage() {
    return 'Este ambiente Stripe esta configurado para checkout sem Connect. Habilite o Connect na conta da plataforma e remova STRIPE_CONNECT_MODE=platform_only para onboarding de produtores.';
}
