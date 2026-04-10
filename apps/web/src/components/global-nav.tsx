"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Menu, ShoppingCart } from "lucide-react";
import { Button } from "@frescari/ui";

import { BrandLogo } from "@/components/brand-logo";
import { getPersonalMenuItems } from "@/components/global-nav.model";
import { NotificationInboxSheet } from "@/components/notification-inbox-sheet";
import { authClient } from "@/lib/auth-client";
import { CartStore, useCartStore, useCartTotals } from "@/store/useCartStore";
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
  { ssr: false },
);

type SessionUser = {
  name?: string | null;
  email?: string | null;
  role?: string | null;
};

type ClientSessionResponse = {
  data?: {
    user?: SessionUser | null;
  } | null;
  user?: SessionUser | null;
} | null;

function getLinkState(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href);
}

function getDesktopLinkClasses(active: boolean) {
  return [
    "relative font-sans text-[11px] font-bold uppercase tracking-[0.18em]",
    "transition-[color] duration-200",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2 focus-visible:ring-offset-cream",
    "after:absolute after:left-0 after:-bottom-2 after:h-px after:w-full after:origin-left after:bg-forest after:transition-transform after:duration-200",
    active
      ? "text-forest after:scale-x-100"
      : "text-bark hover:text-forest after:scale-x-0 hover:after:scale-x-100",
  ].join(" ");
}

function getMobileLinkClasses(active: boolean) {
  return [
    "rounded-sm px-1 py-4 font-sans text-lg font-bold uppercase tracking-[0.18em]",
    "transition-[color,background-color] duration-200",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2 focus-visible:ring-offset-cream",
    "border-b border-soil/5 last:border-0",
    active
      ? "bg-sage/35 text-forest"
      : "text-bark hover:bg-forest/5 hover:text-forest",
  ].join(" ");
}

export function GlobalNav() {
  const pathname = usePathname();
  const isAuthRoute = pathname.startsWith("/auth");
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  const role = user?.role;
  const canUseCart = role === "buyer";
  const canUseNotifications = role === "buyer" || role === "producer";
  const personalMenuItems = getPersonalMenuItems(user);

  useEffect(() => {
    let cancelled = false;

    const loadSession = async () => {
      try {
        const response =
          (await authClient.getSession()) as ClientSessionResponse;
        if (cancelled) {
          return;
        }

        setUser(response?.data?.user ?? response?.user ?? null);
      } catch (error) {
        void error;
        if (cancelled) {
          return;
        }
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
      if (
        profileRef.current &&
        !profileRef.current.contains(event.target as Node)
      ) {
        setIsProfileOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (isAuthRoute) {
    return null;
  }

  const handleSignOut = async () => {
    await authClient.signOut();
    useCartStore.getState().clearCart();
    window.location.href = "/";
  };

  const navLinks = (isMobile = false) => {
    const baseProps = isMobile
      ? { onClick: () => setIsMenuOpen(false) }
      : undefined;

    const linkClasses = (href: string) => {
      const active = getLinkState(pathname, href);
      return isMobile
        ? getMobileLinkClasses(active)
        : getDesktopLinkClasses(active);
    };

    if (!user) {
      return (
        <>
          {pathname === "/" ? (
            <Link
              aria-current="page"
              className={
                isMobile
                  ? getMobileLinkClasses(true)
                  : getDesktopLinkClasses(true)
              }
              href="#como-funciona"
              {...baseProps}
            >
              Como Funciona
            </Link>
          ) : null}
          <Link
            aria-current={pathname === "/catalogo" ? "page" : undefined}
            className={linkClasses("/catalogo")}
            href="/catalogo"
            {...baseProps}
          >
            Catálogo
          </Link>
          {isMobile ? (
            <Link
              className={getMobileLinkClasses(false)}
              href="/auth/login"
              {...baseProps}
            >
              Entrar
            </Link>
          ) : null}
        </>
      );
    }

    if (role === "producer") {
      return (
        <>
          <Link
            aria-current={pathname === "/dashboard" ? "page" : undefined}
            className={
              pathname === "/dashboard"
                ? isMobile
                  ? getMobileLinkClasses(true)
                  : getDesktopLinkClasses(true)
                : linkClasses("/dashboard")
            }
            href="/dashboard"
            {...baseProps}
          >
            Dashboard
          </Link>
          <Link
            aria-current={
              pathname.startsWith("/dashboard/fazenda") ? "page" : undefined
            }
            className={linkClasses("/dashboard/fazenda")}
            href="/dashboard/fazenda"
            {...baseProps}
          >
            Minha Fazenda
          </Link>
          <Link
            aria-current={
              pathname.startsWith("/dashboard/inventario") ? "page" : undefined
            }
            className={linkClasses("/dashboard/inventario")}
            href="/dashboard/inventario"
            {...baseProps}
          >
            Estoque e Lotes
          </Link>
          <Link
            aria-current={
              pathname.startsWith("/dashboard/vendas") ? "page" : undefined
            }
            className={linkClasses("/dashboard/vendas")}
            href="/dashboard/vendas"
            {...baseProps}
          >
            Vendas
          </Link>
          <Link
            aria-current={pathname.startsWith("/catalogo") ? "page" : undefined}
            className={linkClasses("/catalogo")}
            href="/catalogo"
            {...baseProps}
          >
            Vitrine
          </Link>
          <Link
            aria-current={
              pathname.startsWith("/dashboard/entregas") ? "page" : undefined
            }
            className={`${linkClasses("/dashboard/entregas")} inline-flex items-center gap-2`}
            href="/dashboard/entregas"
            {...baseProps}
          >
            <span>Entregas</span>
          </Link>
        </>
      );
    }

    if (role === "admin") {
      return (
        <>
          <Link
            aria-current={pathname === "/admin" ? "page" : undefined}
            className={
              pathname === "/admin"
                ? isMobile
                  ? getMobileLinkClasses(true)
                  : getDesktopLinkClasses(true)
                : linkClasses("/admin")
            }
            href="/admin"
            {...baseProps}
          >
            Plataforma
          </Link>
          <Link
            aria-current={
              pathname.startsWith("/admin/catalogo") ? "page" : undefined
            }
            className={linkClasses("/admin/catalogo")}
            href="/admin/catalogo"
            {...baseProps}
          >
            Catalogo
          </Link>
          <Link
            aria-current={
              pathname.startsWith("/admin/usuarios") ? "page" : undefined
            }
            className={linkClasses("/admin/usuarios")}
            href="/admin/usuarios"
            {...baseProps}
          >
            Usuarios
          </Link>
          <Link
            aria-current={pathname.startsWith("/catalogo") ? "page" : undefined}
            className={linkClasses("/catalogo")}
            href="/catalogo"
            {...baseProps}
          >
            Marketplace
          </Link>
        </>
      );
    }

    return (
      <>
        <Link
          aria-current={pathname === "/dashboard" ? "page" : undefined}
          className={
            pathname === "/dashboard"
              ? isMobile
                ? getMobileLinkClasses(true)
                : getDesktopLinkClasses(true)
              : linkClasses("/dashboard")
          }
          href="/dashboard"
          {...baseProps}
        >
          Visão Geral
        </Link>
        <Link
          aria-current={pathname.startsWith("/catalogo") ? "page" : undefined}
          className={linkClasses("/catalogo")}
          href="/catalogo"
          {...baseProps}
        >
          Mercado
        </Link>
        <Link
          aria-current={
            pathname.startsWith("/dashboard/pedidos") ? "page" : undefined
          }
          className={linkClasses("/dashboard/pedidos")}
          href="/dashboard/pedidos"
          {...baseProps}
        >
          Histórico e Faturas
        </Link>
      </>
    );
  };

  return (
    <nav
      aria-label="Navegacao principal"
      className="sticky top-0 w-full z-50 bg-cream/90 backdrop-blur-md border-b border-soil/8"
    >
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12 h-[72px] flex items-center justify-between">
        <Link
          aria-label="Frescari, voltar para a pagina inicial"
          className="flex items-center gap-3 group"
          href="/"
        >
          <BrandLogo
            size="md"
            className="transition-transform duration-200 group-hover:-translate-y-0.5"
          />
        </Link>

        <div className="flex items-center gap-3 sm:gap-8">
          <div className="hidden md:flex items-center gap-8">{navLinks()}</div>

          {user && canUseNotifications ? <NotificationInboxSheet /> : null}
          {canUseCart ? <CartButton /> : null}

          {!user ? (
            <div className="flex items-center gap-3">
              <Link
                className="hidden sm:block font-sans text-[11px] font-bold uppercase tracking-[0.18em] text-bark hover:text-forest transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
                href="/auth/login"
              >
                Entrar
              </Link>
              <Link href="/auth/register">
                <Button
                  variant="primary"
                  size="sm"
                  className="h-9 px-4 sm:h-10 sm:px-6"
                >
                  Começar
                </Button>
              </Link>
            </div>
          ) : null}

          <div className="md:hidden">
            <Sheet onOpenChange={setIsMenuOpen} open={isMenuOpen}>
              <SheetTrigger asChild>
                <button
                  aria-label="Abrir menu principal"
                  className="rounded-sm p-2 text-bark hover:bg-forest/5 hover:text-forest transition-[color,background-color] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
                  type="button"
                >
                  <Menu className="w-6 h-6" />
                </button>
              </SheetTrigger>
              <SheetContent
                side="right"
                className="w-[320px] border-l border-forest/10 bg-cream/95 backdrop-blur-xl flex flex-col pt-12"
              >
                <SheetHeader>
                  <SheetTitle className="text-left font-display italic text-3xl mb-8">
                    Menu
                  </SheetTitle>
                  <SheetDescription className="sr-only">
                    Menu de navegação principal para compradores e produtores.
                  </SheetDescription>
                </SheetHeader>
                <div className="flex flex-col flex-1">{navLinks(true)}</div>

                {user ? (
                  <div className="mt-auto pt-6 border-t border-soil/10">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 rounded-sm bg-forest flex items-center justify-center">
                        <span className="font-display text-white text-lg font-black leading-none">
                          {user.name?.charAt(0).toUpperCase() ?? "U"}
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <p className="font-sans text-sm font-bold text-soil">
                          {user.name}
                        </p>
                        <p className="font-sans text-xs text-bark">
                          {user.email}
                        </p>
                      </div>
                    </div>
                    {personalMenuItems.map((item) => (
                      <Link
                        className="mb-3 block w-full rounded-sm border border-forest/15 bg-sage/40 px-4 py-3 font-sans text-sm font-bold uppercase tracking-widest text-forest text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
                        href={item.href}
                        key={item.key}
                        onClick={() => setIsMenuOpen(false)}
                      >
                        {item.label}
                      </Link>
                    ))}
                    <button
                      className="w-full py-3 px-4 rounded-sm bg-red-50 text-red-600 font-sans text-sm font-bold uppercase tracking-widest text-center transition-[background-color,color] hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
                      onClick={handleSignOut}
                      type="button"
                    >
                      Sair da Conta
                    </button>
                  </div>
                ) : null}
              </SheetContent>
            </Sheet>
          </div>

          {user ? (
            <div className="hidden md:block relative" ref={profileRef}>
              <button
                aria-expanded={isProfileOpen}
                aria-haspopup="menu"
                className="flex items-center gap-2 px-3 py-1.5 rounded-sm bg-sage/60 border border-forest/15 hover:bg-sage transition-[background-color,border-color] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                type="button"
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

              {isProfileOpen ? (
                <div
                  className="absolute right-0 mt-2 w-52 bg-cream border border-soil/15 rounded-sm shadow-card py-1 flex flex-col z-50"
                  role="menu"
                >
                  <div className="px-4 py-3 border-b border-soil/8 mb-1">
                    <p className="font-sans text-xs font-semibold text-soil truncate">
                      {user.name}
                    </p>
                    <p className="font-sans text-[10px] text-bark truncate mt-0.5">
                      {user.email}
                    </p>
                  </div>
                  {personalMenuItems.map((item) => (
                    <Link
                      className="px-4 py-2 font-sans text-xs font-bold text-forest hover:bg-sage/30 transition-colors focus-visible:outline-none focus-visible:bg-sage/30"
                      href={item.href}
                      key={item.key}
                      onClick={() => setIsProfileOpen(false)}
                      role="menuitem"
                    >
                      {item.label}
                    </Link>
                  ))}
                  <button
                    className="w-full text-left px-4 py-2 font-sans text-xs font-bold text-red-600 hover:bg-red-50 transition-colors cursor-pointer focus-visible:outline-none focus-visible:bg-red-50"
                    onClick={handleSignOut}
                    role="menuitem"
                    type="button"
                  >
                    Sair
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {canUseCart ? <CartDrawer /> : null}
    </nav>
  );
}

function CartButton() {
  const toggleCart = useCartStore((state: CartStore) => state.toggleCart);
  const { totalItems } = useCartTotals();
  const hasHydrated = useSyncExternalStore(
    (callback) => {
      const unsubscribeHydrate = useCartStore.persist.onHydrate(callback);
      const unsubscribeFinish =
        useCartStore.persist.onFinishHydration(callback);

      return () => {
        unsubscribeHydrate();
        unsubscribeFinish();
      };
    },
    () => useCartStore.persist.hasHydrated(),
    () => false,
  );

  if (!hasHydrated) {
    return null;
  }

  return (
    <button
      aria-label="Abrir carrinho"
      className="group relative flex items-center justify-center rounded-sm p-2 text-bark hover:bg-forest/5 hover:text-forest transition-[color,background-color] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
      onClick={toggleCart}
      type="button"
    >
      <ShoppingCart className="w-5 h-5" />
      {totalItems > 0 ? (
        <span className="absolute top-0 right-0 -mr-1 -mt-1 flex h-4 w-4 items-center justify-center rounded-full bg-ember text-[9px] font-bold text-white shadow-sm ring-2 ring-cream">
          {totalItems}
        </span>
      ) : null}
    </button>
  );
}
