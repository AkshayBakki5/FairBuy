
const CART_KEY = 'fairbuy_cart';

export const getCart = () => {
  try {
    const raw = localStorage.getItem(CART_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const addToCart = (product) => {
  const cart = getCart();
  const existing = cart.find((item) => item.id === product.id);
  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({ ...product, quantity: 1 });
  }
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  return cart;
};

export const removeFromCart = (productId) => {
  const cart = getCart().filter((item) => item.id !== productId);
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  return cart;
};

export const updateQuantity = (productId, quantity) => {
  const cart = getCart();
  const item = cart.find((i) => i.id === productId);
  if (item) {
    item.quantity = Math.max(1, quantity);
  }
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  return cart;
};

export const clearCart = () => {
  localStorage.removeItem(CART_KEY);
  return [];
};

export const getCartTotal = (cart) => {
  return cart.reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0);
};