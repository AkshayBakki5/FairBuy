import express from 'express';
import cors    from 'cors';
import dotenv  from 'dotenv';
import path    from 'path';
import { fileURLToPath } from 'url';

import connectDB           from './config/db.js';
import apiRoutes           from './routes/apiRoutes.js';
import authRoutes          from './routes/authRoutes.js';
import watchlistRoutes     from './routes/watchlistRoutes.js';
import notificationRoutes  from './routes/notificationRoutes.js';
import { startPriceMonitor } from './services/priceMonitor.js';

dotenv.config({ path: '../.env' });

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ── Database ──────────────────────────────────────────────────────────────────
connectDB();

const app  = express();
const PORT = process.env.PORT || 4000;

// ── Security middleware (optional packages — degrade gracefully if missing) ───
try {
  const { default: helmet } = await import('helmet');
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
} catch { /* helmet not installed */ }

try {
  const { default: mongoSanitize } = await import('express-mongo-sanitize');
  app.use(mongoSanitize());
} catch { /* skip */ }

try {
  const { default: rateLimit } = await import('express-rate-limit');
  app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, max: 200, standardHeaders: true, legacyHeaders: false, message: { success: false, error: 'Too many requests.' } }));
  app.use('/api/search', rateLimit({ windowMs: 60 * 1000, max: 20, message: { success: false, error: 'Too many search requests.' } }));
} catch { /* skip */ }

// ── CORS ──────────────────────────────────────────────────────────────────────
const allowedOrigins = [
  process.env.CLIENT_URL,
  'http://localhost:8080',
  'http://localhost:3000',
  'http://localhost:5173',
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => (!origin || allowedOrigins.includes(origin) ? cb(null, true) : cb(new Error('Not allowed by CORS'))),
  credentials: true,
  exposedHeaders: ['Content-Type', 'Cache-Control', 'Connection'],
}));

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api',              apiRoutes);
app.use('/api/auth',         authRoutes);
app.use('/api/watchlist',    watchlistRoutes);
app.use('/api/notifications', notificationRoutes);
app.get('/api/health', (_req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

// ── Serve built frontend ──────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '../client/dist')));
app.get('*', (_req, res) => res.sendFile(path.join(__dirname, '../client/dist/index.html')));

// ── Centralised error handler ─────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  const status = err.status || err.statusCode || 500;
  console.error(`[Error] ${status} — ${err.message}`);
  res.status(status).json({ success: false, error: err.message || 'Internal Server Error' });
});

app.listen(PORT, () => {
  console.log(`✅ FairBuy server running on port ${PORT}`);
  // Start price monitoring cron jobs
  startPriceMonitor();
});
