import { NavLink, Outlet, Link } from "react-router";
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
} from "lucide-react";
import { useAuth } from "../store/AuthContext";

export function DashboardLayout() {
  const { isSuperAdmin } = useAuth();

  const navItems = [
    {
      to: "/dashboard",
      label: "Overview",
      icon: LayoutGrid,
      end: true,
      show: true,
    },
    {
      to: "/dashboard/analytics",
      label: "Analytics",
      icon: BarChart3,
      show: true,
    },
    {
      to: "/dashboard/my-shop",
      label: "My Shop",
      icon: Store,
      show: !isSuperAdmin,
    },
    { to: "/dashboard/products", label: "Products", icon: Package, show: true },
    {
      to: "/dashboard/categories",
      label: "Categories",
      icon: Tags,
      show: isSuperAdmin,
    },
    {
      to: "/dashboard/orders",
      label: "Orders",
      icon: ClipboardList,
      show: true,
    },
    { to: "/dashboard/coupons", label: "Coupons", icon: Tag, show: true },
    { to: "/dashboard/users", label: "Users", icon: Users, show: isSuperAdmin },
    { to: "/dashboard/profile", label: "Profile", icon: UserIcon, show: true },
  ].filter((item) => item.show);

  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        <aside className="w-64 bg-card border-r border-border min-h-screen flex flex-col">
          <div className="flex items-center gap-2 px-5 py-5">
            <span className="text-lg font-extrabold text-brand-700">
              Artisan<span className="text-brand-500">Admin</span>
            </span>
          </div>
          {isSuperAdmin && (
            <span className="mx-3 mb-2 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
              Super Admin
            </span>
          )}
          <nav className="flex-1 p-4 space-y-2">
            {navItems.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? "bg-accent text-accent-foreground"
                      : "text-foreground hover:bg-secondary"
                  }`
                }
              >
                <Icon className="font-medium" />
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="px-3 pb-5">
            <Link
              to="/"
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-500 hover:bg-gray-100"
            >
              <ArrowLeft className="font-medium" />
              Back to shop
            </Link>
          </div>
        </aside>

        <main className="flex-1 px-6 py-8 bg-background">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
