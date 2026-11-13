// Splits a shop name for its two-tone wordmark: the last word in the accent
// colour ("Dar Fen" → "Dar " + "Fen"), or the last capitalised part of a
// single word ("ArtisanShop" → "Artisan" + "Shop"). Otherwise all plain.
export function splitWordmark(name: string): [string, string] {
  const space = name.lastIndexOf(" ");
  if (space > 0) return [name.slice(0, space + 1), name.slice(space + 1)];
  const match = name.match(/^(.*[a-zà-ÿ])([A-ZÀ-Þ].*)$/);
  return match ? [match[1], match[2]] : [name, ""];
}
