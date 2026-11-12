import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { shippingApi } from "../api/shipping";
import { useI18n } from "../i18n/I18nProvider";

// The communes of the chosen wilaya. The value is the commune's official
// Latin name (what the server stores); Arabic readers see the Arabic name.
// A value that isn't in the list (e.g. typed by hand before the dropdown
// existed) is cleared, so the customer picks a real one.
export function CommuneSelect({
  id,
  wilayaCode,
  value,
  onChange,
  required,
  className = "select",
}: {
  id: string;
  wilayaCode: number | "";
  value: string;
  onChange: (commune: string) => void;
  required?: boolean;
  className?: string;
}) {
  const { t, lang } = useI18n();
  const { data: communes, isLoading } = useQuery({
    queryKey: ["communes", wilayaCode],
    queryFn: () => shippingApi.communes(wilayaCode as number),
    enabled: wilayaCode !== "",
    staleTime: Infinity, // the official list doesn't change
  });

  const known = !!communes?.some((c) => c.name === value);
  useEffect(() => {
    if (communes && value && !known) onChange("");
  }, [communes, value, known, onChange]);

  const sorted =
    lang === "ar" && communes
      ? [...communes].sort((a, b) => a.nameAr.localeCompare(b.nameAr, "ar"))
      : communes ?? [];

  return (
    <select
      id={id}
      required={required}
      disabled={wilayaCode === "" || isLoading}
      value={known ? value : ""}
      onChange={(e) => onChange(e.target.value)}
      className={className}
    >
      <option value="">{wilayaCode === "" ? t("cart.chooseWilayaFirst") : t("cart.chooseCommune")}</option>
      {sorted.map((c) => (
        <option key={c.name} value={c.name}>
          {lang === "ar" ? c.nameAr : c.name}
        </option>
      ))}
    </select>
  );
}
