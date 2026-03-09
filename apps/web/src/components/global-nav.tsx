"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@frescari/ui";
import { authClient } from "@/lib/auth-client";
import { useState, useRef, useEffect } from "react";
import { ShoppingCart } from "lucide-react";
import { useCartStore, useCartTotals, CartStore } from "@/store/useCartStore";

const CartDrawer = dynamic(
    () => import("@/components/CartDrawer").then((mod) => mod.CartDrawer),
    { ssr: false }
);

export function GlobalNav({ session: initialSession }: { session: any }) {
    const pathname = usePathname();
    const router = useRouter();
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const profileRef = useRef<HTMLDivElement>(null);

    const user = initialSession?.user;
    const role = user?.role;

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
                setIsProfileOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleSignOut = async () => {
        await authClient.signOut();
        useCartStore.getState().clearCart();
        window.location.href = '/';
    };

    const navLinks = () => {
        if (!user) {
            return (
                <>
                    {pathname === "/" && (
                        <Link href="#como-funciona" className="font-sans text-[11px] font-bold uppercase tracking-[0.18em] text-bark hover:text-forest transition-colors">
                            Como Funciona
                        </Link>
                    )}
                    <Link href="/catalogo" className={`font-sans text-[11px] font-bold uppercase tracking-[0.18em] transition-colors ${pathname.startsWith('/catalogo') ? 'text-forest' : 'text-bark hover:text-forest'}`}>
                        Catálogo
                    </Link>
                    <Link href="/auth/login" className="font-sans text-[11px] font-bold uppercase tracking-[0.18em] text-bark hover:text-forest transition-colors">
                        Entrar
                    </Link>
                    <Link href="/auth/register">
                        <Button variant="primary" size="sm">Começar Agora</Button>
                    </Link>
                </>
            );
        }

        if (role === 'producer') {
            return (
                <>
                    <Link href="/dashboard" className={`font-sans text-[11px] font-bold uppercase tracking-[0.18em] transition-colors ${pathname === '/dashboard' ? 'text-forest' : 'text-bark hover:text-forest'}`}>
                        Dashboard
                    </Link>
                    <Link href="/dashboard/inventario" className={`font-sans text-[11px] font-bold uppercase tracking-[0.18em] transition-colors ${pathname.startsWith('/dashboard/inventario') ? 'text-forest' : 'text-bark hover:text-forest'}`}>
                        Meu Inventário
                    </Link>
                    <Link href="/catalogo" className={`font-sans text-[11px] font-bold uppercase tracking-[0.18em] transition-colors ${pathname.startsWith('/catalogo') ? 'text-forest' : 'text-bark hover:text-forest'}`}>
                        Catálogo
                    </Link>
                </>
            );
        }

        // buyer
        return (
            <>
                <Link href="/dashboard" className={`font-sans text-[11px] font-bold uppercase tracking-[0.18em] transition-colors ${pathname === '/dashboard' ? 'text-forest' : 'text-bark hover:text-forest'}`}>
                    Painel de Compras
                </Link>
                <Link href="/catalogo" className={`font-sans text-[11px] font-bold uppercase tracking-[0.18em] transition-colors ${pathname.startsWith('/catalogo') ? 'text-forest' : 'text-bark hover:text-forest'}`}>
                    Catálogo
                </Link>
                <Link href="/dashboard/pedidos" className={`font-sans text-[11px] font-bold uppercase tracking-[0.18em] transition-colors ${pathname.startsWith('/dashboard/pedidos') ? 'text-forest' : 'text-bark hover:text-forest'}`}>
                    Meus Pedidos
                </Link>
            </>
        );
    };

    return (
        <nav className="sticky top-0 w-full z-50 bg-cream/90 backdrop-blur-md border-b border-soil/8">
            <div className="max-w-[1400px] mx-auto px-6 lg:px-12 h-[72px] flex items-center justify-between">
                {/* Logo */}
                <Link href="/" className="flex items-center gap-3 group">
                    <div className="w-9 h-9 bg-forest rounded-sm flex items-center justify-center transition-all group-hover:bg-forest-hover">
                        <span className="font-display text-white font-black text-lg italic leading-none">F</span>
                    </div>
                    <span className="font-display text-xl font-bold text-soil italic tracking-tight hidden sm:block">Frescari</span>
                </Link>

                <div className="flex items-center gap-6 sm:gap-8">
                    {/* Desktop Links */}
                    <div className="hidden md:flex items-center gap-8">
                        {navLinks()}
                    </div>

                    {/* Cart trigger button */}
                    {user && <CartButton />}

                    {/* Mobile Login / Register (only when logged out) */}
                    {!user && (
                        <div className="flex md:hidden items-center gap-3">
                            <Link href="/auth/login" className="font-sans text-[11px] font-bold uppercase tracking-[0.18em] text-bark hover:text-forest transition-colors">
                                Entrar
                            </Link>
                            <Link href="/auth/register">
                                <Button variant="primary" size="sm">Começar</Button>
                            </Link>
                        </div>
                    )}

                    {/* Profile Dropdown */}
                    {user && (
                        <div className="relative" ref={profileRef}>
                            <button
                                onClick={() => setIsProfileOpen(!isProfileOpen)}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-sm bg-sage/60 border border-forest/15 hover:bg-sage transition-colors cursor-pointer"
                            >
                                <div className="w-6 h-6 rounded-sm bg-forest flex items-center justify-center flex-shrink-0">
                                    <span className="font-display text-white text-xs font-black leading-none">
                                        {user.name?.charAt(0).toUpperCase() ?? "U"}
                                    </span>
                                </div>
                                <span className="font-sans text-xs font-semibold text-forest truncate max-w-[100px] hidden sm:block">
                                    {user.name}
                                </span>
                            </button>

                            {isProfileOpen && (
                                <div className="absolute right-0 mt-2 w-48 bg-cream border border-soil/15 rounded-sm shadow-card py-1 flex flex-col z-50">
                                    <div className="px-4 py-3 border-b border-soil/8 mb-1">
                                        <p className="font-sans text-xs font-semibold text-soil truncate">{user.name}</p>
                                        <p className="font-sans text-[10px] text-bark truncate mt-0.5">{user.email}</p>
                                    </div>
                                    <button
                                        onClick={handleSignOut}
                                        className="w-full text-left px-4 py-2 font-sans text-xs font-bold text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                                    >
                                        Sair
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* The cart panel itself */}
            {user && <CartDrawer />}
        </nav>
    );
}

// Client-only cart button to avoid hydration mismatch with local storage counts
function CartButton() {
    const toggleCart = useCartStore((state: CartStore) => state.toggleCart);
    const { totalItems } = useCartTotals();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) return null;

    return (
        <button
            onClick={toggleCart}
            className="group relative flex items-center justify-center p-2 text-bark hover:text-forest transition-colors"
            aria-label="Abrir carrinho"
        >
            <ShoppingCart className="w-5 h-5" />
            {totalItems > 0 && (
                <span className="absolute top-0 right-0 -mr-1 -mt-1 flex h-4 w-4 items-center justify-center rounded-full bg-ember text-[9px] font-bold text-white shadow-sm ring-2 ring-cream">
                    {totalItems}
                </span>
            )}
        </button>
    );
}
