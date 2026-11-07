import { ErrorRequestHandler, Router } from "express";
import multer from "multer";
import cloudinary from "../config/cloudinary";
import { logger } from "../config/logger";
import { requireAuth, requireAnyAdmin } from "../middleware/auth";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed"));
    }
    cb(null, true);
  },
});

function uploadBuffer(
  buffer: Buffer,
  folder: string,
): Promise<{ url: string; publicId: string }> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
        transformation: [{ width: 1200, height: 1200, crop: "limit" }],
      },
      (error, result) => {
        if (error || !result)
          return reject(error || new Error("Upload failed"));
        resolve({ url: result.secure_url, publicId: result.public_id });
      },
    );
    stream.end(buffer);
  });
}

router.post(
  "/",
  requireAuth,
  requireAnyAdmin,
  upload.single("image"),
  async (req, res) => {
    if (!req.file)
      return res.status(400).json({ message: "No image file provided" });

    const folder =
      typeof req.query.folder === "string" ? req.query.folder : "misc";
    const safeFolder = `artisan-shop/${folder.replace(/[^a-z0-9_-]/gi, "")}`;

    try {
      const result = await uploadBuffer(req.file.buffer, safeFolder);
      res.status(201).json(result);
    } catch (err) {
      logger.error({ err }, "Cloudinary upload failed");
      res.status(500).json({ message: "Image upload failed" });
    }
  },
);

const uploadErrorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  if (
    err instanceof multer.MulterError ||
    err?.message === "Only image files are allowed"
  ) {
    return res.status(400).json({ message: err.message });
  }
  next(err);
};
router.use(uploadErrorHandler);

export default router;
