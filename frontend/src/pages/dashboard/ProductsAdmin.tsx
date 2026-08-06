import { useState, FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import { productsApi, ProductInput } from "../../api/products";
import { categoriesApi } from "../../api/categories";
import { shopsApi } from "../../api/shops";
import { Product } from "../../api/types";
import { useAuth } from "../../store/AuthContext";
import { Pagination } from "../../components/Pagination";
import { ImageUpload } from "../../components/ImageUpload";
import toast from "react-hot-toast";

const emptyForm: ProductInput = {
  name: "",
  description: "",
  price: 0,
  stock: 0,
  imageUrl: "",
  categoryId: "",
  shopId: "",
};

export default function ProductsAdmin() {
  const { isSuperAdmin } = useAuth();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductInput>(emptyForm);

  // A shop-admin only ever sees/creates products for their own shop.
  const { data: myShop } = useQuery({
    queryKey: ["myShop"],
    queryFn: shopsApi.mine,
    retry: false,
    enabled: !isSuperAdmin,
  });
  const { data: allShops } = useQuery({
    queryKey: ["shops"],
    queryFn: shopsApi.list,
    enabled: isSuperAdmin,
  });

  const { data, isLoading } = useQuery({
    queryKey: [
      "products",
      { page, limit: 10, admin: true, shopId: myShop?.id },
    ],
    queryFn: () =>
      productsApi.list({
        page,
        limit: 10,
        shopId: isSuperAdmin ? undefined : myShop?.id,
      }),
    enabled: isSuperAdmin || !!myShop,
  });
  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: categoriesApi.list,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["products"] });

  const createMutation = useMutation({
    mutationFn: productsApi.create,
    onSuccess: () => {
      invalidate();
      toast.success("Product created");
      closeModal();
    },
    onError: (err: any) => toast.error(String(err)),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ProductInput> }) =>
      productsApi.update(id, data),
    onSuccess: () => {
      invalidate();
      toast.success("Product updated");
      closeModal();
    },
    onError: (err: any) => toast.error(String(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: productsApi.remove,
    onSuccess: () => {
      invalidate();
      toast.success("Product deleted");
    },
    onError: (err: any) => toast.error(String(err)),
  });

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm, shopId: isSuperAdmin ? "" : myShop?.id || "" });
    setModalOpen(true);
  }

  function openEdit(product: Product) {
    setEditing(product);
    setForm({
      name: product.name,
      description: product.description || "",
      price: Number(product.price),
      stock: product.stock,
      imageUrl: product.imageUrl || "",
      categoryId: product.categoryId || "",
      shopId: product.shopId,
    });
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const payload = { ...form, categoryId: form.categoryId || undefined };
    if (editing) {
      updateMutation.mutate({ id: editing.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  // Shop-admin without a shop yet — block product management until they create one.
  if (!isSuperAdmin && !myShop) {
    return (
      <div className="card p-8 text-center">
        <p>You need to create your shop before adding products.</p>
        <a href="/dashboard/my-shop" className="btn-primary mt-4 inline-flex">
          Create my shop
        </a>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-4xl font-bold mb-2">Products</h1>
          <p className="text-muted-foreground">Manage your product catalog</p>
        </div>
        <button
          onClick={openCreate}
          className="bg-accent text-accent-foreground font-semibold py-2 px-4 rounded-lg hover:bg-accent/90 transition-colors flex items-center gap-2"
        >
          <Plus size={20} />
          Add Product
        </button>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Product</th>
              {isSuperAdmin && <th className="px-4 py-3 font-medium">Shop</th>}
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Price</th>
              <th className="px-4 py-3 font-medium">Stock</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  Loading...
                </td>
              </tr>
            ) : data?.items.length ? (
              data.items.map((p) => (
                <tr key={p.id} className="border-t border-border">
                  <td className="flex items-center gap-3 px-4 py-3">
                    <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg bg-muted">
                      {p.imageUrl && (
                        <img
                          src={p.imageUrl}
                          className="h-full w-full object-cover"
                        />
                      )}
                    </div>
                    <span className="font-medium text-foreground">
                      {p.name}
                    </span>
                  </td>
                  {isSuperAdmin && (
                    <td className="px-4 py-3 text-muted-foreground">
                      {p.shop?.name || "—"}
                    </td>
                  )}
                  <td className="px-4 py-3 text-muted-foreground">
                    {p.category?.name || "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    ${Number(p.price).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{p.stock}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => openEdit(p)}
                        className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Delete "${p.name}"?`))
                            deleteMutation.mutate(p.id);
                        }}
                        className="rounded-lg p-2 text-red-500 transition-colors hover:bg-red-50 dark:hover:bg-red-500/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  No products yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {data && (
        <Pagination
          page={data.page}
          totalPages={data.totalPages}
          total={data.total}
          limit={data.limit}
          onPageChange={setPage}
        />
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-serif text-lg font-bold text-foreground">
                {editing ? "Edit product" : "New product"}
              </h2>
              <button
                onClick={closeModal}
                className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-secondary"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              {isSuperAdmin && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">
                    Shop
                  </label>
                  <select
                    required
                    value={form.shopId}
                    onChange={(e) =>
                      setForm({ ...form, shopId: e.target.value })
                    }
                    className="w-full rounded-lg border border-border bg-card px-4 py-3 text-foreground transition focus:border-accent focus:outline-none"
                  >
                    <option value="">Select a shop...</option>
                    {allShops?.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  Name
                </label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-lg border border-border bg-card px-4 py-3 text-foreground placeholder:text-muted-foreground transition focus:border-accent focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  rows={2}
                  className="w-full resize-none rounded-lg border border-border bg-card px-4 py-3 text-foreground placeholder:text-muted-foreground transition focus:border-accent focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">
                    Price
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={form.price}
                    onChange={(e) =>
                      setForm({ ...form, price: Number(e.target.value) })
                    }
                    className="w-full rounded-lg border border-border bg-card px-4 py-3 text-foreground transition focus:border-accent focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">
                    Stock
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={form.stock}
                    onChange={(e) =>
                      setForm({ ...form, stock: Number(e.target.value) })
                    }
                    className="w-full rounded-lg border border-border bg-card px-4 py-3 text-foreground transition focus:border-accent focus:outline-none"
                  />
                </div>
              </div>
              <ImageUpload
                value={form.imageUrl}
                onChange={(url) => setForm({ ...form, imageUrl: url })}
                folder="products"
                label="Product image"
              />
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  Category
                </label>
                <select
                  value={form.categoryId}
                  onChange={(e) =>
                    setForm({ ...form, categoryId: e.target.value })
                  }
                  className="w-full rounded-lg border border-border bg-card px-4 py-3 text-foreground transition focus:border-accent focus:outline-none"
                >
                  <option value="">None</option>
                  {categories?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                className="w-full rounded-md bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {editing ? "Save changes" : "Create product"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
