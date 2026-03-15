"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LockKeyhole, ShoppingCart } from "lucide-react";
import { Button } from "@frescari/ui";

import { getBuyerAccessState, type BuyerAccessState } from "@/lib/buyer-access";

export function CatalogReserveNotice() {
    const [accessState, setAccessState] = useState<BuyerAccessState>("error");
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        let cancelled = false;

        const loadAccessState = async () => {
            const nextState = await getBuyerAccessState();

            if (!cancelled) {
                setAccessState(nextState);
                setIsLoaded(true);
            }
        };

        void loadAccessState();

        return () => {
            cancelled = true;
        };
    }, []);

    if (!isLoaded || accessState === "buyer") {
        return null;
    }

    const isGuest = accessState === "guest";
    const isError = accessState === "error";

    return (
        <div className="surface-panel rounded-[28px] px-5 py-5 sm:px-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-forest text-cream shadow-[0_18px_30px_-24px_rgba(13,51,33,0.5)]">
                        {isGuest ? <ShoppingCart className="h-5 w-5" /> : <LockKeyhole className="h-5 w-5" />}
                    </div>
                    <div className="space-y-2">
                        <p className="field-label">Reserva protegida</p>
                        <p className="font-display text-2xl font-black tracking-[-0.04em] text-soil">
                            {isGuest
                                ? "Entre para reservar os lotes"
                                : isError
                                    ? "Nao foi possivel validar sua sessao"
                                    : "Sua conta atual nao compra no marketplace"}
                        </p>
                        <p className="max-w-3xl font-sans text-sm leading-6 text-bark/78">
                            {isGuest
                                ? "O carrinho e o fechamento de pedidos ficam disponiveis apenas para compradores logados. Voce ainda pode explorar o catalogo antes de entrar."
                                : isError
                                    ? "Tivemos um problema ao confirmar sua sessao agora. Tente entrar novamente para liberar o carrinho e a reserva de lotes."
                                    : "Esta sessao pertence a um perfil sem permissao de compra. Para usar carrinho e reservar lotes, acesse com uma conta de comprador."}
                        </p>
                    </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                    <Button asChild variant="primary">
                        <Link href="/auth/login">{isError ? "Entrar novamente" : "Entrar como comprador"}</Link>
                    </Button>
                    {isGuest ? (
                        <Button asChild variant="ghost">
                            <Link href="/auth/register">Criar conta</Link>
                        </Button>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
