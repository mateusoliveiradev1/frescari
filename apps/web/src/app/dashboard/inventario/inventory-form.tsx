"use client";

import { useState, useEffect } from "react";
import { trpc } from "@/trpc/react";
import { Button } from "@frescari/ui";
import { useRouter } from "next/navigation";
import { Toaster, toast } from "sonner";
import { UploadDropzone } from "@/lib/uploadthing";

export function InventoryForm({
    onSuccess,
    initialData
}: {
    onSuccess?: () => void,
    initialData?: any
}) {
    // Form state
    const [productId, setProductId] = useState("");
    const [qty, setQty] = useState("");
    const [price, setPrice] = useState("");
    const [expiryDate, setExpiryDate] = useState("");
    const [harvestDate, setHarvestDate] = useState(new Date().toISOString().split("T")[0]);
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    // Sync initialData
    useEffect(() => {
        if (initialData) {
            setProductId(initialData.productName || "");
            setSelectedMasterId(initialData.productId || "");
            setQty(initialData.availableQty?.toString() || "");
            setPrice(initialData.priceOverride?.toString() || "");
            // Handle date conversion to YYYY-MM-DD for input[type="date"], forcing UTC to avoid timezone shift
            const formatForInput = (d: any) => {
                if (!d) return "";
                const date = new Date(d);
                return date.toISOString().split("T")[0];
            };
            setExpiryDate(formatForInput(initialData.expiryDate));
            setHarvestDate(formatForInput(initialData.harvestDate));
            setImageUrl(initialData.imageUrl || null);
        }
    }, [initialData]);

    // Queries & Mutations
    // @ts-expect-error local monorepo limits
    const { data: masterProducts, isLoading: loadingMaster } = trpc.product.searchMasterProducts.useQuery(
        { query: productId },
        { enabled: productId.length > 1 }
    );
    const [isComboboxOpen, setIsComboboxOpen] = useState(false);
    const [selectedMasterId, setSelectedMasterId] = useState("");


    const utils = trpc.useUtils();

    // @ts-ignore
    const createLot = trpc.lot.create.useMutation({
        onSuccess: () => {
            toast.success("Lote registrado com sucesso! 🌿", {
                description: "O novo lote já está disponível no catálogo.",
            });
            handlePostSuccess();
        },
        onError: (err: any) => {
            toast.error(err.message || "Erro ao registrar o lote.");
        }
    });

    // @ts-ignore
    const updateLot = trpc.lot.update.useMutation({
        onSuccess: () => {
            toast.success("Lote atualizado com sucesso! 🌿");
            handlePostSuccess();
        },
        onError: (err: any) => {
            toast.error(err.message || "Erro ao atualizar o lote.");
        }
    });

    const handlePostSuccess = () => {
        setQty("");
        setPrice("");
        setProductId("");
        setImageUrl(null);
        setSelectedMasterId("");

        // CRITICAL: Invalidate dashboard queries so metrics update instantly
        // @ts-expect-error local monorepo trpc generics limit
        utils.lot.getDashboardMetrics.invalidate();
        // @ts-expect-error local monorepo trpc generics limit
        utils.lot.getRecentLots.invalidate();
        // @ts-expect-error local monorepo trpc generics limit
        utils.lot.getByProducer.invalidate();
        // @ts-expect-error local monorepo trpc generics limit
        utils.lot.invalidate();

        if (onSuccess) {
            onSuccess();
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!productId || !qty || !expiryDate || !harvestDate || !price) {
            toast.error("Preencha todos os campos obrigatórios.");
            return;
        }

        if (!selectedMasterId) {
            toast.error("Selecione um produto do Catálogo Mestre.");
            return;
        }

        if (!imageUrl) {
            toast.error("Por favor, adicione uma foto para o lote.");
            return;
        }

        const parsedPrice = parseFloat(price.replace(",", "."));
        if (isNaN(parsedPrice) || parsedPrice < 0) {
            toast.error("Por favor, insira um preço válido.");
            return;
        }

        if (initialData?.id) {
            updateLot.mutate({
                id: initialData.id,
                availableQty: Number(qty),
                priceOverride: parsedPrice,
                harvestDate,
                expiryDate,
                imageUrl: imageUrl || undefined,
            });
        } else {
            const lotCode = `LOT-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
            createLot.mutate({
                productId: selectedMasterId,
                lotCode,
                availableQty: Number(qty),
                priceOverride: parsedPrice,
                harvestDate,
                expiryDate,
                imageUrl: imageUrl || undefined,
            });
        }
    };

    return (
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
                            className="absolute inset-0 flex items-center justify-center bg-black/50 text-white rounded-sm opacity-0 group-hover:opacity-100 transition-opacity font-sans text-sm font-bold uppercase tracking-wider backdrop-blur-sm border-2 border-transparent hover:border-white/50"
                            aria-label="Trocar imagem"
                        >
                            <span className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M21 2v6h-6" />
                                    <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
                                    <path d="M3 22v-6h6" />
                                    <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
                                </svg>
                                Trocar Imagem
                            </span>
                        </button>
                        <div className="absolute bottom-2 left-2 px-2 py-1 bg-forest/90 text-cream text-[10px] font-bold uppercase tracking-wider rounded-sm">
                            ✓ Foto de Catálogo ou Carregada
                        </div>
                    </div>
                ) : (
                    <UploadDropzone
                        endpoint="lotImage"
                        onUploadBegin={() => {
                            console.log('[UPLOADTHING] Upload iniciado');
                            setIsUploading(true);
                        }}
                        onClientUploadComplete={(res) => {
                            console.log('[UPLOADTHING]', res);
                            if (res?.[0]) {
                                setImageUrl(res[0].url); // Or res[0].ufsUrl depending on version, fallback handled
                                toast.success('Imagem carregada com sucesso!');
                            }
                            setIsUploading(false);
                        }}
                        onUploadError={(error: Error) => {
                            console.log('[UPLOADTHING_ERROR]', error);
                            toast.error(`Erro no upload: ${error.message}`);
                            setIsUploading(false);
                        }}
                        className="border-2 border-dashed border-soil/15 bg-cream hover:bg-sage/20 rounded-sm transition-colors ut-button:bg-forest ut-button:hover:bg-forest/90 ut-button:text-cream ut-button:font-sans ut-button:text-xs ut-button:font-bold ut-button:uppercase ut-button:tracking-wider ut-button:rounded-sm ut-label:text-bark ut-label:font-sans ut-allowed-content:text-bark/50"
                        content={{
                            label: "Arraste a foto ou clique para enviar",
                            allowedContent: "Imagens até 4MB (JPG, PNG, WebP)",
                        }}
                    />
                )}
            </div>

            {/* ── Product Combobox ── */}
            <div className="space-y-1.5 relative">
                <label htmlFor="product" className="font-sans text-[10px] font-bold uppercase tracking-[0.15em] text-bark">
                    Produto (Catálogo Mestre)
                </label>
                <input
                    type="text"
                    id="product"
                    value={productId}
                    onChange={(e) => {
                        setProductId(e.target.value);
                        setIsComboboxOpen(true);
                        if (selectedMasterId) setSelectedMasterId("");
                    }}
                    onFocus={() => setIsComboboxOpen(true)}
                    onBlur={() => setTimeout(() => setIsComboboxOpen(false), 200)} // Delay for click
                    placeholder="Busque por Tomate, Banana, Cebola..."
                    className="w-full px-4 py-3 rounded-sm bg-cream border border-soil/15 font-sans text-sm text-soil outline-none focus:border-forest focus:ring-2 focus:ring-forest/15"
                    disabled={createLot.isPending || updateLot.isPending || !!initialData}
                    required
                    autoComplete="off"
                />

                {isComboboxOpen && (masterProducts?.length || loadingMaster) ? (
                    <div className="absolute z-10 w-full mt-1 bg-cream border border-soil/15 rounded-sm shadow-card max-h-60 overflow-y-auto">
                        {loadingMaster ? (
                            <div className="p-3 text-xs text-bark/60">Buscando no catálogo...</div>
                        ) : masterProducts?.length ? (
                            <ul>
                                {masterProducts.map((p: any) => (
                                    <li
                                        key={p.id}
                                        onClick={() => {
                                            setProductId(p.name);
                                            setSelectedMasterId(p.id);
                                            if (p.defaultImageUrl && !imageUrl) {
                                                setImageUrl(p.defaultImageUrl);
                                            }
                                            setIsComboboxOpen(false);
                                        }}
                                        className="px-4 py-2 hover:bg-sage/40 cursor-pointer font-sans text-sm flex items-center justify-between"
                                    >
                                        <span className="font-bold text-soil">{p.name}</span>
                                        <span className="text-xs text-bark/60 bg-soil/5 px-2 py-0.5 rounded-full">{p.category}</span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <div className="p-3 text-xs text-bark/60">Nenhum produto encontrado no catálogo mestre.</div>
                        )}
                    </div>
                ) : null}
            </div>

            {/* ── Quantity ── */}
            <div className="space-y-1.5">
                <label htmlFor="qty" className="font-sans text-[10px] font-bold uppercase tracking-[0.15em] text-bark">
                    Quantidade Disponível (kg/unidade)
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
                    disabled={createLot.isPending || updateLot.isPending}
                    required
                />
            </div>

            {/* ── Price ── */}
            <div className="space-y-1.5">
                <label htmlFor="price" className="font-sans text-[10px] font-bold uppercase tracking-[0.15em] text-bark">
                    Preço (R$)
                </label>
                <input
                    id="price"
                    type="text"
                    placeholder="Ex: 15,90"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full px-4 py-3 rounded-sm bg-cream border border-soil/15 font-sans text-sm text-soil outline-none focus:border-forest focus:ring-2 focus:ring-forest/15"
                    disabled={createLot.isPending || updateLot.isPending}
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
                        disabled={createLot.isPending || updateLot.isPending}
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
                        disabled={createLot.isPending || updateLot.isPending}
                        required
                    />
                </div>
            </div>

            <Button
                type="submit"
                variant="primary"
                className="w-full"
                disabled={createLot.isPending || updateLot.isPending || !selectedMasterId || !imageUrl || isUploading || !price}
            >
                {createLot.isPending || updateLot.isPending ? (
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
                    initialData?.id ? "Salvar Alterações" : "Registrar Lote"
                )}
            </Button>
        </form>
    );
}

