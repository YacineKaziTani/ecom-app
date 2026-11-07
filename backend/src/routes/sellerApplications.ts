import { Request, Response, Router } from "express";
import { z } from "zod";
import { AppDataSource } from "../config/data-source";
import { SellerApplication } from "../entities/SellerApplication";
import { Shop } from "../entities/Shop";
import { User } from "../entities/User";
import { requireAuth, requireSuperAdmin } from "../middleware/auth";
import { validateUuidParam } from "../middleware/validateUuid";
import { HttpError } from "../utils/httpError";
import { paginated, parsePagination } from "../utils/pagination";
import { slugify } from "../utils/slug";
import { algerianPhoneSchema, nameSchema, shortTextSchema } from "../utils/validators";
import { revokeAllRefreshTokensForUser } from "../utils/tokens";
import * as mailer from "../services/email";
import { inBackground } from "../services/notifications";
import { audit } from "../services/audit";
import {
  sellerApplicationDecisionEmail,
  sellerApplicationForAdminEmail,
} from "../emails/accountEmails";

const router = Router();
const repo = () => AppDataSource.getRepository(SellerApplication);
const clientUrl = () => process.env.CLIENT_URL || "http://localhost:5173";

async function slugTaken(name: string) {
  const slug = slugify(name);
  if (!slug) return true;
  return (await AppDataSource.getRepository(Shop).count({ where: [{ slug }, { name }] })) > 0;
}

const applySchema = z.object({
  shopName: nameSchema,
  description: shortTextSchema,
  phone: algerianPhoneSchema,
  wilayaCode: z.number().int().min(1).max(99).optional(),
  message: z.string().trim().max(2000).optional(),
});

// A signed-in customer applies to open a shop.
router.post("/", requireAuth, async (req, res) => {
  const parsed = applySchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });

  const user = await AppDataSource.getRepository(User).findOneByOrFail({ id: req.user!.id });
  if (user.role !== "customer") {
    return res.status(400).json({ message: "You already have seller access" });
  }
  if (!user.emailVerifiedAt) {
    return res.status(403).json({ message: "Confirm your email address before applying" });
  }
  if (await repo().count({ where: { userId: user.id, status: "pending" } })) {
    return res.status(409).json({ message: "You already have an application under review" });
  }
  if (await slugTaken(parsed.data.shopName)) {
    return res.status(409).json({ message: "That shop name is taken — try a more distinct one" });
  }

  const application = await repo().save(repo().create({ ...parsed.data, userId: user.id }));
  res.status(201).json(application);

  // Let every super admin know there's something to review.
  inBackground(
    (async () => {
      const superAdmins = await AppDataSource.getRepository(User).find({ where: { role: "super_admin" } });
      const message = sellerApplicationForAdminEmail(
        `${user.firstName} ${user.lastName}`,
        application.shopName,
        `${clientUrl()}/dashboard/applications`,
      );
      for (const admin of superAdmins) await mailer.sendEmail("seller-application", admin.email, message);
    })(),
    { applicationId: application.id },
  );
});

// The applicant's latest application (or null).
router.get("/mine", requireAuth, async (req, res) => {
  const latest = await repo().findOne({
    where: { userId: req.user!.id },
    order: { createdAt: "DESC" },
  });
  res.json(latest ?? null);
});

// Super admin: review queue (?status=pending|approved|rejected).
router.get("/", requireAuth, requireSuperAdmin, async (req, res) => {
  const pageParams = parsePagination(req.query);
  const status = z.enum(["pending", "approved", "rejected"]).safeParse(req.query.status);
  const [items, total] = await repo().findAndCount({
    where: status.success ? { status: status.data } : {},
    relations: ["user"],
    order: { createdAt: "DESC" },
    skip: pageParams.skip,
    take: pageParams.limit,
  });
  res.json(paginated(items, total, pageParams));
});

const decisionSchema = z.object({ note: z.string().trim().max(500).optional() });

// Super admin: approve (creates the shop, makes the applicant its admin) or reject.
const decide = (approve: boolean) => async (req: Request<{ id: string }>, res: Response) => {
    const parsed = decisionSchema.safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json({ message: "Invalid input" });
    const note = parsed.data.note || null;

    const { application, user } = await AppDataSource.transaction(async (manager) => {
      const application = await manager.getRepository(SellerApplication).findOne({
        where: { id: req.params.id },
        lock: { mode: "pessimistic_write" },
      });
      if (!application) throw new HttpError(404, "Application not found");
      if (application.status !== "pending") throw new HttpError(409, "This application was already reviewed");
      const user = await manager.getRepository(User).findOneByOrFail({ id: application.userId });

      if (approve) {
        if (await slugTaken(application.shopName)) {
          throw new HttpError(409, "A shop with this name now exists — reject with a note asking for another name");
        }
        if (await manager.getRepository(Shop).count({ where: { ownerId: user.id } })) {
          throw new HttpError(409, "This user already owns a shop");
        }
        await manager.getRepository(Shop).save(
          manager.getRepository(Shop).create({
            name: application.shopName,
            slug: slugify(application.shopName),
            description: application.description ?? undefined,
            ownerId: user.id,
          }),
        );
        await manager.getRepository(User).update(user.id, { role: "admin" });
      }

      Object.assign(application, {
        status: approve ? "approved" : "rejected",
        reviewNote: note,
        reviewedById: req.user!.id,
        reviewedAt: new Date(),
      });
      await manager.save(application);
      return { application, user };
    });

    // The applicant's current tokens still say "customer" — make them sign in again.
    if (approve) await revokeAllRefreshTokensForUser(user.id);
    await audit(req, approve ? "seller_application.approve" : "seller_application.reject", "seller_application", application.id, {
      shopName: application.shopName,
      userEmail: user.email,
      note,
    });

    res.json(application);
    inBackground(
      mailer.sendEmail(
        "seller-application-decision",
        user.email,
        sellerApplicationDecisionEmail(approve, user.firstName, application.shopName, `${clientUrl()}/login`, note),
      ),
      { applicationId: application.id },
    );
};

router.post("/:id/approve", validateUuidParam(), requireAuth, requireSuperAdmin, decide(true));
router.post("/:id/reject", validateUuidParam(), requireAuth, requireSuperAdmin, decide(false));

export default router;
