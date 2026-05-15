import { useState, useCallback, createContext, useContext } from 'react';
import { getCart, addToCart, removeFromCart, updateQuantity, clearCart, getCartTotal } from '@/lib/cart';

import { toast } from 'sonner';



const CartContext = createContext(undefined);

export const CartProvider = ({ children }) => {
  const [items, setItems] = useState(getCart);

  const add = useCallback((product) => {
    const updated = addToCart(product);
    setItems([...updated]);
    toast.success(`${product.name} added to cart`);
  }, []);

  const remove = useCallback((id) => {
    const updated = removeFromCart(id);
    setItems([...updated]);
    toast.info('Item removed from cart');
  }, []);

  const update = useCallback((id, qty) => {
    const updated = updateQuantity(id, qty);
    setItems([...updated]);
  }, []);

  const clear = useCallback(() => {
    const updated = clearCart();
    setItems(updated);
    toast.info('Cart cleared');
  }, []);

  return (
    <CartContext.Provider value={{ items, total: getCartTotal(items), count: items.length, add, remove, update, clear }}>
      {children}
    </CartContext.Provider>);

};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within CartProvider');
  return context;
};