"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@frescari/ui";
import { trpc } from "@/trpc/react";
import { Sprout, ShoppingBag, ArrowRight } from "lucide-react";

type TenantType = "PRODUCER" | "BUYER";

export function OnboardingClient() {
    const router = useRouter();
    const [selectedType, setSelectedType] = useState<TenantType | null>(null);
    const [companyName, setCompanyName] = useState("");

    const setupAccount = trpc.onboarding.setupAccount.useMutation({
        onSuccess: (data: { tenantId: string; type: string | null }) => {
            if (data.type === "BUYER") {
                router.push("/catalogo");
            } else {
                router.push("/dashboard");
            }
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedType || companyName.trim().length < 2) return;

        setupAccount.mutate({
            type: selectedType,
            companyName: companyName.trim(),
        });
    };

    const label =
        selectedType === "PRODUCER"
            ? "Nome da Fazenda / Razão Social"
            : selectedType === "BUYER"
                ? "Nome do Restaurante / Sacolão"
                : "Nome da Empresa";

    return (
        <main className="min-h-screen flex items-center justify-center px-4 py-16">
            <div className="w-full max-w-lg">
                {/* Header */}
                <div className="text-center mb-10">
                    <div className="inline-flex items-center justify-center w-14 h-14 bg-forest rounded-md mb-5">
                        <span className="font-display text-white font-black text-2xl italic leading-none">
                            F
                        </span>
                    </div>
                    <h1 className="font-display text-3xl sm:text-4xl font-bold text-soil italic tracking-tight">
                        Bem-vindo ao Frescari
                    </h1>
                    <p className="font-sans text-sm text-bark mt-2 max-w-sm mx-auto">
                        Para começar, nos diga: qual é o seu perfil?
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Profile Cards */}
                    <div className="grid grid-cols-2 gap-4">
                        <button
                            type="button"
                            onClick={() => setSelectedType("PRODUCER")}
                            className={`group relative flex flex-col items-center gap-3 p-6 rounded-lg border-2 transition-all duration-200 cursor-pointer ${selectedType === "PRODUCER"
                                ? "border-forest bg-forest/5 shadow-md"
                                : "border-soil/10 bg-white hover:border-forest/40 hover:shadow-sm"
                                }`}
                        >
                            <div
                                className={`w-12 h-12 rounded-md flex items-center justify-center transition-colors ${selectedType === "PRODUCER"
                                    ? "bg-forest"
                                    : "bg-sage group-hover:bg-forest/20"
                                    }`}
                            >
                                <Sprout
                                    className={`w-6 h-6 ${selectedType === "PRODUCER"
                                        ? "text-white"
                                        : "text-forest"
                                        }`}
                                />
                            </div>
                            <div className="text-center">
                                <p className="font-sans text-sm font-semibold text-soil">
                                    Sou Produtor
                                </p>
                                <p className="font-sans text-[11px] text-bark mt-0.5">
                                    Vendo hortifruti
                                </p>
                            </div>
                            {selectedType === "PRODUCER" && (
                                <div className="absolute top-2 right-2 w-5 h-5 bg-forest rounded-full flex items-center justify-center">
                                    <svg
                                        className="w-3 h-3 text-white"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                        strokeWidth={3}
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            d="M5 13l4 4L19 7"
                                        />
                                    </svg>
                                </div>
                            )}
                        </button>

                        <button
                            type="button"
                            onClick={() => setSelectedType("BUYER")}
                            className={`group relative flex flex-col items-center gap-3 p-6 rounded-lg border-2 transition-all duration-200 cursor-pointer ${selectedType === "BUYER"
                                ? "border-forest bg-forest/5 shadow-md"
                                : "border-soil/10 bg-white hover:border-forest/40 hover:shadow-sm"
                                }`}
                        >
                            <div
                                className={`w-12 h-12 rounded-md flex items-center justify-center transition-colors ${selectedType === "BUYER"
                                    ? "bg-forest"
                                    : "bg-sage group-hover:bg-forest/20"
                                    }`}
                            >
                                <ShoppingBag
                                    className={`w-6 h-6 ${selectedType === "BUYER"
                                        ? "text-white"
                                        : "text-forest"
                                        }`}
                                />
                            </div>
                            <div className="text-center">
                                <p className="font-sans text-sm font-semibold text-soil">
                                    Sou Comprador
                                </p>
                                <p className="font-sans text-[11px] text-bark mt-0.5">
                                    Compro hortifruti
                                </p>
                            </div>
                            {selectedType === "BUYER" && (
                                <div className="absolute top-2 right-2 w-5 h-5 bg-forest rounded-full flex items-center justify-center">
                                    <svg
                                        className="w-3 h-3 text-white"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                        strokeWidth={3}
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            d="M5 13l4 4L19 7"
                                        />
                                    </svg>
                                </div>
                            )}
                        </button>
                    </div>

                    {/* Company Name Input — only appears after selection */}
                    {selectedType && (
                        <div className="space-y-2 animate-[slide-up-fade_0.3s_ease-out]">
                            <label
                                htmlFor="companyName"
                                className="block font-sans text-xs font-bold uppercase tracking-wider text-bark"
                            >
                                {label}
                            </label>
                            <input
                                id="companyName"
                                type="text"
                                value={companyName}
                                onChange={(e) => setCompanyName(e.target.value)}
                                placeholder={
                                    selectedType === "PRODUCER"
                                        ? "Ex: Fazenda São João"
                                        : "Ex: Restaurante Sabor da Terra"
                                }
                                className="w-full px-4 py-3 rounded-md border border-soil/15 bg-white font-sans text-sm text-soil placeholder:text-bark/40 focus:outline-none focus:ring-2 focus:ring-forest/30 focus:border-forest transition-all"
                                autoFocus
                                required
                                minLength={2}
                                maxLength={120}
                            />
                        </div>
                    )}

                    {/* Error Message */}
                    {setupAccount.error && (
                        <div className="px-4 py-3 rounded-md bg-red-50 border border-red-200">
                            <p className="font-sans text-xs text-red-700">
                                {setupAccount.error.message}
                            </p>
                        </div>
                    )}

                    {/* Submit Button */}
                    <Button
                        className="w-full normal-case tracking-normal"
                        type="submit"
                        disabled={
                            !selectedType ||
                            companyName.trim().length < 2
                        }
                        isPending={setupAccount.isPending}
                    >
                        <>
                            Continuar
                            <ArrowRight className="w-4 h-4" />
                        </>
                    </Button>
                </form>
            </div>
        </main>
    );
}
