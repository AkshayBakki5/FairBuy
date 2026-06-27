import mongoose from 'mongoose';

// Stores a time-series of price snapshots for a watchlist item.
// One document per item; prices array capped at 90 entries (~3 months at daily checks).
const priceHistorySchema = new mongoose.Schema(
  {
    watchlistItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WatchlistItem',
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    productId: { type: String, required: true },
    store:     { type: String, required: true },
    prices: [
      {
        price: { type: Number, required: true },
        ts:    { type: Date,   default: Date.now },
      },
    ],
  },
  { timestamps: true },
);

// Compound index for quick lookup by user + product
priceHistorySchema.index({ user: 1, productId: 1 }, { unique: true });

// Helper: append a price snapshot (max 90 kept)
priceHistorySchema.methods.addSnapshot = function (price) {
  this.prices.push({ price, ts: new Date() });
  if (this.prices.length > 90) this.prices = this.prices.slice(-90);
  return this.save();
};

export default mongoose.model('PriceHistory', priceHistorySchema);
