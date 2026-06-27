import { ExternalLink, Plus, Star } from 'lucide-react';
import { Button }            from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge }             from '@/components/ui/badge';
import { useCart }           from '@/hooks/useCart';
import { useAuth }           from '@/hooks/useAuth';
import WatchButton           from './WatchButton';
import { useNavigate }       from 'react-router-dom';
import { toast }             from 'sonner';

const STORE_COLORS = {
  amazon:    '#ff9900',
  flipkart:  '#2874f0',
  blinkit:   '#f8c200',
  zepto:     '#8b2df0',
  instamart: '#fc8019',
  bigbasket: '#84c225',
  myntra:    '#ff3f6c',
  ajio:      '#232323',
};

const STORE_SEARCH_URLS = {
  amazon:    (q) => `https://www.amazon.in/s?k=${encodeURIComponent(q)}`,
  flipkart:  (q) => `https://www.flipkart.com/search?q=${encodeURIComponent(q)}`,
  blinkit:   (q) => `https://blinkit.com/s/?q=${encodeURIComponent(q)}`,
  zepto:     (q) => `https://www.zeptonow.com/search?query=${encodeURIComponent(q)}`,
  instamart: (q) => `https://www.swiggy.com/instamart/search?query=${encodeURIComponent(q)}`,
  bigbasket: (q) => `https://www.bigbasket.com/ps/?q=${encodeURIComponent(q)}`,
  myntra:    (q) => `https://www.myntra.com/${encodeURIComponent(q)}`,
  ajio:      (q) => `https://www.ajio.com/search/?text=${encodeURIComponent(q)}`,
};

const STORE_LOGOS = {
  amazon:    '🟤',
  flipkart:  '🔵',
  blinkit:   '🟡',
  zepto:     '🟣',
  instamart: '🟠',
  bigbasket: '🟢',
  myntra:    '🔴',
  ajio:      '⚫',
};

const ProductCard = ({ product }) => {
  const { add }  = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const color    = STORE_COLORS[product.storeId] || '#6366f1';

  const handleAddToCart = () => {
    if (!user) {
      toast.info('Please log in to add items to your cart');
      navigate('/login');
      return;
    }
    add(product);
    toast.success('Added to cart');
  };

  // Resolve best URL: direct product link, else store search fallback
  const resolvedUrl = (() => {
    if (product.url && product.url.startsWith('http')) return product.url;
    const fn = STORE_SEARCH_URLS[product.storeId];
    return fn ? fn(product.name) : null;
  })();

  const openProduct = () => {
    if (resolvedUrl) window.open(resolvedUrl, '_blank', 'noopener,noreferrer');
  };

  const discountLabel = product.discount || null;
  const isLive = product.source === 'cheerio';

  return (
    <Card className="overflow-hidden transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 group flex flex-col">
      {/* Store colour strip */}
      <div className="h-1 w-full shrink-0" style={{ backgroundColor: color }} />

      {/* Image — click to open product page */}
      <div
        className="aspect-square bg-muted/40 flex items-center justify-center overflow-hidden relative cursor-pointer"
        onClick={openProduct}
        title="View on store"
      >
        {product.image ? (
          <img
            src={product.image}
            alt={product.name}
            className="h-full w-full object-contain p-3 transition-transform duration-200 group-hover:scale-105"
            loading="lazy"
            onError={e => {
              e.currentTarget.style.display = 'none';
              if (e.currentTarget.nextSibling) e.currentTarget.nextSibling.style.display = 'flex';
            }}
          />
        ) : null}
        <div
          className="absolute inset-0 flex items-center justify-center text-4xl opacity-20"
          style={{ display: product.image ? 'none' : 'flex' }}
        >
          📦
        </div>

        {/* Discount badge — top-right */}
        {discountLabel && (
          <span
            className="absolute top-2 right-2 text-[10px] font-bold px-1.5 py-0.5 rounded-md text-white"
            style={{ backgroundColor: color }}
          >
            {discountLabel}
          </span>
        )}

        {/* Live badge — top-left */}
        {isLive && (
          <span className="absolute top-2 left-2 text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-green-500 text-white">
            LIVE
          </span>
        )}
      </div>

      <CardContent className="p-3 flex flex-col gap-1.5 flex-1">
        {/* Store badge */}
        <Badge
          variant="outline"
          className="text-[10px] font-semibold uppercase tracking-wider w-fit"
          style={{ borderColor: color, color }}
        >
          {STORE_LOGOS[product.storeId]} {product.store}
        </Badge>

        {/* Product name — click to open product page */}
        <h3
          className="font-semibold text-sm line-clamp-2 leading-snug flex-1 cursor-pointer hover:underline"
          onClick={openProduct}
          title="View on store"
        >
          {product.name}
        </h3>

        {/* Rating */}
        {product.rating != null && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
            <span>{product.rating.toFixed(1)}</span>
            {product.ratingCount && (
              <span className="opacity-60">
                ({Number(product.ratingCount).toLocaleString('en-IN')})
              </span>
            )}
          </div>
        )}

        {/* Price block */}
        <div className="mt-auto pt-1">
          <p className="text-xl font-bold leading-none" style={{ color }}>
            {product.price != null ? `₹${product.price.toLocaleString('en-IN')}` : 'N/A'}
          </p>
          {product.originalPrice != null && (
            <p className="text-xs text-muted-foreground mt-0.5">
              MRP ₹{product.originalPrice.toLocaleString('en-IN')}
            </p>
          )}
          {product.unitLabel && (
            <p className="text-[10px] font-medium text-muted-foreground/80 mt-0.5 tabular-nums">
              {product.unitLabel}
            </p>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex gap-1.5 pt-1">
          <Button size="sm" className="flex-1 gap-1 text-xs" onClick={handleAddToCart}>
            <Plus className="h-3 w-3" /> Add
          </Button>
          <WatchButton product={product} />
          <Button
            size="sm"
            variant="outline"
            className="px-2"
            title={product.url ? 'View product on store' : 'Search on store'}
            onClick={openProduct}
          >
            <ExternalLink className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default ProductCard;
