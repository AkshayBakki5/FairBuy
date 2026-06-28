
// Must match storeId values returned by the backend scraper
export const STORES = [
  { id: 'amazon',    name: 'Amazon Fresh',     logo: '🟤', color: 'hsl(35, 100%, 50%)',  searchUrl: q => `https://www.amazon.in/s?k=${encodeURIComponent(q)}&i=nowstore` },
  { id: 'flipkart',  name: 'Flipkart Grocery', logo: '🔵', color: 'hsl(210, 80%, 50%)', searchUrl: q => `https://www.flipkart.com/search?q=${encodeURIComponent(q)}&marketplace=GROCERY` },
  { id: 'bigbasket', name: 'BigBasket',         logo: '🟢', color: 'hsl(145, 63%, 42%)', searchUrl: q => `https://www.bigbasket.com/ps/?q=${encodeURIComponent(q)}` },
  { id: 'blinkit',   name: 'Blinkit',           logo: '🟡', color: 'hsl(50, 90%, 50%)',  searchUrl: q => `https://blinkit.com/s/?q=${encodeURIComponent(q)}` },
  { id: 'zepto',     name: 'Zepto',             logo: '🟣', color: 'hsl(270, 70%, 55%)', searchUrl: q => `https://www.zeptonow.com/search?query=${encodeURIComponent(q)}` },
  { id: 'instamart', name: 'Swiggy Instamart',  logo: '🟠', color: 'hsl(25, 95%, 55%)',  searchUrl: q => `https://www.swiggy.com/instamart/search?query=${encodeURIComponent(q)}` },
];


export const SUGGESTED_PRODUCTS = [
  { name: 'Fortune Sunflower Oil 1L', category: 'Cooking Oil' },
  { name: 'Amul Butter 500g', category: 'Dairy' },
  { name: 'Tata Salt 1kg', category: 'Essentials' },
  { name: 'Maggi 2-Minute Noodles', category: 'Instant Food' },
  { name: 'Cadbury Dairy Milk Silk', category: 'Chocolate' },
  { name: 'Aashirvaad Atta 5kg', category: 'Flour' },
  { name: 'Parle-G Biscuits', category: 'Snacks' },
  { name: 'Surf Excel Detergent', category: 'Cleaning' }];


export const CATEGORIES = [
  { id: 'essentials', name: 'Essentials', emoji: '🧂', query: 'grocery essentials salt sugar' },
  { id: 'dairy', name: 'Dairy', emoji: '🥛', query: 'milk butter cheese curd' },
  { id: 'snacks', name: 'Snacks', emoji: '🍪', query: 'biscuits chips namkeen snacks' },
  { id: 'beverages', name: 'Beverages', emoji: '🥤', query: 'tea coffee juice cold drink' },
  { id: 'chocolate', name: 'Chocolate', emoji: '🍫', query: 'chocolate candy sweets' },
  { id: 'cooking', name: 'Cooking Oil', emoji: '🫒', query: 'cooking oil sunflower mustard' }];