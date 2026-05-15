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

  // Show discount badge from stored discount string only
  const discountLabel = product.discount || null;

  // Source badge (cheerio = live, fallback = search)
  const isLive = product.source === 'cheerio';

  return (
    <Card className="overflow-hidden transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 group flex flex-col">
      {/* Store colour strip */}
      <div className="h-1 w-full shrink-0" style={{ backgroundColor: color }} />

      {/* Image */}
      <div className="aspect-square bg-muted/40 flex items-center justify-center overflow-hidden relative">
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
          <span className="absolute top-2 right-2 text-[10px] font-bold px-1.5 py-0.5 rounded-md text-white"
            style={{ backgroundColor: color }}>
            {discountLabel}
          </span>
        )}

        {/* Live price badge — top-left */}
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

        {/* Product name */}
        <h3 className="font-semibold text-sm line-clamp-2 leading-snug flex-1">
          {product.name}
        </h3>

        {/* Rating */}
        {product.rating != null && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
            <span>{product.rating.toFixed(1)}</span>
            {product.ratingCount && (
              <span className="opacity-60">({Number(product.ratingCount).toLocaleString('en-IN')})</span>
            )}
          </div>
        )}

        {/* Price block */}
        <div className="mt-auto pt-1">
          {/* Current price — as scraped, no modification */}
          <p className="text-xl font-bold leading-none" style={{ color }}>
            {product.price != null ? `₹${product.price.toLocaleString('en-IN')}` : 'N/A'}
          </p>

          {/* Original price — shown as-is when available */}
          {product.originalPrice != null && (
            <p className="text-xs text-muted-foreground mt-0.5">
              MRP ₹{product.originalPrice.toLocaleString('en-IN')}
            </p>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex gap-1.5 pt-1">
          <Button size="sm" className="flex-1 gap-1 text-xs" onClick={handleAddToCart}>
            <Plus className="h-3 w-3" /> Add
          </Button>
          <WatchButton product={product} />
          <Button size="sm" variant="outline" className="px-2" asChild>
            <a href={product.url} target="_blank" rel="noopener noreferrer" title="Open on store">
              <ExternalLink className="h-3 w-3" />
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default ProductCard;
