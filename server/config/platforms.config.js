// ─────────────────────────────────────────────────────────────────────────────
// platforms.config.js
//
// Toggle any platform on/off here.
// Only enabled platforms will be scraped.
//
// Usage:
//   set to true  → platform is scraped
//   set to false → platform is completely skipped (no API call, no cost)
// ─────────────────────────────────────────────────────────────────────────────

export const ENABLED_PLATFORMS = {
  amazon:    true,   // ✅ Priority 1
  flipkart:  true,   // ✅ Priority 2
  blinkit:   true,   // ✅ Priority 3 — 10-min delivery
  zepto:     true,   // ✅ Priority 4 — 10-min delivery
  instamart: true,   // ✅ Priority 5 — Swiggy Instamart
  bigbasket: true,   // ✅ Priority 6 — Scheduled grocery
  myntra:    true,   // ✅ Priority 7 — Fashion
  ajio:      true,   // ✅ Priority 8 — Fashion
};

// ─────────────────────────────────────────────────────────────────────────────
// Cache settings — adjust as needed
// ─────────────────────────────────────────────────────────────────────────────
export const CACHE_CONFIG = {
  TTL_MS:    10 * 60 * 1000,  // 10 minutes (change to 30 * 60 * 1000 for 30 min)
  MAX_ITEMS: 100,              // evict oldest when cache grows beyond this
};

// ─────────────────────────────────────────────────────────────────────────────
// Search settings
// ─────────────────────────────────────────────────────────────────────────────
export const SEARCH_CONFIG = {
  RESULTS_PER_STORE: 5,        // Firecrawl limit per store query
  TIMEOUT_MS:        15000,    // per-store timeout (15 sec)
};
