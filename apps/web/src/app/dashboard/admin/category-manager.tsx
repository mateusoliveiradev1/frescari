"use client";

import { useState } from "react";
import {
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
import { Pencil, Save, Tags, X } from "lucide-react";
import { toast } from "sonner";

import { formatSaoPauloDateBR } from "@/lib/date-format";
import { trpc } from "@/trpc/react";

type CategoryFormState = {
  name: string;
  slug: string;
  seoDescription: string;
};

type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  seoDescription: string | null;
  createdAt: string | Date;
};

const initialCategoryForm: CategoryFormState = {
  name: "",
  slug: "",
  seoDescription: "",
};

const inputClassName =
  "w-full px-4 py-3 rounded-sm bg-cream border border-soil/15 font-sans text-sm text-soil outline-none focus:border-forest focus:ring-2 focus:ring-forest/15";
const labelClassName =
  "font-sans text-[10px] font-bold uppercase tracking-[0.15em] text-bark";

function toSlug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function formatDate(dateValue: string | Date) {
  return formatSaoPauloDateBR(dateValue, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function CategoryManager() {
  const [form, setForm] = useState<CategoryFormState>(initialCategoryForm);
  const [editingId, setEditingId] = useState<string | null>(null);

  const utils = trpc.useUtils();
  const { data: categories = [], isLoading } =
    trpc.admin.listCategories.useQuery();

  const createCategory = trpc.admin.createCategory.useMutation({
    onSuccess: async () => {
      toast.success("Categoria criada com sucesso.");
      setForm(initialCategoryForm);
      await utils.admin.listCategories.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Nao foi possivel criar a categoria.");
    },
  });

  const updateCategory = trpc.admin.updateCategory.useMutation({
    onSuccess: async () => {
      toast.success("Categoria atualizada com sucesso.");
      setEditingId(null);
      setForm(initialCategoryForm);
      await Promise.all([
        utils.admin.listCategories.invalidate(),
        utils.admin.listMasterProducts.invalidate(),
      ]);
    },
    onError: (error) => {
      toast.error(error.message || "Nao foi possivel atualizar a categoria.");
    },
  });

  const isSaving = createCategory.isPending || updateCategory.isPending;

  function resetForm() {
    setEditingId(null);
    setForm(initialCategoryForm);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const payload = {
      name: form.name.trim(),
      slug: form.slug.trim().toLowerCase(),
      seoDescription: form.seoDescription.trim(),
    };

    if (editingId) {
      updateCategory.mutate({
        id: editingId,
        ...payload,
      });
      return;
    }

    createCategory.mutate(payload);
  }

  function startEdit(category: CategoryRow) {
    setEditingId(category.id);
    setForm({
      name: category.name,
      slug: category.slug,
      seoDescription: category.seoDescription ?? "",
    });
  }

  return (
    <Card className="border-forest/5 shadow-xl shadow-forest/5 overflow-hidden">
      <CardHeader className="bg-cream/50 border-b border-forest/5">
        <CardTitle className="text-lg font-sans font-bold text-bark flex items-center gap-2">
          <Tags className="h-5 w-5 text-forest" />
          Categorias do Catalogo
        </CardTitle>
        <CardDescription>
          Cadastre e revise os agrupamentos publicos usados no catalogo ISR.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="category-name" className={labelClassName}>
                Nome da categoria
              </label>
              <input
                id="category-name"
                className={inputClassName}
                value={form.name}
                onChange={(event) => {
                  const name = event.target.value;
                  setForm((current) => ({
                    ...current,
                    name,
                    slug:
                      editingId || current.slug ? current.slug : toSlug(name),
                  }));
                }}
                placeholder="Ex: Folhas"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="category-slug" className={labelClassName}>
                Slug
              </label>
              <input
                id="category-slug"
                className={inputClassName}
                value={form.slug}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    slug: event.target.value,
                  }))
                }
                placeholder="folhas"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="category-seo" className={labelClassName}>
              Descricao SEO
            </label>
            <textarea
              id="category-seo"
              className={`${inputClassName} min-h-24 resize-y`}
              value={form.seoDescription}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  seoDescription: event.target.value,
                }))
              }
              placeholder="Resumo editorial opcional para metadados publicos."
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={isSaving}>
              {editingId ? (
                <>
                  <Save className="h-4 w-4" />
                  Salvar categoria
                </>
              ) : (
                <>
                  <Tags className="h-4 w-4" />
                  Adicionar categoria
                </>
              )}
            </Button>
            {(editingId || form.name || form.slug) && (
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
                <TableHead>Nome</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead className="hidden md:table-cell">
                  Criada em
                </TableHead>
                <TableHead className="text-right">Acoes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="py-10 text-center text-bark/60"
                  >
                    Carregando categorias...
                  </TableCell>
                </TableRow>
              ) : (categories as CategoryRow[]).length > 0 ? (
                (categories as CategoryRow[]).map((category) => (
                  <TableRow
                    key={category.id}
                    className="border-forest/5 hover:bg-forest/[0.02]"
                  >
                    <TableCell>
                      <div className="font-semibold text-soil">
                        {category.name}
                      </div>
                      {category.seoDescription ? (
                        <p className="mt-1 text-xs text-bark/60 line-clamp-2">
                          {category.seoDescription}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-bark/70">
                      {category.slug}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-bark/60">
                      {formatDate(category.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => startEdit(category)}
                      >
                        <Pencil className="h-4 w-4" />
                        Editar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="py-10 text-center text-bark/60"
                  >
                    Nenhuma categoria cadastrada ainda.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
