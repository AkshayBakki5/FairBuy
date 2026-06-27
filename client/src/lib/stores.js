
export const STORES = [
  {
    id: 'bigbasket',
    name: 'BigBasket',
    logo: '🟢',
    baseUrl: 'https://www.bigbasket.com',
    searchUrl: (q) => `https://www.bigbasket.com/ps/?q=${encodeURIComponent(q)}`,
    color: 'hsl(145, 63%, 42%)'
  },
  {
    id: 'blinkit',
    name: 'Blinkit',
    logo: '🟡',
    baseUrl: 'https://blinkit.com',
    searchUrl: (q) => `https://blinkit.com/s/?q=${encodeURIComponent(q)}`,
    color: 'hsl(50, 90%, 50%)'
  },
  {
    id: 'zepto',
    name: 'Zepto',
    logo: '🟣',
    baseUrl: 'https://www.zeptonow.com',
    searchUrl: (q) => `https://www.zeptonow.com/search?query=${encodeURIComponent(q)}`,
    color: 'hsl(270, 70%, 55%)'
  },
  {
    id: 'instamart',
    name: 'Swiggy Instamart',
    logo: '🟠',
    baseUrl: 'https://www.swiggy.com/instamart',
    searchUrl: (q) => `https://www.swiggy.com/instamart/search?custom_back=true&query=${encodeURIComponent(q)}`,
    color: 'hsl(25, 95%, 55%)'
  },
  {
    id: 'flipkart',
    name: 'Flipkart Grocery',
    logo: '🔵',
    baseUrl: 'https://www.flipkart.com/grocery-supermart-store',
    searchUrl: (q) => `https://www.flipkart.com/search?q=${encodeURIComponent(q)}&marketplace=GROCERY`,
    color: 'hsl(210, 80%, 50%)'
  },
  {
    id: 'amazon',
    name: 'Amazon Fresh',
    logo: '🟤',
    baseUrl: 'https://www.amazon.in/fresh',
    searchUrl: (q) => `https://www.amazon.in/s?k=${encodeURIComponent(q)}&i=nowstore`,
    color: 'hsl(35, 100%, 50%)'
  }];


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