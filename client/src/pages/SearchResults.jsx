import { useEffect, useState, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Search, SlidersHorizontal, Loader2, AlertTriangle,
  RefreshCw, Lightbulb, TrendingDown, Star, ArrowUpDown
} from 'lucide-react';
import { Button }   from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue
} from '@/components/ui/select';
import Navbar       from '@/components/Navbar';
import ProductCard  from '@/components/ProductCard';
import { searchProducts } from '@/lib/api/firecrawl';
import { STORES }   from '@/lib/stores';
import { toast }    from 'sonner';

// ── Search suggestions ────────────────────────────────────────────────────────
const SUGGESTIONS = {
  // Chocolates & Snacks
  'dairy milk':       'Cadbury Dairy Milk chocolate 40g',
  'dairy milk silk':  'Cadbury Dairy Milk Silk chocolate',
  'kitkat':           'KitKat chocolate wafer 38g',
  '5 star':           'Cadbury 5 Star chocolate 40g',
  'oreo':             'Oreo cookies cream biscuits 120g',
  'parle g':          'Parle-G biscuits 799g family pack',
  'good day':         'Britannia Good Day cashew cookies',
  'hide & seek':      'Parle Hide & Seek chocolate chips biscuits',
  'maggi':            'Maggi 2 Minute Noodles 70g',
  'yippee':           'Sunfeast Yippee noodles 70g',
  'lays':             'Lays chips potato crisps 52g',
  'kurkure':          'Kurkure Masala Munch 90g',
  'haldirams':        "Haldiram's Aloo Bhujia 400g",
  'bikaji':           'Bikaji Aloo Bhujia 200g',
  'act ii':           'Act II popcorn butter 30g',

  // Beverages
  'coke':             'Coca Cola cold drink 2L',
  'pepsi':            'Pepsi cold drink 2 litre',
  'sprite':           'Sprite lemon drink 2L',
  'thums up':         'Thums Up 2L',
  'frooti':           'Frooti mango drink 1L',
  'maaza':            'Maaza mango drink 1.2L',
  'real juice':       'Real fruit juice mixed fruit 1L',
  'tropicana':        'Tropicana orange juice 1L',
  'red bull':         'Red Bull energy drink 250ml',
  'boost':            'Boost health drink 500g',
  'horlicks':         'Horlicks health drink 500g',
  'bournvita':        'Cadbury Bournvita 1kg',
  'nescafe':          'Nescafe Classic coffee 100g',
  'bru':              'Bru Gold coffee 100g',
  'tata tea':         'Tata Tea Premium 500g',
  'red label':        'Brooke Bond Red Label tea 500g',

  // Dairy & Grocery
  'amul':             'Amul butter 500g',
  'amul milk':        'Amul Taaza toned milk 1L',
  'mother dairy':     'Mother Dairy toned milk 1L',
  'paneer':           'Amul paneer 200g',
  'dahi':             'Nestle Dahi curd 400g',
  'cheese':           'Amul processed cheese slices 200g',
  'ghee':             'Amul pure ghee 500g',
  'eggs':             'Farm fresh eggs 6 pieces',
  'bread':            'Britannia whole wheat bread 400g',
  'tata salt':        'Tata Salt 1kg iodised',
  'fortune salt':     'Fortune Saathi iodised salt 1kg',
  'sugar':            'Sugar refined 1kg',
  'atta':             'Aashirvaad atta wheat flour 5kg',
  'maida':            'Annapurna maida 1kg',
  'besan':            'Rajdhani besan gram flour 500g',
  'rice':             'India Gate basmati rice 5kg',
  'poha':             'Double Horse poha 500g',
  'oats':             'Quaker oats 1kg',
  'cornflakes':       'Kelloggs cornflakes 875g',
  'muesli':           'Soulfull muesli 400g',
  'dal':              'Toor dal 1kg yellow pigeon peas',
  'chana':            'Kabuli chana chickpeas 500g',
  'moong dal':        'Moong dal split 500g',
  'rajma':            'Rajma red kidney beans 500g',

  // Oils & Condiments
  'sunflower oil':    'Fortune sunflower oil 1 litre',
  'olive oil':        'Borges olive oil extra virgin 500ml',
  'mustard oil':      'Patanjali mustard oil 1L',
  'soya sauce':       'Maggi soya sauce 200g',
  'tomato ketchup':   'Kissan tomato ketchup 500g',
  'maggi masala':     'Maggi masala noodles masala 100g',
  'vinegar':          'Remia white vinegar 500ml',
  'mayonnaise':       'Dr. Oetker Funfoods mayonnaise 300g',
  'peanut butter':    'Sundrop peanut butter 462g',

  // Personal Care
  'dove':             'Dove soap 100g pack of 3',
  'lifebuoy':         'Lifebuoy total soap 100g',
  'dettol':           'Dettol soap 100g',
  'lux':              'Lux beauty soap 100g',
  'pears':            'Pears transparent soap 75g',
  'head shoulders':   'Head & Shoulders shampoo 340ml',
  'pantene':          'Pantene shampoo 340ml',
  'clinic plus':      'Clinic Plus shampoo 175ml',
  'sunsilk':          'Sunsilk shampoo 340ml',
  'colgate':          'Colgate strong teeth toothpaste 300g',
  'pepsodent':        'Pepsodent toothpaste 300g',
  'closeup':          'Closeup red hot toothpaste 200g',
  'sensodyne':        'Sensodyne rapid relief toothpaste 70g',
  'himalaya':         'Himalaya face wash 150ml',
  'cetaphil':         'Cetaphil face wash 250ml',
  'nivea':            'Nivea moisturizing cream 200ml',
  'vaseline':         'Vaseline body lotion 400ml',
  'ponds':            "Pond's cream moisturizing 100g",
  'lakme':            'Lakme sunscreen SPF 50 50ml',
  'gillette':         'Gillette mach3 razor blades 8 count',
  'veet':             'Veet hair removal cream 100g',

  // Home & Cleaning
  'surf excel':       'Surf Excel detergent powder 1kg',
  'ariel':            'Ariel detergent powder 1kg',
  'tide':             'Tide plus detergent powder 1kg',
  'vim':              'Vim dishwash liquid 500ml',
  'harpic':           'Harpic toilet cleaner 500ml',
  'lizol':            'Lizol floor cleaner 500ml',
  'colin':            'Colin glass cleaner 500ml',
  'odonil':           'Odonil room freshener 50g',
  'good knight':      'Good Knight fast card mosquito repellent',
  'hit':              'HIT mosquito spray 200ml',
  'mortein':          'Mortein mosquito coil',
  'scotch brite':     'Scotch-Brite scrub pad',
  'tissue':           'Kleenex facial tissue 100 sheets',

  // Baby & Health
  'pampers':          'Pampers diapers medium size 76 count',
  'huggies':          'Huggies diapers medium 76 count',
  'cerelac':          'Nestle Cerelac wheat 300g',
  'dettol liquid':    'Dettol antiseptic liquid 500ml',
  'bandaid':          'Band-Aid plasters flexible 40 strips',
  'volini':           'Volini pain relief gel 50g',
  'vicks':            'Vicks VapoRub 25g',
  'dabur':            'Dabur honey 500g',
  'patanjali':        'Patanjali aloe vera gel 150ml',

  // Pet Food
  'whiskas':          'Whiskas cat food adult 1.2kg',
  'pedigree':         'Pedigree dog food adult chicken 1.2kg',
  'drools':           'Drools adult dog food chicken 3kg',

  // Electronics & Accessories
  'earphones':        'boAt BassHeads 100 in-ear wired earphones',
  'charger':          'Mi 33W fast charger Type-C',
  'power bank':       'Mi power bank 3i 10000mAh',
  'usb cable':        'Anker USB-C to USB-C cable 1m',
  'mouse':            'Logitech M235 wireless mouse',
  'keyboard':         'Logitech MK215 wireless keyboard mouse combo',
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

function SimpleLoader({ query }) {
  return (
    <div className="flex flex-col items-center py-20 gap-3">
      <p className="text-base font-semibold text-foreground">
        Searching for "{query}"…
      </p>
      <p className="text-sm text-muted-foreground">
        Checking Amazon, Flipkart, Blinkit, Zepto, Instamart, BigBasket, Myntra, Ajio
      </p>
    </div>
  );
}

// ── Sort options ──────────────────────────────────────────────────────────────
const SORT_OPTIONS = [
  { value: 'price-asc',    label: 'Price: Low → High',    icon: TrendingDown },
  { value: 'price-desc',   label: 'Price: High → Low',    icon: ArrowUpDown  },
  { value: 'rating',       label: 'Highest rating',        icon: Star         },
  { value: 'grouped',      label: 'Group similar products', icon: SlidersHorizontal },
  { value: 'name',         label: 'Name A → Z',            icon: ArrowUpDown  },
];

// ── Helper: no-op kept for possible future use ─────────────────────────────

// ── Main page ─────────────────────────────────────────────────────────────────
const SearchResults = () => {
  const [searchParams]  = useSearchParams();
  const navigate        = useNavigate();
  const query           = searchParams.get('q') || '';

  const [products,    setProducts]    = useState([]);
  const [meta,        setMeta]        = useState(null);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState(null);
  const [searchTime,  setSearchTime]  = useState(null);
  const [sortBy,      setSortBy]      = useState('price-asc');
  const [filterStore, setFilterStore] = useState('all');
  const [searchInput, setSearchInput] = useState(query);

  useEffect(() => {
    if (query) { setSearchInput(query); doSearch(query); }
  }, [query]);

  const doSearch = async (q) => {
    setLoading(true); setProducts([]); setMeta(null); setError(null);
    const t0 = Date.now();
    const result = await searchProducts(q);
    setSearchTime(((Date.now() - t0) / 1000).toFixed(1));
    setLoading(false);
    if (result.success) {
      setProducts(result.products ?? []);
      setMeta(result.meta ?? null);
      if (!result.products?.length) toast.info('No products found. Try the suggestions below.');
    } else {
      setError(result.error || 'Search failed');
      toast.error(result.error || 'Search failed');
    }
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

  // Per-store counts
  const storeCounts = useMemo(() =>
    Object.fromEntries(STORES.map(s => [s.id, products.filter(p => p.storeId === s.id).length])),
    [products]
  );

  // Summary stats
  const cheapest     = products.filter(p => p.price).sort((a,b) => a.price - b.price)[0];
  const topRated     = products.filter(p => p.rating).sort((a,b) => b.rating - a.rating)[0];

  const suggestions = useMemo(() => getSuggestions(query), [query]);

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
              placeholder="Search across all enabled stores…"
              autoFocus
            />
          </div>
          <Button type="submit" className="rounded-xl" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
          </Button>
        </form>

        {/* Summary cards */}
        {!loading && products.length > 0 && (
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
              <p className="text-2xl font-bold text-blue-500">{searchTime}s</p>
              <p className="text-xs text-muted-foreground mt-0.5">Search time</p>
            </div>
          </div>
        )}

        {/* Sort + filter bar */}
        <div className="flex flex-wrap items-center gap-3 mb-4 p-3 rounded-xl bg-card border">
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-sm font-medium shrink-0">Sort & filter:</span>

          {/* Sort selector */}
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[200px] rounded-lg">
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

          {/* Store filter */}
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
            {filtered.length} result{filtered.length !== 1 ? 's' : ''} for{' '}
            <span className="font-medium">"{meta?.cleaned ?? query}"</span>
          </div>
        </div>

        {/* Store filter pills */}
        {!loading && products.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-5">
            {STORES.map(store => {
              const count  = storeCounts[store.id] ?? 0;
              const active = filterStore === store.id;
              return (
                <button
                  key={store.id}
                  onClick={() => setFilterStore(active ? 'all' : (count > 0 ? store.id : 'all'))}
                  className={`rounded-full px-3 py-1 text-xs font-medium border transition-all ${
                    active    ? 'bg-primary text-primary-foreground border-primary' :
                    count > 0 ? 'bg-card hover:bg-primary/5 border-border' :
                                'bg-muted/40 text-muted-foreground border-transparent opacity-40 cursor-default'
                  }`}
                >
                  {store.logo} {store.name} ({count})
                </button>
              );
            })}
          </div>
        )}

        {/* Results */}
        {loading ? (
          <SimpleLoader query={query} />

        ) : filtered.length > 0 ? (
          sortBy === 'grouped' ? (
            // ── Grouped view: each product cluster shown as a labelled section ──
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

        ) : query ? (
          <div className="flex flex-col items-center py-16 gap-6 max-w-lg mx-auto text-center">
            <span className="text-6xl">🔍</span>
            <div>
              <p className="text-lg font-semibold">No products found for "{query}"</p>
              <p className="text-sm text-muted-foreground mt-1">
                Searched {meta?.enabledStores?.join(', ') || 'all enabled stores'} — no results.
              </p>
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
