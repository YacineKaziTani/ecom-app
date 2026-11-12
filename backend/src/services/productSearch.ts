import { Brackets, SelectQueryBuilder } from "typeorm";
import { AppDataSource } from "../config/data-source";
import { Product } from "../entities/Product";

// Storefront search. Everything is compared through the search_normalize()
// SQL function (migration AddSmartSearch): case, accents, hyphens and Arabic
// letter variants don't matter. Every word of the query must match, in the
// product's name or description, its category or its shop; a word of 4+
// letters also matches a product name that's close enough ("tajin" → Tajine).
// The query builder must join `product.category` as `category` and
// `product.shop` as `shop`.

const MAX_TERMS = 6;
// Words shorter than this only match exactly: trigram similarity on two or
// three letters matches almost anything.
const FUZZY_MIN_LENGTH = 4;
// A zero-result search offers the closest product name above this score.
const SUGGESTION_MIN_SCORE = 0.3;

export function searchTerms(raw: string): string[] {
  return raw
    .normalize("NFC")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, MAX_TERMS)
    .map((term) => term.slice(0, 50));
}

// So "%" or "_" in a query are searched literally, not as LIKE wildcards.
const escapeLike = (value: string) => value.replace(/[\\%_]/g, "\\$&");

const contains = (column: string, param: string) =>
  `search_normalize(${column}) LIKE '%' || search_normalize(:${param}) || '%'`;

export function applySearch(qb: SelectQueryBuilder<Product>, raw: string): boolean {
  const terms = searchTerms(raw);
  terms.forEach((term, i) => {
    const like = `searchLike${i}`;
    const word = `searchWord${i}`;
    qb.andWhere(
      new Brackets((match) => {
        match
          .where(contains("product.name", like))
          .orWhere(contains("coalesce(product.description, '')", like))
          .orWhere(contains("coalesce(category.name, '')", like))
          .orWhere(contains("shop.name", like));
        if (term.length >= FUZZY_MIN_LENGTH) {
          match.orWhere(`search_normalize(:${word}) <% search_normalize(product.name)`);
        }
      }),
      { [like]: escapeLike(term), [word]: term },
    );
  });
  return terms.length > 0;
}

// Best matches first: names starting with the query, then names containing
// it, then by how close the name is; newest last.
export function orderByRelevance(qb: SelectQueryBuilder<Product>, raw: string) {
  const query = searchTerms(raw).join(" ");
  qb.setParameters({ relevanceLike: escapeLike(query), relevanceWord: query })
    .orderBy(
      `CASE WHEN search_normalize(product.name) LIKE search_normalize(:relevanceLike) || '%' THEN 0
            WHEN search_normalize(product.name) LIKE '%' || search_normalize(:relevanceLike) || '%' THEN 1
            ELSE 2 END`,
      "ASC",
    )
    .addOrderBy("word_similarity(search_normalize(:relevanceWord), search_normalize(product.name))", "DESC")
    .addOrderBy("product.createdAt", "DESC");
}

// "Did you mean …?" for a search with no results: the closest product name.
export async function suggestionFor(raw: string): Promise<string | null> {
  const query = searchTerms(raw).join(" ");
  if (query.length < 3) return null;
  const [best] = await AppDataSource.query(
    `SELECT name, word_similarity(search_normalize($1), search_normalize(name)) AS score
     FROM products
     ORDER BY score DESC
     LIMIT 1`,
    [query],
  );
  return best && Number(best.score) >= SUGGESTION_MIN_SCORE ? best.name : null;
}

// Categories and shops whose name contains the query (for search suggestions).
export async function matchingCategoriesAndShops(raw: string) {
  const query = escapeLike(searchTerms(raw).join(" "));
  const [categories, shops] = await Promise.all([
    AppDataSource.query(
      `SELECT id, name FROM categories
       WHERE search_normalize(name) LIKE '%' || search_normalize($1) || '%'
       ORDER BY name LIMIT 4`,
      [query],
    ),
    AppDataSource.query(
      `SELECT id, name, slug, "logoUrl" FROM shops
       WHERE search_normalize(name) LIKE '%' || search_normalize($1) || '%'
       ORDER BY name LIMIT 3`,
      [query],
    ),
  ]);
  return { categories, shops };
}
