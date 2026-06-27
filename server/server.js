import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

import connectDB from "./config/db.js";
import apiRoutes from "./routes/apiRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import watchlistRoutes from "./routes/watchlistRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";

dotenv.config({ path: "../.env" });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Connect DB ────────────────────────────────────────────────────────────────
connectDB();

const app = express();
const PORT = process.env.PORT || 3000;

// ── Security & middleware ─────────────────────────────────────────────────────
// Dynamically load optional security packages (install when available)
try {
  const { default: helmet } = await import("helmet");
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
} catch { /* helmet not installed — skip */ }

try {
  const { default: mongoSanitize } = await import("express-mongo-sanitize");
  app.use(mongoSanitize());
} catch { /* skip */ }

try {
  const rateLimit = await import("express-rate-limit");
  const limiter = rateLimit.default({
    windowMs: 15 * 60 * 1000, // 15 min
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: "Too many requests, please try again later." },
  });
  const searchLimiter = rateLimit.default({
    windowMs: 60 * 1000, // 1 min
    max: 20,
    message: { success: false, error: "Too many search requests. Please slow down." },
  });
  app.use("/api", limiter);
  app.use("/api/search", searchLimiter);
} catch { /* skip */ }

// ── CORS ──────────────────────────────────────────────────────────────────────
const allowedOrigins = [
  process.env.CLIENT_URL || "http://localhost:5173",
  "http://localhost:8080",
  "http://localhost:3000",
  "http://localhost:5173",
];
app.use(cors({
  origin: (origin, cb) => {
    // Allow same-origin requests (no origin header) and listed origins
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error("Not allowed by CORS"));
  },
  credentials: true,
  exposedHeaders: ["Content-Type", "Cache-Control", "Connection"],
}));

app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: false, limit: "10kb" }));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/api", apiRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/watchlist", watchlistRoutes);
app.use("/api/notifications", notificationRoutes);
app.get("/api/health", (_req, res) => res.json({ status: "ok", ts: new Date().toISOString() }));

// ── Serve built frontend ──────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, "../client/dist")));
app.get("*", (_req, res) =>
  res.sendFile(path.join(__dirname, "../client/dist/index.html")),
);

// ── Centralized error handler ─────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  const status = err.status || err.statusCode || 500;
  console.error(`[Error] ${status} — ${err.message}`);
  res.status(status).json({ success: false, error: err.message || "Internal Server Error" });
});

app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
