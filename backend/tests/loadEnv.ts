import dotenv from "dotenv";
import path from "path";

// Loaded via Jest's `setupFiles`, before any test file or app code runs.
// Keeps test config (a separate, disposable database) fully isolated from
// whatever's in the developer's regular .env.
dotenv.config({ path: path.resolve(__dirname, "../.env.test") });
