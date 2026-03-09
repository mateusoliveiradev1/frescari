"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@frescari/ui";
import Link from "next/link";
import { cn } from "@frescari/ui";

// ────────────────────────────────────────────
// Reusable styled input
// ────────────────────────────────────────────
interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label: string;
    id: string;
}

function Field({ label, id, ...props }: FieldProps) {
    return (
        <div className="space-y-1.5">
            <label
                htmlFor={id}
                className="font-sans text-[10px] font-bold uppercase tracking-[0.15em] text-bark"
            >
                {label}
            </label>
            <input
                id={id}
                className={[
                    "w-full px-4 py-3 rounded-sm",
                    "bg-cream border border-soil/15",
                    "font-sans text-sm text-soil",
                    "outline-none transition-all duration-150",
                    "placeholder:text-bark/40",
                    "focus:border-forest focus:ring-2 focus:ring-forest/15",
                    "hover:border-soil/30",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                ].join(" ")}
                {...props}
            />
        </div>
    );
}

// ────────────────────────────────────────────
// Inline error alert
// ────────────────────────────────────────────
function ErrorAlert({ message }: { message: string }) {
    return (
        <div
            role="alert"
            aria-live="assertive"
            className="flex items-start gap-3 p-4 bg-ember/8 border border-ember/30 rounded-sm animate-[slide-up-fade_0.2s_ease-out]"
        >
            <div className="w-1 rounded-full bg-ember flex-shrink-0 self-stretch min-h-[1rem]" />
            <div className="flex-1 min-w-0">
                <p className="font-sans text-xs font-bold uppercase tracking-wide text-ember mb-0.5">
                    Erro
                </p>
                <p className="font-sans text-sm text-soil/80">{message}</p>
            </div>
        </div>
    );
}

// ────────────────────────────────────────────
// Success banner
// ────────────────────────────────────────────
function SuccessAlert({ message }: { message: string }) {
    return (
        <div
            role="status"
            aria-live="polite"
            className="flex items-start gap-3 p-4 bg-sage/60 border border-forest/25 rounded-sm animate-[slide-up-fade_0.2s_ease-out]"
        >
            <div className="w-1 rounded-full bg-forest flex-shrink-0 self-stretch min-h-[1rem]" />
            <p className="font-sans text-sm text-forest">{message}</p>
        </div>
    );
}


// ────────────────────────────────────────────
// Loading spinner
// ────────────────────────────────────────────
function Spinner() {
    return (
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
    );
}

// ────────────────────────────────────────────
// Register Page
// ────────────────────────────────────────────
export default function RegisterPage() {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setSuccess("");
        setLoading(true);

        try {
            await authClient.signUp.email(
                {
                    email,
                    password,
                    name,
                },
                {
                    onSuccess: () => {
                        setSuccess("Conta criada com sucesso! Redirecionando…");
                        // Refresh to sync navbar server cache with new session
                        router.refresh();
                        // Redirect to onboarding
                        setTimeout(() => router.push("/onboarding"), 800);
                    },
                    onError: (ctx) => {
                        // Map common Better Auth error codes to user-friendly PT-BR messages
                        const code = ctx.error.code ?? "";
                        const msgMap: Record<string, string> = {
                            USER_ALREADY_EXISTS: "Este e-mail já está cadastrado. Tente fazer login.",
                            INVALID_EMAIL: "Formato de e-mail inválido.",
                            PASSWORD_TOO_SHORT: "A senha deve ter pelo menos 6 caracteres.",
                            WEAK_PASSWORD: "Senha muito fraca. Use letras, números e símbolos.",
                        };
                        setError(msgMap[code] ?? ctx.error.message ?? "Erro ao criar conta. Tente novamente.");
                    },
                }
            );
        } catch (err: unknown) {
            const message =
                err instanceof Error
                    ? err.message
                    : "Erro inesperado de rede. Verifique sua conexão e tente novamente.";
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen bg-cream">
            {/* ── Left brand panel ── */}
            <div className="hidden lg:flex lg:w-[40%] flex-col justify-between p-16 bg-forest relative overflow-hidden">
                <div
                    className="absolute inset-0 opacity-10"
                    style={{ backgroundImage: "radial-gradient(#f9f6f0 1px, transparent 1px)", backgroundSize: "22px 22px" }}
                />
                <Link href="/" className="flex items-center gap-3 relative z-10">
                    <div className="w-9 h-9 bg-cream/15 rounded-sm border border-cream/20 flex items-center justify-center">
                        <span className="font-display text-cream font-black text-lg italic leading-none">F</span>
                    </div>
                    <span className="font-display text-cream text-xl font-bold italic">Frescari</span>
                </Link>

                <div className="relative z-10 space-y-8">
                    {[
                        { value: "−40%", label: "Desperdício médio evitado" },
                        { value: "50km", label: "Raio máximo de entrega" },
                        { value: "100%", label: "Produtor familiar" },
                    ].map((stat) => (
                        <div key={stat.value} className="border-l-2 border-sage/30 pl-4">
                            <p className="font-display text-3xl font-black text-cream italic">{stat.value}</p>
                            <p className="font-sans text-xs text-sage/70 mt-0.5 uppercase tracking-widest">{stat.label}</p>
                        </div>
                    ))}
                </div>

                <p className="font-sans text-[9px] font-bold uppercase tracking-[0.2em] text-sage/40 relative z-10">
                    Plataforma B2B · Hortifruti
                </p>
            </div>

            {/* ── Right form panel ── */}
            <div className="flex-1 flex items-center justify-center p-6 lg:p-16 overflow-y-auto">
                <div className="w-full max-w-sm space-y-8 py-8">

                    {/* Mobile logo */}
                    <div className="flex lg:hidden items-center gap-2">
                        <div className="w-8 h-8 bg-forest rounded-sm flex items-center justify-center">
                            <span className="font-display text-white font-black text-base italic leading-none">F</span>
                        </div>
                        <span className="font-display text-soil text-lg font-bold italic">Frescari</span>
                    </div>

                    <div className="space-y-1">
                        <h1 className="font-display text-3xl font-black text-soil">Nova Conta</h1>
                        <p className="font-sans text-sm text-bark">
                            O marketplace focado em hortifruti B2B.
                        </p>
                    </div>

                    {/* Alerts */}
                    {error && <ErrorAlert message={error} />}
                    {success && <SuccessAlert message={success} />}

                    <form onSubmit={handleRegister} className="space-y-5" noValidate>
                        <Field
                            label="Nome Completo"
                            id="name"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Ex: Maria Silva"
                            required
                            autoComplete="name"
                            disabled={loading}
                        />

                        <Field
                            label="Email Corporativo"
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="seu@email.com"
                            required
                            autoComplete="email"
                            disabled={loading}
                        />

                        <Field
                            label="Senha Segura"
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="mínimo 6 caracteres"
                            required
                            minLength={6}
                            autoComplete="new-password"
                            disabled={loading}
                        />

                        <Button
                            type="submit"
                            variant="primary"
                            size="lg"
                            className="w-full"
                            disabled={loading}
                            aria-disabled={loading}
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <Spinner />
                                    Criando conta…
                                </span>
                            ) : (
                                "Criar Conta e Acessar"
                            )}
                        </Button>
                    </form>

                    <div className="pt-4 border-t border-soil/8 text-center">
                        <span className="font-sans text-sm text-bark">Já possui uma conta? </span>
                        <Link
                            href="/auth/login"
                            className="font-sans text-sm font-semibold text-forest hover:underline underline-offset-4"
                        >
                            Acesse agora
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
