import express      from 'express';
import WatchlistItem from '../models/WatchlistItem.js';
import Notification  from '../models/Notification.js';
import { protect }  from '../middleware/authMiddleware.js';

const router = express.Router();

// ── GET /api/watchlist ────────────────────────────────────────────────────────
router.get('/', protect, async (req, res) => {
  try {
    const watchlist = await WatchlistItem.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json(watchlist);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── POST /api/watchlist ───────────────────────────────────────────────────────
// Body: { productId, title, price, imageUrl, store, url }
router.post('/', protect, async (req, res) => {
  try {
    const {
      productId,
      title,
      price,
      originalPrice,
      imageUrl,
      store,
      url,
      targetPrice,
    } = req.body;

    // Validation
    if (!productId || !url) {
      return res.status(400).json({ message: 'productId and url are required' });
    }
    if (!title) {
      return res.status(400).json({ message: 'title is required' });
    }

    // Prevent duplicates (same product + same user)
    const existing = await WatchlistItem.findOne({
      user:      req.user._id,
      productId,
    });
    if (existing) {
      return res.status(409).json({ message: 'Already in watchlist' });
    }

    const item = await WatchlistItem.create({
      user:         req.user._id,
      productId,
      title,
      price:        price        ?? null,
      originalPrice: originalPrice ?? null,
      currency:     '₹',
      imageUrl:     imageUrl     || '',
      store:        store        || '',
      url,
      targetPrice:  targetPrice  ?? null,
    });

    // ── In-app notification: "added to watchlist" ─────────────────────────────
    await Notification.create({
      user:    req.user._id,
      message: `🛍️ Now watching "${title}" on ${store}${price ? ` at ₹${price.toLocaleString('en-IN')}` : ''}`,
      type:    'watchlist_added',
      link:    url,
      read:    false,
    });

    res.status(201).json(item);
  } catch (err) {
    console.error('[Watchlist POST]', err.message);
    res.status(500).json({ message: err.message });
  }
});

// ── DELETE /api/watchlist/:id ─────────────────────────────────────────────────
router.delete('/:id', protect, async (req, res) => {
  try {
    const item = await WatchlistItem.findById(req.params.id);
    if (!item) return res.status(404).json({ message: 'Watchlist item not found' });
    if (item.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    await item.deleteOne();
    res.json({ message: 'Removed from watchlist' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/watchlist/check/:productId ──────────────────────────────────────
router.get('/check/:productId', protect, async (req, res) => {
  try {
    // productId may be URL-encoded
    const productId = decodeURIComponent(req.params.productId);
    const item = await WatchlistItem.findOne({ user: req.user._id, productId });
    res.json({ inWatchlist: !!item, item: item ?? null });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── PATCH /api/watchlist/:id ──────────────────────────────────────────────────
router.patch('/:id', protect, async (req, res) => {
  try {
    const item = await WatchlistItem.findOne({ _id: req.params.id, user: req.user._id });
    if (!item) return res.status(404).json({ message: 'Watchlist item not found' });

    const { notificationsEnabled, targetPrice } = req.body;
    if (notificationsEnabled !== undefined) item.notificationsEnabled = notificationsEnabled;
    if (targetPrice !== undefined) item.targetPrice = targetPrice === null ? undefined : Number(targetPrice);

    const updated = await item.save();
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
