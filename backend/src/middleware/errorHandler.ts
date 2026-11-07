import { ErrorRequestHandler, RequestHandler } from "express";
import { logger } from "../config/logger";
import { Sentry } from "../config/sentry";
import { HttpError } from "../utils/httpError";

// Postgres errors that are the client's fault, mapped to a clean 4xx instead
// of a generic 500 (e.g. a duplicate category name, or a foreign key pointing
// at a shop/category/user that doesn't exist).
const PG_ERRORS: Record<string, [number, string]> = {
  "23505": [409, "A record with these details already exists"],
  "23503": [400, "A referenced record does not exist"],
  "22P02": [400, "Invalid input"],
};

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ message: "Not found" });
};

// Express 5 forwards rejected promises from async handlers here, so routes
// don't need their own try/catch just to avoid crashing the process.
export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);

  if (err instanceof HttpError) {
    return res.status(err.status).json({ message: err.message, ...err.body });
  }

  // body-parser / multer style errors (malformed JSON, payload too large, ...)
  const status = err?.status ?? err?.statusCode;
  if (typeof status === "number" && status >= 400 && status < 500) {
    return res
      .status(status)
      .json({ message: err.expose ? err.message : "Invalid request" });
  }

  const pg = typeof err?.code === "string" ? PG_ERRORS[err.code] : undefined;
  if (pg) return res.status(pg[0]).json({ message: pg[1] });

  // req.log (from pino-http) tags the entry with the request id.
  (req.log ?? logger).error({ err }, "Unhandled error");
  Sentry.captureException(err, {
    tags: { requestId: String(req.id ?? "") },
    extra: { method: req.method, path: req.path },
  });
  res.status(500).json({
    message: "Something went wrong",
    requestId: req.id, // quote this when reporting the problem
  });
};
