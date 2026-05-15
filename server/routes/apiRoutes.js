import express from 'express';
import { searchAllStores, cleanQuery } from '../services/scraper.js';
import { ENABLED_PLATFORMS }          from '../config/platforms.config.js';

const router = express.Router();

// ── POST /api/search ──────────────────────────────────────────────────────────
router.post('/search', async (req, res) => {
  try {
    const { query } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ success: false, products: [], error: 'query is required' });
    }

    const cleaned = cleanQuery(query);
    if (!cleaned) {
      return res.status(400).json({ success: false, products: [], error: 'Query is empty after cleaning' });
    }

    const products = await searchAllStores(cleaned);

    return res.json({
      success:  true,
      products,
      meta: {
        query,
        cleaned,
        total:         products.length,
        cheapestPrice: products[0]?.price   ?? null,
        cheapestStore: products[0]?.store   ?? null,
        enabledStores: Object.entries(ENABLED_PLATFORMS).filter(([, v]) => v).map(([k]) => k),
      },
    });

  } catch (error) {
    console.error('[Search]', error.message);
    const status = error.message.includes('credits') ? 402 : 500;
    return res.status(status).json({ success: false, products: [], error: error.message });
  }
});

// ── GET /api/platforms ────────────────────────────────────────────────────────
router.get('/platforms', (_req, res) => {
  res.json({ platforms: ENABLED_PLATFORMS });
});

export default router;
