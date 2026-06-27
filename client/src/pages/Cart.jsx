import { Link } from 'react-router-dom';
import { Trash2, Plus, Minus, ExternalLink, ShoppingBag, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import Navbar from '@/components/Navbar';
import { useCart } from '@/hooks/useCart';

// Store search URL fallbacks — used when a cart item has no direct product URL
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

function resolveUrl(item) {
  if (item.url && item.url.startsWith('http')) return item.url;
  // fallback: open store search for this product name
  const fn = STORE_SEARCH_URLS[item.storeId] || STORE_SEARCH_URLS[item.store?.toLowerCase()];
  return fn ? fn(item.name) : null;
}

function openUrl(url) {
  if (url) window.open(url, '_blank', 'noopener,noreferrer');
}

const Cart = () => {
  const { items, total, update, remove, clear } = useCart();

  const groupedByStore = items.reduce((acc, item) => {
    if (!acc[item.store]) acc[item.store] = [];
    acc[item.store].push(item);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-6 max-w-3xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShoppingBag className="h-6 w-6" /> Cart ({items.length})
          </h1>
          {items.length > 0 && (
            <Button variant="ghost" size="sm" onClick={clear} className="text-destructive">
              Clear All
            </Button>
          )}
        </div>

        {items.length === 0 ? (
          <div className="flex flex-col items-center py-20 gap-4">
            <span className="text-5xl">🛒</span>
            <p className="text-lg font-medium">Your cart is empty</p>
            <Link to="/">
              <Button className="gap-2"><ArrowLeft className="h-4 w-4" /> Start Shopping</Button>
            </Link>
          </div>
        ) : (
          <>
            {Object.entries(groupedByStore).map(([store, storeItems]) => (
              <Card key={store} className="mb-4">
                <CardContent className="p-4">
                  <h3 className="font-semibold mb-3 text-sm text-muted-foreground uppercase tracking-wider">
                    {store}
                  </h3>
                  <div className="space-y-3">
                    {storeItems.map((item) => {
                      const productUrl = resolveUrl(item);
                      return (
                        <div key={item.id} className="flex items-center gap-3 py-2 border-b last:border-0">
                          {/* Product image — click to open product page */}
                          <div
                            className="h-14 w-14 rounded-lg bg-muted flex items-center justify-center overflow-hidden shrink-0 cursor-pointer"
                            onClick={() => openUrl(productUrl)}
                            title={productUrl ? 'Open product page' : undefined}
                          >
                            {item.image ? (
                              <img
                                src={item.image}
                                alt={item.name}
                                className="h-full w-full object-contain p-1"
                                onError={(e) => { e.target.style.display = 'none'; }}
                              />
                            ) : (
                              <span className="text-2xl">📦</span>
                            )}
                          </div>

                          {/* Product name — click to open product page */}
                          <div className="flex-1 min-w-0">
                            <p
                              className="text-sm font-medium truncate cursor-pointer hover:underline"
                              onClick={() => openUrl(productUrl)}
                              title={productUrl ? 'Open product page' : undefined}
                            >
                              {item.name}
                            </p>
                            <p className="text-xs text-muted-foreground">{item.unitLabel || item.unit || ''}</p>
                          </div>

                          {/* Quantity controls */}
                          <div className="flex items-center gap-1">
                            <Button size="icon" variant="ghost" className="h-7 w-7"
                              onClick={() => update(item.id, item.quantity - 1)}>
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="text-sm w-6 text-center">{item.quantity}</span>
                            <Button size="icon" variant="ghost" className="h-7 w-7"
                              onClick={() => update(item.id, item.quantity + 1)}>
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>

                          <span className="font-semibold text-sm w-16 text-right">
                            ₹{((item.price || 0) * item.quantity).toFixed(0)}
                          </span>

                          {/* Individual product link */}
                          {productUrl && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-muted-foreground hover:text-primary"
                              title="Open product page"
                              onClick={() => openUrl(productUrl)}
                            >
                              <ExternalLink className="h-3 w-3" />
                            </Button>
                          )}

                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive"
                            onClick={() => remove(item.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      );
                    })}

                    {/* "Buy on [Store]" — opens store search for all items in this group */}
                    <div className="pt-2 flex flex-wrap gap-2">
                      {storeItems.map((item) => {
                        const url = resolveUrl(item);
                        if (!url) return null;
                        return (
                          <Button
                            key={item.id}
                            size="sm"
                            variant="outline"
                            className="gap-1 text-xs"
                            onClick={() => openUrl(url)}
                          >
                            <ExternalLink className="h-3 w-3" />
                            Buy {item.name.substring(0, 20)}{item.name.length > 20 ? '…' : ''} on {store}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-4 flex items-center justify-between">
                <span className="text-lg font-bold">Total</span>
                <span className="text-2xl font-bold text-primary">₹{total.toFixed(0)}</span>
              </CardContent>
            </Card>
            <p className="text-xs text-muted-foreground mt-3 text-center">
              Click a product name, image, or "Buy on [Store]" to complete your purchase.
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default Cart;
