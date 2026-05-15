import { Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, Search, LogOut, User, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useCart } from '@/hooks/useCart';
import { Badge } from '@/components/ui/badge';
import NotificationBell from './NotificationBell';
import { useState } from 'react';

const Navbar = () => {
  const { user, signOut } = useAuth();
  const { count } = useCart();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <nav className="sticky top-0 z-50 border-b bg-card/90 backdrop-blur-xl shadow-sm">
      <div className="container mx-auto flex items-center justify-between gap-3 px-4 py-3">
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <span className="text-2xl">🛒</span>
          <span className="text-xl font-bold tracking-tight" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Fair<span className="text-primary">Buy</span>
          </span>
        </Link>

        <form onSubmit={handleSearch} className="hidden sm:flex flex-1 max-w-lg items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search groceries across all stores..."
              className="w-full rounded-xl border bg-background px-10 py-2 text-sm outline-none ring-ring focus:ring-2 transition-shadow" />
            
          </div>
          <Button type="submit" size="sm" className="rounded-xl">Search</Button>
        </form>

        <div className="flex items-center gap-1">
          {user &&
          <Link to="/watchlist">
              <Button variant="ghost" size="icon" title="Price Watchlist">
                <Eye className="h-5 w-5" />
              </Button>
            </Link>
          }
          <NotificationBell />
          <Link to="/cart" className="relative">
            <Button variant="ghost" size="icon">
              <ShoppingCart className="h-5 w-5" />
              {count > 0 &&
              <Badge className="absolute -right-1 -top-1 h-5 w-5 rounded-full p-0 text-[10px] flex items-center justify-center bg-accent text-accent-foreground font-bold">
                  {count}
                </Badge>
              }
            </Button>
          </Link>

          {user ?
          <div className="flex items-center gap-1">
              <span className="hidden lg:block text-xs text-muted-foreground truncate max-w-[100px]">
                {user.email}
              </span>
              <Button variant="ghost" size="icon" onClick={signOut} title="Sign Out">
                <LogOut className="h-4 w-4" />
              </Button>
            </div> :

          <Link to="/login">
              <Button variant="outline" size="sm" className="gap-1 rounded-xl">
                <User className="h-4 w-4" />
                <span className="hidden sm:inline">Sign In</span>
              </Button>
            </Link>
          }
        </div>
      </div>
    </nav>);

};

export default Navbar;