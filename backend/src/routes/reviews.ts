import { Router } from "express";
import { z } from "zod";
import { EntityManager } from "typeorm";
import { AppDataSource } from "../config/data-source";
import { COUNTED_SALE_SQL } from "../entities/Order";
import { Product } from "../entities/Product";
import { Review } from "../entities/Review";
import { User } from "../entities/User";
import { optionalAuth, requireAuth } from "../middleware/auth";
import { validateUuidParam } from "../middleware/validateUuid";
import { HttpError } from "../utils/httpError";
import { paginated, parsePagination } from "../utils/pagination";
import { audit } from "../services/audit";

// Mounted at /api: GET/POST /products/:id/reviews, DELETE /reviews/:id
const router = Router();
const reviews = () => AppDataSource.getRepository(Review);

// A verified buyer: has a paid (card paid / COD delivered), non-cancelled
// order containing this product.
async function hasBought(userId: string, productId: string): Promise<boolean> {
  const [row] = await AppDataSource.query(
    `SELECT EXISTS (
       SELECT 1 FROM orders o JOIN order_items oi ON oi."orderId" = o.id
       WHERE o."userId" = $1 AND oi."productId" = $2
         AND ${COUNTED_SALE_SQL}
     ) AS bought`,
    [userId, productId],
  );
  return row.bought === true;
}

async function refreshRating(manager: EntityManager, productId: string) {
  await manager.query(
    `UPDATE products SET
       "ratingAverage" = COALESCE((SELECT ROUND(AVG(rating)::numeric, 2) FROM reviews WHERE "productId" = $1), 0),
       "ratingCount" = (SELECT COUNT(*) FROM reviews WHERE "productId" = $1)
     WHERE id = $1`,
    [productId],
  );
}

// Public list. When signed in, also says whether you may review and returns
// your own review so the form can be pre-filled.
router.get("/products/:id/reviews", validateUuidParam(), optionalAuth, async (req, res) => {
  const pageParams = parsePagination(req.query, 10, 50);
  const [items, total] = await reviews()
    .createQueryBuilder("review")
    .leftJoin("review.user", "user")
    .addSelect(["user.id", "user.firstName", "user.lastName"])
    .where("review.productId = :id", { id: req.params.id })
    .orderBy("review.createdAt", "DESC")
    .skip(pageParams.skip)
    .take(pageParams.limit)
    .getManyAndCount();

  // Show "Amina B." rather than full names.
  const safe = items.map(({ user, ...r }) => ({
    ...r,
    author: user ? `${user.firstName} ${user.lastName.charAt(0)}.` : "Customer",
  }));

  let mine: Review | null = null;
  let canReview = false;
  if (req.user) {
    mine = await reviews().findOne({ where: { productId: req.params.id, userId: req.user.id } });
    canReview = await hasBought(req.user.id, req.params.id);
  }
  res.json({ ...paginated(safe, total, pageParams), mine, canReview });
});

const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional(),
});

// Create or update your own review.
router.post("/products/:id/reviews", validateUuidParam(), requireAuth, async (req, res) => {
  const parsed = reviewSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });

  const productId = req.params.id;
  if (!(await AppDataSource.getRepository(Product).exist({ where: { id: productId } })))
    return res.status(404).json({ message: "Product not found" });
  const user = await AppDataSource.getRepository(User).findOneByOrFail({ id: req.user!.id });
  if (!user.emailVerifiedAt)
    return res.status(403).json({ message: "Confirm your email address before reviewing" });
  if (!(await hasBought(user.id, productId)))
    return res.status(403).json({ message: "Only customers who bought this item can review it" });

  const review = await AppDataSource.transaction(async (manager) => {
    const repo = manager.getRepository(Review);
    const existing = await repo.findOne({ where: { productId, userId: user.id } });
    const saved = await repo.save(
      Object.assign(existing ?? repo.create({ productId, userId: user.id }), {
        rating: parsed.data.rating,
        comment: parsed.data.comment || null,
      }),
    );
    await refreshRating(manager, productId);
    return saved;
  });
  res.status(201).json(review);
});

// Authors can delete their own review; super admins can moderate any.
router.delete("/reviews/:id", validateUuidParam(), requireAuth, async (req, res) => {
  const review = await reviews().findOne({ where: { id: req.params.id } });
  if (!review) throw new HttpError(404, "Review not found");
  const isMod = req.user!.role === "super_admin";
  if (review.userId !== req.user!.id && !isMod) throw new HttpError(403, "You can only delete your own review");

  await AppDataSource.transaction(async (manager) => {
    await manager.getRepository(Review).delete(review.id);
    await refreshRating(manager, review.productId);
  });
  if (isMod && review.userId !== req.user!.id) {
    void audit(req, "review.delete", "review", review.id, { productId: review.productId, rating: review.rating });
  }
  res.status(204).send();
});

export default router;
