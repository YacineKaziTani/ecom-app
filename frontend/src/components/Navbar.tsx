import { Link, useNavigate } from "react-router";
import {
  ShoppingCart,
  User as UserIcon,
  LayoutDashboard,
  LogOut,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../store/AuthContext";
import { useCartStore } from "../store/cartStore";
import { authApi } from "../api/auth";

export function Navbar() {
  const { user, isAdmin } = useAuth();
  const qc = useQueryClient();
  const count = useCartStore((s) => s.count());
  const navigate = useNavigate();

  async function handleLogout() {
    await authApi.logout();
    qc.clear();
    navigate("/");
  }

  return (
    <header className="sticky top-0 z-50 bg-card border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link
            to="/"
            className="text-xl font-extrabold tracking-tight text-brand-700"
          >
            Artisan<span className="text-brand-500">Shop</span>
          </Link>

          <nav className="hidden md:flex gap-8">
            <Link
              to="/"
              className="text-foreground hover:text-accent transition"
            >
              Products
            </Link>
            <Link
              to="/shops"
              className="text-foreground hover:text-accent transition"
            >
              Shops
            </Link>
            {user ? (
              <Link
                to="/orders"
                className="text-foreground hover:text-accent transition"
              >
                My Orders
              </Link>
            ) : (
              <Link
                to="/track-order"
                className="text-foreground hover:text-accent transition"
              >
                Track Order
              </Link>
            )}
            {isAdmin && (
              <Link
                to="/dashboard"
                className="text-foreground hover:text-accent transition"
              >
                Dashboard
              </Link>
            )}
          </nav>

          <div className="flex items-center gap-4">
            <Link
              to="/cart"
              className="relative p-2 hover:bg-secondary rounded-md transition"
            >
              <ShoppingCart className="w-6 h-6" />
              {count > 0 && (
                <span className="absolute top-0 right-0 bg-accent text-accent-foreground text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {count}
                </span>
              )}
            </Link>

            {user ? (
              <div className="flex items-center gap-2">
                <Link
                  to="/profile"
                  className="flex items-center gap-1 rounded-full p-2 hover:bg-gray-100"
                >
                  <UserIcon className="h-5 w-5 text-gray-700" />
                </Link>
                {isAdmin && (
                  <Link
                    to="/dashboard"
                    className="rounded-full p-2 hover:bg-gray-100 sm:hidden"
                  >
                    <LayoutDashboard className="h-5 w-5 text-gray-700" />
                  </Link>
                )}
                <button
                  onClick={handleLogout}
                  className="rounded-full p-2 hover:bg-gray-100"
                  title="Logout"
                >
                  <LogOut className="h-5 w-5 text-gray-700" />
                </button>
              </div>
            ) : (
              <Link to="/login" className="btn-primary">
                Sign in
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
