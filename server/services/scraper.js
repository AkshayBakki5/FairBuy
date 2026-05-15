// ─────────────────────────────────────────────────────────────────────────────
// scraper.js  (v7 — firecrawl.scrape markdown+html, verbatim prices, no math)
//
// Strategy:
//   1. firecrawl.scrape(storeSearchUrl, { formats: ['markdown','html'] })
//   2. HTML Cheerio extractor first (more structured), markdown fallback
//   3. Prices extracted VERBATIM — no modification, no math, no saving calc
//   4. Group similar products by Jaccard similarity
// ─────────────────────────────────────────────────────────────────────────────

import * as cheerio from 'cheerio';
import Firecrawl    from '@mendable/firecrawl-js';
import { ENABLED_PLATFORMS, CACHE_CONFIG } from '../config/platforms.config.js';

// ── Cache ─────────────────────────────────────────────────────────────────────
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

// ── Query cleaner ─────────────────────────────────────────────────────────────
export function cleanQuery(raw) {
  if (!raw || typeof raw !== 'string') return '';
  return raw.trim()
    .replace(/[<>"';\\]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 120);
}

// ─────────────────────────────────────────────────────────────────────────────
// PRICE EXTRACTION — verbatim first ₹ value, no modification
// ─────────────────────────────────────────────────────────────────────────────
function firstPrice(raw) {
  if (!raw) return null;
  const cleaned = String(raw).replace(/\s/g, '');
  const m = cleaned.match(/₹([\d,]+(?:\.\d{1,2})?)/);
  if (!m) return null;
  const val = parseFloat(m[1].replace(/,/g, ''));
  return (val >= 1 && val < 500000) ? val : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// NAME CLEANER
// ─────────────────────────────────────────────────────────────────────────────
function cleanName(raw, fallback = '') {
  if (!raw) return fallback.substring(0, 120);
  return String(raw)
    .replace(/\*\*/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^\s*#+\s*/gm, '')
    .replace(/\s*[-|–·•]\s*(?:amazon|flipkart|myntra|ajio|bigbasket|blinkit|zepto|swiggy|buy|online|best price|india|\.com).*/gi, '')
    .replace(/\s*\|\s*.*/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 120);
}

// ─────────────────────────────────────────────────────────────────────────────
// HTML CHEERIO EXTRACTORS — price taken verbatim from DOM text
// ─────────────────────────────────────────────────────────────────────────────

// Safe URL builder — never double-prepends the domain
function buildUrl(href, base) {
  if (!href) return '';
  const clean = href.split('?')[0];
  if (clean.startsWith('http')) return clean;
  return `${base}${clean}`;
}

function extractAmazon(html) {
  const $ = cheerio.load(html);
  const products = [];
  $('[data-component-type="s-search-result"]').each((_, el) => {
    const name = $(el).find('h2 a span').first().text().trim();
    if (!name || name.length < 3) return;
    const href = $(el).find('h2 a').attr('href') || '';
    const url  = buildUrl(href, 'https://www.amazon.in');
    // .a-offscreen has the full price like "₹240.00"
    const priceText = $(el).find('.a-price .a-offscreen').first().text().trim();
    const price = firstPrice(priceText);
    if (!price) return;
    const origText = $(el).find('.a-text-price .a-offscreen').first().text().trim();
    const originalPrice = origText ? firstPrice(origText) : null;
    const ratingText  = $(el).find('.a-icon-alt').first().text().trim();
    const rating      = ratingText ? parseFloat(ratingText) : null;
    const ratingCount = $(el).find('.s-underline-text').first().text().replace(/[^0-9]/g, '') || null;
    const image       = $(el).find('img.s-image').attr('src') || '';
    products.push({ name, price, originalPrice, discount: null, rating, ratingCount: ratingCount ? parseInt(ratingCount) : null, image, url });
  });
  return products;
}

function extractFlipkart(html) {
  const $ = cheerio.load(html);
  const products = [];
  // Try multiple card selectors Flipkart uses
  const cards = $('div[data-id]').length > 0
    ? $('div[data-id]')
    : $('div._1AtVbE, div.tUxRFH, div._13oc-S, div.DOjaWF');
  cards.each((_, el) => {
    const name = $(el).find('.RG5Slk, .s1Q9rs, .IRpwTa, .WKTcLC, ._4rR01T, .KzDlHZ, .wjcEIp').first().text().trim();
    if (!name || name.length < 3) return;
    const href = $(el).find('a').first().attr('href') || '';
    const url  = buildUrl(href, 'https://www.flipkart.com');
    // Current price selectors
    const priceText = $(el).find('.hZ3P6w, ._30jeq3, .Nx9bqj, ._16Jk6d, .CEmiEU, .yRaY8j').first().text().trim();
    const price = firstPrice(priceText);
    if (!price) return;
    // Original (struck) price
    const origText = $(el).find('.kRYCnD, ._3I9_wc, .sxXaOq, .ZMdkAy').first().text().trim();
    const originalPrice = origText ? firstPrice(origText) : null;
    const discount = $(el).find('.HQe8jr, .VGWI37, ._3Ay6Sb, .UkUFwK').first().text().trim() || null;
    const ratingText = $(el).find('.XQDdHH, ._3LWZlK, .MKiFS6').first().text().trim();
    const rating = ratingText ? parseFloat(ratingText) : null;
    const image = $(el).find('img').first().attr('src') || '';
    products.push({ name, price, originalPrice, discount, rating, ratingCount: null, image, url });
  });
  return products;
}

function extractBigBasket(html) {
  const $ = cheerio.load(html);
  const products = [];
  $('li[qa="product-card"], div.SKUDeck___StyledDiv, div[qa="product-card"], div.sku-book').each((_, el) => {
    const name = $(el).find('[qa="product-name"], h3, .p-name').first().text().trim();
    if (!name || name.length < 3) return;
    const href = $(el).find('a').first().attr('href') || '';
    const url  = buildUrl(href, 'https://www.bigbasket.com');
    const priceText = $(el).find('[qa="discounted-price"], .discnt-price, .Pricing___StyledDiv').first().text().trim();
    const price = firstPrice(priceText);
    if (!price) return;
    const origText = $(el).find('[qa="mrp"], .sp, .MRP___StyledDiv').first().text().trim();
    const originalPrice = origText ? firstPrice(origText) : null;
    const image = $(el).find('img').first().attr('src') || '';
    products.push({ name, price, originalPrice, discount: null, rating: null, ratingCount: null, image, url });
  });
  return products;
}

function extractBlinkit(html) {
  const $ = cheerio.load(html);
  const products = [];
  $('a[data-test-id="product-card"], div[class*="Product__Container"]').each((_, el) => {
    const name = $(el).find('[data-test-id="product-name"], div[class*="Product__Name"]').first().text().trim();
    if (!name || name.length < 3) return;
    const href = $(el).is('a') ? $(el).attr('href') : $(el).find('a').first().attr('href') || '';
    const url  = buildUrl(href, 'https://blinkit.com');
    const priceText = $(el).find('[data-test-id="product-price"], div[class*="Product__Price"]').first().text().trim();
    const price = firstPrice(priceText);
    if (!price) return;
    const origText = $(el).find('[class*="strikethrough"], [class*="Strikethrough"]').first().text().trim();
    const originalPrice = origText ? firstPrice(origText) : null;
    const image = $(el).find('img').first().attr('src') || '';
    products.push({ name, price, originalPrice, discount: null, rating: null, ratingCount: null, image, url });
  });
  return products;
}

function extractZepto(html) {
  const $ = cheerio.load(html);
  const products = [];
  $('a[href*="/pn/"], div[class*="ProductCard"]').each((_, el) => {
    const name = $(el).find('h5, [class*="name"], [class*="Name"]').first().text().trim();
    if (!name || name.length < 3) return;
    const href = $(el).is('a') ? $(el).attr('href') : $(el).find('a').first().attr('href') || '';
    const url  = buildUrl(href, 'https://www.zeptonow.com');
    const priceText = $(el).find('[class*="price"], [class*="Price"]').first().text().trim();
    const price = firstPrice(priceText);
    if (!price) return;
    const origText = $(el).find('[class*="strike"], [class*="Strike"], [class*="original"]').first().text().trim();
    const originalPrice = origText ? firstPrice(origText) : null;
    const image = $(el).find('img').first().attr('src') || '';
    products.push({ name, price, originalPrice, discount: null, rating: null, ratingCount: null, image, url });
  });
  return products;
}

function extractInstamart(html) {
  const $ = cheerio.load(html);
  const products = [];
  $('div[class*="ItemRevamp"], div[data-testid="item-card"], div[class*="sc-"]').each((_, el) => {
    const name = $(el).find('[class*="ItemName"], [class*="item-name"]').first().text().trim();
    if (!name || name.length < 3) return;
    const href = $(el).find('a').first().attr('href') || '';
    const url  = buildUrl(href, 'https://www.swiggy.com');
    const priceText = $(el).find('[class*="ItemPrice"], [class*="item-price"]').first().text().trim();
    const price = firstPrice(priceText);
    if (!price) return;
    const origText = $(el).find('[class*="Strike"], [class*="strike"]').first().text().trim();
    const originalPrice = origText ? firstPrice(origText) : null;
    const image = $(el).find('img').first().attr('src') || '';
    products.push({ name, price, originalPrice, discount: null, rating: null, ratingCount: null, image, url });
  });
  return products;
}

function extractMyntra(html) {
  const $ = cheerio.load(html);
  const products = [];
  $('li.product-base').each((_, el) => {
    const name = $(el).find('.product-product, .product-brand, h3, h4').first().text().trim();
    if (!name) return;
    const href = $(el).find('a').attr('href') || '';
    const url  = buildUrl(href, 'https://www.myntra.com');
    const priceText = $(el).find('.product-discountedPrice, .product-price span').first().text().trim();
    const price = firstPrice(priceText);
    if (!price) return;
    const origText = $(el).find('.product-strike').first().text().trim();
    const originalPrice = origText ? firstPrice(origText) : null;
    const discount = $(el).find('.product-discountPercentage').first().text().trim() || null;
    const ratingText = $(el).find('.product-ratingsCount').first().text().trim();
    const rating = ratingText ? parseFloat(ratingText) : null;
    const image = $(el).find('img').attr('src') || '';
    products.push({ name, price, originalPrice, discount, rating, ratingCount: null, image, url });
  });
  return products;
}

function extractAjio(html) {
  const $ = cheerio.load(html);
  const products = [];
  $('div.item, div[class*="product-container"]').each((_, el) => {
    const name = $(el).find('.nameCnt, .brand-name, h2, h3').first().text().trim();
    if (!name) return;
    const href = $(el).find('a').attr('href') || '';
    const url  = buildUrl(href, 'https://www.ajio.com');
    const priceText = $(el).find('.price strong, .sell-price').first().text().trim();
    const price = firstPrice(priceText);
    if (!price) return;
    const origText = $(el).find('.price .price-was').first().text().trim();
    const originalPrice = origText ? firstPrice(origText) : null;
    const discount = $(el).find('.discount-percent').first().text().trim() || null;
    const image = $(el).find('img').first().attr('src') || '';
    products.push({ name, price, originalPrice, discount, rating: null, ratingCount: null, image, url });
  });
  return products;
}

const HTML_EXTRACTORS = {
  amazon:    extractAmazon,
  flipkart:  extractFlipkart,
  bigbasket: extractBigBasket,
  blinkit:   extractBlinkit,
  zepto:     extractZepto,
  instamart: extractInstamart,
  myntra:    extractMyntra,
  ajio:      extractAjio,
};

// ─────────────────────────────────────────────────────────────────────────────
// MARKDOWN PARSER — fallback when HTML extractor yields nothing
// Prices extracted verbatim from markdown text
// ─────────────────────────────────────────────────────────────────────────────
function parseMarkdown(markdown, query) {
  const products = [];
  if (!markdown) return products;

  // Split into product blocks by headings or separators
  const blocks = markdown.split(/\n---+\n|\n(?=#{1,4}\s)/);

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed || trimmed.length < 10) continue;

    const nameMatch =
      trimmed.match(/^#{1,4}\s+(.{4,120})/m) ||
      trimmed.match(/^\*\*(.{4,120})\*\*/m)  ||
      trimmed.match(/^\d+\.\s+\*\*(.{4,120})\*\*/m);
    if (!nameMatch) continue;

    const name = cleanName(nameMatch[1], query);
    if (!name || name.length < 3) continue;

    // Price — prefer labeled, else first ₹ in block
    let price = null;
    const priceLabelMatch = trimmed.match(/(?:price|selling price|offer price)\s*:?\s*(₹[\s\d,]+(?:\.\d{1,2})?)/i);
    price = priceLabelMatch ? firstPrice(priceLabelMatch[1]) : firstPrice(trimmed);
    if (!price) continue;

    // MRP — only from explicit label, never computed
    let originalPrice = null;
    const mrpMatch = trimmed.match(/(?:M\.R\.P\.?|MRP|was|market price|original price)\s*:?\s*(₹[\s\d,]+(?:\.\d{1,2})?)/i);
    if (mrpMatch) {
      const mrp = firstPrice(mrpMatch[1]);
      if (mrp && mrp !== price) originalPrice = mrp;
    }

    const ratingMatch = trimmed.match(/([\d.]+)\s*(?:out of\s*5|\/5|★|⭐)/i);
    const rating = ratingMatch ? parseFloat(ratingMatch[1]) : null;

    const imgMatch = trimmed.match(/!\[[^\]]*\]\((https?:\/\/[^\s)]+)\)/);
    const image = imgMatch ? imgMatch[1] : '';

    const allLinks = [...trimmed.matchAll(/\((https?:\/\/[^\s)]+)\)/g)].map(m => m[1]);
    const url = allLinks.find(u => !/\.(jpg|jpeg|png|gif|webp|svg)/i.test(u)) || '';

    products.push({ name, price, originalPrice, discount: null, rating, ratingCount: null, image, url });
  }
  return products;
}

// Choose HTML extractor first, markdown as fallback
function parseStoreResult(storeId, markdown, html, query) {
  const extractor = HTML_EXTRACTORS[storeId];
  if (html && extractor) {
    const r = extractor(html, query);
    if (r.length > 0) {
      console.log(`  ↳ HTML cheerio: ${r.length} products`);
      return r;
    }
  }
  const r = parseMarkdown(markdown, query);
  console.log(`  ↳ Markdown fallback: ${r.length} products`);
  return r;
}

// ─────────────────────────────────────────────────────────────────────────────
// PLATFORM DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────
const ALL_PLATFORMS = [
  { id: 'amazon',    name: 'Amazon',           priority: 1, searchUrl: q => `https://www.amazon.in/s?k=${encodeURIComponent(q)}` },
  { id: 'flipkart',  name: 'Flipkart',         priority: 2, searchUrl: q => `https://www.flipkart.com/search?q=${encodeURIComponent(q)}&marketplace=FLIPKART` },
  { id: 'bigbasket', name: 'BigBasket',        priority: 3, searchUrl: q => `https://www.bigbasket.com/ps/?q=${encodeURIComponent(q)}` },
  { id: 'blinkit',   name: 'Blinkit',          priority: 4, searchUrl: q => `https://blinkit.com/s/?q=${encodeURIComponent(q)}` },
  { id: 'zepto',     name: 'Zepto',            priority: 5, searchUrl: q => `https://www.zeptonow.com/search?q=${encodeURIComponent(q)}` },
  { id: 'instamart', name: 'Swiggy Instamart', priority: 6, searchUrl: q => `https://www.swiggy.com/instamart/search?custom_back=true&query=${encodeURIComponent(q)}` },
  { id: 'myntra',    name: 'Myntra',           priority: 7, searchUrl: q => `https://www.myntra.com/${encodeURIComponent(q)}` },
  { id: 'ajio',      name: 'Ajio',             priority: 8, searchUrl: q => `https://www.ajio.com/search/?text=${encodeURIComponent(q)}` },
];

function getEnabledStores() {
  return ALL_PLATFORMS.filter(p => ENABLED_PLATFORMS[p.id] === true);
}

// ─────────────────────────────────────────────────────────────────────────────
// SCRAPE ONE STORE — firecrawl.scrape with markdown + html
// ─────────────────────────────────────────────────────────────────────────────
async function scrapeOneStore(store, query, firecrawl) {
  const url = store.searchUrl(query);
  console.log(`🕷️  Scraping ${store.name}: ${url}`);
  try {
    const result = await firecrawl.scrape(url, {
      formats: ['markdown', 'html'],
    });
    const markdown = result?.markdown || '';
    const html     = result?.html     || '';
    if (!markdown && !html) {
      console.warn(`⚠️  ${store.name}: empty response`);
      return { store: store.name, storeId: store.id, priority: store.priority, products: [], error: 'No content', source: 'empty' };
    }
    const products = parseStoreResult(store.id, markdown, html, query);
    console.log(`✅ ${store.name}: ${products.length} products found`);
    return { store: store.name, storeId: store.id, priority: store.priority, products, error: null, source: 'firecrawl' };
  } catch (err) {
    if (err.message?.includes('Insufficient credits') || err.message?.includes('out of credits')) {
      throw new Error('CREDITS_EXHAUSTED');
    }
    console.warn(`⚠️  ${store.name} failed: ${err.message}`);
    return { store: store.name, storeId: store.id, priority: store.priority, products: [], error: err.message, source: 'error' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GROUPING — Jaccard similarity on product names
// ─────────────────────────────────────────────────────────────────────────────
const STOP = new Set([
  'the','a','an','in','on','at','to','of','for','with','buy','online',
  'best','price','india','g','ml','kg','l','pack','pcs','rs','get','and','or',
  'new','free','sale','off','deal',
]);

function jaccardSimilarity(a, b) {
  const words = s => new Set(
    s.toLowerCase().replace(/[^a-z0-9\s]/g,' ').split(/\s+/).filter(w => w.length > 1 && !STOP.has(w))
  );
  const A = words(a), B = words(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  A.forEach(w => { if (B.has(w)) inter++; });
  return inter / new Set([...A,...B]).size;
}

function assignGroups(products) {
  const assigned = new Array(products.length).fill(-1);
  let gid = 0;
  for (let i = 0; i < products.length; i++) {
    if (assigned[i] !== -1) continue;
    assigned[i] = gid;
    for (let j = i + 1; j < products.length; j++) {
      if (assigned[j] !== -1) continue;
      if (jaccardSimilarity(products[i].name, products[j].name) >= 0.35) assigned[j] = gid;
    }
    gid++;
  }
  return products.map((p, i) => ({ ...p, groupId: assigned[i] }));
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────────────────────
export async function searchAllStores(rawQuery) {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) throw new Error('FIRECRAWL_API_KEY is not set in .env');

  const query = cleanQuery(rawQuery);
  if (!query) throw new Error('Query is empty after cleaning');

  console.log(`\n🔍 Searching: "${query}"`);

  const cached = cacheGet(query);
  if (cached) return cached;

  const enabledStores = getEnabledStores();
  if (!enabledStores.length) throw new Error('No platforms enabled in platforms.config.js');
  console.log(`🏪 Enabled stores: ${enabledStores.map(s => s.name).join(', ')}`);

  const firecrawl = new Firecrawl({ apiKey });

  // Scrape all stores in parallel
  const settled = await Promise.allSettled(
    enabledStores.map(store => scrapeOneStore(store, query, firecrawl))
  );

  // Bail on credit exhaustion
  for (const r of settled) {
    if (r.status === 'rejected' && r.reason?.message === 'CREDITS_EXHAUSTED') {
      throw new Error('Firecrawl API credits exhausted. Top up at firecrawl.dev');
    }
  }

  // Flatten all products
  const allProducts = [];
  for (const r of settled) {
    if (r.status !== 'fulfilled') continue;
    const { store, storeId, priority, products, source } = r.value;
    for (let i = 0; i < products.length; i++) {
      allProducts.push({
        id:            `${storeId}-${i}-${Date.now()}`,
        name:          products[i].name,
        price:         products[i].price         ?? null,
        originalPrice: products[i].originalPrice ?? null,
        discount:      products[i].discount      ?? null,
        rating:        products[i].rating        ?? null,
        ratingCount:   products[i].ratingCount   ?? null,
        image:         products[i].image         || '',
        url:           products[i].url           || '',
        store, storeId, priority, source, groupId: null,
      });
    }
  }

  console.log(`📦 Total products across all stores: ${allProducts.length}`);

  const grouped = assignGroups(allProducts);
  // Sort: by groupId first, then by store priority within each group
  grouped.sort((a, b) => {
    if (a.groupId !== b.groupId) return a.groupId - b.groupId;
    return a.priority - b.priority;
  });

  cacheSet(query, grouped);
  return grouped;
}
