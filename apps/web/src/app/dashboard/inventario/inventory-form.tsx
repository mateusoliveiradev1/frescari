"use client";

import { useState } from "react";
import { trpc } from "@/trpc/react";
import { Button } from "@frescari/ui";
import { useRouter } from "next/navigation";

export function InventoryForm() {
    const router = useRouter();

    // Form state
    const [productId, setProductId] = useState("");
    const [qty, setQty] = useState("");
    const [expiryDate, setExpiryDate] = useState("");
    const [harvestDate, setHarvestDate] = useState(new Date().toISOString().split("T")[0]); // Default to today

    // UI state
    const [message, setMessage] = useState<{ type: "success" | "error", text: string } | null>(null);

    // Queries & Mutations
    // Queries & Mutations
    // @ts-expect-error - Bypassing tRPC workspace type issues
    const { data: products, isLoading: loadingProducts } = trpc.product.getProducts.useQuery();

    const utils = trpc.useUtils();

    // @ts-ignore
    const createLot = trpc.lot.create.useMutation({
        onSuccess: () => {
            setMessage({ type: "success", text: "Lote registrado com sucesso!" });
            setQty("");
            setProductId("");

            // Force React Query to refetch the dashboard metrics and lots
            // @ts-expect-error local monorepo trpc generics limit
            utils.lot.invalidate();

            setTimeout(() => {
                setMessage(null);
                // Redirect user to the dashboard overview so they see the new data
                router.push("/dashboard");
            }, 1500);
        },
        onError: (err: any) => {
            setMessage({ type: "error", text: err.message || "Erro ao registrar o lote." });
        }
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage(null);

        if (!productId || !qty || !expiryDate || !harvestDate) {
            setMessage({ type: "error", text: "Preencha todos os campos obrigatórios." });
            return;
        }

        // Generate a random lot code for this example
        const lotCode = `LOT-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

        createLot.mutate({
            productId,
            lotCode,
            availableQty: Number(qty),
            harvestDate,
            expiryDate,
        });
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {message && (
                <div
                    className={`p-4 rounded-sm border mb-4 ${message.type === "error"
                        ? "bg-ember/10 border-ember/30 text-ember"
                        : "bg-forest/10 border-forest/30 text-forest"
                        }`}
                >
                    <p className="font-sans text-sm font-medium">{message.text}</p>
                </div>
            )}

            <div className="space-y-1.5">
                <label htmlFor="product" className="font-sans text-[10px] font-bold uppercase tracking-[0.15em] text-bark">
                    Produto
                </label>
                <select
                    id="product"
                    value={productId}
                    onChange={(e) => setProductId(e.target.value)}
                    className="w-full px-4 py-3 rounded-sm bg-cream border border-soil/15 font-sans text-sm text-soil outline-none focus:border-forest focus:ring-2 focus:ring-forest/15"
                    disabled={loadingProducts || createLot.isPending}
                    required
                >
                    <option value="" disabled>Selecione um produto</option>
                    {products?.map((p: { id: string; name: string; saleUnit: string }) => (
                        <option key={p.id} value={p.id}>
                            {p.name} ({p.saleUnit})
                        </option>
                    ))}
                </select>
                {loadingProducts && <p className="text-xs text-bark/60 mt-1">Carregando produtos...</p>}
            </div>

            <div className="space-y-1.5">
                <label htmlFor="qty" className="font-sans text-[10px] font-bold uppercase tracking-[0.15em] text-bark">
                    Quantidade Disponível
                </label>
                <input
                    id="qty"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                    placeholder="Ex: 50.5"
                    className="w-full px-4 py-3 rounded-sm bg-cream border border-soil/15 font-sans text-sm text-soil outline-none focus:border-forest focus:ring-2 focus:ring-forest/15"
                    disabled={createLot.isPending}
                    required
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                    <label htmlFor="harvestDate" className="font-sans text-[10px] font-bold uppercase tracking-[0.15em] text-bark">
                        Data de Colheita
                    </label>
                    <input
                        id="harvestDate"
                        type="date"
                        value={harvestDate}
                        onChange={(e) => setHarvestDate(e.target.value)}
                        className="w-full px-4 py-3 rounded-sm bg-cream border border-soil/15 font-sans text-sm text-soil outline-none focus:border-forest focus:ring-2 focus:ring-forest/15"
                        disabled={createLot.isPending}
                        required
                    />
                </div>

                <div className="space-y-1.5">
                    <label htmlFor="expiryDate" className="font-sans text-[10px] font-bold uppercase tracking-[0.15em] text-bark">
                        Data de Validade
                    </label>
                    <input
                        id="expiryDate"
                        type="date"
                        value={expiryDate}
                        onChange={(e) => setExpiryDate(e.target.value)}
                        className="w-full px-4 py-3 rounded-sm bg-cream border border-soil/15 font-sans text-sm text-soil outline-none focus:border-forest focus:ring-2 focus:ring-forest/15"
                        disabled={createLot.isPending}
                        required
                    />
                </div>
            </div>

            <Button
                type="submit"
                variant="primary"
                className="w-full"
                disabled={createLot.isPending}
            >
                {createLot.isPending ? (
                    <span className="flex items-center justify-center gap-2">
                        <svg
                            className="animate-spin h-4 w-4 text-white"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                        >
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                        Salvando...
                    </span>
                ) : (
                    "Registrar Lote"
                )}
            </Button>
        </form>
    );
}
