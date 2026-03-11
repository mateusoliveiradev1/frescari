'use client';

import { toast } from 'sonner';
import { trpc } from '@/trpc/react';
import { Loader2 } from 'lucide-react';
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

    // @ts-expect-error local monorepo trpc generics limit
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
        <button
            onClick={() => connectStripe({})}
            disabled={isLoading}
            className="inline-flex items-center justify-center rounded-md bg-[#635BFF] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#635BFF]/90 focus:outline-none focus:ring-2 focus:ring-[#635BFF] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
        >
            {isLoading ? (
                <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Conectando...
                </>
            ) : (
                'Conectar com Stripe'
            )}
        </button>
    );
}
