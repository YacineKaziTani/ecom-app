// "Atelier Bab El Oued" → "atelier-bab-el-oued". Accents are stripped first so
// "Béjaïa Céramique" becomes "bejaia-ceramique" rather than losing letters.
export function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
