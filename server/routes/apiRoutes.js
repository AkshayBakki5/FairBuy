import express from "express";
import PriceHistory from "../models/PriceHistory.js";
import { protect } from "../middleware/authMiddleware.js";
import {
  searchAllStores,
  searchAllStoresStream,
  cleanQuery,
} from "../services/scraper.js";
import { ENABLED_PLATFORMS } from "../config/platforms.config.js";

const router = express.Router();

// ── POST /api/search ─────────────────────────────────────────────────────────
// Original blocking endpoint — waits for ALL stores before responding.
// Kept for backwards compatibility with the existing frontend.
router.post("/search", async (req, res) => {
  try {
    const { query } = req.body;

    if (!query || typeof query !== "string")
      return res
        .status(400)
        .json({ success: false, products: [], error: "query is required" });

    const cleaned = cleanQuery(query);
    if (!cleaned)
      return res
        .status(400)
        .json({
          success: false,
          products: [],
          error: "Query is empty after cleaning",
        });

    const products = await searchAllStores(cleaned);

    return res.json({
      success: true,
      products,
      meta: {
        query,
        cleaned,
        total: products.length,
        cheapestPrice: products[0]?.price ?? null,
        cheapestStore: products[0]?.store ?? null,
        enabledStores: Object.entries(ENABLED_PLATFORMS)
          .filter(([, v]) => v)
          .map(([k]) => k),
      },
    });
  } catch (error) {
    console.error("[Search]", error.message);
    return res
      .status(500)
      .json({ success: false, products: [], error: error.message });
  }
});

// ── GET /api/search/stream ────────────────────────────────────────────────────
// SSE endpoint — emits results per-store as each scrape finishes.
//
// SSE event types:
//   event: store  — fired immediately when one store finishes
//     data: { store, storeId, priority, cached, products: [...] }
//
//   event: done   — fired when all stores are complete
//     data: { total, products: [...grouped+sorted...] }
//
//   event: error  — fired on fatal failure
//     data: { message }
//
// Frontend usage:
//   const es = new EventSource(`/api/search/stream?q=${encodeURIComponent(query)}`);
//   es.addEventListener('store', e => { const d = JSON.parse(e.data); ... });
//   es.addEventListener('done',  e => { const d = JSON.parse(e.data); es.close(); });
//   es.addEventListener('error', e => { es.close(); });

router.get("/search/stream", async (req, res) => {
  const raw = req.query.q || "";
  const query = cleanQuery(raw);

  if (!query) {
    res.status(400).json({ error: "q parameter is required" });
    return;
  }

  // ── SSE headers ──
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // disable nginx buffering if behind proxy
  res.flushHeaders();

  // Helper: write one SSE event
  const send = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  // Keep-alive ping every 20s so the connection doesn't time out
  const ping = setInterval(() => res.write(": ping\n\n"), 20_000);

  // If client disconnects early, stop
  let aborted = false;
  req.on("close", () => {
    aborted = true;
    clearInterval(ping);
  });

  try {
    const grouped = await searchAllStoresStream(query, (storePayload) => {
      if (aborted) return;
      send("store", {
        store: storePayload.store,
        storeId: storePayload.storeId,
        priority: storePayload.priority,
        cached: storePayload.cached ?? false,
        products: storePayload.products,
      });
    });

    if (!aborted) {
      send("done", {
        total: grouped.length,
        cheapestPrice: grouped[0]?.price ?? null,
        cheapestStore: grouped[0]?.store ?? null,
        products: grouped,
      });
    }
  } catch (err) {
    console.error("[SSE Search]", err.message);
    if (!aborted) send("error", { message: err.message });
  } finally {
    clearInterval(ping);
    res.end();
  }
});

// ── GET /api/platforms ────────────────────────────────────────────────────────
router.get("/platforms", (_req, res) => {
  res.json({ platforms: ENABLED_PLATFORMS });
});

// ── GET /api/price-history/:productId ────────────────────────────────────────
// Returns price snapshots for a watchlist item (requires auth)
router.get("/price-history/:productId", protect, async (req, res) => {
  try {
    const productId = decodeURIComponent(req.params.productId);
    const ph = await PriceHistory.findOne({ user: req.user._id, productId });
    if (!ph) return res.json({ prices: [], store: null });
    res.json({ prices: ph.prices, store: ph.store });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
