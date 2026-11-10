import { useRef, useState, DragEvent } from "react";
import { Upload, X, Loader2, ImagePlus } from "lucide-react";
import { uploadApi } from "../api/upload";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";
import { optimizedImage } from "../lib/images";
import { useI18n } from "../i18n/I18nProvider";

interface ImageUploadProps {
  value?: string;
  onChange: (url: string) => void;
  folder: "products" | "categories" | "shops";
  label?: string;
}

export function ImageUpload({
  value,
  onChange,
  folder,
  label,
}: ImageUploadProps) {
  const { t } = useI18n();
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error(t("upload.notImage"));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t("upload.tooBig"));
      return;
    }

    setUploading(true);
    try {
      const result = await uploadApi.image(file, folder);
      onChange(result.url);
    } catch (err: any) {
      toast.error(String(err) || t("upload.failed"));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function handleDrop(e: DragEvent<HTMLButtonElement>) {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files?.[0]);
  }

  return (
    <div>
      {label !== "" && <label className="label">{label ?? t("upload.image")}</label>}

      {value ? (
        <div className="flex items-start gap-3">
          <div className="group relative h-28 w-28 overflow-hidden rounded-xl border border-border bg-secondary">
            <img src={optimizedImage(value, 240)} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => onChange("")}
              className="absolute end-1.5 top-1.5 rounded-full bg-foreground/70 p-1 text-background
                         opacity-0 transition-opacity hover:bg-foreground group-hover:opacity-100
                         focus-visible:opacity-100"
              aria-label={t("upload.remove")}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="btn-outline btn-sm"
          >
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5" />
            )}
            {uploading ? t("upload.uploading") : t("upload.replace")}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          disabled={uploading}
          className={cn(
            "flex h-28 w-full max-w-xs flex-col items-center justify-center gap-2 rounded-xl",
            "border-2 border-dashed transition-all duration-200 disabled:opacity-60",
            dragging
              ? "border-accent bg-accent-soft text-accent"
              : "border-border bg-secondary/40 text-muted-foreground hover:border-accent/60 hover:bg-accent-soft/50 hover:text-accent",
          )}
        >
          {uploading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-xs font-medium">{t("upload.uploading")}</span>
            </>
          ) : (
            <>
              <ImagePlus className="h-6 w-6" />
              <span className="text-xs font-medium">{t("upload.drop")}</span>
              <span className="text-[11px] opacity-70">{t("upload.formats")}</span>
            </>
          )}
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
    </div>
  );
}
