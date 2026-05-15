import { Link } from 'react-router-dom';
import { Trash2, Plus, Minus, ExternalLink, ShoppingBag, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import Navbar from '@/components/Navbar';
import { useCart } from '@/hooks/useCart';

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
          {items.length > 0 &&
          <Button variant="ghost" size="sm" onClick={clear} className="text-destructive">
              Clear All
            </Button>
          }
        </div>

        {items.length === 0 ?
        <div className="flex flex-col items-center py-20 gap-4">
            <span className="text-5xl">🛒</span>
            <p className="text-lg font-medium">Your cart is empty</p>
            <Link to="/">
              <Button className="gap-2"><ArrowLeft className="h-4 w-4" /> Start Shopping</Button>
            </Link>
          </div> :

        <>
            {Object.entries(groupedByStore).map(([store, storeItems]) =>
          <Card key={store} className="mb-4">
                <CardContent className="p-4">
                  <h3 className="font-semibold mb-3 text-sm text-muted-foreground uppercase tracking-wider">{store}</h3>
                  <div className="space-y-3">
                    {storeItems.map((item) =>
                <div key={item.id} className="flex items-center gap-3 py-2 border-b last:border-0">
                        <div className="h-14 w-14 rounded-lg bg-muted flex items-center justify-center overflow-hidden shrink-0">
                          {item.image ?
                    <img src={item.image} alt={item.name} className="h-full w-full object-contain p-1" onError={(e) => {e.target.src = '/placeholder.svg';}} /> :

                    <span className="text-2xl">📦</span>
                    }
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.name}</p>
                          <p className="text-xs text-muted-foreground">{item.unit}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => update(item.id, item.quantity - 1)}>
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="text-sm w-6 text-center">{item.quantity}</span>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => update(item.id, item.quantity + 1)}>
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                        <span className="font-semibold text-sm w-16 text-right">₹{((item.price || 0) * item.quantity).toFixed(0)}</span>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => remove(item.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                )}
                    <div className="pt-2">
                      <Button size="sm" variant="outline" className="gap-1" asChild>
                        <a href={storeItems[0].url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3 w-3" /> Buy on {store}
                        </a>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
          )}

            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-4 flex items-center justify-between">
                <span className="text-lg font-bold">Total</span>
                <span className="text-2xl font-bold text-primary">₹{total.toFixed(0)}</span>
              </CardContent>
            </Card>
            <p className="text-xs text-muted-foreground mt-3 text-center">
              Click "Buy on [Store]" to complete your purchase on the store's website.
            </p>
          </>
        }
      </div>
    </div>);

};

export default Cart;