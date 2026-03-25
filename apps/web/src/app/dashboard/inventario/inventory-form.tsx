"use client";

import { useState } from "react";
import Image from "next/image";

import { Button } from "@frescari/ui";
import { toast } from "sonner";

import { UploadButton } from "@/lib/uploadthing";
import { trpc } from "@/trpc/react";

import { getCreateLotSuccessDescription } from "./inventory-lot-toast";

type InventoryLotSeed = {
  id?: string;
  productId?: string | null;
  productName?: string | null;
  availableQty?: number | string | null;
  priceOverride?: number | string | null;
  expiryDate?: string | Date | null;
  harvestDate?: string | Date | null;
  unit?: string | null;
  imageUrl?: string | null;
};

type InventorySubmission = {
  availableQty: number;
  priceOverride: number;
  harvestDate: string;
  expiryDate: string;
  productId: string;
};

const formatForDateInput = (value: string | Date | null | undefined) => {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  return date.toISOString().split("T")[0] ?? "";
};

export function InventoryForm({
  onSuccess,
  initialData,
}: {
  onSuccess?: () => void;
  initialData?: InventoryLotSeed;
}) {
  const [productId, setProductId] = useState(
    () => initialData?.productName ?? "",
  );
  const [qty, setQty] = useState(() => String(initialData?.availableQty ?? ""));
  const [price, setPrice] = useState(() =>
    String(initialData?.priceOverride ?? ""),
  );
  const [expiryDate, setExpiryDate] = useState(() =>
    formatForDateInput(initialData?.expiryDate),
  );
  const [harvestDate, setHarvestDate] = useState(
    () =>
      formatForDateInput(initialData?.harvestDate) ||
      new Date().toISOString().split("T")[0] ||
      "",
  );
  const [imageUrl, setImageUrl] = useState<string | null>(
    () => initialData?.imageUrl ?? null,
  );
  const [unit, setUnit] = useState(() => initialData?.unit ?? "un");
  const [isUploading, setIsUploading] = useState(false);
  const [isComboboxOpen, setIsComboboxOpen] = useState(false);
  const [selectedMasterId, setSelectedMasterId] = useState(
    () => initialData?.productId ?? "",
  );

  const { data: masterProducts, isLoading: loadingMaster } =
    trpc.product.searchMasterProducts.useQuery(
      { query: productId },
      { enabled: productId.length > 1 },
    );
  const { data: connectStatus } = trpc.stripe.getConnectStatus.useQuery();

  const utils = trpc.useUtils();

  const handlePostSuccess = () => {
    setQty("");
    setPrice("");
    setProductId("");
    setUnit("un");
    setImageUrl(null);
    setSelectedMasterId("");

    void utils.lot.getDashboardMetrics.invalidate();
    void utils.lot.getRecentLots.invalidate();
    void utils.lot.getByProducer.invalidate();
    void utils.lot.invalidate();

    onSuccess?.();
  };

  const createLot = trpc.lot.create.useMutation({
    onSuccess: () => {
      toast.success("Lote registrado com sucesso!", {
        description: getCreateLotSuccessDescription(connectStatus),
      });
      handlePostSuccess();
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao registrar o lote.");
    },
  });

  const updateLot = trpc.lot.update.useMutation({
    onSuccess: () => {
      toast.success("Lote atualizado com sucesso!");
      handlePostSuccess();
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao atualizar o lote.");
    },
  });

  const handleCreate = (formData: InventorySubmission) => {
    const lotCode = `LOT-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    createLot.mutate({
      productId: formData.productId,
      lotCode,
      availableQty: formData.availableQty,
      priceOverride: formData.priceOverride,
      harvestDate: formData.harvestDate,
      expiryDate: formData.expiryDate,
      unit,
      imageUrl: imageUrl || "",
    });
  };

  const handleUpdate = (formData: InventorySubmission) => {
    if (!initialData?.id) {
      return;
    }

    updateLot.mutate({
      id: initialData.id,
      availableQty: formData.availableQty,
      priceOverride: formData.priceOverride,
      harvestDate: formData.harvestDate,
      expiryDate: formData.expiryDate,
      unit,
      imageUrl: imageUrl || "",
    });
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!productId || !qty || !expiryDate || !harvestDate || !price) {
      toast.error("Preencha todos os campos obrigatorios.");
      return;
    }

    if (!selectedMasterId) {
      toast.error("Selecione um produto do Catalogo Mestre.");
      return;
    }

    if (!imageUrl) {
      toast.error("Por favor, adicione uma foto para o lote.");
      return;
    }

    const parsedPrice = Number(price.replace(",", "."));
    if (Number.isNaN(parsedPrice) || parsedPrice < 0) {
      toast.error("Por favor, insira um preco valido.");
      return;
    }

    const formData: InventorySubmission = {
      availableQty: Number(qty),
      priceOverride: parsedPrice,
      harvestDate,
      expiryDate,
      productId: selectedMasterId,
    };

    if (initialData?.id) {
      handleUpdate(formData);
      return;
    }

    handleCreate(formData);
  };

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <div className="space-y-1.5">
        <label className="font-sans text-[10px] font-bold uppercase tracking-[0.15em] text-bark">
          Foto do Lote
        </label>
        {imageUrl ? (
          <div className="relative group h-48">
            <Image
              src={imageUrl}
              alt="Foto do lote"
              fill
              sizes="(max-width: 768px) 100vw, 672px"
              className="rounded-sm border border-forest/20 object-cover"
              unoptimized
            />
            <button
              aria-label="Trocar imagem"
              className="absolute inset-0 flex items-center justify-center rounded-sm border-2 border-transparent bg-black/50 text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 hover:border-white/50"
              onClick={() => setImageUrl(null)}
              type="button"
            >
              <span className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 font-sans text-sm font-bold uppercase tracking-wider">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M21 2v6h-6" />
                  <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
                  <path d="M3 22v-6h6" />
                  <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
                </svg>
                Trocar Imagem
              </span>
            </button>
            <div className="absolute bottom-2 left-2 rounded-sm bg-forest/90 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-cream">
              Foto de catalogo ou carregada
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-sm border-2 border-dashed border-soil/15 bg-cream p-8 transition-colors hover:bg-sage/5">
            <UploadButton
              endpoint="lotImage"
              onUploadBegin={() => {
                setIsUploading(true);
              }}
              onClientUploadComplete={(result) => {
                if (result?.[0]) {
                  setImageUrl(result[0].url);
                  toast.success("Imagem carregada com sucesso!");
                }
                setIsUploading(false);
              }}
              onUploadError={(error: Error) => {
                alert(`Erro no upload: ${error.message}`);
                toast.error(`Erro no upload: ${error.message}`);
                setIsUploading(false);
              }}
              appearance={{
                button:
                  "bg-forest hover:bg-forest/90 text-cream font-sans text-xs font-bold uppercase tracking-wider rounded-sm px-6 py-2",
                allowedContent:
                  "text-bark/50 font-sans text-[10px] uppercase tracking-tighter mt-2",
              }}
              content={{
                button: "Selecionar Foto",
                allowedContent: "Imagens ate 8MB (JPG, PNG, WebP)",
              }}
            />
            <p className="mt-4 text-center font-sans text-[10px] text-bark/40">
              Dica: use fotos bem iluminadas do produto real.
            </p>
          </div>
        )}
      </div>

      <div className="relative space-y-1.5">
        <label
          htmlFor="product"
          className="font-sans text-[10px] font-bold uppercase tracking-[0.15em] text-bark"
        >
          Produto (Catalogo Mestre)
        </label>
        <input
          autoComplete="off"
          className="w-full rounded-sm border border-soil/15 bg-cream px-4 py-3 font-sans text-sm text-soil outline-none focus:border-forest focus:ring-2 focus:ring-forest/15"
          disabled={
            createLot.isPending || updateLot.isPending || Boolean(initialData)
          }
          id="product"
          onBlur={() => setTimeout(() => setIsComboboxOpen(false), 200)}
          onChange={(event) => {
            setProductId(event.target.value);
            setIsComboboxOpen(true);

            if (selectedMasterId) {
              setSelectedMasterId("");
            }
          }}
          onFocus={() => setIsComboboxOpen(true)}
          placeholder="Busque por Tomate, Banana, Cebola..."
          required
          type="text"
          value={productId}
        />

        {isComboboxOpen && (masterProducts?.length || loadingMaster) ? (
          <div className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-sm border border-soil/15 bg-cream shadow-card">
            {loadingMaster ? (
              <div className="p-3 text-xs text-bark/60">
                Buscando no catalogo...
              </div>
            ) : masterProducts?.length ? (
              <ul>
                {masterProducts.map((product) => (
                  <li
                    className="flex cursor-pointer items-center justify-between px-4 py-2 font-sans text-sm hover:bg-sage/40"
                    key={product.id}
                    onClick={() => {
                      setProductId(product.name);
                      setSelectedMasterId(product.id);

                      if (product.defaultImageUrl && !imageUrl) {
                        setImageUrl(product.defaultImageUrl);
                      }

                      setIsComboboxOpen(false);
                    }}
                  >
                    <span className="font-bold text-soil">{product.name}</span>
                    <span className="rounded-full bg-soil/5 px-2 py-0.5 text-xs text-bark/60">
                      {product.category}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="p-3 text-xs text-bark/60">
                Nenhum produto encontrado no catalogo mestre.
              </div>
            )}
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label
            htmlFor="qty"
            className="font-sans text-[10px] font-bold uppercase tracking-[0.15em] text-bark"
          >
            Quantidade Disponivel
          </label>
          <input
            className="w-full rounded-sm border border-soil/15 bg-cream px-4 py-3 font-sans text-sm text-soil outline-none focus:border-forest focus:ring-2 focus:ring-forest/15"
            disabled={createLot.isPending || updateLot.isPending}
            id="qty"
            min="0.01"
            onChange={(event) => setQty(event.target.value)}
            placeholder="Ex: 50.5"
            required
            step="0.01"
            type="number"
            value={qty}
          />
        </div>
        <div className="space-y-1.5">
          <label
            htmlFor="unit"
            className="font-sans text-[10px] font-bold uppercase tracking-[0.15em] text-bark"
          >
            Unidade
          </label>
          <div className="relative">
            <select
              className="w-full appearance-none cursor-pointer rounded-sm border border-soil/15 bg-cream px-4 py-3 font-sans text-sm text-soil outline-none focus:border-forest focus:ring-2 focus:ring-forest/15"
              disabled={createLot.isPending || updateLot.isPending}
              id="unit"
              onChange={(event) => setUnit(event.target.value)}
              required
              value={unit}
            >
              <option value="kg">Quilogramas (kg)</option>
              <option value="un">Unidades (un)</option>
              <option value="cx">Caixas (cx)</option>
              <option value="maco">Macos (maco)</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-bark/40">
              <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20">
                <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="price"
          className="font-sans text-[10px] font-bold uppercase tracking-[0.15em] text-bark"
        >
          Preco (R$)
        </label>
        <input
          className="w-full rounded-sm border border-soil/15 bg-cream px-4 py-3 font-sans text-sm text-soil outline-none focus:border-forest focus:ring-2 focus:ring-forest/15"
          disabled={createLot.isPending || updateLot.isPending}
          id="price"
          onChange={(event) => setPrice(event.target.value)}
          placeholder="Ex: 15,90"
          required
          type="text"
          value={price}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label
            htmlFor="harvestDate"
            className="font-sans text-[10px] font-bold uppercase tracking-[0.15em] text-bark"
          >
            Data de Colheita
          </label>
          <input
            className="w-full rounded-sm border border-soil/15 bg-cream px-4 py-3 font-sans text-sm text-soil outline-none focus:border-forest focus:ring-2 focus:ring-forest/15"
            disabled={createLot.isPending || updateLot.isPending}
            id="harvestDate"
            onChange={(event) => setHarvestDate(event.target.value)}
            required
            type="date"
            value={harvestDate}
          />
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="expiryDate"
            className="font-sans text-[10px] font-bold uppercase tracking-[0.15em] text-bark"
          >
            Data de Validade
          </label>
          <input
            className="w-full rounded-sm border border-soil/15 bg-cream px-4 py-3 font-sans text-sm text-soil outline-none focus:border-forest focus:ring-2 focus:ring-forest/15"
            disabled={createLot.isPending || updateLot.isPending}
            id="expiryDate"
            onChange={(event) => setExpiryDate(event.target.value)}
            required
            type="date"
            value={expiryDate}
          />
        </div>
      </div>

      <Button
        className="w-full"
        disabled={!selectedMasterId || !imageUrl || isUploading || !price}
        isPending={createLot.isPending || updateLot.isPending}
        type="submit"
        variant="primary"
      >
        {initialData?.id ? "Salvar Alteracoes" : "Registrar Lote"}
      </Button>
    </form>
  );
}
