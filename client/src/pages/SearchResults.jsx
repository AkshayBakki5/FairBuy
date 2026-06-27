import { useEffect, useState, useMemo, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Search, SlidersHorizontal, Loader2, AlertTriangle,
  RefreshCw, Lightbulb, TrendingDown, Star, ArrowUpDown, CheckCircle2
} from 'lucide-react';
import { Button }   from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue
} from '@/components/ui/select';
import Navbar       from '@/components/Navbar';
import ProductCard  from '@/components/ProductCard';
import ProductCardSkeleton from '@/components/ProductCardSkeleton';
import { searchProductsSSE } from '@/lib/api/api';
import { STORES }   from '@/lib/stores';
import { toast }    from 'sonner';

// ── Search suggestions ────────────────────────────────────────────────────────
const SUGGESTIONS = {
  'dairy milk':       'Cadbury Dairy Milk chocolate 40g',
  'dairy milk silk':  'Cadbury Dairy Milk Silk chocolate',
  'kitkat':           'KitKat chocolate wafer 38g',
  '5 star':           'Cadbury 5 Star chocolate 40g',
  'oreo':             'Oreo cookies cream biscuits 120g',
  'parle g':          'Parle-G biscuits 799g family pack',
  'good day':         'Britannia Good Day cashew cookies',
  'maggi':            'Maggi 2 Minute Noodles 70g',
  'lays':             'Lays chips potato crisps 52g',
  'kurkure':          'Kurkure Masala Munch 90g',
  'coke':             'Coca Cola cold drink 2L',
  'pepsi':            'Pepsi cold drink 2 litre',
  'amul':             'Amul butter 500g',
  'amul milk':        'Amul Taaza toned milk 1L',
  'mother dairy':     'Mother Dairy toned milk 1L',
  'paneer':           'Amul paneer 200g',
  'ghee':             'Amul pure ghee 500g',
  'bread':            'Britannia whole wheat bread 400g',
  'tata salt':        'Tata Salt 1kg iodised',
  'atta':             'Aashirvaad atta wheat flour 5kg',
  'rice':             'India Gate basmati rice 5kg',
  'dal':              'Toor dal 1kg yellow pigeon peas',
  'sunflower oil':    'Fortune sunflower oil 1 litre',
  'surf excel':       'Surf Excel detergent powder 1kg',
  'dove':             'Dove soap 100g pack of 3',
  'dettol':           'Dettol soap 100g',
  'head shoulders':   'Head & Shoulders shampoo 340ml',
  'colgate':          'Colgate strong teeth toothpaste 300g',
  'pampers':          'Pampers diapers medium size 76 count',
  'pedigree':         'Pedigree dog food adult chicken 1.2kg',
};

function getSuggestions(query) {
  const q = query.toLowerCase();
  const tips = [];
  for (const [key, sug] of Object.entries(SUGGESTIONS)) {
    if (q.includes(key)) { tips.push(sug); break; }
  }
  if (q.split(' ').length === 1)
    tips.push(`Try adding a brand: "${query} amul" or "${query} tata"`);
  if (tips.length < 2)
    tips.push('Include brand + quantity for best results e.g. "Amul butter 500g"');
  return tips.slice(0, 3);
}

// ── Sort options ──────────────────────────────────────────────────────────────
const SORT_OPTIONS = [
  { value: 'price-asc',   label: 'Price: Low → High',     icon: TrendingDown },
  { value: 'price-desc',  label: 'Price: High → Low',     icon: ArrowUpDown  },
  { value: 'unit-asc',    label: 'Unit price: Low → High', icon: TrendingDown },
  { value: 'rating',      label: 'Highest rating',          icon: Star         },
  { value: 'grouped',     label: 'Group similar products',  icon: SlidersHorizontal },
  { value: 'name',        label: 'Name A → Z',              icon: ArrowUpDown  },
];

// ── Per-store streaming status bar ────────────────────────────────────────────
const STORE_ORDER = ['amazon','flipkart','bigbasket','blinkit','zepto','instamart','myntra','ajio'];

function StreamStatus({ storeStatus, done }) {
  return (
    <div className="flex flex-wrap gap-2 mb-5 p-3 rounded-xl bg-card border">
      <span className="text-xs font-medium text-muted-foreground self-center mr-1">
        {done ? 'All stores checked' : 'Searching…'}
      </span>
      {STORE_ORDER.map(id => {
        const s = STORES.find(st => st.id === id);
        if (!s) return null;
        const status = storeStatus[id];
        return (
          <span
            key={id}
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium border transition-all ${
              status === 'done'    ? 'bg-green-50 border-green-200 text-green-700 dark:bg-green-950 dark:border-green-800 dark:text-green-400' :
              status === 'loading' ? 'bg-primary/5 border-primary/30 text-primary animate-pulse' :
                                     'bg-muted/40 border-transparent text-muted-foreground opacity-40'
            }`}
          >
            {s.logo}
            {s.name.split(' ')[0]}
            {status === 'done'    && <CheckCircle2 className="h-3 w-3" />}
            {status === 'loading' && <Loader2 className="h-3 w-3 animate-spin" />}
          </span>
        );
      })}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
const SearchResults = () => {
  const [searchParams]  = useSearchParams();
  const navigate        = useNavigate();
  const query           = searchParams.get('q') || '';

  const [products,     setProducts]     = useState([]);
  const [storeStatus,  setStoreStatus]  = useState({});   // id → 'loading'|'done'
  const [loading,      setLoading]      = useState(false);
  const [streamDone,   setStreamDone]   = useState(false);
  const [error,        setError]        = useState(null);
  const [searchTime,   setSearchTime]   = useState(null);
  const [sortBy,       setSortBy]       = useState('price-asc');
  const [filterStore,  setFilterStore]  = useState('all');
  const [searchInput,  setSearchInput]  = useState(query);
  const cleanupRef = useRef(null);
  const t0Ref      = useRef(null);

  useEffect(() => {
    if (query) { setSearchInput(query); doSearch(query); }
    return () => cleanupRef.current?.();
  }, [query]);

  const doSearch = (q) => {
    // Cancel any previous SSE connection
    cleanupRef.current?.();

    setLoading(true);
    setStreamDone(false);
    setProducts([]);
    setStoreStatus({});
    setError(null);
    setSearchTime(null);
    t0Ref.current = Date.now();

    // Mark all enabled stores as loading
    setStoreStatus(Object.fromEntries(STORE_ORDER.map(id => [id, 'loading'])));

    cleanupRef.current = searchProductsSSE(q, {
      onStore: (payload) => {
        // Mark this store as done
        setStoreStatus(prev => ({ ...prev, [payload.storeId]: 'done' }));

        if (!payload.products?.length) return;

        // Merge products in, sorted by price
        setProducts(prev => {
          const merged = [...prev, ...payload.products];
          return merged;
        });
      },

      onDone: (payload) => {
        setLoading(false);
        setStreamDone(true);
        setSearchTime(((Date.now() - t0Ref.current) / 1000).toFixed(1));
        // Mark any stores that never sent results as done (they returned 0 products)
        setStoreStatus(prev =>
          Object.fromEntries(Object.entries(prev).map(([id, s]) => [id, s === 'loading' ? 'done' : s]))
        );
        // Replace with the server's fully grouped list
        if (payload.products?.length) {
          setProducts(payload.products);
        } else {
          toast.info('No products found. Try the suggestions below.');
        }
      },

      onError: (msg) => {
        setLoading(false);
        setStreamDone(true);
        setError(msg);
        toast.error(msg);
      },
    });
  };

  const handleSearch = e => {
    e.preventDefault();
    const t = searchInput.trim();
    if (t) navigate(`/search?q=${encodeURIComponent(t)}`);
  };

  const handleSuggestion = s => navigate(`/search?q=${encodeURIComponent(s)}`);

  // ── Sorted + filtered list ──────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = products.filter(p =>
      filterStore === 'all' || p.storeId === filterStore
    );
    switch (sortBy) {
      case 'price-asc':
        list = [...list].sort((a, b) => (a.price ?? 999999) - (b.price ?? 999999));
        break;
      case 'price-desc':
        list = [...list].sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
        break;
      case 'unit-asc':
        list = [...list].sort((a, b) => {
          if (a.unitPrice == null && b.unitPrice == null) return 0;
          if (a.unitPrice == null) return 1;
          if (b.unitPrice == null) return -1;
          return a.unitPrice - b.unitPrice;
        });
        break;
      case 'rating':
        list = [...list].sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1));
        break;
      case 'grouped':
        list = [...list].sort((a, b) => {
          if (a.groupId !== b.groupId) return (a.groupId ?? 0) - (b.groupId ?? 0);
          return (a.price ?? 999999) - (b.price ?? 999999);
        });
        break;
      case 'name':
        list = [...list].sort((a, b) => a.name.localeCompare(b.name));
        break;
    }
    return list;
  }, [products, filterStore, sortBy]);

  const storeCounts = useMemo(() =>
    Object.fromEntries(STORES.map(s => [s.id, products.filter(p => p.storeId === s.id).length])),
    [products]
  );

  const cheapest = products.filter(p => p.price).sort((a,b) => a.price - b.price)[0];
  const topRated = products.filter(p => p.rating).sort((a,b) => b.rating - a.rating)[0];
  const suggestions = useMemo(() => getSuggestions(query), [query]);
  const hasProducts = products.length > 0;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-6 max-w-7xl">

        {/* Search bar */}
        <form onSubmit={handleSearch} className="flex gap-2 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              className="w-full rounded-xl border bg-card px-10 py-2.5 outline-none ring-ring focus:ring-2 transition-shadow"
              placeholder="Search across all stores…"
              autoFocus
            />
          </div>
          <Button type="submit" className="rounded-xl" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
          </Button>
        </form>

        {/* Streaming status — shown during and after search */}
        {(loading || streamDone) && query && (
          <StreamStatus storeStatus={storeStatus} done={streamDone} />
        )}

        {/* Summary cards — update live as stores arrive */}
        {hasProducts && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            <div className="rounded-xl border bg-card p-3 text-center">
              <p className="text-2xl font-bold text-primary">{products.length}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Products found</p>
            </div>
            <div className="rounded-xl border bg-card p-3 text-center">
              <p className="text-xl font-bold text-green-500 truncate">
                {cheapest ? `₹${cheapest.price.toLocaleString('en-IN')}` : '—'}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {cheapest ? `Lowest · ${cheapest.store}` : 'Lowest price'}
              </p>
            </div>
            <div className="rounded-xl border bg-card p-3 text-center">
              {topRated ? (
                <>
                  <p className="text-2xl font-bold text-amber-500">{topRated.rating.toFixed(1)}★</p>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">Top rated · {topRated.store}</p>
                </>
              ) : (
                <>
                  <p className="text-2xl font-bold">—</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Top rated</p>
                </>
              )}
            </div>
            <div className="rounded-xl border bg-card p-3 text-center">
              <p className="text-2xl font-bold text-blue-500">
                {searchTime ? `${searchTime}s` : <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Search time</p>
            </div>
          </div>
        )}

        {/* Sort + filter bar */}
        {hasProducts && (
          <div className="flex flex-wrap items-center gap-3 mb-4 p-3 rounded-xl bg-card border">
            <SlidersHorizontal className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-sm font-medium shrink-0">Sort & filter:</span>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[210px] rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map(o => {
                  const Icon = o.icon;
                  return (
                    <SelectItem key={o.value} value={o.value}>
                      <span className="flex items-center gap-2">
                        <Icon className="h-3.5 w-3.5 opacity-60" />
                        {o.label}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>

            <Select value={filterStore} onValueChange={setFilterStore}>
              <SelectTrigger className="w-[180px] rounded-lg">
                <SelectValue placeholder="All stores" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All stores ({products.length})</SelectItem>
                {STORES.map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.logo} {s.name} ({storeCounts[s.id] ?? 0})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="ml-auto text-xs text-muted-foreground">
              {filtered.length} result{filtered.length !== 1 ? 's' : ''}
            </div>
          </div>
        )}

        {/* Store filter pills */}
        {hasProducts && (
          <div className="flex flex-wrap gap-2 mb-5">
            {STORES.map(store => {
              const count  = storeCounts[store.id] ?? 0;
              const active = filterStore === store.id;
              const isStillLoading = storeStatus[store.id] === 'loading';
              return (
                <button
                  key={store.id}
                  onClick={() => setFilterStore(active ? 'all' : (count > 0 ? store.id : 'all'))}
                  className={`rounded-full px-3 py-1 text-xs font-medium border transition-all flex items-center gap-1 ${
                    active          ? 'bg-primary text-primary-foreground border-primary' :
                    count > 0       ? 'bg-card hover:bg-primary/5 border-border' :
                    isStillLoading  ? 'bg-muted/40 border-border text-muted-foreground animate-pulse' :
                                      'bg-muted/40 text-muted-foreground border-transparent opacity-40 cursor-default'
                  }`}
                >
                  {store.logo} {store.name} ({count})
                  {isStillLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                </button>
              );
            })}
          </div>
        )}

        {/* Results */}
        {filtered.length > 0 ? (
          sortBy === 'grouped' ? (
            (() => {
              const byGroup = [];
              const seen = new Map();
              for (const p of filtered) {
                const gid = p.groupId ?? 0;
                if (!seen.has(gid)) { seen.set(gid, byGroup.length); byGroup.push({ gid, items: [] }); }
                byGroup[seen.get(gid)].items.push(p);
              }
              return (
                <div className="flex flex-col gap-8">
                  {byGroup.map(({ gid, items }) => (
                    <div key={gid}>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-sm font-semibold text-foreground">
                          {items[0].name.length > 60 ? items[0].name.slice(0, 60) + '…' : items[0].name}
                        </span>
                        <span className="text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">
                          {items.length} store{items.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {items.map(p => <ProductCard key={p.id} product={p} />)}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {filtered.map(p => <ProductCard key={p.id} product={p} />)}
            </div>
          )

        ) : products.length > 0 ? (
          <div className="flex flex-col items-center py-16 gap-4">
            <AlertTriangle className="h-10 w-10 text-accent" />
            <p className="font-medium">No results for this filter</p>
            <Button variant="outline" onClick={() => setFilterStore('all')}>Show all stores</Button>
          </div>

        ) : error ? (
          <div className="flex flex-col items-center py-16 gap-4 max-w-md mx-auto text-center">
            <AlertTriangle className="h-10 w-10 text-destructive" />
            <p className="font-medium text-destructive">Search failed</p>
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button onClick={() => doSearch(query)} className="gap-2">
              <RefreshCw className="h-4 w-4" /> Try again
            </Button>
          </div>

        ) : loading && products.length === 0 ? (
          /* Skeleton grid while awaiting first results */
          <div>
            <p className="text-sm text-muted-foreground mb-4 text-center">
              Results appear as each store responds…
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {Array.from({ length: 10 }).map((_, i) => <ProductCardSkeleton key={i} />)}
            </div>
          </div>

        ) : query && streamDone ? (
          <div className="flex flex-col items-center py-16 gap-6 max-w-lg mx-auto text-center">
            <span className="text-6xl">🔍</span>
            <div>
              <p className="text-lg font-semibold">No products found for "{query}"</p>
              <p className="text-sm text-muted-foreground mt-1">All stores searched — nothing matched.</p>
            </div>
            <div className="w-full bg-muted/30 rounded-xl p-4 text-left space-y-2">
              <p className="text-xs font-semibold flex items-center gap-1.5 text-muted-foreground uppercase tracking-wide">
                <Lightbulb className="h-3.5 w-3.5" /> Try instead:
              </p>
              {suggestions.map((s, i) => (
                <button key={i} onClick={() => handleSuggestion(s)}
                  className="w-full text-left text-sm text-primary hover:underline block py-0.5">
                  → {s}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default SearchResults;
