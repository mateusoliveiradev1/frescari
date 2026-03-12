'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { trpc } from './react';
import { httpBatchLink } from '@trpc/client';
import superjson from 'superjson';
import { useState } from 'react';

const getTrpcUrl = () => {
    if (typeof window !== 'undefined') {
        return `${window.location.origin}/api/trpc`;
    }

    return 'http://localhost:3000/api/trpc';
};

export function TRPCProvider({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(() => new QueryClient({
        defaultOptions: {
            queries: {
                staleTime: 1000 * 60 * 5, // 5 minutes cache
            }
        }
    }));

    const [trpcClient] = useState(() =>
        trpc.createClient({
            links: [
                httpBatchLink({
                    url: getTrpcUrl(),
                    transformer: superjson,
                }),
            ],
        }),
    );

    return (
        <trpc.Provider client={trpcClient} queryClient={queryClient}>
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        </trpc.Provider>
    );
}
