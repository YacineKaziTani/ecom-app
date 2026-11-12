import { Router } from "express";
import { AppDataSource } from "../config/data-source";
import { Product } from "../entities/Product";
import { applySearch, matchingCategoriesAndShops, orderByRelevance } from "../services/productSearch";

const router = Router();

// Live suggestions for the search box, as the customer types: the best
// matching products, plus categories and shops whose name matches.
router.get("/suggest", async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 100) : "";
  if (q.length < 2) return res.json({ products: [], categories: [], shops: [] });

  const qb = AppDataSource.getRepository(Product)
    .createQueryBuilder("product")
    .leftJoin("product.category", "category")
    .leftJoin("product.shop", "shop")
    .select(["product.id", "product.name", "product.price", "product.imageUrl", "product.stock"]);
  applySearch(qb, q);
  orderByRelevance(qb, q);
  qb.limit(6);

  const [products, { categories, shops }] = await Promise.all([qb.getMany(), matchingCategoriesAndShops(q)]);
  res.json({ products, categories, shops });
});

export default router;
