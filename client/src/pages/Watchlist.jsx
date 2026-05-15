import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, Trash2, ExternalLink, ArrowLeft, TrendingDown, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

const API_URL = '/api';

const Watchlist = () => {
  const { user, session } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchItems = async () => {
      try {
        const res = await fetch(`${API_URL}/watchlist`, {
          headers: { Authorization: `Bearer ${session?.access_token}` }
        });
        const data = await res.json();
        setItems(data || []);
      } catch (err) {
        console.error('Failed to fetch watchlist:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchItems();
  }, [user, session]);

  const remove = async (id) => {
    try {
      const res = await fetch(`${API_URL}/watchlist/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session?.access_token}` }
      });
      if (res.ok) {
        setItems((prev) => prev.filter((i) => i._id !== id));
        toast.info('Removed from watchlist');
      }
    } catch (err) {
      toast.error('Failed to remove item');
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Eye className="h-12 w-12 text-muted-foreground/30" />
          <p className="text-lg font-medium">Sign in to view your watchlist</p>
          <Link to="/login"><Button>Sign In</Button></Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-6 max-w-3xl">
        <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <Eye className="h-6 w-6" /> Price Watchlist ({items.length})
        </h1>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center py-20 gap-4">
            <Eye className="h-12 w-12 text-muted-foreground/30" />
            <p className="text-lg font-medium">Your watchlist is empty</p>
            <p className="text-muted-foreground text-sm">Search for products and click the 👁 icon to track prices</p>
            <Link to="/"><Button className="gap-2"><ArrowLeft className="h-4 w-4" /> Search Products</Button></Link>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => {
              const priceDiff = item.price && item.targetPrice ? item.price - item.targetPrice : 0;
              return (
                <Card key={item._id}>
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="h-14 w-14 rounded-lg bg-muted flex items-center justify-center overflow-hidden shrink-0">
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt={item.title} className="h-full w-full object-contain p-1" onError={(e) => {e.target.src = '/placeholder.svg';}} />
                      ) : (
                        <span className="text-2xl">📦</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{item.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">{item.store}</Badge>
                        {item.price && <span className="text-sm font-bold text-primary">₹{item.price}</span>}
                        {priceDiff > 0 && (
                          <span className="text-xs text-destructive flex items-center gap-0.5">
                            <TrendingUp className="h-3 w-3" /> +₹{priceDiff.toFixed(0)}
                          </span>
                        )}
                        {priceDiff < 0 && (
                          <span className="text-xs text-primary flex items-center gap-0.5">
                            <TrendingDown className="h-3 w-3" /> ₹{Math.abs(priceDiff).toFixed(0)} saved
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Watching since {new Date(item.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="ghost" className="h-8 w-8" asChild>
                        <a href={item.url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => remove(item._id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Watchlist;