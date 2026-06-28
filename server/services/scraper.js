/**
 * scraper.js — FairBuy Scraping Engine v10
 *
 * Strategy:
 *   Amazon / Flipkart / BigBasket  → Playwright fetchHtml() + Cheerio  AND  Firecrawl (parallel)
 *   Blinkit / Zepto / Instamart    → Playwright page.evaluate() with geolocation + localStorage injection
 *   Best result wins               → whichever channel returns more products is used
 */

import * as cheerio from 'cheerio';
import { chromium } from 'playwright';
import Firecrawl    from '@mendable/firecrawl-js';
import { ENABLED_PLATFORMS, CACHE_CONFIG, SEARCH_CONFIG } from '../config/platforms.config.js';

// ─── Cache ────────────────────────────────────────────────────────────────────
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

// ─── Concurrency limiter ──────────────────────────────────────────────────────
class Semaphore {
  constructor(n) { this.n = n; this.c = 0; this.q = []; }
  acquire() {
    if (this.c < this.n) { this.c++; return Promise.resolve(); }
    return new Promise(r => this.q.push(r)).then(() => { this.c++; });
  }
  release() { this.c--; if (this.q.length) this.q.shift()(); }
}
const sem = new Semaphore(4);

// ─── Singleton browser ────────────────────────────────────────────────────────
let _browser = null;

async function getBrowser() {
  if (_browser?.isConnected()) return _browser;
  console.log('🌐 Launching Playwright Chromium...');
  _browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox', '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage', '--disable-gpu',
      '--disable-web-security', '--window-size=1366,768',
    ],
  });
  _browser.on('disconnected', () => { _browser = null; });
  return _browser;
}

process.on('exit',    () => _browser?.close());
process.on('SIGINT',  () => _browser?.close().then(() => process.exit(0)));
process.on('SIGTERM', () => _browser?.close().then(() => process.exit(0)));

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
];
const randUA = () => USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

// Delhi — default location for quick-commerce apps that need geolocation
const DELHI = { latitude: 28.6139, longitude: 77.2090 };

async function newPage(opts = {}) {
  const browser = await getBrowser();
  const context = await browser.newContext({
    userAgent: randUA(),
    viewport: { width: 1366, height: 768 },
    locale: 'en-IN',
    timezoneId: 'Asia/Kolkata',
    geolocation: opts.geo ? DELHI : undefined,
    permissions: opts.geo ? ['geolocation'] : [],
    extraHTTPHeaders: {
      'Accept-Language': 'en-IN,en;q=0.9,hi;q=0.8',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'DNT': '1',
    },
  });

  const page = await context.newPage();
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    Object.defineProperty(navigator, 'languages', { get: () => ['en-IN', 'en'] });
    Object.defineProperty(navigator, 'plugins',   { get: () => [1, 2, 3, 4, 5] });
    window.chrome = { runtime: {} };
  });

  page.setDefaultTimeout(45_000);
  page.setDefaultNavigationTimeout(45_000);
  return { page, context };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
export function cleanQuery(raw) {
  if (!raw || typeof raw !== 'string') return '';
  return raw.trim().replace(/[<>"';\\]/g, '').replace(/\s+/g, ' ').substring(0, 120);
}

function parsePrice(raw) {
  if (!raw) return null;
  const m = String(raw).replace(/\s/g, '').match(/₹?([\d,]+(?:\.\d{1,2})?)/);
  if (!m) return null;
  const val = parseFloat(m[1].replace(/,/g, ''));
  return val >= 1 && val < 500_000 ? val : null;
}

function buildUrl(href, base) {
  if (!href) return '';
  const clean = href.split('?')[0];
  return clean.startsWith('http') ? clean : `${base}${clean}`;
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ─────────────────────────────────────────────────────────────────────────────
// QUICK-COMMERCE: page.evaluate() scrapers
// These inject Delhi geolocation + localStorage location hints before navigation.
// Without location context, these apps show "Set your location" screens with 0 products.
// ─────────────────────────────────────────────────────────────────────────────

async function scrapeBlinkit(query) {
  const url = `https://blinkit.com/s/?q=${encodeURIComponent(query)}`;
  console.log(`  🟡 Blinkit → ${url}`);
  const { page, context } = await newPage({ geo: true });
  try {
    await page.addInitScript((loc) => {
      try {
        localStorage.setItem('userLat', String(loc.lat));
        localStorage.setItem('userLng', String(loc.lng));
        localStorage.setItem('btl_loc', JSON.stringify({ lat: loc.lat, lng: loc.lng, city: 'Delhi' }));
        localStorage.setItem('user_locality', 'New Delhi');
      } catch (_) {}
    }, { lat: DELHI.latitude, lng: DELHI.longitude });

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await sleep(9000);

    // Dismiss location/login modals if present
    try {
      const closeBtn = await page.$('[data-testid="modal-close"], button[aria-label="Close"]');
      if (closeBtn) await closeBtn.click();
    } catch (_) {}

    const products = await page.evaluate(() => {
      const data = [];
      const selectors = [
        '[data-testid="plp-product-card"]',
        '[data-test-id="plp-product-card"]',
        'a[data-testid="product-card"]',
        'div[class*="Product__Container"]',
        'div[class*="product-card"]',
        'a[href*="/p/"]',
      ];
      let items = [];
      for (const sel of selectors) {
        items = document.querySelectorAll(sel);
        if (items.length > 0) break;
      }
      items.forEach(el => {
        try {
          const nameEl = el.querySelector('[data-testid="product-name"], [data-test-id="product-name"], [class*="ProductName"], h4, h5');
          const title  = nameEl?.innerText?.trim() || el.innerText?.split('\n')[0]?.trim() || '';
          if (!title || title.length < 2) return;
          const priceMatch = el.innerText?.match(/₹\s*(\d[\d,]*)/);
          const price = priceMatch ? parseInt(priceMatch[1].replace(/,/g, ''), 10) : null;
          if (!price) return;
          const img  = el.querySelector('img')?.src || el.querySelector('img')?.dataset?.src || '';
          const href = el.tagName === 'A' ? el.href : el.querySelector('a')?.href || '';
          data.push({ title: title.substring(0, 120), price, image: img, url: href });
        } catch (_) {}
      });
      return data.slice(0, 30);
    });

    console.log(`  🟡 Blinkit: ${products.length} products`);
    return products.map(p => ({ name: p.title, price: p.price, originalPrice: null, discount: null, rating: null, ratingCount: null, image: p.image, url: p.url }));
  } catch (err) {
    console.warn(`  ⚠️ Blinkit: ${err.message}`);
    return [];
  } finally {
    await context.close();
  }
}

async function scrapeZepto(query) {
  const url = `https://www.zeptonow.com/search?query=${encodeURIComponent(query)}`;
  console.log(`  🟣 Zepto → ${url}`);
  const { page, context } = await newPage({ geo: true });
  try {
    await page.addInitScript((loc) => {
      try {
        localStorage.setItem('lat', String(loc.lat));
        localStorage.setItem('lng', String(loc.lng));
        localStorage.setItem('zepto_city', 'Delhi');
        localStorage.setItem('city', 'Delhi');
      } catch (_) {}
    }, { lat: DELHI.latitude, lng: DELHI.longitude });

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await sleep(9000);

    try {
      const closeBtn = await page.$('button[aria-label*="close"], button[aria-label*="Close"]');
      if (closeBtn) await closeBtn.click();
    } catch (_) {}

    const products = await page.evaluate(() => {
      const data = [];
      const selectors = [
        '[data-testid="product-card"]',
        'div[class*="ProductCard"]',
        'div[class*="product-card"]',
        'a[href*="/pn/"]',
      ];
      let items = [];
      for (const sel of selectors) {
        items = document.querySelectorAll(sel);
        if (items.length > 0) break;
      }
      items.forEach(el => {
        try {
          const nameEl  = el.querySelector('[data-testid="product-card-name"], h5, [class*="ProductName"]');
          const title   = nameEl?.innerText?.trim() || el.innerText?.split('\n')[0]?.trim() || '';
          if (!title || title.length < 2) return;
          const priceMatch = el.innerText?.match(/₹\s*(\d[\d,]*)/);
          const price = priceMatch ? parseInt(priceMatch[1].replace(/,/g, ''), 10) : null;
          if (!price) return;
          const img  = el.querySelector('[data-testid="product-card-image"]')?.src || el.querySelector('img')?.src || '';
          const href = el.tagName === 'A' ? el.href : el.querySelector('a')?.href || '';
          data.push({ title: title.substring(0, 120), price, image: img, url: href });
        } catch (_) {}
      });
      return data.slice(0, 30);
    });

    console.log(`  🟣 Zepto: ${products.length} products`);
    return products.map(p => ({ name: p.title, price: p.price, originalPrice: null, discount: null, rating: null, ratingCount: null, image: p.image, url: p.url }));
  } catch (err) {
    console.warn(`  ⚠️ Zepto: ${err.message}`);
    return [];
  } finally {
    await context.close();
  }
}

async function scrapeInstamart(query) {
  const url = `https://www.swiggy.com/instamart/search?query=${encodeURIComponent(query)}`;
  console.log(`  🟠 Instamart → ${url}`);
  const { page, context } = await newPage({ geo: true });
  try {
    await page.addInitScript((loc) => {
      try {
        localStorage.setItem('swiggy.userLat', String(loc.lat));
        localStorage.setItem('swiggy.userLng', String(loc.lng));
        localStorage.setItem('swiggy.userCity', 'Delhi');
      } catch (_) {}
    }, { lat: DELHI.latitude, lng: DELHI.longitude });

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await sleep(9000);

    const products = await page.evaluate(() => {
      const data = [];
      const selectors = [
        '[data-testid="default_container_ux4"]',
        '[data-testid="item-card"]',
        'div[class*="ItemRevamp"]',
        '._3OU0A',
        'div[role="button"]',
      ];
      let items = [];
      for (const sel of selectors) {
        items = document.querySelectorAll(sel);
        if (items.length > 0) break;
      }
      items.forEach(el => {
        try {
          const lines = (el.innerText || '').split('\n').map(l => l.trim()).filter(Boolean);
          const title = lines[0] || '';
          if (!title || title.length < 2) return;
          const priceMatch = el.innerText?.match(/₹\s*(\d[\d,]*)/);
          const price = priceMatch ? parseInt(priceMatch[1].replace(/,/g, ''), 10) : null;
          if (!price) return;
          const img  = el.querySelector('img')?.src || '';
          const href = el.querySelector('a')?.href || '';
          data.push({ title: title.substring(0, 120), price, image: img, url: href });
        } catch (_) {}
      });
      return data.slice(0, 30);
    });

    console.log(`  🟠 Instamart: ${products.length} products`);
    return products.map(p => ({ name: p.title, price: p.price, originalPrice: null, discount: null, rating: null, ratingCount: null, image: p.image, url: p.url }));
  } catch (err) {
    console.warn(`  ⚠️ Instamart: ${err.message}`);
    return [];
  } finally {
    await context.close();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// STANDARD STORES: fetchHtml + Cheerio
// ─────────────────────────────────────────────────────────────────────────────

async function fetchHtml(url, storeId) {
  const { page, context } = await newPage();
  await page.route('**/*', route => {
    if (['image', 'font', 'media', 'manifest'].includes(route.request().resourceType())) return route.abort();
    route.continue();
  });
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: SEARCH_CONFIG.TIMEOUT_MS });
    const waits = {
      amazon:    '[data-component-type="s-search-result"], .s-result-item[data-asin]',
      flipkart:  'div[data-id], ._1AtVbE, .tUxRFH, .DOjaWF',
      bigbasket: '[qa="product-card"], li[class*="PaginateItems"]',
    };
    if (waits[storeId]) {
      await page.waitForSelector(waits[storeId], { timeout: 12_000 }).catch(() => {});
    }
    return await page.content();
  } finally {
    await context.close();
  }
}

function extractAmazon(html) {
  const $ = cheerio.load(html);
  const products = [];
  $('[data-component-type="s-search-result"][data-asin]').each((_, el) => {
    const name = $(el).find('h2 span').first().text().trim();
    if (!name || name.length < 3) return;
    const url = buildUrl($(el).find('h2 a').attr('href') || '', 'https://www.amazon.in');
    let priceText = '';
    $(el).find('.a-price').not('.a-text-price').each((_, p) => {
      if (!priceText) priceText = $(p).find('.a-offscreen').first().text().trim();
    });
    if (!priceText) priceText = $(el).find('.a-price-whole').first().text().trim();
    const price = parsePrice(priceText);
    if (!price) return;
    const origText  = $(el).find('.a-text-price .a-offscreen').first().text().trim();
    const ratingTxt = $(el).find('.a-icon-alt').first().text().trim();
    const countTxt  = $(el).find('.s-underline-text').first().text().replace(/[^0-9]/g, '');
    const image     = $(el).find('img.s-image').attr('src') || '';
    products.push({ name, price, originalPrice: parsePrice(origText) || null, discount: null, rating: ratingTxt ? parseFloat(ratingTxt) : null, ratingCount: countTxt ? parseInt(countTxt) : null, image, url });
  });
  console.log(`  🟤 Amazon: ${products.length} products`);
  return products;
}

function extractFlipkart(html) {
  const $ = cheerio.load(html);
  const products = [];
  const containers = $('div[data-id]').length > 0 ? $('div[data-id]') : $('div._1AtVbE, div.tUxRFH, div.DOjaWF');
  containers.each((_, el) => {
    const name = $(el).find('._4rR01T, .s1Q9rs, .WKTcLC, .KzDlHZ, .wjcEIp').first().text().trim()
              || $(el).find('a[title]').attr('title') || '';
    if (!name || name.length < 3) return;
    const url       = buildUrl($(el).find('a').first().attr('href') || '', 'https://www.flipkart.com');
    const priceText = $(el).find('._30jeq3, .Nx9bqj, .hZ3P6w, .CEmiEU, .yRaY8j').first().text().trim();
    const price     = parsePrice(priceText);
    if (!price) return;
    const origText  = $(el).find('._3I9_wc, .kRYCnD, .sxXaOq, .ZMdkAy').first().text().trim();
    const discount  = $(el).find('._3Ay6Sb, .VGWI37, .UkUFwK, .HQe8jr').first().text().trim() || null;
    const ratingTxt = $(el).find('._3LWZlK, .XQDdHH, .MKiFS6').first().text().trim();
    const image     = $(el).find('img').first().attr('src') || '';
    products.push({ name, price, originalPrice: parsePrice(origText) || null, discount, rating: ratingTxt ? parseFloat(ratingTxt) : null, ratingCount: null, image, url });
  });
  console.log(`  🔵 Flipkart: ${products.length} products`);
  return products;
}

function extractBigBasket(html) {
  const $ = cheerio.load(html);
  const products = [];
  $('li[qa="product-card"], div[qa="product-card"], div[class*="SKUDeck"]').each((_, el) => {
    const name = $(el).find('[qa="product-name"], h3, h4').first().text().trim();
    if (!name || name.length < 3) return;
    const url   = buildUrl($(el).find('a').first().attr('href') || '', 'https://www.bigbasket.com');
    const price = parsePrice($(el).find('[qa="discounted-price"]').first().text());
    if (!price) return;
    const image = $(el).find('img').first().attr('src') || $(el).find('img').first().attr('data-src') || '';
    products.push({ name, price, originalPrice: parsePrice($(el).find('[qa="mrp"]').first().text()) || null, discount: null, rating: null, ratingCount: null, image, url });
  });
  console.log(`  🟢 BigBasket: ${products.length} products`);
  return products;
}

// ─── Store Registry ───────────────────────────────────────────────────────────
const STORES = [
  { id: 'amazon',    name: 'Amazon Fresh',     priority: 1, strategy: 'cheerio',   searchUrl: q => `https://www.amazon.in/s?k=${encodeURIComponent(q)}&i=nowstore`,                                extractor: extractAmazon    },
  { id: 'flipkart',  name: 'Flipkart Grocery', priority: 2, strategy: 'cheerio',   searchUrl: q => `https://www.flipkart.com/search?q=${encodeURIComponent(q)}&marketplace=GROCERY`,              extractor: extractFlipkart  },
  { id: 'bigbasket', name: 'BigBasket',         priority: 3, strategy: 'cheerio',   searchUrl: q => `https://www.bigbasket.com/ps/?q=${encodeURIComponent(q)}&nc=as`,                              extractor: extractBigBasket },
  { id: 'blinkit',   name: 'Blinkit',           priority: 4, strategy: 'evaluate',  searchUrl: q => `https://blinkit.com/s/?q=${encodeURIComponent(q)}`,                   evaluator: scrapeBlinkit   },
  { id: 'zepto',     name: 'Zepto',             priority: 5, strategy: 'evaluate',  searchUrl: q => `https://www.zeptonow.com/search?query=${encodeURIComponent(q)}`,      evaluator: scrapeZepto     },
  { id: 'instamart', name: 'Swiggy Instamart',  priority: 6, strategy: 'evaluate',  searchUrl: q => `https://www.swiggy.com/instamart/search?query=${encodeURIComponent(q)}`, evaluator: scrapeInstamart },
];

function getEnabledStores() {
  return STORES.filter(s => ENABLED_PLATFORMS[s.id] === true);
}

// ─── Relevance filter ─────────────────────────────────────────────────────────
const MIN_RELEVANCE = 0.20;
const STOP = new Set(['buy','online','best','price','india','store','shop','delivery','fresh','organic','natural','premium','special','classic','original','new','free','sale','offer','deal','combo','pack','value','family','mini','g','ml','kg','l','gm','lt','ltr','pcs','pc','piece','pieces','set','nos','rs','mrp','off','discount','extra','upto','get','and','or','the','of','with','for','in','at','to','a','an','is','by','from','on','as']);

function tokenize(text) {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 1 && !STOP.has(w));
}

function relevanceScore(name, qt) {
  if (!qt.length) return 1;
  const nameSet = new Set(tokenize(name));
  let matches = 0;
  for (const t of qt) {
    if (nameSet.has(t) || [...nameSet].some(n => n.includes(t) || t.includes(n))) matches++;
  }
  let score = matches / qt.length;
  if (name.toLowerCase().includes(qt.join(' '))) score = Math.min(1, score + 0.15);
  return score;
}

function filterByRelevance(products, query) {
  const qt = tokenize(query);
  if (!qt.length) return products;
  return products.map(p => ({ ...p, _r: relevanceScore(p.name, qt) })).filter(p => p._r >= MIN_RELEVANCE).map(({ _r, ...rest }) => rest);
}

// ─── Unit price normalisation ─────────────────────────────────────────────────
const UNIT_PATTERNS = [
  { re: /(\d+(?:\.\d+)?)\s*kg/i,                  toG:  v => v * 1000, unit: 'kg' },
  { re: /(\d+(?:\.\d+)?)\s*g(?:m|ms|s)?(?!\w)/i,  toG:  v => v,        unit: 'g'  },
  { re: /(\d+(?:\.\d+)?)\s*mg/i,                  toG:  v => v / 1000, unit: 'mg' },
  { re: /(\d+(?:\.\d+)?)\s*ltr?s?/i,              toMl: v => v * 1000, unit: 'l'  },
  { re: /(\d+(?:\.\d+)?)\s*l(?!b)(?!\w)/i,        toMl: v => v * 1000, unit: 'l'  },
  { re: /(\d+(?:\.\d+)?)\s*ml/i,                  toMl: v => v,        unit: 'ml' },
  { re: /(\d+)\s*(?:pcs?|pieces?|nos?|count|ct|tabs?|capsules?|sachets?)/i, isPc: true, unit: 'pc' },
  { re: /pack\s*of\s*(\d+)/i, isPc: true, unit: 'pc' },
];

function computeUnitPrice(price, name) {
  if (!price || price <= 0) return {};
  for (const p of UNIT_PATTERNS) {
    const m = name.match(p.re);
    if (!m) continue;
    const qty = parseFloat(m[1]);
    if (!qty || qty <= 0) continue;
    if (p.toG)  { const g  = p.toG(qty);  const v = (price / g)  * 100; return { unitPrice: Math.round(v * 100) / 100, unitLabel: `₹${v.toFixed(2)} / 100g`,   quantity: qty, unit: p.unit }; }
    if (p.toMl) { const ml = p.toMl(qty); const v = (price / ml) * 100; return { unitPrice: Math.round(v * 100) / 100, unitLabel: `₹${v.toFixed(2)} / 100ml`,  quantity: qty, unit: p.unit }; }
    if (p.isPc) { const v = price / qty;  return { unitPrice: Math.round(v * 100) / 100, unitLabel: `₹${v.toFixed(2)} / piece`, quantity: qty, unit: p.unit }; }
  }
  return {};
}

function addUnitPrices(arr) {
  return arr.map(p => ({ ...p, unitPrice: null, unitLabel: null, quantity: null, unit: null, ...computeUnitPrice(p.price, p.name) }));
}

// ─── Jaccard grouping ─────────────────────────────────────────────────────────
const JSTOP = new Set(['the','a','an','in','on','at','to','of','for','with','buy','online','best','price','india','g','ml','kg','l','pack','pcs','and','or','new','free','sale','off']);
const W_RE  = /\b\d+(?:\.\d+)?\s*(?:kg|gm?s?|mg|ltr?s?|ml|l)\b/gi;
const C_RE  = /\b(?:pack|set|combo|box|bag|bundle|kit)\s*(?:of)?\s*\d+|\d+\s*(?:pcs?|pieces?|nos?|count|ct)\b/gi;
const BK_RE = /\b(?:amazon|flipkart|bigbasket|blinkit|zepto|swiggy|instamart|india|online|buy|shop)\b/gi;

function normStr(s) {
  return s.toLowerCase().replace(W_RE, ' ').replace(C_RE, ' ').replace(BK_RE, ' ').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function jaccard(a, b) {
  const words = s => new Set(normStr(s).split(' ').filter(w => w.length > 1 && !JSTOP.has(w)));
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

// ─── Firecrawl helper ────────────────────────────────────────────────────────
async function firecrawlFetch(url) {
  if (!process.env.FIRECRAWL_API_KEY) return '';
  const fc = new Firecrawl({ apiKey: process.env.FIRECRAWL_API_KEY });
  const result = await fc.scrapeUrl(url, { formats: ['html'] });
  return result?.html || '';
}

// ─── Scrape one store ─────────────────────────────────────────────────────────
async function scrapeOneStore(store, query, attempt = 1) {
  console.log(`🕷️  ${store.name} [attempt ${attempt}]`);
  await sem.acquire();
  try {
    let raw = [];

    if (store.strategy === 'evaluate') {
      // Quick-commerce SPAs: Playwright page.evaluate() only
      raw = await store.evaluator(query);
    } else {
      // Standard stores: run Playwright+Cheerio AND Firecrawl in PARALLEL
      const url = store.searchUrl(query);
      // For Flipkart, Firecrawl uses a simpler URL (marketplace=GROCERY can trigger stricter bot checks)
      const fcUrl = store.id === 'flipkart'
        ? `https://www.flipkart.com/search?q=${encodeURIComponent(query)}`
        : url;

      const [pwResult, fcResult] = await Promise.allSettled([
        // Channel 1: Playwright → Cheerio
        fetchHtml(url, store.id)
          .then(html => (html.length >= 500 && store.extractor ? store.extractor(html) : []))
          .catch(e => { console.warn(`  ⚠️  ${store.name} Playwright: ${e.message}`); return []; }),

        // Channel 2: Firecrawl (only if key present)
        process.env.FIRECRAWL_API_KEY
          ? firecrawlFetch(fcUrl)
              .then(html => (html.length >= 500 && store.extractor ? store.extractor(html) : []))
              .catch(e => { console.warn(`  ⚠️  ${store.name} Firecrawl: ${e.message}`); return []; })
          : Promise.resolve([]),
      ]);

      const pwProducts = pwResult.status === 'fulfilled' ? pwResult.value : [];
      const fcProducts = fcResult.status === 'fulfilled' ? fcResult.value : [];

      console.log(`  📊 ${store.name}: Playwright=${pwProducts.length} Firecrawl=${fcProducts.length}`);

      // Use whichever channel returned more products
      raw = fcProducts.length > pwProducts.length ? fcProducts : pwProducts;
    }

    // Auto-retry once if still empty
    if (raw.length === 0 && attempt < 2) {
      sem.release();
      await sleep(2000);
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

// ─── Flatten + group ──────────────────────────────────────────────────────────
function flattenResults(results) {
  const all = [];
  let seq = 0;
  for (const r of results) {
    if (!r?.products?.length) continue;
    const { store, storeId, priority, products } = r;
    products.forEach(p => all.push({
      id: `${storeId}-${seq++}`,
      name: p.name, price: p.price ?? null, originalPrice: p.originalPrice ?? null,
      discount: p.discount ?? null, rating: p.rating ?? null, ratingCount: p.ratingCount ?? null,
      image: p.image || '', url: p.url || '',
      store, storeId, priority, groupId: null,
      unitPrice: null, unitLabel: null, quantity: null, unit: null,
    }));
  }
  return addUnitPrices(all);
}

function groupAndSort(all) {
  const grouped = assignGroups(all);
  grouped.sort((a, b) => a.groupId !== b.groupId ? a.groupId - b.groupId : a.priority - b.priority);
  return grouped;
}

// ─── Public API ───────────────────────────────────────────────────────────────
export async function searchAllStores(rawQuery) {
  const query = cleanQuery(rawQuery);
  if (!query) throw new Error('Empty query');
  const cached = cacheGet(query);
  if (cached) return cached;
  const stores = getEnabledStores();
  if (!stores.length) throw new Error('No platforms enabled');
  console.log(`\n🔍 Blocking search: "${query}" → [${stores.map(s => s.name).join(', ')}]`);
  const results  = await Promise.all(stores.map(s => scrapeOneStore(s, query)));
  const products = groupAndSort(flattenResults(results));
  cacheSet(query, products);
  return products;
}

export async function searchAllStoresStream(rawQuery, onStoreResult) {
  const query = cleanQuery(rawQuery);
  if (!query) throw new Error('Empty query');
  const cached = cacheGet(query);
  if (cached) {
    const byStore = {};
    for (const p of cached) {
      if (!byStore[p.storeId]) byStore[p.storeId] = { store: p.store, storeId: p.storeId, priority: p.priority, products: [] };
      byStore[p.storeId].products.push(p);
    }
    Object.values(byStore).forEach(payload => onStoreResult({ ...payload, cached: true }));
    return cached;
  }
  const stores = getEnabledStores();
  if (!stores.length) throw new Error('No platforms enabled');
  console.log(`\n🔍 SSE search: "${query}"`);
  const results = await Promise.all(
    stores.map(s =>
      scrapeOneStore(s, query).then(result => {
        onStoreResult({ ...result, cached: false });
        return result;
      })
    )
  );
  const products = groupAndSort(flattenResults(results));
  cacheSet(query, products);
  return products;
}
