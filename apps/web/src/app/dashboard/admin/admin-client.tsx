"use client";

import { Badge } from "@frescari/ui";
import { trpc } from "@/trpc/react";

import { CategoryManager } from "./category-manager";
import { MasterProductManager } from "./master-product-manager";

export function AdminClient({ userName }: { userName?: string | null }) {
    const { data: categories = [] } = trpc.admin.listCategories.useQuery();
    const { data: masterProducts = [] } = trpc.admin.listMasterProducts.useQuery();

    return (
        <div className="space-y-10 animate-in fade-in duration-500">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div className="space-y-1">
                    <p className="font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-bark/70">
                        Painel Administrativo
                    </p>
                    <h1 className="font-display text-4xl font-black text-soil">
                        Catálogo Mestre
                    </h1>
                    <p className="max-w-2xl text-bark/70 font-sans">
                        {userName ? `${userName}, ` : ""}
                        gerencie categorias e produtos mestres sem sair do padrão visual do
                        dashboard.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <Badge variant="secondary">{categories.length} categorias</Badge>
                    <Badge variant="secondary">
                        {masterProducts.length} produtos mestres
                    </Badge>
                </div>
            </div>

            <div className="grid gap-8 xl:grid-cols-2">
                <CategoryManager />
                <MasterProductManager />
            </div>

         </div>
     );
}
