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
  amazon:    true,   // ✅ Priority 1 — Amazon Fresh (most reliable)
  flipkart:  true,   // ✅ Priority 2 — Flipkart Grocery
  bigbasket: true,   // ✅ Priority 3 — BigBasket
  blinkit:   true,   // ✅ Priority 4 — Blinkit (needs Delhi location)
  zepto:     true,   // ✅ Priority 5 — Zepto (needs location)
  instamart: true,   // ✅ Priority 6 — Swiggy Instamart (needs location)
  myntra:    false,  // ⛔ Fashion — disabled for grocery comparison
  ajio:      false,  // ⛔ Fashion — disabled for grocery comparison
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
  TIMEOUT_MS: 30_000,  // Playwright navigation timeout (30s)
};
