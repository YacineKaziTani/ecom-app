import dotenv from "dotenv";
dotenv.config();

import { app } from "./app";
import { AppDataSource } from "./config/data-source";
import { verifyMailer } from "./config/mailer";

const PORT = process.env.PORT || 4000;

AppDataSource.initialize()
  .then(async () => {
    console.log("Database connected");
    await verifyMailer();
    app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error("Failed to connect to database", err);
    process.exit(1);
  });
