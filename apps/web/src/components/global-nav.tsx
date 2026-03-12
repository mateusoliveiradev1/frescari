"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { Button } from "@frescari/ui";
import { authClient } from "@/lib/auth-client";
import { useState, useRef, useEffect, useSyncExternalStore } from "react";
import { ShoppingCart, Menu } from "lucide-react";
import { useCartStore, useCartTotals, CartStore } from "@/store/useCartStore";
import { BrandLogo } from "@/components/brand-logo";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@frescari/ui";

const CartDrawer = dynamic(
    () => import("@/components/CartDrawer").then((mod) => mod.CartDrawer),
    { ssr: false }
);

type SessionUser = {
    name?: string | null;
    email?: string | null;
    role?: string | null;
};

export function GlobalNav() {
    const pathname = usePathname();
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [user, setUser] = useState<SessionUser | null>(null);
    const profileRef = useRef<HTMLDivElement>(null);

    const role = user?.role;
    const canUseCart = role === "buyer";

    useEffect(() => {
        let cancelled = false;

        const loadSession = async () => {
            try {
                const response = await authClient.getSession();
                if (cancelled) {
                    return;
                }

                setUser((response.data?.user as SessionUser | undefined) ?? null);
            } catch (error) {
                if (cancelled) {
                    return;
                }

                console.error("Failed to load session", error);
                setUser(null);
            }
        };

        void loadSession();

        return () => {
            cancelled = true;
        };
    }, []);

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

    const navLinks = (isMobile = false) => {
        const linkClass = isMobile
            ? "font-sans text-lg font-bold uppercase tracking-widest text-bark hover:text-forest transition-colors py-4 border-b border-soil/5 last:border-0"
            : "font-sans text-[11px] font-bold uppercase tracking-[0.18em] transition-colors";
        const mobileLinkProps = isMobile
            ? { onClick: () => setIsMenuOpen(false) }
            : undefined;

        const getActiveStoreClass = (href: string) => {
            if (isMobile) return pathname === href || pathname.startsWith(href) ? "text-forest" : "text-bark";
            return pathname === href || pathname.startsWith(href) ? "text-forest" : "text-bark hover:text-forest";
        };

        if (!user) {
            return (
                <>
                    {pathname === "/" && (
                        <Link href="#como-funciona" className={`${linkClass} ${pathname === '/' ? 'text-forest' : 'text-bark hover:text-forest'}`} {...mobileLinkProps}>
                            Como Funciona
                        </Link>
                    )}
                    <Link href="/catalogo" className={`${linkClass} ${getActiveStoreClass('/catalogo')}`} {...mobileLinkProps}>
                        Catálogo
                    </Link>
                    {isMobile && (
                        <Link href="/auth/login" className={`${linkClass} text-bark hover:text-forest`} {...mobileLinkProps}>
                            Entrar
                        </Link>
                    )}
                </>
            );
        }

        if (role === 'producer') {
            return (
                <>
                    <Link href="/dashboard" className={`${linkClass} ${pathname === '/dashboard' ? 'text-forest' : 'text-bark hover:text-forest'}`} {...mobileLinkProps}>
                        Dashboard
                    </Link>
                    <Link href="/dashboard/inventario" className={`${linkClass} ${getActiveStoreClass('/dashboard/inventario')}`} {...mobileLinkProps}>
                        Meu Inventário
                    </Link>
                    <Link href="/dashboard/vendas" className={`${linkClass} ${getActiveStoreClass('/dashboard/vendas')}`} {...mobileLinkProps}>
                        Meus Pedidos
                    </Link>
                    <Link href="/catalogo" className={`${linkClass} ${getActiveStoreClass('/catalogo')}`} {...mobileLinkProps}>
                        Catálogo
                    </Link>
                </>
            );
        }

        // buyer
        return (
            <>
                <Link href="/dashboard" className={`${linkClass} ${pathname === '/dashboard' ? 'text-forest' : 'text-bark hover:text-forest'}`} {...mobileLinkProps}>
                    Painel de Compras
                </Link>
                <Link href="/catalogo" className={`${linkClass} ${getActiveStoreClass('/catalogo')}`} {...mobileLinkProps}>
                    Catálogo
                </Link>
                <Link href="/dashboard/pedidos" className={`${linkClass} ${getActiveStoreClass('/dashboard/pedidos')}`} {...mobileLinkProps}>
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
                    <BrandLogo
                        size="md"
                        className="transition-transform duration-200 group-hover:-translate-y-0.5"
                    />
                </Link>

                <div className="flex items-center gap-3 sm:gap-8">
                    {/* Desktop Links */}
                    <div className="hidden md:flex items-center gap-8">
                        {navLinks()}
                    </div>

                    {/* Cart trigger button */}
                    {canUseCart && <CartButton />}

                    {/* Auth Actions (Desktop & Mobile header) */}
                    {!user && (
                        <div className="flex items-center gap-3">
                            <Link href="/auth/login" className="hidden sm:block font-sans text-[11px] font-bold uppercase tracking-[0.18em] text-bark hover:text-forest transition-colors">
                                Entrar
                            </Link>
                            <Link href="/auth/register">
                                <Button variant="primary" size="sm" className="h-9 px-4 sm:h-10 sm:px-6">Começar</Button>
                            </Link>
                        </div>
                    )}

                    {/* Mobile Hamburger Menu */}
                    <div className="md:hidden">
                        <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
                            <SheetTrigger asChild>
                                <button className="p-2 text-bark hover:text-forest transition-colors outline-none">
                                    <Menu className="w-6 h-6" />
                                </button>
                            </SheetTrigger>
                            <SheetContent side="right" className="w-[300px] flex flex-col pt-12">
                                <SheetHeader>
                                    <SheetTitle className="text-left font-display italic text-3xl mb-8">Menu</SheetTitle>
                                    <SheetDescription className="sr-only">
                                        Menu de navegação principal para compradores e produtores.
                                    </SheetDescription>
                                </SheetHeader>
                                <div className="flex flex-col flex-1">
                                    {navLinks(true)}
                                </div>

                                {user && (
                                    <div className="mt-auto pt-6 border-t border-soil/10">
                                        <div className="flex items-center gap-3 mb-6">
                                            <div className="w-10 h-10 rounded-sm bg-forest flex items-center justify-center">
                                                <span className="font-display text-white text-lg font-black leading-none">
                                                    {user.name?.charAt(0).toUpperCase() ?? "U"}
                                                </span>
                                            </div>
                                            <div className="flex flex-col">
                                                <p className="font-sans text-sm font-bold text-soil">{user.name}</p>
                                                <p className="font-sans text-xs text-bark">{user.email}</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={handleSignOut}
                                            className="w-full py-3 px-4 rounded-sm bg-red-50 text-red-600 font-sans text-sm font-bold uppercase tracking-widest text-center"
                                        >
                                            Sair da Conta
                                        </button>
                                    </div>
                                )}
                            </SheetContent>
                        </Sheet>
                    </div>

                    {/* Profile Dropdown (Desktop Only) */}
                    {user && (
                        <div className="hidden md:block relative" ref={profileRef}>
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
            {canUseCart && <CartDrawer />}
        </nav>
    );
}

// Client-only cart button to avoid hydration mismatch with local storage counts
function CartButton() {
    const toggleCart = useCartStore((state: CartStore) => state.toggleCart);
    const { totalItems } = useCartTotals();
    const hasHydrated = useSyncExternalStore(
        (callback) => {
            const unsubscribeHydrate = useCartStore.persist.onHydrate(callback);
            const unsubscribeFinish = useCartStore.persist.onFinishHydration(callback);

            return () => {
                unsubscribeHydrate();
                unsubscribeFinish();
            };
        },
        () => useCartStore.persist.hasHydrated(),
        () => false,
    );

    if (!hasHydrated) return null;

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
