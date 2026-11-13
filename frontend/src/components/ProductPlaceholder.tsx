import { cn } from "@/lib/utils";

// Stands in for a missing product photo: the name's initial on a warm tile,
// its colour picked from the name so the same product always looks the same.
const TONES = [
  "from-[#efe6d6] to-[#e2d3b9] text-[#8a6a3a] dark:from-[#2a251f] dark:to-[#211d19] dark:text-[#c9a66b]",
  "from-[#e4ebe4] to-[#d0ddd3] text-[#3f6450] dark:from-[#1f2723] dark:to-[#1a201c] dark:text-[#8fb9a1]",
  "from-[#f1e1d8] to-[#e5c9ba] text-[#9a5a3c] dark:from-[#2a211d] dark:to-[#221b18] dark:text-[#d49a7b]",
  "from-[#e3e8ee] to-[#d0d9e3] text-[#4a5d74] dark:from-[#1f2329] dark:to-[#1a1d22] dark:text-[#9fb3cc]",
  "from-[#f3e7cf] to-[#e7d2a5] text-[#8a6416] dark:from-[#2a2519] dark:to-[#221e15] dark:text-[#d8b45e]",
  "from-[#f2e4e6] to-[#e5cdd2] text-[#8c4f5c] dark:from-[#2a2023] dark:to-[#221a1d] dark:text-[#d495a3]",
];

function hash(text: string): number {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.codePointAt(0)!) | 0;
  return Math.abs(h);
}

export function ProductPlaceholder({
  name,
  size = "md",
  className,
}: {
  name: string;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}) {
  const initial = [...name.trim()][0]?.toUpperCase() ?? "·";
  return (
    <div
      aria-hidden
      className={cn(
        "relative flex h-full w-full items-center justify-center overflow-hidden bg-gradient-to-br",
        TONES[hash(name) % TONES.length],
        className,
      )}
    >
      <span className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,currentColor_1px,transparent_0)] bg-[length:16px_16px] opacity-[0.12]" />
      <span
        className={cn(
          "relative font-serif font-bold leading-none opacity-80",
          size === "xs" && "text-base",
          size === "sm" && "text-2xl",
          size === "md" && "text-6xl",
          size === "lg" && "text-8xl sm:text-9xl",
        )}
      >
        {initial}
      </span>
    </div>
  );
}
