import { Plus, Trash2 } from "lucide-react";
import { VariantInput } from "../api/products";
import { useI18n } from "../i18n/I18nProvider";

// Rows are edited as strings so a half-typed price ("12.") or an emptied
// stock field doesn't jump back to a number while typing.
export interface VariantRow {
  id?: string;
  name: string;
  sku: string;
  price: string; // "" = the product's price
  stock: string;
}

export const toRows = (variants: { id: string; name: string; sku?: string | null; price?: number | string | null; stock: number }[]): VariantRow[] =>
  variants.map((v) => ({
    id: v.id,
    name: v.name,
    sku: v.sku ?? "",
    price: v.price != null ? String(Number(v.price)) : "",
    stock: String(v.stock),
  }));

export const toInput = (rows: VariantRow[]): VariantInput[] =>
  rows.map((r) => ({
    ...(r.id ? { id: r.id } : {}),
    name: r.name.trim(),
    sku: r.sku.trim() || null,
    price: r.price.trim() === "" ? null : Number(r.price),
    stock: Math.max(0, Math.trunc(Number(r.stock) || 0)),
  }));

export const rowsStock = (rows: VariantRow[]) => toInput(rows).reduce((sum, v) => sum + v.stock, 0);

export function VariantsEditor({ rows, onChange }: { rows: VariantRow[]; onChange: (rows: VariantRow[]) => void }) {
  const { t } = useI18n();
  const update = (index: number, patch: Partial<VariantRow>) =>
    onChange(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));

  return (
    <fieldset className="rounded-lg border border-border p-3">
      <legend className="px-1 text-sm font-semibold text-foreground">{t("dash.variants.title")}</legend>
      <p className="mb-3 text-xs text-muted-foreground">{t("dash.variants.hint")}</p>

      {rows.length > 0 && (
        <div className="space-y-2">
          <div className="grid grid-cols-[1fr_5.5rem_4.5rem_5rem_2rem] gap-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            <span>{t("dash.variants.name")}</span>
            <span>{t("dash.variants.price")}</span>
            <span>{t("dash.variants.stock")}</span>
            <span>{t("dash.variants.sku")}</span>
            <span />
          </div>
          {rows.map((row, index) => (
            <div key={row.id ?? `new-${index}`} className="grid grid-cols-[1fr_5.5rem_4.5rem_5rem_2rem] items-center gap-2">
              <input
                required
                maxLength={60}
                value={row.name}
                onChange={(e) => update(index, { name: e.target.value })}
                placeholder={t("dash.variants.namePlaceholder")}
                aria-label={t("dash.variants.name")}
                className="input h-9 px-2.5"
              />
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={row.price}
                onChange={(e) => update(index, { price: e.target.value })}
                placeholder={t("dash.variants.samePrice")}
                aria-label={t("dash.variants.price")}
                className="input h-9 px-2"
              />
              <input
                type="number"
                min="0"
                step="1"
                required
                value={row.stock}
                onChange={(e) => update(index, { stock: e.target.value })}
                aria-label={t("dash.variants.stock")}
                className="input h-9 px-2"
              />
              <input
                maxLength={64}
                value={row.sku}
                onChange={(e) => update(index, { sku: e.target.value })}
                aria-label={t("dash.variants.sku")}
                className="input h-9 px-2"
              />
              <button
                type="button"
                onClick={() => onChange(rows.filter((_, i) => i !== index))}
                className="icon-btn-danger h-8 w-8"
                aria-label={t("dash.variants.remove", { name: row.name || "—" })}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => onChange([...rows, { name: "", sku: "", price: "", stock: "0" }])}
        disabled={rows.length >= 50}
        className="btn-ghost btn-sm mt-2"
      >
        <Plus className="h-3.5 w-3.5" />
        {t("dash.variants.add")}
      </button>
    </fieldset>
  );
}
