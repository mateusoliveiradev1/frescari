"use client";

import { useState } from "react";
import { trpc } from "@/trpc/react";
import { Button } from "@frescari/ui";
import { useRouter } from "next/navigation";
import { Toaster, toast } from "sonner";
import { UploadDropzone } from "@/lib/uploadthing";

export function InventoryForm() {
    const router = useRouter();

    // Form state
    const [productId, setProductId] = useState("");
    const [qty, setQty] = useState("");
    const [expiryDate, setExpiryDate] = useState("");
    const [harvestDate, setHarvestDate] = useState(new Date().toISOString().split("T")[0]);
    const [imageUrl, setImageUrl] = useState<string | null>(null);

    // Queries & Mutations
    // @ts-expect-error - Bypassing tRPC workspace type issues
    const { data: products, isLoading: loadingProducts } = trpc.product.getProducts.useQuery();

    const utils = trpc.useUtils();

    // @ts-ignore
    const createLot = trpc.lot.create.useMutation({
        onSuccess: () => {
            toast.success("Lote registrado com sucesso! 🌿", {
                description: "O novo lote já está disponível no catálogo.",
            });

            setQty("");
            setProductId("");
            setImageUrl(null);

            // CRITICAL: Invalidate dashboard queries so metrics update instantly
            // @ts-expect-error local monorepo trpc generics limit
            utils.lot.getDashboardMetrics.invalidate();
            // @ts-expect-error local monorepo trpc generics limit
            utils.lot.getRecentLots.invalidate();
            // @ts-expect-error local monorepo trpc generics limit
            utils.lot.invalidate();

            setTimeout(() => {
                router.push("/dashboard");
            }, 1500);
        },
        onError: (err: any) => {
            toast.error(err.message || "Erro ao registrar o lote.");
        }
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!productId || !qty || !expiryDate || !harvestDate) {
            toast.error("Preencha todos os campos obrigatórios.");
            return;
        }

        const lotCode = `LOT-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

        createLot.mutate({
            productId,
            lotCode,
            availableQty: Number(qty),
            harvestDate,
            expiryDate,
            ...(imageUrl ? { imageUrl } : {}),
        });
    };

    return (
        <>
            <form onSubmit={handleSubmit} className="space-y-6">
                {/* ── Image Upload ── */}
                <div className="space-y-1.5">
                    <label className="font-sans text-[10px] font-bold uppercase tracking-[0.15em] text-bark">
                        Foto do Lote
                    </label>
                    {imageUrl ? (
                        <div className="relative group">
                            <img
                                src={imageUrl}
                                alt="Foto do lote"
                                className="w-full h-48 object-cover rounded-sm border border-forest/20"
                            />
                            <button
                                type="button"
                                onClick={() => setImageUrl(null)}
                                className="absolute top-2 right-2 bg-white/90 hover:bg-red-50 text-red-600 rounded-full p-1.5 shadow-sm transition-colors opacity-0 group-hover:opacity-100"
                                aria-label="Remover foto"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M18 6L6 18M6 6l12 12" />
                                </svg>
                            </button>
                            <div className="absolute bottom-2 left-2 px-2 py-1 bg-forest/90 text-cream text-[10px] font-bold uppercase tracking-wider rounded-sm">
                                ✓ Foto carregada
                            </div>
                        </div>
                    ) : (
                        <UploadDropzone
                            endpoint="lotImage"
                            onClientUploadComplete={(res) => {
                                if (res?.[0]) {
                                    setImageUrl(res[0].ufsUrl);
                                    toast.success("Foto carregada com sucesso!");
                                }
                            }}
                            onUploadError={(error: Error) => {
                                toast.error(`Erro no upload: ${error.message}`);
                            }}
                            className="border-2 border-dashed border-soil/15 bg-cream hover:bg-sage/20 rounded-sm transition-colors ut-button:bg-forest ut-button:hover:bg-forest/90 ut-button:text-cream ut-button:font-sans ut-button:text-xs ut-button:font-bold ut-button:uppercase ut-button:tracking-wider ut-button:rounded-sm ut-label:text-bark ut-label:font-sans ut-allowed-content:text-bark/50"
                            content={{
                                label: "Arraste a foto ou clique para enviar",
                                allowedContent: "Imagens até 4MB (JPG, PNG, WebP)",
                            }}
                        />
                    )}
                </div>

                {/* ── Product Select ── */}
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

                {/* ── Quantity ── */}
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

                {/* ── Dates ── */}
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

            <Toaster richColors position="bottom-right" />
        </>
    );
}
