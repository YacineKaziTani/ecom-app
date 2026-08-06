import { LucideIcon } from "lucide-react";

export function StatCard({
  label,
  value,
  icon: Icon,
  accent = "brand",
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  accent?: "brand" | "amber" | "rose" | "blue";
}) {
  const accents: Record<string, string> = {
    brand: "bg-brand-50 text-brand-600",
    amber: "bg-amber-50 text-amber-600",
    rose: "bg-rose-50 text-rose-600",
    blue: "bg-blue-50 text-blue-600",
  };

  return (
    <div className="card flex items-center gap-4 p-5">
      <div className={`rounded-xl p-3 ${accents[accent]}`}>
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <p className="text-sm">{label}</p>
        <p className="text-2xl font-bold">{value}</p>
      </div>
    </div>
  );
}
