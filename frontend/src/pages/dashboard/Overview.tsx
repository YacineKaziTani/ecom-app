import { useQuery } from "@tanstack/react-query";
import { Package, Tags, ClipboardList, DollarSign } from "lucide-react";
import { productsApi } from "../../api/products";
import { categoriesApi } from "../../api/categories";
import { ordersApi } from "../../api/orders";
import { shopsApi } from "../../api/shops";
import { useAuth } from "../../store/AuthContext";

const statusColors: Record<string, string> = {
  pending:
    "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  processing:
    "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400",
  shipped:
    "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400",
  delivered:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400",
};

export default function Overview() {
  const { isSuperAdmin } = useAuth();

  const { data: myShop } = useQuery({
    queryKey: ["myShop"],
    queryFn: shopsApi.mine,
    retry: false,
    enabled: !isSuperAdmin,
  });

  const { data: products } = useQuery({
    queryKey: ["products", { page: 1, limit: 1, shopId: myShop?.id }],
    queryFn: () =>
      productsApi.list({
        page: 1,
        limit: 1,
        shopId: isSuperAdmin ? undefined : myShop?.id,
      }),
    enabled: isSuperAdmin || !!myShop,
  });
  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: categoriesApi.list,
  });
  // The backend already scopes /orders to "my shop's items only" for the admin role.
  const { data: orders } = useQuery({
    queryKey: ["orders"],
    queryFn: ordersApi.list,
  });

  const revenue =
    orders?.reduce((sum, o) => {
      if (isSuperAdmin) return sum + Number(o.total);
      const myItemsTotal = o.items.reduce(
        (s, i) => s + Number(i.price) * i.quantity,
        0,
      );
      return sum + myItemsTotal;
    }, 0) ?? 0;

  const pendingOrders =
    orders?.filter((o) => o.status === "pending").length ?? 0;

  if (!isSuperAdmin && !myShop) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center shadow-sm">
        <p className="text-muted-foreground">
          Create your shop to start tracking your dashboard stats.
        </p>
        <a
          href="/dashboard/my-shop"
          className="mt-4 inline-flex rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          Create my shop
        </a>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="mb-2 font-serif text-4xl font-bold text-foreground">
          {isSuperAdmin ? "Platform Overview" : `${myShop?.name} — Overview`}
        </h1>
        <p className="text-muted-foreground">
          Welcome back! Here&apos;s your shop performance.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="mb-2 text-sm text-muted-foreground">
                {isSuperAdmin ? "Total Products" : "My Products"}
              </p>
              <p className="font-serif text-3xl font-bold text-foreground">
                {products?.total ?? 0}
              </p>
            </div>
            <Package className="text-accent" size={32} />
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="mb-2 text-sm text-muted-foreground">Categories</p>
              <p className="font-serif text-3xl font-bold text-foreground">
                {categories?.length ?? 0}
              </p>
            </div>
            <Tags className="text-accent" size={32} />
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="mb-2 text-sm text-muted-foreground">
                {isSuperAdmin ? "Total Orders" : "Orders With My Items"}
              </p>
              <p className="font-serif text-3xl font-bold text-foreground">
                {orders?.length ?? 0}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {pendingOrders} pending
              </p>
            </div>
            <ClipboardList className="text-accent" size={32} />
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="mb-2 text-sm text-muted-foreground">Revenue</p>
              <p className="font-serif text-3xl font-bold text-foreground">
                ${revenue.toFixed(2)}
              </p>
            </div>
            <DollarSign className="text-accent" size={32} />
          </div>
        </div>
      </div>

      {/* Recent Orders */}
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="mb-6 font-serif text-2xl font-bold text-foreground">
          Recent Orders
        </h2>

        {orders && orders.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border">
                <tr className="text-muted-foreground">
                  <th className="py-3 px-4 text-left font-semibold">Order</th>
                  <th className="py-3 px-4 text-left font-semibold">
                    Customer
                  </th>
                  <th className="py-3 px-4 text-left font-semibold">Status</th>
                  <th className="py-3 px-4 text-right font-semibold">Total</th>
                </tr>
              </thead>
              <tbody>
                {orders.slice(0, 5).map((o) => (
                  <tr
                    key={o.id}
                    className="border-b border-border transition-colors last:border-0 hover:bg-secondary/50"
                  >
                    <td className="py-4 px-4 font-medium text-accent">
                      #{o.id.slice(0, 8)}
                    </td>
                    <td className="py-4 px-4 text-foreground">
                      {o.user
                        ? `${o.user.firstName} ${o.user.lastName}`
                        : o.guestEmail
                          ? `${o.guestEmail} (guest)`
                          : "—"}
                    </td>
                    <td className="py-4 px-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${statusColors[o.status]}`}
                      >
                        {o.status}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right font-medium text-foreground">
                      $
                      {(isSuperAdmin
                        ? Number(o.total)
                        : o.items.reduce(
                            (s, i) => s + Number(i.price) * i.quantity,
                            0,
                          )
                      ).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-muted-foreground">No orders yet.</p>
        )}
      </div>
    </div>
  );
}
