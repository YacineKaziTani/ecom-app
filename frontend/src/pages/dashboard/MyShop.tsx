import { useState, FormEvent, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { shopsApi, ShopInput } from "../../api/shops";
import { useAuth } from "../../store/AuthContext";
import { ImageUpload } from "../../components/ImageUpload";
import toast from "react-hot-toast";

export default function MyShop() {
  const { isSuperAdmin } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState<ShopInput>({
    name: "",
    description: "",
    logoUrl: "",
  });

  const {
    data: shop,
    isLoading,
    isError,
  } = useQuery({
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
      <p className="">
        Super admins don't own an individual shop — you manage every shop from
        here.
      </p>
    );
  }

  if (isLoading) return <p className="text-gray-400">Loading...</p>;

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-2 text-2xl font-bold">My Shop</h1>
      {!shop && (
        <p className="mb-6 text-sm">
          You don't have a shop yet — create one below before adding products.
        </p>
      )}

      <form onSubmit={handleSubmit} className="card space-y-4 p-6">
        <div>
          <label className="mb-1 block text-sm font-medium">Shop name</label>
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full rounded-lg border border-border bg-card px-4 py-3 text-foreground transition focus:border-accent focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full rounded-lg border border-border bg-card px-4 py-3 text-foreground transition focus:border-accent focus:outline-none"
            rows={3}
          />
        </div>
        <ImageUpload
          value={form.logoUrl}
          onChange={(url) => setForm({ ...form, logoUrl: url })}
          folder="shops"
          label="Shop logo"
        />
        <button
          type="submit"
          disabled={createMutation.isPending || updateMutation.isPending}
          className="btn-primary w-full"
        >
          {shop ? "Save changes" : "Create my shop"}
        </button>
      </form>
    </div>
  );
}
