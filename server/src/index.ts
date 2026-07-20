import "dotenv/config";
import { createServer } from "node:http";
import { createApp } from "./app.js";
import { initializePostgres } from "./data/postgres.js";
import { startMealCardHomeCleanup } from "./modules/mealCardCleanup.js";
import { realtimeHub } from "./realtime.js";

const port = Number.parseInt(process.env.PORT ?? "3000", 10);
const host = process.env.HOST ?? "127.0.0.1";

if (!Number.isInteger(port) || port <= 0) {
  throw new Error(`Invalid PORT value: ${process.env.PORT}`);
}

const app = createApp();
const server = createServer(app);

realtimeHub.attach(server);

await initializePostgres();
startMealCardHomeCleanup();

server.listen(port, host, () => {
  console.log(`ueat server listening on http://${host}:${port}`);
});
