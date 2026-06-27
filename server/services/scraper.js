// ─────────────────────────────────────────────────────────────────────────────
// scraper.js — FairBuy Scraping Engine v9
//
// Strategy per store type:
//   Quick-commerce (Blinkit, Zepto, Instamart):
//     → page.evaluate() — runs JS inside the live browser DOM after 8s hydration
//       These are heavy React SPAs; Cheerio on rendered HTML misses products.
//
//   Standard e-commerce (Amazon, Flipkart, BigBasket, Myntra, Ajio):
//     → fetchHtml() + Cheerio — wait for a known selector, then parse HTML
//
//   Fallback (any store returning 0):
//     → Firecrawl API
//
//   Retry: 1 automatic retry on 0 results with 2s back-off
// ─────────────────────────────────────────────────────────────────────────────

import * as cheerio from "cheerio";
import { chromium } from "playwright";
import Firecrawl from "@mendable/firecrawl-js";
import {
  ENABLED_PLATFORMS,
  CACHE_CONFIG,
  SEARCH_CONFIG,
} from "../config/platforms.config.js";

// ── In-memory cache ───────────────────────────────────────────────────────────
const cache = new Map();

function cacheGet(key) {
  const e = cache.get(key);
  if (!e) return null;
  if (Date.now() - e.ts > CACHE_CONFIG.TTL_MS) { cache.delete(key); return null; }
  console.log(`⚡ Cache hit: "${key}"`);
  return e.data;
}

function cacheSet(key, data) {
  if (cache.size >= CACHE_CONFIG.MAX_ITEMS) cache.delete(cache.keys().next().value);
  cache.set(key, { data, ts: Date.now() });
}

// ── Concurrency cap — max 4 parallel browser contexts ────────────────────────
class Semaphore {
  constructor(n) { this.n = n; this.c = 0; this.q = []; }
  acquire() {
    if (this.c < this.n) { this.c++; return Promise.resolve(); }
    return new Promise(r => this.q.push(r)).then(() => { this.c++; });
  }
  release() { this.c--; if (this.q.length) this.q.shift()(); }
}
const sem = new Semaphore(4);

// ── Singleton Playwright browser ──────────────────────────────────────────────
let _browser = null;

async function getBrowser() {
  if (_browser?.isConnected()) return _browser;
  console.log("🌐 Launching Playwright Chromium...");
  _browser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--disable-web-security",
      "--disable-features=IsolateOrigins,site-per-process",
      "--window-size=1366,768",
    ],
  });
  _browser.on("disconnected", () => { _browser = null; });
  return _browser;
}

process.on("exit",    () => _browser?.close());
process.on("SIGINT",  () => _browser?.close().then(() => process.exit()));
process.on("SIGTERM", () => _browser?.close().then(() => process.exit()));

// Rotating user agents
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
];
const randUA = () => USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

// ── Create a stealth page ─────────────────────────────────────────────────────
async function newPage() {
  const browser = await getBrowser();
  const context = await browser.newContext({
    userAgent: randUA(),
    viewport: { width: 1366, height: 768 },
    locale: "en-IN",
    extraHTTPHeaders: {
      "Accept-Language": "en-IN,en;q=0.9",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    },
  });
  const page = await context.newPage();
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
    window.chrome = { runtime: {} };
    Object.defineProperty(navigator, "languages", { get: () => ["en-IN", "en"] });
    Object.defineProperty(navigator, "plugins",   { get: () => [1, 2, 3] });
  });
  page.setDefaultTimeout(45000);
  page.setDefaultNavigationTimeout(45000);
  return { page, context };
}

// ── Query cleaner ─────────────────────────────────────────────────────────────
export function cleanQuery(raw) {
  if (!raw || typeof raw !== "string") return "";
  return raw.trim().replace(/[<>"';\\]/g, "").replace(/\s+/g, " ").trim().substring(0, 120);
}

// ── Price helper ──────────────────────────────────────────────────────────────
function firstPrice(raw) {
  if (!raw) return null;
  const m = String(raw).replace(/\s/g, "").match(/₹([\d,]+(?:\.\d{1,2})?)/);
  if (!m) return null;
  const val = parseFloat(m[1].replace(/,/g, ""));
  return val >= 1 && val < 500000 ? val : null;
}

function buildUrl(href, base) {
  if (!href) return "";
  const clean = href.split("?")[0];
  return clean.startsWith("http") ? clean : `${base}${clean}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// QUICK-COMMERCE SCRAPERS — page.evaluate() approach
// Runs JavaScript inside the live browser after the React SPA hydrates.
// This is the ONLY reliable way to get products from Blinkit/Zepto/Instamart
// because their prices and product cards are rendered client-side.
// ─────────────────────────────────────────────────────────────────────────────

async function scrapeBlinkit(query) {
  const url = `https://blinkit.com/s/?q=${encodeURIComponent(query)}`;
  console.log(`  🟡 Blinkit: ${url}`);

  const { page, context } = await newPage();
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });

    // Wait for React to hydrate and products to render
    await page.waitForTimeout(8000);

    const products = await page.evaluate(() => {
      const data = [];
      const selectors = [
        '[data-testid="product-card"]',
        'a[data-test-id="product-card"]',
        'div[class*="Product__Container"]',
        'div[class*="product-card"]',
        'a[href*="/p/"]',
        'div[role="button"]',
      ];

      let items = [];
      for (const sel of selectors) {
        items = document.querySelectorAll(sel);
        if (items.length > 0) break;
      }

      items.forEach(el => {
        try {
          // Name — try dedicated name element first, fallback to first text line
          const nameEl = el.querySelector(
            '[data-testid="product-name"], [data-test-id="product-name"], div[class*="Name"], h5'
          );
          const title = nameEl?.innerText?.trim() || el.innerText?.split("\n")[0]?.trim();
          if (!title || title.length < 2) return;

          // Price — regex on innerText catches ₹ followed by digits
          const priceMatch = el.innerText?.match(/₹\s*(\d[\d,]*)/);
          const price = priceMatch ? parseInt(priceMatch[1].replace(/,/g, "")) : null;
          if (!price) return;

          const image = el.querySelector("img")?.src || el.querySelector("img")?.dataset?.src || null;
          const href = el.tagName === "A" ? el.href : el.querySelector("a")?.href || "";

          data.push({ title: title.substring(0, 120), price, image: image || "", url: href });
        } catch { /* skip broken cards */ }
      });

      return data.slice(0, 30);
    });

    console.log(`  🟡 Blinkit: ${products.length} products`);
    return products.map(p => ({
      name: p.title, price: p.price, originalPrice: null,
      discount: null, rating: null, ratingCount: null,
      image: p.image, url: p.url || url,
    }));
  } catch (err) {
    console.warn(`  ⚠️ Blinkit error: ${err.message}`);
    return [];
  } finally {
    await context.close();
  }
}

async function scrapeZepto(query) {
  const url = `https://www.zeptonow.com/search?query=${encodeURIComponent(query)}`;
  console.log(`  🟣 Zepto: ${url}`);

  const { page, context } = await newPage();
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(8000);

    const products = await page.evaluate(() => {
      const data = [];
      const selectors = [
        '[data-testid="product-card"]',
        'div[class*="ProductCard"]',
        'a[href*="/pn/"]',
        'div[role="button"]',
      ];

      let items = [];
      for (const sel of selectors) {
        items = document.querySelectorAll(sel);
        if (items.length > 0) break;
      }

      items.forEach(el => {
        try {
          const nameEl = el.querySelector('h5, [data-testid="product-card-name"], [class*="name"]');
          const title = nameEl?.innerText?.trim() || el.innerText?.split("\n")[0]?.trim();
          if (!title || title.length < 2) return;

          const priceMatch = el.innerText?.match(/₹\s*(\d[\d,]*)/);
          const price = priceMatch ? parseInt(priceMatch[1].replace(/,/g, "")) : null;
          if (!price) return;

          const image = el.querySelector('[data-testid="product-card-image"]')?.src
            || el.querySelector("img")?.src
            || el.querySelector("img")?.dataset?.src || null;

          const href = el.tagName === "A" ? el.href : el.querySelector("a")?.href || "";

          data.push({ title: title.substring(0, 120), price, image: image || "", url: href });
        } catch { /* skip */ }
      });

      return data.slice(0, 30);
    });

    console.log(`  🟣 Zepto: ${products.length} products`);
    return products.map(p => ({
      name: p.title, price: p.price, originalPrice: null,
      discount: null, rating: null, ratingCount: null,
      image: p.image, url: p.url || url,
    }));
  } catch (err) {
    console.warn(`  ⚠️ Zepto error: ${err.message}`);
    return [];
  } finally {
    await context.close();
  }
}

async function scrapeInstamart(query) {
  const url = `https://www.swiggy.com/instamart/search?query=${encodeURIComponent(query)}`;
  console.log(`  🟠 Instamart: ${url}`);

  const { page, context } = await newPage();
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(8000);

    const products = await page.evaluate(() => {
      const data = [];
      const selectors = [
        '[data-testid="default_container_ux4"]',
        "._3OU0A",
        'div[class*="ItemRevamp"]',
        'div[data-testid="item-card"]',
        'div[role="button"]',
      ];

      let items = [];
      for (const sel of selectors) {
        items = document.querySelectorAll(sel);
        if (items.length > 0) break;
      }

      items.forEach(el => {
        try {
          const lines = el.innerText?.split("\n").map(l => l.trim()).filter(Boolean) || [];
          const title = lines[0];
          if (!title || title.length < 2) return;

          const priceMatch = el.innerText?.match(/₹\s*(\d[\d,]*)/);
          const price = priceMatch ? parseInt(priceMatch[1].replace(/,/g, "")) : null;
          if (!price) return;

          const image = el.querySelector("img")?.src || el.querySelector("img")?.dataset?.src || null;
          const href = el.querySelector("a")?.href || "";

          data.push({ title: title.substring(0, 120), price, image: image || "", url: href });
        } catch { /* skip */ }
      });

      return data.slice(0, 30);
    });

    console.log(`  🟠 Instamart: ${products.length} products`);
    return products.map(p => ({
      name: p.title, price: p.price, originalPrice: null,
      discount: null, rating: null, ratingCount: null,
      image: p.image, url: p.url || url,
    }));
  } catch (err) {
    console.warn(`  ⚠️ Instamart error: ${err.message}`);
    return [];
  } finally {
    await context.close();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// STANDARD SCRAPERS — fetchHtml + Cheerio
// Used for Amazon, Flipkart, BigBasket, Myntra, Ajio
// ─────────────────────────────────────────────────────────────────────────────

// Per-store wait selectors — wait for product list before grabbing HTML
const STORE_WAITS = {
  amazon:    p => p.waitForSelector('[data-component-type="s-search-result"], .s-result-item', { timeout: 12000 }).catch(() => {}),
  flipkart:  p => p.waitForSelector("div[data-id], ._1AtVbE, .tUxRFH", { timeout: 12000 }).catch(() => {}),
  bigbasket: p => p.waitForSelector('[qa="product-card"], .SKUDeck___StyledDiv', { timeout: 12000 }).catch(() => {}),
  myntra:    p => p.waitForSelector("li.product-base", { timeout: 12000 }).catch(() => {}),
  ajio:      p => p.waitForSelector('div.item, div[class*="product-container"]', { timeout: 12000 }).catch(() => {}),
};

async function fetchHtml(url, storeId) {
  const { page, context } = await newPage();
  // Block images/fonts — faster loads
  await page.route("**/*", route => {
    if (["image", "font", "media", "manifest"].includes(route.request().resourceType())) return route.abort();
    route.continue();
  });
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: SEARCH_CONFIG.TIMEOUT_MS });
    const waitFn = STORE_WAITS[storeId];
    if (waitFn) await waitFn(page);
    return await page.content();
  } finally {
    await context.close();
  }
}

// ── Cheerio extractors ────────────────────────────────────────────────────────

function extractAmazon(html) {
  const $ = cheerio.load(html);
  const products = [];
  $('[data-component-type="s-search-result"], .s-result-item[data-asin]').each((_, el) => {
    const name = $(el).find("h2 span").first().text().trim();
    if (!name || name.length < 3) return;
    const url = buildUrl($(el).find("h2 a").attr("href") || "", "https://www.amazon.in");
    let priceText = "";
    // .a-price:not(.a-text-price) → sale price only
    $(el).find(".a-price").not(".a-text-price").each((_, p) => {
      if (!priceText) priceText = $(p).find(".a-offscreen").first().text().trim();
    });
    if (!priceText) priceText = $(el).find(".a-price-whole").first().text().trim();
    const price = firstPrice(priceText);
    if (!price) return;
    const origText = $(el).find(".a-text-price .a-offscreen").first().text().trim();
    const ratingText = $(el).find(".a-icon-alt").first().text().trim();
    const ratingCount = $(el).find(".s-underline-text").first().text().replace(/[^0-9]/g, "") || null;
    const image = $(el).find("img.s-image").attr("src") || $(el).find("img").attr("src") || "";
    products.push({
      name, price, originalPrice: firstPrice(origText) || null,
      discount: null, rating: ratingText ? parseFloat(ratingText) : null,
      ratingCount: ratingCount ? parseInt(ratingCount) : null, image, url,
    });
  });
  return products;
}

function extractFlipkart(html) {
  const $ = cheerio.load(html);
  const products = [];
  const cards = $("div[data-id]").length > 0 ? $("div[data-id]") : $("div._1AtVbE, div.tUxRFH, div._13oc-S");
  cards.each((_, el) => {
    const name = $(el).find("._4rR01T, .s1Q9rs, .IRpwTa, .WKTcLC, .KzDlHZ, .wjcEIp").first().text().trim();
    if (!name || name.length < 3) return;
    const url = buildUrl($(el).find("a").first().attr("href") || "", "https://www.flipkart.com");
    const priceText = $(el).find("._30jeq3, .Nx9bqj, .hZ3P6w, .CEmiEU, .yRaY8j").first().text().trim();
    const price = firstPrice(priceText);
    if (!price) return;
    const origText = $(el).find(".kRYCnD, ._3I9_wc, .sxXaOq, .ZMdkAy").first().text().trim();
    const discount = $(el).find(".HQe8jr, ._3Ay6Sb, .VGWI37, .UkUFwK").first().text().trim() || null;
    const ratingText = $(el).find(".XQDdHH, ._3LWZlK, .MKiFS6").first().text().trim();
    const image = $(el).find("img._396cs4, img").first().attr("src") || "";
    products.push({
      name, price, originalPrice: firstPrice(origText) || null,
      discount, rating: ratingText ? parseFloat(ratingText) : null,
      ratingCount: null, image, url,
    });
  });
  return products;
}

function extractBigBasket(html) {
  const $ = cheerio.load(html);
  const products = [];
  $('li[qa="product-card"], div[qa="product-card"], div.SKUDeck___StyledDiv').each((_, el) => {
    const name = $(el).find('[qa="product-name"]').first().text().trim();
    if (!name || name.length < 3) return;
    const url = buildUrl($(el).find("a").first().attr("href") || "", "https://www.bigbasket.com");
    const price = firstPrice($(el).find('[qa="discounted-price"]').first().text());
    if (!price) return;
    const image = $(el).find("img").first().attr("src") || $(el).find("img").first().attr("data-src") || "";
    products.push({
      name, price, originalPrice: firstPrice($(el).find('[qa="mrp"]').first().text()) || null,
      discount: null, rating: null, ratingCount: null, image, url,
    });
  });
  return products;
}

function extractMyntra(html) {
  const $ = cheerio.load(html);
  const products = [];
  $("li.product-base").each((_, el) => {
    const brand = $(el).find(".product-brand").text().trim();
    const prod  = $(el).find(".product-product").text().trim();
    const name  = [brand, prod].filter(Boolean).join(" ").trim();
    if (!name || name.length < 3) return;
    const href = $(el).find("a").first().attr("href") || "";
    const url  = href.startsWith("http") ? href : `https://www.myntra.com/${href}`;
    const price = firstPrice($(el).find(".product-discountedPrice").first().text());
    if (!price) return;
    const image = $(el).find("img").first().attr("src") || "";
    products.push({
      name, price, originalPrice: firstPrice($(el).find(".product-strike").first().text()) || null,
      discount: $(el).find(".product-discountPercentage").first().text().trim() || null,
      rating: parseFloat($(el).find(".product-ratingsCount").first().text()) || null,
      ratingCount: null, image, url,
    });
  });
  return products;
}

function extractAjio(html) {
  const $ = cheerio.load(html);
  const products = [];
  $('div.item, div[class*="product-container"]').each((_, el) => {
    const name = $(el).find(".nameCnt, .brand-name, [class*='brand'], [class*='name']").first().text().trim();
    if (!name || name.length < 3) return;
    const href = $(el).find("a").first().attr("href") || "";
    const url  = href.startsWith("http") ? href : `https://www.ajio.com${href}`;
    const price = firstPrice($(el).find(".price strong, .sell-price").first().text());
    if (!price) return;
    const image = $(el).find("img").first().attr("src") || "";
    products.push({
      name, price, originalPrice: firstPrice($(el).find(".price .price-was").first().text()) || null,
      discount: $(el).find(".discount-percent").first().text().trim() || null,
      rating: null, ratingCount: null, image, url,
    });
  });
  return products;
}

// ─────────────────────────────────────────────────────────────────────────────
// RELEVANCE FILTER
// ─────────────────────────────────────────────────────────────────────────────
const MIN_RELEVANCE = 0.2;
const STOP = new Set([
  "buy","online","best","price","india","store","shop","delivery","fresh","organic","natural",
  "premium","special","classic","original","new","free","sale","offer","deal","combo","pack",
  "value","family","mini","g","ml","kg","l","gm","lt","ltr","pcs","pc","piece","pieces","set",
  "nos","rs","mrp","off","discount","extra","upto","get","and","or","the","of","with","for",
  "in","at","to","a","an","is","by","from","on","as",
]);

function tokenize(text) {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(w => w.length > 1 && !STOP.has(w));
}

function relevanceScore(name, qt) {
  if (!qt.length) return 1;
  const nameSet = new Set(tokenize(name));
  let matches = 0;
  for (const t of qt) {
    if (nameSet.has(t) || [...nameSet].some(n => n.includes(t) || t.includes(n))) matches++;
  }
  let score = matches / qt.length;
  if (name.toLowerCase().includes(qt.join(" "))) score = Math.min(1, score + 0.15);
  return score;
}

function filterByRelevance(products, query) {
  const qt = tokenize(query);
  if (!qt.length) return products;
  return products
    .map(p => ({ ...p, _r: relevanceScore(p.name, qt) }))
    .filter(p => p._r >= MIN_RELEVANCE)
    .map(({ _r, ...rest }) => rest);
}

// ─────────────────────────────────────────────────────────────────────────────
// PRICE-PER-UNIT NORMALISATION
// ─────────────────────────────────────────────────────────────────────────────
const UNIT_PATTERNS = [
  { re: /(\d+(?:\.\d+)?)\s*kg/i,                  toG:  v => v * 1000, unit: "kg" },
  { re: /(\d+(?:\.\d+)?)\s*g(?:m|ms|s)?(?!\w)/i,  toG:  v => v,        unit: "g"  },
  { re: /(\d+(?:\.\d+)?)\s*mg/i,                  toG:  v => v / 1000, unit: "mg" },
  { re: /(\d+(?:\.\d+)?)\s*ltr?s?/i,              toMl: v => v * 1000, unit: "l"  },
  { re: /(\d+(?:\.\d+)?)\s*l(?!b)(?!\w)/i,        toMl: v => v * 1000, unit: "l"  },
  { re: /(\d+(?:\.\d+)?)\s*ml/i,                  toMl: v => v,        unit: "ml" },
  { re: /(\d+)\s*(?:pcs?|pieces?|nos?|count|ct|tabs?|capsules?|sachets?)/i, isPc: true, unit: "pc" },
  { re: /pack\s*of\s*(\d+)/i,                      isPc: true, unit: "pc" },
];

function computeUnitPrice(price, name) {
  if (!price || price <= 0) return {};
  for (const p of UNIT_PATTERNS) {
    const m = name.match(p.re);
    if (!m) continue;
    const qty = parseFloat(m[1]);
    if (!qty || qty <= 0) continue;
    if (p.toG)  { const g  = p.toG(qty);  const v = (price/g)*100;  return { unitPrice: Math.round(v*100)/100, unitLabel: `₹${v.toFixed(2)} / 100g`,  quantity: qty, unit: p.unit }; }
    if (p.toMl) { const ml = p.toMl(qty); const v = (price/ml)*100; return { unitPrice: Math.round(v*100)/100, unitLabel: `₹${v.toFixed(2)} / 100ml`, quantity: qty, unit: p.unit }; }
    if (p.isPc) { const v = price/qty;    return { unitPrice: Math.round(v*100)/100, unitLabel: `₹${v.toFixed(2)} / piece`, quantity: qty, unit: p.unit }; }
  }
  return {};
}

function addUnitPrices(arr) {
  return arr.map(p => ({ ...p, unitPrice: null, unitLabel: null, quantity: null, unit: null, ...computeUnitPrice(p.price, p.name) }));
}

// ─────────────────────────────────────────────────────────────────────────────
// JACCARD GROUPING
// ─────────────────────────────────────────────────────────────────────────────
const JSTOP = new Set(["the","a","an","in","on","at","to","of","for","with","buy","online","best","price","india","g","ml","kg","l","pack","pcs","and","or","new","free","sale","off"]);
const W_RE  = /\b\d+(?:\.\d+)?\s*(?:kg|gm?s?|mg|ltr?s?|ml|l)\b/gi;
const C_RE  = /\b(?:pack|set|combo|box|bag|bundle|kit)\s*(?:of)?\s*\d+|\d+\s*(?:pcs?|pieces?|nos?|count|ct)\b/gi;
const JK_RE = /\b(?:amazon|flipkart|myntra|ajio|bigbasket|blinkit|zepto|swiggy|instamart|india|online|buy|shop)\b/gi;

function norm(s) {
  return s.toLowerCase().replace(W_RE," ").replace(C_RE," ").replace(JK_RE," ").replace(/[^a-z0-9\s]/g," ").replace(/\s+/g," ").trim();
}

function jaccard(a, b) {
  const words = s => new Set(norm(s).split(" ").filter(w => w.length > 1 && !JSTOP.has(w)));
  const A = words(a), B = words(b);
  if (!A.size || !B.size) return 0;
  let inter = 0; A.forEach(w => { if (B.has(w)) inter++; });
  return inter / new Set([...A, ...B]).size;
}

function assignGroups(products) {
  const assigned = new Array(products.length).fill(-1);
  let gid = 0;
  for (let i = 0; i < products.length; i++) {
    if (assigned[i] !== -1) continue;
    assigned[i] = gid;
    for (let j = i + 1; j < products.length; j++) {
      if (assigned[j] !== -1) continue;
      if (jaccard(products[i].name, products[j].name) >= 0.45) assigned[j] = gid;
    }
    gid++;
  }
  return products.map((p, i) => ({ ...p, groupId: assigned[i] }));
}

// ─────────────────────────────────────────────────────────────────────────────
// PLATFORM DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────
// Stores that use page.evaluate() (quick-commerce SPAs)
const EVALUATE_STORES = new Set(["blinkit", "zepto", "instamart"]);

const EVALUATE_SCRAPERS = {
  blinkit:   scrapeBlinkit,
  zepto:     scrapeZepto,
  instamart: scrapeInstamart,
};

// Stores that use fetchHtml + Cheerio
const HTML_EXTRACTORS = {
  amazon:    extractAmazon,
  flipkart:  extractFlipkart,
  bigbasket: extractBigBasket,
  myntra:    extractMyntra,
  ajio:      extractAjio,
};

const ALL_PLATFORMS = [
  { id: "amazon",    name: "Amazon",          priority: 1, searchUrl: q => `https://www.amazon.in/s?k=${encodeURIComponent(q)}` },
  { id: "flipkart",  name: "Flipkart",         priority: 2, searchUrl: q => `https://www.flipkart.com/search?q=${encodeURIComponent(q)}&marketplace=FLIPKART` },
  { id: "bigbasket", name: "BigBasket",        priority: 3, searchUrl: q => `https://www.bigbasket.com/ps/?q=${encodeURIComponent(q)}` },
  { id: "blinkit",   name: "Blinkit",          priority: 4, searchUrl: q => `https://blinkit.com/s/?q=${encodeURIComponent(q)}` },
  { id: "zepto",     name: "Zepto",            priority: 5, searchUrl: q => `https://www.zeptonow.com/search?query=${encodeURIComponent(q)}` },
  { id: "instamart", name: "Swiggy Instamart", priority: 6, searchUrl: q => `https://www.swiggy.com/instamart/search?query=${encodeURIComponent(q)}` },
  { id: "myntra",    name: "Myntra",           priority: 7, searchUrl: q => `https://www.myntra.com/${encodeURIComponent(q)}` },
  { id: "ajio",      name: "Ajio",             priority: 8, searchUrl: q => `https://www.ajio.com/search/?text=${encodeURIComponent(q)}` },
];

function getEnabledStores() {
  return ALL_PLATFORMS.filter(p => ENABLED_PLATFORMS[p.id] === true);
}

// ─────────────────────────────────────────────────────────────────────────────
// SCRAPE ONE STORE
// ─────────────────────────────────────────────────────────────────────────────
async function scrapeOneStore(store, query, attempt = 1) {
  console.log(`🕷️  ${store.name} (attempt ${attempt})`);
  await sem.acquire();
  try {
    let raw = [];

    if (EVALUATE_STORES.has(store.id)) {
      // ── Quick-commerce: page.evaluate() ─────────────────────────────────
      const scraper = EVALUATE_SCRAPERS[store.id];
      raw = await scraper(query);
    } else {
      // ── Standard: fetchHtml + Cheerio ────────────────────────────────────
      const url       = store.searchUrl(query);
      const extractor = HTML_EXTRACTORS[store.id];
      let html = "";
      try {
        html = await fetchHtml(url, store.id);
      } catch (e) {
        console.warn(`  ⚠️ ${store.name} Playwright error: ${e.message}`);
      }
      raw = html?.length >= 500 && extractor ? extractor(html) : [];
    }

    // ── Firecrawl fallback ────────────────────────────────────────────────
    if (raw.length === 0) {
      const apiKey = process.env.FIRECRAWL_API_KEY;
      if (apiKey) {
        try {
          console.log(`  🔄 ${store.name}: Firecrawl fallback`);
          const fc = new Firecrawl({ apiKey });
          const result = await fc.scrape(store.searchUrl(query), { formats: ["html"] });
          const fbHtml = result?.html || "";
          const extractor = HTML_EXTRACTORS[store.id];
          if (fbHtml.length >= 500 && extractor) raw = extractor(fbHtml);
        } catch (fcErr) {
          console.warn(`  ⚠️ ${store.name} Firecrawl failed: ${fcErr.message}`);
        }
      }
    }

    // ── Retry once on 0 results ───────────────────────────────────────────
    if (raw.length === 0 && attempt < 2) {
      sem.release();
      await new Promise(r => setTimeout(r, 2000));
      return scrapeOneStore(store, query, attempt + 1);
    }

    const products = filterByRelevance(raw, query);
    console.log(`✅ ${store.name}: ${products.length} relevant / ${raw.length} raw`);
    return { store: store.name, storeId: store.id, priority: store.priority, products, error: null };

  } catch (err) {
    console.warn(`⚠️  ${store.name} failed: ${err.message}`);
    return { store: store.name, storeId: store.id, priority: store.priority, products: [], error: err.message };
  } finally {
    sem.release();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FLATTEN + GROUP
// ─────────────────────────────────────────────────────────────────────────────
function flattenResults(results) {
  const all = [];
  for (const r of results) {
    if (!r?.products?.length) continue;
    const { store, storeId, priority, products } = r;
    products.forEach((p, i) =>
      all.push({
        id: `${storeId}-${i}-${Date.now()}`,
        name: p.name, price: p.price ?? null, originalPrice: p.originalPrice ?? null,
        discount: p.discount ?? null, rating: p.rating ?? null, ratingCount: p.ratingCount ?? null,
        image: p.image || "", url: p.url || "",
        store, storeId, priority, groupId: null,
        unitPrice: null, unitLabel: null, quantity: null, unit: null,
      })
    );
  }
  return addUnitPrices(all);
}

function groupAndSort(all) {
  const grouped = assignGroups(all);
  grouped.sort((a, b) => a.groupId !== b.groupId ? a.groupId - b.groupId : a.priority - b.priority);
  return grouped;
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

/** Blocking search — waits for all stores */
export async function searchAllStores(rawQuery) {
  const query = cleanQuery(rawQuery);
  if (!query) throw new Error("Empty query");
  const cached = cacheGet(query);
  if (cached) return cached;
  const stores = getEnabledStores();
  if (!stores.length) throw new Error("No platforms enabled");
  console.log(`\n🔍 Searching: "${query}" across ${stores.map(s=>s.name).join(", ")}`);
  const results = await Promise.all(stores.map(s => scrapeOneStore(s, query)));
  const grouped = groupAndSort(flattenResults(results));
  cacheSet(query, grouped);
  return grouped;
}

/** SSE streaming — fires onStoreResult as each store finishes */
export async function searchAllStoresStream(rawQuery, onStoreResult) {
  const query = cleanQuery(rawQuery);
  if (!query) throw new Error("Empty query");

  const cached = cacheGet(query);
  if (cached) {
    const byStore = {};
    for (const p of cached) {
      if (!byStore[p.storeId])
        byStore[p.storeId] = { store: p.store, storeId: p.storeId, priority: p.priority, products: [] };
      byStore[p.storeId].products.push(p);
    }
    for (const payload of Object.values(byStore)) onStoreResult({ ...payload, cached: true });
    return cached;
  }

  const stores = getEnabledStores();
  if (!stores.length) throw new Error("No platforms enabled");
  console.log(`\n🔍 SSE: "${query}"`);

  const results = await Promise.all(
    stores.map(s =>
      scrapeOneStore(s, query).then(result => {
        onStoreResult({ ...result, cached: false });
        return result;
      })
    )
  );

  const grouped = groupAndSort(flattenResults(results));
  cacheSet(query, grouped);
  return grouped;
}
