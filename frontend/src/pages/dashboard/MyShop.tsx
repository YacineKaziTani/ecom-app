import { useState, FormEvent, useEffect } from "react";
import { Link } from "react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Store, ExternalLink, Info } from "lucide-react";
import { shopsApi, ShopInput } from "../../api/shops";
import { useAuth } from "../../store/AuthContext";
import { ImageUpload } from "../../components/ImageUpload";
import { PageHeader } from "../../components/ui/PageHeader";
import { EmptyState } from "../../components/ui/EmptyState";
import { Skeleton } from "../../components/ui/Skeleton";
import toast from "react-hot-toast";

export default function MyShop() {
  const { isSuperAdmin } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState<ShopInput>({
    name: "",
    description: "",
    logoUrl: "",
  });

  const { data: shop, isLoading } = useQuery({
    queryKey: ["myShop"],
    queryFn: shopsApi.mine,
    retry: false,
    enabled: !isSuperAdmin, // super_admin has no personal shop
  });

  useEffect(() => {
    if (shop)
      setForm({
        name: shop.name,
        description: shop.description || "",
        logoUrl: shop.logoUrl || "",
      });
  }, [shop]);

  const createMutation = useMutation({
    mutationFn: shopsApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["myShop"] });
      toast.success("Shop created!");
    },
    onError: (err: any) => toast.error(String(err)),
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<ShopInput>) => shopsApi.update(shop!.id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["myShop"] });
      toast.success("Shop updated");
    },
    onError: (err: any) => toast.error(String(err)),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (shop) updateMutation.mutate(form);
    else createMutation.mutate(form);
  }

  if (isSuperAdmin) {
    return (
      <EmptyState
        icon={Store}
        title="No personal shop"
        description="Super admins don't own an individual shop — you manage every shop on the platform from the other dashboard sections."
      />
    );
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-80 w-full rounded-xl" />
      </div>
    );
  }

  const pending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        eyebrow="Storefront"
        title="My shop"
        description="How your shop appears to shoppers across the marketplace."
        actions={
          shop ? (
            <Link
              to={`/shops/${shop.slug}`}
              className="btn-outline"
              target="_blank"
              rel="noreferrer"
            >
              View public page
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          ) : undefined
        }
      />

      {!shop && (
        <p className="mb-6 flex items-start gap-2 rounded-lg border border-info/30 bg-info-soft px-4 py-3 text-sm text-info">
          <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
          You don't have a shop yet — create one below before adding products.
        </p>
      )}

      <form onSubmit={handleSubmit} className="card overflow-hidden">
        <div className="space-y-5 p-6">
          <div>
            <label htmlFor="name" className="label">
              Shop name
            </label>
            <input
              id="name"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="input"
              placeholder="Clay & Kiln Studio"
            />
            {shop && (
              <p className="field-hint">
                Public URL: <span className="font-mono">/shops/{shop.slug}</span>
              </p>
            )}
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
              rows={4}
              className="textarea"
              placeholder="Tell shoppers what you make and what makes it different."
            />
          </div>

          <ImageUpload
            value={form.logoUrl}
            onChange={(url) => setForm({ ...form, logoUrl: url })}
            folder="shops"
            label="Shop logo"
          />
        </div>

        <div className="flex justify-end border-t border-border bg-secondary/30 px-6 py-4">
          <button
            type="submit"
            disabled={pending}
            className="btn-primary w-full sm:w-auto"
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            {shop ? "Save changes" : "Create my shop"}
          </button>
        </div>
      </form>
    </div>
  );
}
