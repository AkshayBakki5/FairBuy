import express    from 'express';
import cors       from 'cors';
import dotenv     from 'dotenv';
import path       from 'path';
import { fileURLToPath } from 'url';

import connectDB          from './config/db.js';
import apiRoutes          from './routes/apiRoutes.js';
import authRoutes         from './routes/authRoutes.js';
import watchlistRoutes    from './routes/watchlistRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';

dotenv.config({ path: '../.env' });

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

connectDB();
// Note: startPriceMonitor() is intentionally removed.
// Prices are fetched live on each search. Watchlist is for manual tracking.

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use('/api',              apiRoutes);
app.use('/api/auth',         authRoutes);
app.use('/api/watchlist',    watchlistRoutes);
app.use('/api/notifications', notificationRoutes);

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// Serve built frontend
app.use(express.static(path.join(__dirname, '../client/dist')));
app.get('*', (_req, res) => res.sendFile(path.join(__dirname, '../client/dist/index.html')));

app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
