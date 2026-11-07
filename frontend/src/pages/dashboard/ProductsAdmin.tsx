import { useState, FormEvent } from "react";
import { Link } from "react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Package, Store, ArrowRight } from "lucide-react";
import { productsApi, ProductInput } from "../../api/products";
import { categoriesApi } from "../../api/categories";
import { shopsApi } from "../../api/shops";
import { Product } from "../../api/types";
import { useAuth } from "../../store/AuthContext";
import { Pagination } from "../../components/Pagination";
import { ImageUpload } from "../../components/ImageUpload";
import { PageHeader } from "../../components/ui/PageHeader";
import { EmptyState } from "../../components/ui/EmptyState";
import { Modal } from "../../components/ui/Modal";
import { TableSkeleton } from "../../components/ui/Skeleton";
import { formatPrice } from "../../lib/status";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";
import { optimizedImage } from "../../lib/images";

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
  const { data: myShop, isLoading: shopLoading } = useQuery({
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
    queryKey: ["products", { page, limit: 10, admin: true, shopId: myShop?.id }],
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
    if (editing) {
      // null (not undefined) so clearing the category actually removes it.
      updateMutation.mutate({
        id: editing.id,
        data: { ...form, categoryId: form.categoryId || null },
      });
    } else {
      createMutation.mutate({ ...form, categoryId: form.categoryId || undefined });
    }
  }

  if (!isSuperAdmin && shopLoading) return null;

  // Shop-admin without a shop yet — block product management until they create one.
  if (!isSuperAdmin && !myShop) {
    return (
      <EmptyState
        icon={Store}
        title="Create your shop first"
        description="Products belong to a shop, so you'll need to set yours up before adding any."
        action={
          <Link to="/dashboard/my-shop" className="btn-primary">
            Create my shop
            <ArrowRight className="h-4 w-4" />
          </Link>
        }
      />
    );
  }

  const colCount = isSuperAdmin ? 6 : 5;

  return (
    <div>
      <PageHeader
        eyebrow="Catalogue"
        title="Products"
        description="Add, edit and remove the items in your shop."
        actions={
          <button onClick={openCreate} className="btn-primary">
            <Plus className="h-4 w-4" />
            Add product
          </button>
        }
      />

      <div className="table-wrap">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Product</th>
                {isSuperAdmin && <th>Shop</th>}
                <th>Category</th>
                <th className="text-right">Price</th>
                <th className="text-right">Stock</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>

            {isLoading ? (
              <TableSkeleton rows={5} cols={colCount} />
            ) : (
              <tbody>
                {data?.items.length ? (
                  data.items.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg bg-secondary">
                            {p.imageUrl ? (
                              <img
                                src={optimizedImage(p.imageUrl, 96)}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center">
                                <Package className="h-4 w-4 text-muted-foreground" />
                              </div>
                            )}
                          </div>
                          <span className="font-medium text-foreground">
                            {p.name}
                          </span>
                        </div>
                      </td>

                      {isSuperAdmin && (
                        <td className="text-muted-foreground">
                          {p.shop?.name || "—"}
                        </td>
                      )}

                      <td>
                        {p.category ? (
                          <span className="badge-neutral">
                            {p.category.name}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>

                      <td className="text-right font-medium tabular-nums text-foreground">
                        {formatPrice(p.price)}
                      </td>

                      <td className="text-right">
                        <span
                          className={cn(
                            "font-medium tabular-nums",
                            p.stock === 0
                              ? "text-destructive"
                              : p.stock <= 5
                                ? "text-warning"
                                : "text-muted-foreground",
                          )}
                        >
                          {p.stock}
                        </span>
                      </td>

                      <td>
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => openEdit(p)}
                            className="icon-btn"
                            aria-label={`Edit ${p.name}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Delete "${p.name}"?`))
                                deleteMutation.mutate(p.id);
                            }}
                            className="icon-btn-danger"
                            aria-label={`Delete ${p.name}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={colCount} className="p-0">
                      <EmptyState
                        icon={Package}
                        title="No products yet"
                        description="Add your first product to start selling."
                        action={
                          <button onClick={openCreate} className="btn-primary">
                            <Plus className="h-4 w-4" />
                            Add product
                          </button>
                        }
                        className="rounded-none border-0"
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            )}
          </table>
        </div>
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

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editing ? "Edit product" : "New product"}
        description={
          editing
            ? "Update the details of this listing."
            : "Add a new item to your catalogue."
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {isSuperAdmin && (
            <div>
              <label htmlFor="shopId" className="label">
                Shop
              </label>
              <select
                id="shopId"
                required
                value={form.shopId}
                onChange={(e) => setForm({ ...form, shopId: e.target.value })}
                className="select"
              >
                <option value="">Select a shop…</option>
                {allShops?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label htmlFor="name" className="label">
              Name
            </label>
            <input
              id="name"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="input"
              placeholder="Hand-thrown ceramic mug"
            />
          </div>

          <div>
            <label htmlFor="description" className="label">
              Description
            </label>
            <textarea
              id="description"
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              rows={3}
              className="textarea"
              placeholder="What makes this piece special?"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="price" className="label">
                Price (DA)
              </label>
              <input
                id="price"
                type="number"
                step="0.01"
                min="0"
                required
                value={form.price}
                onChange={(e) =>
                  setForm({ ...form, price: Number(e.target.value) })
                }
                className="input"
              />
            </div>
            <div>
              <label htmlFor="stock" className="label">
                Stock
              </label>
              <input
                id="stock"
                type="number"
                min="0"
                required
                value={form.stock}
                onChange={(e) =>
                  setForm({ ...form, stock: Number(e.target.value) })
                }
                className="input"
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
            <label htmlFor="categoryId" className="label">
              Category
            </label>
            <select
              id="categoryId"
              value={form.categoryId ?? ""}
              onChange={(e) =>
                setForm({ ...form, categoryId: e.target.value })
              }
              className="select"
            >
              <option value="">None</option>
              {categories?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-3 border-t border-border pt-4">
            <button
              type="button"
              onClick={closeModal}
              className="btn-outline flex-1"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
              className="btn-primary flex-1"
            >
              {editing ? "Save changes" : "Create product"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
