"use client";

import { useState } from "react";
import { trpc } from "@/trpc/react";
import {
    Button,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    Badge
} from "@frescari/ui";
import { InventoryForm } from "./inventory-form";
import { MoreHorizontal, Plus, Trash, Pencil, Leaf } from "lucide-react";
import { toast } from "sonner";

export function InventoryClient() {
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [editingLot, setEditingLot] = useState<any>(null);

    // @ts-expect-error local monorepo trpc generics limit
    const { data: lots, isLoading, refetch } = trpc.lot.getByProducer.useQuery();
    const utils = trpc.useUtils();

    // @ts-expect-error local monorepo
    const deleteLot = trpc.lot.delete.useMutation({
        onSuccess: () => {
            toast.success("Lote removido com sucesso.");
            // @ts-expect-error local monorepo
            utils.lot.getByProducer.invalidate();
        },
        onError: (err: any) => {
            toast.error(err.message || "Erro ao remover lote.");
        }
    });

    const handleDelete = async (id: string) => {
        if (confirm("Tem certeza que deseja excluir este lote? Esta ação não pode ser desfeita.")) {
            deleteLot.mutate({ id });
        }
    };

    const handleEdit = (lot: any) => {
        setEditingLot(lot);
        setIsCreateOpen(true);
    };

    const handleOpenChange = (open: boolean) => {
        setIsCreateOpen(open);
        if (!open) {
            setEditingLot(null);
        }
    };

    const formatCurrency = (val: string) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parseFloat(val));
    };

    const formatDate = (dateStr: string) => {
        return new Intl.DateTimeFormat('pt-BR', {
            timeZone: 'UTC',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        }).format(new Date(dateStr));
    };

    const formatQuantity = (qty: string, unit: string) => {
        const num = parseFloat(qty);
        return `${new Intl.NumberFormat('pt-BR', {
            maximumFractionDigits: 2,
            minimumFractionDigits: 0
        }).format(num)} ${unit || 'un'}`;
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="font-display text-4xl font-bold text-soil tracking-tight">
                        Meu Inventário
                    </h1>
                    <p className="text-bark/70 font-sans mt-1">
                        Gerencie seus lotes ativos e acompanhe a validade dos seus produtos.
                    </p>
                </div>

                <Dialog open={isCreateOpen} onOpenChange={handleOpenChange}>
                    <DialogTrigger asChild>
                        <Button variant="primary" className="h-12 px-6 gap-2 rounded-full shadow-lg shadow-forest/10">
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
                                initialData={editingLot}
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
                        <div className="py-20 text-center space-y-4">
                            <div className="animate-spin h-8 w-8 border-4 border-forest border-t-transparent rounded-full mx-auto" />
                            <p className="text-bark/60 font-sans animate-pulse">Carregando seus produtos...</p>
                        </div>
                    ) : lots?.length === 0 ? (
                        <div className="py-20 text-center px-6">
                            <div className="bg-sage/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Leaf className="h-8 w-8 text-forest/40" />
                            </div>
                            <h3 className="text-xl font-display text-soil font-bold">Nenhum lote encontrado</h3>
                            <p className="text-bark/60 font-sans mt-2 max-w-sm mx-auto">
                                Você ainda não registrou nenhum lote. Clique em "Novo Lote" para começar a vender.
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
                                        <TableHead>Preço</TableHead>
                                        <TableHead className="hidden md:table-cell">Colheita</TableHead>
                                        <TableHead className="hidden md:table-cell">Validade</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right pr-8">Ações</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {lots?.map((lot: any) => {
                                        const isExpired = new Date(lot.expiryDate) < new Date();
                                        const isLastChance = !isExpired && new Date(lot.expiryDate) < new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

                                        return (
                                            <TableRow key={lot.id} className="group border-forest/5 hover:bg-forest/[0.02] transition-colors">
                                                <TableCell className="pl-8 py-4">
                                                    <div className="h-12 w-12 rounded-lg overflow-hidden border border-forest/10 shadow-sm">
                                                        <img
                                                            src={lot.imageUrl}
                                                            className="h-full w-full object-cover group-hover:scale-110 transition-transform duration-500"
                                                            alt={lot.productName}
                                                        />
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <span className="font-bold text-soil font-sans">{lot.productName}</span>
                                                    <div className="text-[10px] text-bark/50 uppercase tracking-widest mt-0.5">{lot.lotCode}</div>
                                                </TableCell>
                                                <TableCell className="font-sans text-bark/80">
                                                    {formatQuantity(lot.availableQty, lot.unit)}
                                                </TableCell>
                                                <TableCell className="font-bold text-forest font-sans">
                                                    {formatCurrency(lot.priceOverride)}
                                                </TableCell>
                                                <TableCell className="hidden md:table-cell font-sans text-bark/60">
                                                    {formatDate(lot.harvestDate)}
                                                </TableCell>
                                                <TableCell className="hidden md:table-cell font-sans text-bark/60">
                                                    {formatDate(lot.expiryDate)}
                                                </TableCell>
                                                <TableCell>
                                                    {isExpired ? (
                                                        <Badge variant="destructive" className="bg-red-50 text-red-600 border-red-100 rounded-full font-sans weight-bold">Vencido</Badge>
                                                    ) : isLastChance ? (
                                                        <Badge className="bg-orange-50 text-orange-600 border-orange-100 rounded-full font-sans weight-bold">Last Chance</Badge>
                                                    ) : (
                                                        <Badge className="bg-forest/10 text-forest border-forest/20 rounded-full font-sans weight-bold">Ativo</Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right pr-8">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-forest/10 rounded-full">
                                                                <MoreHorizontal className="h-4 w-4 text-forest" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" className="w-[160px] p-1 border-forest/10 font-sans shadow-xl">
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
