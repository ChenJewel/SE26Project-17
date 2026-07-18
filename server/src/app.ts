import cors from "cors";
import express, { type ErrorRequestHandler } from "express";
import { join } from "node:path";
import { sendFailure, sendSuccess } from "./common/http.js";
import { postgresStore } from "./data/postgres.js";
import { authRouter } from "./modules/auth.js";
import { chatRouter } from "./modules/chat.js";
import { commentsRouter } from "./modules/comments.js";
import { mealCardsRouter } from "./modules/mealCards.js";
import { notificationsRouter } from "./modules/notifications.js";
import { postsRouter } from "./modules/posts.js";
import { reportsRouter } from "./modules/reports.js";
import { searchRouter } from "./modules/search.js";
import { uploadsRouter } from "./modules/uploads.js";
import { usersRouter } from "./modules/users.js";

const defaultCorsOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "capacitor://localhost",
  "http://localhost",
  "https://localhost",
];

function parseCorsOrigins() {
  return (process.env.CORS_ORIGIN ?? defaultCorsOrigins.join(","))
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function createApp() {
  const app = express();
  const allowedOrigins = parseCorsOrigins();

  app.use(
    cors({
      credentials: true,
      origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }

        callback(new Error(`CORS origin not allowed: ${origin}`));
      },
    })
  );
  app.use(express.json({ limit: "180mb" }));
  app.use("/uploads", uploadsRouter);
  app.use("/uploads", express.static(process.env.UPLOAD_DIR ?? join(process.cwd(), "data", "uploads")));

  app.get("/health", (_req, res) => {
    sendSuccess(res, {
      status: "ok",
      service: "ueat-server",
      database: postgresStore.getDatabaseInfo(),
      timestamp: new Date().toISOString(),
    });
  });

  app.use("/auth", authRouter);
  app.use("/users", usersRouter);
  app.use("/meal-cards", mealCardsRouter);
  app.use("/posts", postsRouter);
  app.use("/comments", commentsRouter);
  app.use("/chat", chatRouter);
  app.use("/search", searchRouter);
  app.use("/", notificationsRouter);
  app.use("/", reportsRouter);

  app.use((_req, res) => {
    sendFailure(res, 404, "NOT_FOUND", "Route not found.");
  });

  const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    sendFailure(res, 500, "INTERNAL_SERVER_ERROR", message);
  };

  app.use(errorHandler);

  return app;
}
