"use client";

import { useState } from "react";
import {
    Badge,
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@frescari/ui";
import { Boxes, Pencil, Save, X } from "lucide-react";
import { toast } from "sonner";

import { trpc } from "@/trpc/react";

type PricingType = "UNIT" | "WEIGHT" | "BOX";

type CategoryRow = {
    id: string;
    name: string;
};

type MasterProductRow = {
    id: string;
    name: string;
    category: string;
    categoryId: string | null;
    defaultImageUrl: string | null;
    pricingType: PricingType;
    createdAt: string | Date;
};

type MasterProductFormState = {
    name: string;
    categoryId: string;
    pricingType: PricingType;
    defaultImageUrl: string;
};

const initialForm: MasterProductFormState = {
    name: "",
    categoryId: "",
    pricingType: "UNIT",
    defaultImageUrl: "",
};

const inputClassName =
    "w-full px-4 py-3 rounded-sm bg-cream border border-soil/15 font-sans text-sm text-soil outline-none focus:border-forest focus:ring-2 focus:ring-forest/15";
const labelClassName =
    "font-sans text-[10px] font-bold uppercase tracking-[0.15em] text-bark";

const pricingTypeLabels: Record<PricingType, string> = {
    UNIT: "Unidade",
    WEIGHT: "Peso",
    BOX: "Caixa",
};

function formatDate(dateValue: string | Date) {
    return new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    }).format(new Date(dateValue));
}

export function MasterProductManager() {
    const [form, setForm] = useState<MasterProductFormState>(initialForm);
    const [editingId, setEditingId] = useState<string | null>(null);

    const utils = trpc.useUtils();
    const { data: categories = [] } = trpc.admin.listCategories.useQuery();
    const { data: masterProducts = [], isLoading } =
        trpc.admin.listMasterProducts.useQuery();

    const createMasterProduct = trpc.admin.createMasterProduct.useMutation({
        onSuccess: async () => {
            toast.success("Produto mestre criado com sucesso.");
            setForm(initialForm);
            await utils.admin.listMasterProducts.invalidate();
        },
        onError: (error) => {
            toast.error(error.message || "Não foi possível criar o produto mestre.");
        },
    });

    const updateMasterProduct = trpc.admin.updateMasterProduct.useMutation({
        onSuccess: async () => {
            await utils.admin.listMasterProducts.invalidate();
            toast.success("Produto e lotes sincronizados!");
            setEditingId(null);
            setForm(initialForm);
        },
        onError: (error) => {
            toast.error(error.message || "Não foi possível sincronizar produto e lotes.");
        },
    });

    const isSaving = createMasterProduct.isPending || updateMasterProduct.isPending;

    function resetForm() {
        setEditingId(null);
        setForm(initialForm);
    }

    function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();

        const payload = {
            name: form.name.trim(),
            categoryId: form.categoryId,
            pricingType: form.pricingType,
            defaultImageUrl: form.defaultImageUrl.trim(),
        };

        if (editingId) {
            updateMasterProduct.mutate({
                id: editingId,
                ...payload,
            });
            return;
        }

        createMasterProduct.mutate(payload);
    }

    function startEdit(product: MasterProductRow) {
        setEditingId(product.id);
        setForm({
            name: product.name,
            categoryId: product.categoryId ?? "",
            pricingType: product.pricingType,
            defaultImageUrl: product.defaultImageUrl ?? "",
        });
    }

    return (
        <Card className="border-forest/5 shadow-xl shadow-forest/5 overflow-hidden">
            <CardHeader className="bg-cream/50 border-b border-forest/5">
                <CardTitle className="text-lg font-sans font-bold text-bark flex items-center gap-2">
                    <Boxes className="h-5 w-5 text-forest" />
                    Produtos Mestres
                </CardTitle>
                <CardDescription>
                    Mantenha o catálogo-base que abastece criação de lotes e SEO do
                    marketplace.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
                <form className="space-y-4" onSubmit={handleSubmit}>
                    <div className="space-y-1.5">
                        <label htmlFor="master-product-name" className={labelClassName}>
                            Nome do produto
                        </label>
                        <input
                            id="master-product-name"
                            className={inputClassName}
                            value={form.name}
                            onChange={(event) =>
                                setForm((current) => ({
                                    ...current,
                                    name: event.target.value,
                                }))
                            }
                            placeholder="Ex: Tomate Italiano"
                            required
                        />
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-1.5">
                            <label htmlFor="master-product-category" className={labelClassName}>
                                Categoria
                            </label>
                            <select
                                id="master-product-category"
                                className={inputClassName}
                                value={form.categoryId}
                                onChange={(event) =>
                                    setForm((current) => ({
                                        ...current,
                                        categoryId: event.target.value,
                                    }))
                                }
                                required
                                disabled={(categories as CategoryRow[]).length === 0}
                            >
                                <option value="">Selecione uma categoria</option>
                                {(categories as CategoryRow[]).map((category) => (
                                    <option key={category.id} value={category.id}>
                                        {category.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <label htmlFor="master-product-pricing" className={labelClassName}>
                                Tipo de precificação
                            </label>
                            <select
                                id="master-product-pricing"
                                className={inputClassName}
                                value={form.pricingType}
                                onChange={(event) =>
                                    setForm((current) => ({
                                        ...current,
                                        pricingType: event.target.value as PricingType,
                                    }))
                                }
                                required
                            >
                                {Object.entries(pricingTypeLabels).map(([value, label]) => (
                                    <option key={value} value={value}>
                                        {label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label htmlFor="master-product-image" className={labelClassName}>
                            URL da imagem padrão
                        </label>
                        <input
                            id="master-product-image"
                            className={inputClassName}
                            value={form.defaultImageUrl}
                            onChange={(event) =>
                                setForm((current) => ({
                                    ...current,
                                    defaultImageUrl: event.target.value,
                                }))
                            }
                            placeholder="https://..."
                        />
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <Button
                            type="submit"
                            disabled={isSaving || (categories as CategoryRow[]).length === 0}
                        >
                            {editingId ? (
                                <>
                                    <Save className="h-4 w-4" />
                                    Salvar produto
                                </>
                            ) : (
                                <>
                                    <Boxes className="h-4 w-4" />
                                    Adicionar produto mestre
                                </>
                            )}
                        </Button>
                        {(editingId ||
                            form.name ||
                            form.categoryId ||
                            form.defaultImageUrl) && (
                            <Button type="button" variant="ghost" onClick={resetForm}>
                                <X className="h-4 w-4" />
                                Cancelar
                            </Button>
                        )}
                    </div>
                </form>

                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow className="hover:bg-transparent border-forest/5 bg-cream/20">
                                <TableHead>Produto</TableHead>
                                <TableHead>Categoria</TableHead>
                                <TableHead>Pricing</TableHead>
                                <TableHead className="hidden md:table-cell">Criado em</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="py-10 text-center text-bark/60">
                                        Carregando produtos mestres...
                                    </TableCell>
                                </TableRow>
                            ) : (masterProducts as MasterProductRow[]).length > 0 ? (
                                (masterProducts as MasterProductRow[]).map((product) => (
                                    <TableRow
                                        key={product.id}
                                        className="border-forest/5 hover:bg-forest/[0.02]"
                                    >
                                        <TableCell>
                                            <div className="font-semibold text-soil">
                                                {product.name}
                                            </div>
                                            <p className="mt-1 text-xs text-bark/60">
                                                {product.defaultImageUrl
                                                    ? "Imagem padrão configurada"
                                                    : "Sem imagem padrão"}
                                            </p>
                                        </TableCell>
                                        <TableCell className="text-bark/70">
                                            {product.category}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="secondary">
                                                {pricingTypeLabels[product.pricingType]}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="hidden md:table-cell text-bark/60">
                                            {formatDate(product.createdAt)}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                onClick={() => startEdit(product)}
                                                disabled={!product.categoryId}
                                            >
                                                <Pencil className="h-4 w-4" />
                                                Editar
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={5} className="py-10 text-center text-bark/60">
                                        Nenhum produto mestre cadastrado ainda.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>

                {(categories as CategoryRow[]).length === 0 ? (
                    <p className="text-sm text-ember font-sans">
                        Cadastre ao menos uma categoria antes de criar produtos mestres.
                    </p>
                ) : null}
            </CardContent>
        </Card>
    );
}
