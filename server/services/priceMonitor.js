import cron from 'node-cron';
import WatchlistItem from '../models/WatchlistItem.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import {
  sendPriceAlert,
  sendTargetPriceAlert,
  sendWishlistDigest,
} from './notification.js';
import { searchAllStores, cleanQuery } from './scraper.js';

// ─── Fetch latest price for a single watchlist item ───────────────────────────
async function fetchLatestPrice(item) {
  try {
    // Search using the item's title across all stores
    const results = await searchAllStores(cleanQuery(item.title));
    // Find the matching result from the same store
    const match = results.find(
      (r) =>
        r.storeId === item.store?.toLowerCase() ||
        r.store?.toLowerCase().includes(item.store?.toLowerCase()) ||
        r.url === item.url
    ) || results[0]; // fallback to cheapest result

    return match ? match.price : null;
  } catch (err) {
    console.error(`[PriceMonitor] Failed to fetch price for "${item.title}":`, err.message);
    return null;
  }
}

// ─── Job 1: Price Check + Alerts (every 6 hours) ──────────────────────────────
async function runPriceCheck() {
  console.log('🔍 [PriceMonitor] Starting 6-hour price check...');

  const allItems = await WatchlistItem.find({ notificationsEnabled: { $ne: false } });
  console.log(`📋 [PriceMonitor] Checking ${allItems.length} watchlist items`);

  for (const item of allItems) {
    try {
      const newPrice = await fetchLatestPrice(item);
      if (newPrice == null) continue;

      const user = await User.findById(item.user);
      if (!user) continue;

      const oldPrice = item.price;

      // ── Target price alert ──
      if (
        item.targetPrice != null &&
        newPrice <= item.targetPrice &&
        (oldPrice == null || oldPrice > item.targetPrice)
      ) {
        await sendTargetPriceAlert({
          to:           user.email,
          title:        item.title,
          store:        item.store,
          targetPrice:  item.targetPrice,
          currentPrice: newPrice,
          url:          item.url,
        });

        // Save in-app notification
        await Notification.create({
          user:    user._id,
          message: `🎯 Target price ₹${item.targetPrice} reached for "${item.title}" — now ₹${newPrice}`,
          type:    'target_price',
          link:    item.url,
        });
      }

      // ── Price change alert ──
      if (oldPrice != null && newPrice !== oldPrice) {
        await sendPriceAlert({
          to:       user.email,
          title:    item.title,
          store:    item.store,
          oldPrice,
          newPrice,
          url:      item.url,
        });

        const dropped = newPrice < oldPrice;
        await Notification.create({
          user:    user._id,
          message: `${dropped ? '📉' : '📈'} Price ${dropped ? 'dropped' : 'increased'} for "${item.title}" — ₹${oldPrice} → ₹${newPrice}`,
          type:    'price_drop',
          link:    item.url,
        });

        console.log(`💰 "${item.title}": ₹${oldPrice} → ₹${newPrice}`);
      }

      // Update stored price
      await WatchlistItem.findByIdAndUpdate(item._id, {
        lastPrice: oldPrice,
        price:     newPrice,
      });
    } catch (err) {
      console.error(`[PriceMonitor] Error for item ${item._id}:`, err.message);
    }
  }

  console.log('✅ [PriceMonitor] Price check complete');
}

// ─── Job 2: Watchlist Digest (every 6 hours, +5 min offset) ───────────────────
async function runWishlistDigest() {
  console.log('📬 [Digest] Sending 6-hour watchlist digests...');

  const allItems = await WatchlistItem.find({ notificationsEnabled: { $ne: false } });

  // Group by user
  const byUser = {};
  for (const item of allItems) {
    const uid = item.user.toString();
    if (!byUser[uid]) byUser[uid] = [];
    byUser[uid].push(item);
  }

  let sent = 0;
  for (const [userId, items] of Object.entries(byUser)) {
    try {
      const user = await User.findById(userId);
      if (!user) continue;

      await sendWishlistDigest({ to: user.email, items });

      // Save a single in-app notification for the digest
      await Notification.create({
        user:    user._id,
        message: `📋 Your 6-hour watchlist digest: ${items.length} item${items.length !== 1 ? 's' : ''} tracked`,
        type:    'digest',
        link:    '/watchlist',
      });

      sent++;
    } catch (err) {
      console.error(`[Digest] Error for user ${userId}:`, err.message);
    }
  }

  console.log(`✅ [Digest] Sent to ${sent} user(s)`);
}

// ─── Scheduler ────────────────────────────────────────────────────────────────
export function startPriceMonitor() {
  // Price check at :00 of every 6th hour  (0:00, 6:00, 12:00, 18:00)
  cron.schedule('0 */6 * * *', async () => {
    try { await runPriceCheck(); }
    catch (err) { console.error('[PriceMonitor] Unhandled error:', err.message); }
  });

  // Digest at :05 of every 6th hour  (0:05, 6:05, 12:05, 18:05)
  cron.schedule('5 */6 * * *', async () => {
    try { await runWishlistDigest(); }
    catch (err) { console.error('[Digest] Unhandled error:', err.message); }
  });

  console.log('⏰ Price monitor scheduled (every 6 hours at :00)');
  console.log('⏰ Watchlist digest scheduled (every 6 hours at :05)');
}

// ─── Manual triggers (for testing) ───────────────────────────────────────────
export async function triggerPriceCheckNow() { return runPriceCheck(); }
export async function triggerDigestNow()      { return runWishlistDigest(); }
