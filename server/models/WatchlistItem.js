import mongoose from 'mongoose';

const watchlistItemSchema = mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User',
    },
    productId: {
      type: String,
      required: true,
    },
    title: {
      type: String,
    },
    price: {
      type: Number,
    },
    originalPrice: {
      type: Number,
    },
    currency: {
      type: String,
      default: '₹'
    },
    imageUrl: {
      type: String,
    },
    store: {
      type: String,
    },
    url: {
      type: String,
    },
    targetPrice: {
      type: Number,
    },
    lastPrice: {
      type: Number,
    },
    notificationsEnabled: {
      type: Boolean,
      default: true,
    }
  },
  {
    timestamps: true,
  }
);

// Compound index: prevents duplicate entries + fast lookups by user
watchlistItemSchema.index({ user: 1, productId: 1 }, { unique: true });

const WatchlistItem = mongoose.model('WatchlistItem', watchlistItemSchema);

export default WatchlistItem;
