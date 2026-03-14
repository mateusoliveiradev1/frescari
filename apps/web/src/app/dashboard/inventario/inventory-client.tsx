"use client";

import { useState } from "react";
import Image from "next/image";
import { MoreHorizontal, Pencil, Plus, Trash, Leaf } from "lucide-react";
import { toast } from "sonner";
import {
    Badge,
    Button,
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    Skeleton,
    SkeletonText,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
    formatCurrencyBRL,
    formatQuantity,
} from "@frescari/ui";

import { trpc } from "@/trpc/react";

import { InventoryForm } from "./inventory-form";

export function InventoryClient() {
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const utils = trpc.useUtils();
    const { data: lots, isLoading } = trpc.lot.getByProducer.useQuery();
    type ProducerLot = NonNullable<typeof lots>[number];
    const [editingLot, setEditingLot] = useState<ProducerLot | null>(null);

    const deleteLot = trpc.lot.delete.useMutation({
        onSuccess: () => {
            toast.success("Lote removido com sucesso.");
            void utils.lot.getByProducer.invalidate();
        },
        onError: (error) => {
            toast.error(error.message || "Erro ao remover lote.");
        },
    });

    const handleDelete = (id: string) => {
        if (confirm("Tem certeza que deseja excluir este lote? Esta acao nao pode ser desfeita.")) {
            deleteLot.mutate({ id });
        }
    };

    const handleEdit = (lot: ProducerLot) => {
        setEditingLot(lot);
        setIsCreateOpen(true);
    };

    const handleOpenChange = (open: boolean) => {
        setIsCreateOpen(open);

        if (!open) {
            setEditingLot(null);
        }
    };

    const formatDate = (dateStr: string) => {
        return new Intl.DateTimeFormat("pt-BR", {
            timeZone: "UTC",
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
        }).format(new Date(dateStr));
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="font-display text-4xl font-bold text-soil tracking-tight">
                        Meu Inventario
                    </h1>
                    <p className="text-bark/70 font-sans mt-1">
                        Gerencie seus lotes ativos e acompanhe a validade dos seus produtos.
                    </p>
                </div>

                <Dialog open={isCreateOpen} onOpenChange={handleOpenChange}>
                    <DialogTrigger asChild>
                        <Button
                            variant="primary"
                            className="h-12 px-6 gap-2 rounded-full shadow-lg shadow-forest/10"
                        >
                            <Plus className="h-5 w-5" />
                            Novo Lote
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle className="text-2xl font-display text-soil">
                                {editingLot ? "Editar Lote" : "Registrar Novo Lote"}
                            </DialogTitle>
                        </DialogHeader>
                        <div className="py-4">
                            <InventoryForm
                                key={editingLot?.id ?? "new"}
                                initialData={editingLot ?? undefined}
                                onSuccess={() => handleOpenChange(false)}
                            />
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            <Card className="border-forest/5 shadow-xl shadow-forest/5 overflow-hidden">
                <CardHeader className="bg-cream/50 border-b border-forest/5 px-8 py-6">
                    <CardTitle className="text-lg font-sans font-bold text-bark flex items-center gap-2">
                        <Leaf className="h-5 w-5 text-forest" />
                        Lotes Cadastrados
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="space-y-3 px-6 py-6">
                            {Array.from({ length: 4 }).map((_, index) => (
                                <div
                                    key={index}
                                    className="grid grid-cols-[64px_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)] gap-4 rounded-lg border border-forest/5 px-4 py-4"
                                >
                                    <Skeleton className="h-12 w-12 rounded-lg" />
                                    <SkeletonText className="pt-1" lines={2} />
                                    <SkeletonText className="pt-1" lines={2} />
                                    <SkeletonText className="pt-1" lines={2} />
                                </div>
                            ))}
                        </div>
                    ) : lots?.length === 0 ? (
                        <div className="py-20 text-center px-6">
                            <div className="bg-sage/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Leaf className="h-8 w-8 text-forest/40" />
                            </div>
                            <h3 className="text-xl font-display text-soil font-bold">
                                Nenhum lote encontrado
                            </h3>
                            <p className="text-bark/60 font-sans mt-2 max-w-sm mx-auto">
                                Voce ainda nao registrou nenhum lote. Clique em
                                {" "}
                                &quot;Novo Lote&quot;
                                {" "}
                                para comecar a vender.
                            </p>
                            <Button
                                variant="primary"
                                className="mt-6 border-forest/20 text-forest hover:bg-forest/5 bg-transparent"
                                onClick={() => setIsCreateOpen(true)}
                            >
                                Registrar meu primeiro lote
                            </Button>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="hover:bg-transparent border-forest/5 bg-cream/20">
                                        <TableHead className="w-[80px] pl-8">Foto</TableHead>
                                        <TableHead>Produto</TableHead>
                                        <TableHead>Quantidade</TableHead>
                                        <TableHead>Preco</TableHead>
                                        <TableHead className="hidden md:table-cell">Colheita</TableHead>
                                        <TableHead className="hidden md:table-cell">Validade</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right pr-8">Acoes</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {lots?.map((lot) => {
                                        const isExpired = lot.status === "vencido";
                                        const isLastChance = lot.status === "last_chance";

                                        return (
                                            <TableRow
                                                key={lot.id}
                                                className="group border-forest/5 hover:bg-forest/[0.02] transition-colors"
                                            >
                                                <TableCell className="pl-8 py-4">
                                                    <div className="relative h-12 w-12 rounded-lg overflow-hidden border border-forest/10 shadow-sm">
                                                        {lot.imageUrl ? (
                                                            <Image
                                                                src={lot.imageUrl}
                                                                fill
                                                                sizes="48px"
                                                                className="h-full w-full object-cover group-hover:scale-110 transition-transform duration-500"
                                                                alt={lot.productName}
                                                                unoptimized
                                                            />
                                                        ) : (
                                                            <div className="h-full w-full bg-sage/20 flex items-center justify-center">
                                                                <Leaf className="h-5 w-5 text-forest/35" />
                                                            </div>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <span className="font-bold text-soil font-sans">
                                                        {lot.productName}
                                                    </span>
                                                    <div className="text-[10px] text-bark/50 uppercase tracking-widest mt-0.5">
                                                        {lot.lotCode}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="font-sans text-bark/80">
                                                    {formatQuantity(lot.availableQty, {
                                                        maximumFractionDigits: 2,
                                                    })}
                                                    {" "}
                                                    {lot.unit || "un"}
                                                </TableCell>
                                                <TableCell className="font-bold text-forest font-sans">
                                                    {formatCurrencyBRL(lot.calculatedPrice ?? lot.priceOverride ?? 0)}
                                                </TableCell>
                                                <TableCell className="hidden md:table-cell font-sans text-bark/60">
                                                    {formatDate(lot.harvestDate)}
                                                </TableCell>
                                                <TableCell className="hidden md:table-cell font-sans text-bark/60">
                                                    {formatDate(lot.expiryDate)}
                                                </TableCell>
                                                <TableCell>
                                                    {isExpired ? (
                                                        <Badge
                                                            variant="destructive"
                                                            className="bg-red-50 text-red-600 border-red-100 rounded-full font-sans weight-bold"
                                                        >
                                                            Vencido
                                                        </Badge>
                                                    ) : isLastChance ? (
                                                        <Badge className="bg-orange-50 text-orange-600 border-orange-100 rounded-full font-sans weight-bold">
                                                            Ultima Colheita
                                                        </Badge>
                                                    ) : (
                                                        <Badge className="bg-forest/10 text-forest border-forest/20 rounded-full font-sans weight-bold">
                                                            Fresco
                                                        </Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right pr-8">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button
                                                                variant="ghost"
                                                                className="h-8 w-8 p-0 hover:bg-forest/10 rounded-full"
                                                            >
                                                                <MoreHorizontal className="h-4 w-4 text-forest" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent
                                                            align="end"
                                                            className="w-[160px] p-1 border-forest/10 font-sans shadow-xl"
                                                        >
                                                            <DropdownMenuItem
                                                                onClick={() => handleEdit(lot)}
                                                                className="gap-2 cursor-pointer focus:bg-forest/5 focus:text-forest"
                                                            >
                                                                <Pencil className="h-4 w-4" />
                                                                Editar
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem
                                                                onClick={() => handleDelete(lot.id)}
                                                                className="gap-2 cursor-pointer text-red-600 focus:bg-red-50 focus:text-red-700"
                                                            >
                                                                <Trash className="h-4 w-4" />
                                                                Excluir
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
