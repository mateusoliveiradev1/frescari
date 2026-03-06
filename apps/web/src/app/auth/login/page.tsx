"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@frescari/ui";
import Link from "next/link";

// ────────────────────────────────────────────
// Reusable form input styled for Frescari DS
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
// Login Page
// ────────────────────────────────────────────
export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            await authClient.signIn.email(
                { email, password },
                {
                    onSuccess: () => {
                        // Hard reload para forçar a remontagem de toda a árvore de componentes
                        window.location.href = "/dashboard";
                    },
                    onError: (ctx) => {
                        setError(ctx.error.message || "Credenciais inválidas. Verifique seu e-mail e senha.");
                        setLoading(false);
                    },
                }
            );
        } catch (err: unknown) {
            const message =
                err instanceof Error
                    ? err.message
                    : "Erro inesperado ao conectar. Tente novamente.";
            setError(message);
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen bg-cream">
            {/* ── Left brand panel ── */}
            <div className="hidden lg:flex lg:w-[45%] flex-col justify-between p-16 bg-forest relative overflow-hidden">
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

                <div className="relative z-10 space-y-6">
                    <blockquote className="font-display text-4xl font-black text-cream italic leading-tight">
                        &ldquo;O frescor começa na raiz, não na gôndola.&rdquo;
                    </blockquote>
                    <p className="font-sans text-sm text-sage/80 leading-relaxed max-w-xs">
                        Conectando produtores familiares ao comércio local com tecnologia que respeita a terra.
                    </p>
                </div>

                <p className="font-sans text-[9px] font-bold uppercase tracking-[0.2em] text-sage/40 relative z-10">
                    Plataforma B2B · Sustentabilidade
                </p>
            </div>

            {/* ── Right form panel ── */}
            <div className="flex-1 flex items-center justify-center p-6 lg:p-16">
                <div className="w-full max-w-sm space-y-8">

                    {/* Mobile logo */}
                    <div className="flex lg:hidden items-center gap-2">
                        <div className="w-8 h-8 bg-forest rounded-sm flex items-center justify-center">
                            <span className="font-display text-white font-black text-base italic leading-none">F</span>
                        </div>
                        <span className="font-display text-soil text-lg font-bold italic">Frescari</span>
                    </div>

                    <div className="space-y-1">
                        <h1 className="font-display text-3xl font-black text-soil">
                            Bem-vindo de volta
                        </h1>
                        <p className="font-sans text-sm text-bark">
                            Acesse sua conta para ver as ofertas de hoje.
                        </p>
                    </div>

                    {/* Error feedback */}
                    {error && <ErrorAlert message={error} />}

                    <form onSubmit={handleLogin} className="space-y-5" noValidate>
                        <Field
                            label="Email"
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
                            label="Senha"
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                            autoComplete="current-password"
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
                                    Entrando…
                                </span>
                            ) : (
                                "Entrar"
                            )}
                        </Button>
                    </form>

                    <div className="pt-4 border-t border-soil/8 text-center">
                        <span className="font-sans text-sm text-bark">Não possui uma conta? </span>
                        <Link
                            href="/auth/register"
                            className="font-sans text-sm font-semibold text-forest hover:underline underline-offset-4"
                        >
                            Registre-se aqui
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
