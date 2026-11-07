import { useEffect, useRef, useState } from "react";
import type { Lang } from "../i18n/messages";
import { useI18n, LANGUAGES } from "../i18n/I18nProvider";
import { Link, NavLink, useLocation, useNavigate } from "react-router";
import {
  ShoppingBag,
  User as UserIcon,
  LayoutDashboard,
  LogOut,
  Menu,
  X,
  Sun,
  Moon,
  Package,
  Heart,
  ChevronDown,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../store/AuthContext";
import { useTheme } from "../store/ThemeContext";
import { useCart } from "../hooks/useCart";
import { authApi } from "../api/auth";
import { cn } from "@/lib/utils";

export function Navbar() {
  const { user, isAdmin } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { t, tp, lang, setLang } = useI18n();
  const qc = useQueryClient();
  const { count } = useCart();
  const cartCount = count();
  const navigate = useNavigate();
  const location = useLocation();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close both menus whenever the route changes.
  useEffect(() => {
    setMobileOpen(false);
    setMenuOpen(false);
  }, [location.pathname]);

  // Solidify the header once the page scrolls under it.
  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 8);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Dismiss the account dropdown on outside click / Escape.
  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  async function handleLogout() {
    try {
      await authApi.logout();
    } catch (error) {
      console.error("Logout API failed", error);
    } finally {
      qc.setQueryData(["me"], null);
      qc.removeQueries();
      navigate("/");
    }
  }

  const links = [
    { to: "/", label: t("nav.products"), end: true },
    { to: "/shops", label: t("nav.shops") },
    user
      ? { to: "/orders", label: t("nav.myOrders") }
      : { to: "/track-order", label: t("nav.trackOrder") },
    ...(isAdmin ? [{ to: "/dashboard", label: t("nav.dashboard") }] : []),
  ];

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      "relative text-sm font-medium transition-colors",
      "after:absolute after:-bottom-1.5 after:start-0 after:h-0.5 after:rounded-full after:bg-accent after:transition-all after:duration-300",
      isActive
        ? "text-foreground after:w-full"
        : "text-muted-foreground hover:text-foreground after:w-0 hover:after:w-full",
    );

  return (
    <header
      className={cn(
        "sticky top-0 z-50 border-b transition-all duration-300",
        scrolled
          ? "border-border bg-card/85 shadow-sm backdrop-blur-xl"
          : "border-transparent bg-background",
      )}
    >
      <div className="container-page">
        <div className="flex h-16 items-center justify-between gap-4">
          {/* Brand */}
          <Link to="/" className="group flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm transition-transform duration-300 group-hover:-rotate-6">
              <ShoppingBag className="h-4.5 w-4.5" strokeWidth={2.2} />
            </span>
            <span className="font-serif text-xl font-bold tracking-tight text-foreground">
              Artisan<span className="text-accent">Shop</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-8 md:flex">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={navLinkClass}
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-1.5">
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value as Lang)}
              aria-label={t("nav.language")}
              className="h-9 cursor-pointer rounded-lg border border-border bg-card px-1.5 text-xs font-semibold text-foreground"
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.short}
                </option>
              ))}
            </select>

            <button
              onClick={toggleTheme}
              className="icon-btn"
              aria-label={
                theme === "dark" ? t("nav.lightMode") : t("nav.darkMode")
              }
              title={
                theme === "dark" ? t("nav.lightMode") : t("nav.darkMode")
              }
            >
              {theme === "dark" ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
            </button>

            <Link
              to="/cart"
              className="icon-btn relative"
              aria-label={tp("nav.cart", cartCount)}
            >
              <ShoppingBag className="h-5 w-5" />
              {cartCount > 0 && (
                <span
                  key={cartCount}
                  className="absolute -end-0.5 -top-0.5 flex h-5 min-w-5 animate-pop items-center justify-center
                             rounded-full bg-accent px-1 text-[10px] font-bold text-accent-foreground shadow-sm"
                >
                  {cartCount > 99 ? "99+" : cartCount}
                </span>
              )}
            </Link>

            {user ? (
              <div className="relative hidden md:block" ref={menuRef}>
                <button
                  onClick={() => setMenuOpen((o) => !o)}
                  className="flex items-center gap-2 rounded-lg py-1.5 ps-1.5 pe-2 transition-colors hover:bg-secondary"
                  aria-expanded={menuOpen}
                  aria-haspopup="menu"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-soft text-xs font-bold uppercase text-brand-700 dark:text-accent">
                    {user.firstName?.[0]}
                    {user.lastName?.[0]}
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 text-muted-foreground transition-transform duration-200",
                      menuOpen && "rotate-180",
                    )}
                  />
                </button>

                {menuOpen && (
                  <div
                    role="menu"
                    className="absolute end-0 top-full z-50 mt-2 w-56 origin-top-right rtl:origin-top-left animate-fade-up
                               overflow-hidden rounded-xl border border-border bg-popover p-1.5 shadow-lg"
                  >
                    <div className="border-b border-border px-3 pb-2.5 pt-2">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {user.firstName} {user.lastName}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {user.email}
                      </p>
                    </div>

                    <MenuLink to="/profile" icon={UserIcon}>
                      {t("nav.profile")}
                    </MenuLink>
                    <MenuLink to="/wishlist" icon={Heart}>
                      {t("nav.wishlist")}
                    </MenuLink>
                    <MenuLink to="/orders" icon={Package}>
                      {t("nav.myOrders")}
                    </MenuLink>
                    {isAdmin && (
                      <MenuLink to="/dashboard" icon={LayoutDashboard}>
                        {t("nav.dashboard")}
                      </MenuLink>
                    )}

                    <div className="my-1 h-px bg-border" />

                    <button
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium
                                 text-destructive transition-colors hover:bg-destructive-soft"
                      role="menuitem"
                    >
                      <LogOut className="h-4 w-4" />
                      {t("nav.signOut")}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link to="/login" className="btn-primary btn-sm ms-1 hidden md:inline-flex">
                {t("nav.signIn")}
              </Link>
            )}

            <button
              onClick={() => setMobileOpen((o) => !o)}
              className="icon-btn md:hidden"
              aria-label="Toggle menu"
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="animate-fade-in border-t border-border bg-card md:hidden">
          <nav className="container-page flex flex-col py-3">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) =>
                  cn(
                    "rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                  )
                }
              >
                {link.label}
              </NavLink>
            ))}

            <div className="my-2 h-px bg-border" />

            {user ? (
              <>
                <div className="px-3 pb-2">
                  <p className="text-sm font-semibold text-foreground">
                    {user.firstName} {user.lastName}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {user.email}
                  </p>
                </div>
                <NavLink
                  to="/profile"
                  className="rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
                >
                  {t("nav.profile")}
                </NavLink>
                <NavLink
                  to="/wishlist"
                  className="rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
                >
                  {t("nav.wishlist")}
                </NavLink>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-start text-sm font-medium text-destructive hover:bg-destructive-soft"
                >
                  <LogOut className="h-4 w-4" />
                  {t("nav.signOut")}
                </button>
              </>
            ) : (
              <Link to="/login" className="btn-primary mx-3 my-1">
                {t("nav.signIn")}
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}

function MenuLink({
  to,
  icon: Icon,
  children,
}: {
  to: string;
  icon: typeof UserIcon;
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      role="menuitem"
      className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium
                 text-foreground transition-colors hover:bg-secondary"
    >
      <Icon className="h-4 w-4 text-muted-foreground" />
      {children}
    </Link>
  );
}
