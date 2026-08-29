import { Link } from "react-router";
import { ShoppingBag } from "lucide-react";

const columns = [
  {
    title: "Shop",
    links: [
      { to: "/", label: "All products" },
      { to: "/shops", label: "Browse shops" },
      { to: "/cart", label: "Your cart" },
    ],
  },
  {
    title: "Account",
    links: [
      { to: "/orders", label: "My orders" },
      { to: "/track-order", label: "Track an order" },
      { to: "/profile", label: "Profile" },
    ],
  },
  {
    title: "Access",
    links: [
      { to: "/login", label: "Sign in" },
      { to: "/register", label: "Create account" },
      { to: "/forgot-password", label: "Reset password" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="mt-20 border-t border-border bg-surface">
      <div className="container-page py-14">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:pr-8">
            <Link to="/" className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <ShoppingBag className="h-4.5 w-4.5" strokeWidth={2.2} />
              </span>
              <span className="font-serif text-xl font-bold tracking-tight text-foreground">
                Artisan<span className="text-accent">Shop</span>
              </span>
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
              A curated marketplace for premium goods, made by independent
              artisans and shipped straight from their workshops.
            </p>
          </div>

          {columns.map((col) => (
            <div key={col.title}>
              <h3 className="font-sans text-xs font-semibold uppercase tracking-[0.18em] text-foreground">
                {col.title}
              </h3>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.to + link.label}>
                    <Link
                      to={link.to}
                      className="text-sm text-muted-foreground transition-colors hover:text-accent"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-border pt-6 sm:flex-row">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} ArtisanShop. All rights reserved.
          </p>
          <p className="text-xs text-muted-foreground">
            Crafted with care for makers everywhere.
          </p>
        </div>
      </div>
    </footer>
  );
}
