import { useState, FormEvent } from "react";
import { Link } from "react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Package, Store, ArrowRight, FileUp } from "lucide-react";
import { productsApi, ProductInput } from "../../api/products";
import { categoriesApi } from "../../api/categories";
import { shopsApi } from "../../api/shops";
import { Product } from "../../api/types";
import { useAuth } from "../../store/AuthContext";
import { useI18n } from "../../i18n/I18nProvider";
import { Pagination } from "../../components/Pagination";
import { ImageUpload } from "../../components/ImageUpload";
import { GalleryUpload } from "../../components/GalleryUpload";
import { VariantsEditor, VariantRow, rowsStock, toInput, toRows } from "../../components/VariantsEditor";
import { ProductImportModal } from "../../components/ProductImportModal";
import { PageHeader } from "../../components/ui/PageHeader";
import { EmptyState } from "../../components/ui/EmptyState";
import { Modal } from "../../components/ui/Modal";
import { TableSkeleton } from "../../components/ui/Skeleton";
import { formatPrice } from "../../lib/status";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";
import { optimizedImage } from "../../lib/images";

type ProductForm = Omit<ProductInput, "variants">;

const emptyForm: ProductForm = {
  name: "",
  description: "",
  price: 0,
  compareAtPrice: null,
  stock: 0,
  imageUrl: "",
  galleryUrls: [],
  categoryId: "",
  shopId: "",
};

export default function ProductsAdmin() {
  const { isSuperAdmin } = useAuth();
  const { t } = useI18n();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [variants, setVariants] = useState<VariantRow[]>([]);

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

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["products"] });
    qc.invalidateQueries({ queryKey: ["product"] });
  };

  const saveError = (err: any) =>
    err?.data?.code === "COMPARE_AT_TOO_LOW" ? t("dash.products.compareAtTooLow") : String(err);

  const createMutation = useMutation({
    mutationFn: productsApi.create,
    onSuccess: () => {
      invalidate();
      toast.success(t("dash.products.created"));
      closeModal();
    },
    onError: (err: any) => toast.error(saveError(err)),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ProductInput> }) =>
      productsApi.update(id, data),
    onSuccess: () => {
      invalidate();
      toast.success(t("dash.products.updated"));
      closeModal();
    },
    onError: (err: any) => toast.error(saveError(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: productsApi.remove,
    onSuccess: () => {
      invalidate();
      toast.success(t("dash.products.deleted"));
    },
    onError: (err: any) => toast.error(String(err)),
  });

  // The list only carries an option count; the edit form needs the options.
  const openEditMutation = useMutation({
    mutationFn: (id: string) => productsApi.get(id),
    onSuccess: (product) => {
      setEditing(product);
      setForm({
        name: product.name,
        description: product.description || "",
        price: Number(product.price),
        compareAtPrice: product.compareAtPrice == null ? null : Number(product.compareAtPrice),
        stock: product.stock,
        imageUrl: product.imageUrl || "",
        galleryUrls: product.galleryUrls ?? [],
        categoryId: product.categoryId || "",
        shopId: product.shopId,
      });
      setVariants(toRows(product.variants ?? []));
      setModalOpen(true);
    },
    onError: (err: any) => toast.error(String(err)),
  });

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm, shopId: isSuperAdmin ? "" : myShop?.id || "" });
    setVariants([]);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
  }

  const hasOptions = variants.length > 0;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const body = {
      ...form,
      compareAtPrice: form.compareAtPrice || null,
      variants: toInput(variants),
      stock: hasOptions ? rowsStock(variants) : form.stock,
    };
    if (editing) {
      // null (not undefined) so clearing the category actually removes it.
      updateMutation.mutate({
        id: editing.id,
        data: { ...body, categoryId: form.categoryId || null },
      });
    } else {
      createMutation.mutate({ ...body, categoryId: form.categoryId || undefined });
    }
  }

  if (!isSuperAdmin && shopLoading) return null;

  // Shop-admin without a shop yet — block product management until they create one.
  if (!isSuperAdmin && !myShop) {
    return (
      <EmptyState
        icon={Store}
        title={t("dash.products.noShopTitle")}
        description={t("dash.products.noShopBody")}
        action={
          <Link to="/dashboard/my-shop" className="btn-primary">
            {t("dash.products.createShop")}
            <ArrowRight className="h-4 w-4 rtl:-scale-x-100" />
          </Link>
        }
      />
    );
  }

  const colCount = isSuperAdmin ? 6 : 5;

  return (
    <div>
      <PageHeader
        eyebrow={t("dash.products.eyebrow")}
        title={t("dash.products.title")}
        description={t("dash.products.description")}
        actions={
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setImportOpen(true)} className="btn-outline">
              <FileUp className="h-4 w-4" />
              {t("dash.products.import")}
            </button>
            <button onClick={openCreate} className="btn-primary">
              <Plus className="h-4 w-4" />
              {t("dash.products.add")}
            </button>
          </div>
        }
      />

      <div className="table-wrap">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t("dash.col.product")}</th>
                {isSuperAdmin && <th>{t("dash.col.shop")}</th>}
                <th>{t("dash.col.category")}</th>
                <th className="text-end">{t("dash.col.price")}</th>
                <th className="text-end">{t("dash.col.stock")}</th>
                <th className="text-end">{t("dash.col.actions")}</th>
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

                      <td className="text-end font-medium tabular-nums text-foreground">
                        {formatPrice(p.price)}
                      </td>

                      <td className="text-end">
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
                        {(p.variantCount ?? 0) > 0 && (
                          <span className="block text-[11px] text-muted-foreground">
                            {t("dash.products.optionsCount", { count: p.variantCount ?? 0 })}
                          </span>
                        )}
                      </td>

                      <td>
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => openEditMutation.mutate(p.id)}
                            disabled={openEditMutation.isPending}
                            className="icon-btn"
                            aria-label={t("dash.products.edit", { name: p.name })}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(t("dash.products.confirmDelete", { name: p.name })))
                                deleteMutation.mutate(p.id);
                            }}
                            className="icon-btn-danger"
                            aria-label={t("dash.products.delete", { name: p.name })}
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
                        title={t("dash.products.emptyTitle")}
                        description={t("dash.products.emptyBody")}
                        action={
                          <button onClick={openCreate} className="btn-primary">
                            <Plus className="h-4 w-4" />
                            {t("dash.products.add")}
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

      {importOpen && <ProductImportModal onClose={() => setImportOpen(false)} />}

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editing ? t("dash.products.editTitle") : t("dash.products.newTitle")}
        description={editing ? t("dash.products.editDescription") : t("dash.products.newDescription")}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {isSuperAdmin && (
            <div>
              <label htmlFor="shopId" className="label">
                {t("dash.col.shop")}
              </label>
              <select
                id="shopId"
                required
                value={form.shopId}
                onChange={(e) => setForm({ ...form, shopId: e.target.value })}
                className="select"
              >
                <option value="">{t("dash.products.selectShop")}</option>
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
              {t("dash.products.name")}
            </label>
            <input
              id="name"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="input"
              placeholder={t("dash.products.namePlaceholder")}
            />
          </div>

          <div>
            <label htmlFor="description" className="label">
              {t("dash.products.descriptionLabel")}
            </label>
            <textarea
              id="description"
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              rows={3}
              className="textarea"
              placeholder={t("dash.products.descriptionPlaceholder")}
            />
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="price" className="label">
                {t("dash.products.price")}
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
              <label htmlFor="compareAtPrice" className="label">
                {t("dash.products.compareAt")}
              </label>
              <input
                id="compareAtPrice"
                type="number"
                step="0.01"
                min="0"
                value={form.compareAtPrice ?? ""}
                onChange={(e) => setForm({ ...form, compareAtPrice: e.target.value === "" ? null : Number(e.target.value) })}
                className="input"
                placeholder={t("dash.products.compareAtPlaceholder")}
              />
              <p className="mt-1 text-xs text-muted-foreground">{t("dash.products.compareAtHint")}</p>
            </div>
            <div>
              <label htmlFor="stock" className="label">
                {t("dash.col.stock")}
              </label>
              <input
                id="stock"
                type="number"
                min="0"
                required
                disabled={hasOptions}
                value={hasOptions ? rowsStock(variants) : form.stock}
                onChange={(e) =>
                  setForm({ ...form, stock: Number(e.target.value) })
                }
                className="input"
              />
              {hasOptions && (
                <p className="mt-1 text-xs text-muted-foreground">{t("dash.products.stockFromOptions")}</p>
              )}
            </div>
          </div>

          <VariantsEditor rows={variants} onChange={setVariants} />

          <ImageUpload
            value={form.imageUrl}
            onChange={(url) => setForm({ ...form, imageUrl: url })}
            folder="products"
            label={t("dash.products.image")}
          />

          <GalleryUpload
            value={form.galleryUrls ?? []}
            onChange={(urls) => setForm({ ...form, galleryUrls: urls })}
          />

          <div>
            <label htmlFor="categoryId" className="label">
              {t("dash.col.category")}
            </label>
            <select
              id="categoryId"
              value={form.categoryId ?? ""}
              onChange={(e) =>
                setForm({ ...form, categoryId: e.target.value })
              }
              className="select"
            >
              <option value="">{t("dash.products.noCategory")}</option>
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
              {t("dash.cancel")}
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
              className="btn-primary flex-1"
            >
              {editing ? t("dash.products.save") : t("dash.products.create")}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
