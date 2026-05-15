import { useState, useEffect } from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button }     from '@/components/ui/button';
import { useAuth }    from '@/hooks/useAuth';
import { toast }      from 'sonner';
import { useNavigate } from 'react-router-dom';

const API_URL = '/api';

// Stable productId from the product — use the product's own `id` field
// (which is unique per scrape result) rather than the full URL
function getProductId(product) {
  return product.id || product.url || '';
}

function getToken() {
  return localStorage.getItem('token') || '';
}

const WatchButton = ({ product, size = 'sm' }) => {
  const { user }   = useAuth();
  const navigate   = useNavigate();
  const [watching, setWatching]  = useState(false);
  const [loading,  setLoading]   = useState(false);
  const [checked,  setChecked]   = useState(false);

  const productId = getProductId(product);

  // Check on mount if this product is already watched
  useEffect(() => {
    if (!user || !productId || checked) return;
    const token = getToken();
    if (!token) return;

    fetch(`${API_URL}/watchlist/check/${encodeURIComponent(productId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => {
        setWatching(!!data.inWatchlist);
        setChecked(true);
      })
      .catch(() => setChecked(true));
  }, [user, productId, checked]);

  const handleClick = async () => {
    if (!user) {
      toast.error('Please sign in to watch prices');
      navigate('/login');
      return;
    }

    const token = getToken();
    if (!token) {
      toast.error('Session expired. Please log in again.');
      navigate('/login');
      return;
    }

    if (!product.price) {
      toast.error('Cannot watch a product without a price');
      return;
    }

    if (watching) {
      toast.info('Already watching this product');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/watchlist`, {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization:  `Bearer ${token}`,
        },
        body: JSON.stringify({
          productId,
          title:    product.name,
          price:    product.price,
          imageUrl: product.image || '',
          store:    product.store || '',
          url:      product.url  || '',
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        // 409 = already in watchlist (not an error)
        if (res.status === 409) {
          setWatching(true);
          toast.info('Already in your watchlist');
          return;
        }
        throw new Error(data.message || 'Failed to add to watchlist');
      }

      setWatching(true);
      toast.success(`Watching "${product.name.substring(0, 40)}…" — you'll be notified of price changes`);

    } catch (err) {
      console.error('[WatchButton]', err);
      toast.error(err.message || 'Failed to add to watchlist');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      size={size}
      variant={watching ? 'default' : 'outline'}
      className={`gap-1 transition-colors ${watching ? 'bg-primary text-primary-foreground' : ''}`}
      onClick={handleClick}
      title={watching ? 'Watching — click again to see watchlist' : 'Watch for price drops'}
      disabled={loading}
    >
      {loading ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : watching ? (
        <Eye className="h-3 w-3" />
      ) : (
        <EyeOff className="h-3 w-3" />
      )}
    </Button>
  );
};

export default WatchButton;
