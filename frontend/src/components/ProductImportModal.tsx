import { useState, ChangeEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Download, Upload } from "lucide-react";
import { productsApi, ImportResult } from "../api/products";
import { shopsApi } from "../api/shops";
import { ApiError } from "../api/client";
import { useAuth } from "../store/AuthContext";
import { useI18n } from "../i18n/I18nProvider";
import { Modal } from "./ui/Modal";
import toast from "react-hot-toast";

const MAX_BYTES = 900_000;
const TEMPLATE =
  "name,price,stock,category,description,imageUrl\n" +
  '"Tasse en céramique",1800,12,,"Tournée à la main",\n';

type Check =
  | { state: "ok"; result: ImportResult }
  | { state: "invalid"; message: string; errors: { line: number; message: string }[] };

// Bulk add / update products from a CSV export (Excel, Google Sheets...).
// The file is checked first (dry run) so nothing is saved until it's clean.
export function ProductImportModal({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const { isSuperAdmin } = useAuth();
  const qc = useQueryClient();
  const [csv, setCsv] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [shopId, setShopId] = useState("");
  const [check, setCheck] = useState<Check | null>(null);

  const { data: shops } = useQuery({ queryKey: ["shops"], queryFn: shopsApi.list, enabled: isSuperAdmin });
  const opts = () => (isSuperAdmin ? { shopId } : {});

  const toCheck = (err: unknown): Check => ({
    state: "invalid",
    message: String(err),
    errors: err instanceof ApiError ? err.data?.errors ?? [] : [],
  });

  const dryRun = useMutation({
    mutationFn: (text: string) => productsApi.importCsv(text, { dryRun: true, ...opts() }),
    onSuccess: (result) => setCheck({ state: "ok", result }),
    onError: (err) => setCheck(toCheck(err)),
  });

  const run = useMutation({
    mutationFn: () => productsApi.importCsv(csv!, opts()),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["products"] });
      toast.success(t("dash.import.done", { created: result.created, updated: result.updated }));
      onClose();
    },
    onError: (err) => setCheck(toCheck(err)),
  });

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setCheck(null);
    if (!file) return;
    if (file.size > MAX_BYTES) {
      toast.error(t("dash.import.tooBig"));
      return;
    }
    const text = await file.text();
    setCsv(text);
    setFileName(file.name);
    if (!isSuperAdmin || shopId) dryRun.mutate(text);
  }

  function downloadTemplate() {
    const url = URL.createObjectURL(new Blob(["﻿" + TEMPLATE], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "products-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Modal open onClose={onClose} title={t("dash.import.title")} description={t("dash.import.description")}>
      <div className="space-y-4">
        <p className="text-xs text-muted-foreground">{t("dash.import.columns")}</p>
        <button type="button" onClick={downloadTemplate} className="btn-ghost btn-sm">
          <Download className="h-3.5 w-3.5" />
          {t("dash.import.template")}
        </button>

        {isSuperAdmin && (
          <div>
            <label htmlFor="import-shop" className="label">{t("dash.col.shop")}</label>
            <select
              id="import-shop"
              value={shopId}
              onChange={(e) => {
                setShopId(e.target.value);
                setCheck(null);
              }}
              className="select"
            >
              <option value="">{t("dash.products.selectShop")}</option>
              {shops?.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label htmlFor="import-file" className="label">{t("dash.import.file")}</label>
          <input
            id="import-file"
            type="file"
            accept=".csv,text/csv"
            onChange={onFile}
            disabled={isSuperAdmin && !shopId}
            className="block w-full text-sm text-muted-foreground file:me-3 file:rounded-lg file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-sm file:font-medium file:text-foreground"
          />
          {fileName && <p className="mt-1 text-xs text-muted-foreground">{fileName}</p>}
        </div>

        {dryRun.isPending && <p className="text-sm text-muted-foreground">{t("dash.import.checking")}</p>}

        {check?.state === "ok" && (
          <p className="flex items-center gap-2 rounded-lg border border-success/30 bg-success-soft px-3 py-2 text-sm text-success">
            <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
            {t("dash.import.ready", { created: check.result.created, updated: check.result.updated })}
          </p>
        )}

        {check?.state === "invalid" && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm">
            <p className="flex items-center gap-2 font-medium text-destructive">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              {check.errors.length ? t("dash.import.errorsTitle") : check.message}
            </p>
            {check.errors.length > 0 && (
              <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-xs text-foreground">
                {check.errors.map((e) => (
                  <li key={`${e.line}-${e.message}`}>
                    <span className="font-semibold">{t("dash.import.line", { line: e.line })}</span> — {e.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="flex gap-3 border-t border-border pt-4">
          <button type="button" onClick={onClose} className="btn-outline flex-1">
            {t("dash.cancel")}
          </button>
          <button
            type="button"
            onClick={() => run.mutate()}
            disabled={check?.state !== "ok" || run.isPending}
            className="btn-primary flex-1"
          >
            <Upload className="h-4 w-4" />
            {t("dash.import.submit")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
