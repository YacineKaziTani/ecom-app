import { useEffect, useState } from "react";
import { NavLink, Outlet, Link, useLocation } from "react-router";
import {
  LayoutGrid,
  Package,
  Tags,
  ClipboardList,
  User as UserIcon,
  ArrowLeft,
  Store,
  Users,
  Tag,
  BarChart3,
  Menu,
  X,
  Sun,
  Moon,
  ShoppingBag,
} from "lucide-react";
import { useAuth } from "../store/AuthContext";
import { useTheme } from "../store/ThemeContext";
import { cn } from "@/lib/utils";

export function DashboardLayout() {
  const { isSuperAdmin, user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { pathname } = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  const navItems = [
    { to: "/dashboard", label: "Overview", icon: LayoutGrid, end: true, show: true },
    { to: "/dashboard/analytics", label: "Analytics", icon: BarChart3, show: true },
    { to: "/dashboard/my-shop", label: "My Shop", icon: Store, show: !isSuperAdmin },
    { to: "/dashboard/products", label: "Products", icon: Package, show: true },
    { to: "/dashboard/categories", label: "Categories", icon: Tags, show: isSuperAdmin },
    { to: "/dashboard/orders", label: "Orders", icon: ClipboardList, show: true },
    { to: "/dashboard/coupons", label: "Coupons", icon: Tag, show: true },
    { to: "/dashboard/users", label: "Users", icon: Users, show: isSuperAdmin },
    { to: "/dashboard/profile", label: "Profile", icon: UserIcon, show: true },
  ].filter((item) => item.show);

  const sidebar = (
    <div className="flex h-full flex-col bg-sidebar">
      <div className="flex items-center justify-between px-5 py-5">
        <Link to="/dashboard" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <ShoppingBag className="h-4.5 w-4.5" strokeWidth={2.2} />
          </span>
          <span className="font-serif text-lg font-bold tracking-tight text-sidebar-foreground">
            Artisan<span className="text-accent">Admin</span>
          </span>
        </Link>
        <button
          onClick={() => setSidebarOpen(false)}
          className="icon-btn lg:hidden"
          aria-label="Close sidebar"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="px-5 pb-4">
        <div className="flex items-center gap-2.5 rounded-lg bg-secondary/70 p-2.5">
          <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-bold uppercase text-brand-700 dark:text-accent">
            {user?.firstName?.[0]}
            {user?.lastName?.[0]}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {isSuperAdmin ? "Super admin" : "Shop admin"}
            </p>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-secondary text-foreground shadow-xs"
                  : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
              )
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={cn(
                    "absolute left-0 h-5 w-1 rounded-r-full bg-accent transition-all duration-200",
                    isActive ? "opacity-100" : "opacity-0",
                  )}
                />
                <Icon
                  className={cn(
                    "h-4.5 w-4.5 transition-colors",
                    isActive ? "text-accent" : "text-muted-foreground",
                  )}
                />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="space-y-1 border-t border-sidebar-border p-3">
        <button
          onClick={toggleTheme}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium
                     text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          {theme === "dark" ? (
            <Sun className="h-4.5 w-4.5" />
          ) : (
            <Moon className="h-4.5 w-4.5" />
          )}
          {theme === "dark" ? "Light mode" : "Dark mode"}
        </button>
        <Link
          to="/"
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium
                     text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <ArrowLeft className="h-4.5 w-4.5" />
          Back to shop
        </Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-sidebar-border lg:block">
        {sidebar}
      </aside>

      {/* Mobile sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-foreground/40 backdrop-blur-sm animate-fade-in"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-72 border-r border-sidebar-border shadow-xl animate-fade-in">
            {sidebar}
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        {/* Mobile top bar */}
        <div className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-card/85 px-4 backdrop-blur-xl lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="icon-btn"
            aria-label="Open sidebar"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="font-serif text-base font-bold text-foreground">
            Artisan<span className="text-accent">Admin</span>
          </span>
        </div>

        <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-10">
          <div className="mx-auto max-w-6xl animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
