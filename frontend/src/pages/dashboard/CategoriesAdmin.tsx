import { useState, FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Tags } from "lucide-react";
import { categoriesApi, CategoryInput } from "../../api/categories";
import { Category } from "../../api/types";
import { ImageUpload } from "../../components/ImageUpload";
import { PageHeader } from "../../components/ui/PageHeader";
import { EmptyState } from "../../components/ui/EmptyState";
import { Modal } from "../../components/ui/Modal";
import { Skeleton } from "../../components/ui/Skeleton";
import toast from "react-hot-toast";
import { optimizedImage } from "../../lib/images";
import { useI18n } from "../../i18n/I18nProvider";

const emptyForm: CategoryInput = { name: "", description: "", imageUrl: "" };

export default function CategoriesAdmin() {
  const qc = useQueryClient();
  const { t } = useI18n();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState<CategoryInput>(emptyForm);

  const { data: categories, isLoading } = useQuery({
    queryKey: ["categories"],
    queryFn: categoriesApi.list,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["categories"] });

  const createMutation = useMutation({
    mutationFn: categoriesApi.create,
    onSuccess: () => {
      invalidate();
      toast.success(t("dash.categories.created"));
      closeModal();
    },
    onError: (err: any) => toast.error(String(err)),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CategoryInput> }) =>
      categoriesApi.update(id, data),
    onSuccess: () => {
      invalidate();
      toast.success(t("dash.categories.updated"));
      closeModal();
    },
    onError: (err: any) => toast.error(String(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: categoriesApi.remove,
    onSuccess: () => {
      invalidate();
      toast.success(t("dash.categories.deleted"));
    },
    onError: (err: any) => toast.error(String(err)),
  });

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEdit(c: Category) {
    setEditing(c);
    setForm({
      name: c.name,
      description: c.description || "",
      imageUrl: c.imageUrl || "",
    });
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (editing) updateMutation.mutate({ id: editing.id, data: form });
    else createMutation.mutate(form);
  }

  return (
    <div>
      <PageHeader
        eyebrow={t("dash.categories.eyebrow")}
        title={t("dash.nav.categories")}
        description={t("dash.categories.description")}
        actions={
          <button onClick={openCreate} className="btn-primary">
            <Plus className="h-4 w-4" />
            {t("dash.categories.add")}
          </button>
        }
      />

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card p-5">
              <Skeleton className="h-12 w-12 rounded-lg" />
              <Skeleton className="mt-4 h-4 w-2/3" />
              <Skeleton className="mt-2 h-3 w-full" />
            </div>
          ))}
        </div>
      ) : categories?.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((c) => (
            <div key={c.id} className="card group flex gap-4 p-5">
              <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg bg-secondary">
                {c.imageUrl ? (
                  <img
                    src={optimizedImage(c.imageUrl, 400)}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Tags className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-foreground">{c.name}</h3>
                <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                  {c.description || t("dash.categories.noDescription")}
                </p>
              </div>

              <div className="flex flex-shrink-0 flex-col gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100 focus-within:opacity-100">
                <button
                  onClick={() => openEdit(c)}
                  className="icon-btn p-1.5"
                  aria-label={t("dash.products.edit", { name: c.name })}
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    if (confirm(t("dash.products.confirmDelete", { name: c.name })))
                      deleteMutation.mutate(c.id);
                  }}
                  className="icon-btn-danger p-1.5"
                  aria-label={t("dash.products.delete", { name: c.name })}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Tags}
          title={t("dash.categories.emptyTitle")}
          description={t("dash.categories.emptyBody")}
          action={
            <button onClick={openCreate} className="btn-primary">
              <Plus className="h-4 w-4" />
              {t("dash.categories.add")}
            </button>
          }
        />
      )}

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editing ? t("dash.categories.editTitle") : t("dash.categories.newTitle")}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
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
              placeholder={t("dash.categories.namePlaceholder")}
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
              placeholder={t("dash.categories.descriptionPlaceholder")}
            />
          </div>

          <ImageUpload
            value={form.imageUrl}
            onChange={(url) => setForm({ ...form, imageUrl: url })}
            folder="categories"
            label={t("dash.categories.image")}
          />

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
              {editing ? t("dash.products.save") : t("dash.categories.create")}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
