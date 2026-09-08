import app from "./app";
import { logger } from "./lib/logger";
import { initCronJobs } from "./lib/cronJobs";
import { initTelegramBot } from "./lib/telegramBot";
import { runTokenMigrations } from "./lib/tokenMigration";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Run DB migrations before starting
runTokenMigrations().catch(err => {
  logger.error({ err }, "Token migration failed — continuing anyway");
});

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  initCronJobs();
  initTelegramBot();
});
