'use client';

import { Button } from '@frescari/ui';
import { toast } from 'sonner';
import { trpc } from '@/trpc/react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * Stripe Connect Button
 * Allows a Producer tenant to start the Stripe Express onboarding flow.
 * Adheres to "React UI Patterns" with proper loading/error states.
 */
export function StripeConnectButton() {
    const router = useRouter();
    const [isRedirecting, setIsRedirecting] = useState(false);

    const { mutate: connectStripe, isPending } = trpc.stripe.createStripeConnect.useMutation({
        onSuccess: (data: { url: string }) => {
            setIsRedirecting(true);
            router.push(data.url);
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onError: (error: any) => {
            console.error('[STRIPE_CONNECT_ERROR]:', error);
            setIsRedirecting(false);
            toast.error('Erro ao conectar', {
                description:
                    error.message || 'Não foi possível iniciar a conexão com o Stripe. Tente novamente.',
            });
        },
    });

    const isLoading = isPending || isRedirecting;

    return (
        <Button
            className="bg-[#635BFF] text-white hover:bg-[#635BFF]/90 focus-visible:ring-[#635BFF] normal-case tracking-normal"
            isLoading={isLoading}
            onClick={() => connectStripe({})}
            type="button"
        >
            Conectar com Stripe
        </Button>
    );
}
