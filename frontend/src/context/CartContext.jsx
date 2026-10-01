import { createContext, useContext, useMemo, useState, useCallback } from 'react';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [items, setItems] = useState([]);

  const addItem = useCallback((ref, qty = 1, productName) => {
    if (!qty || qty <= 0) return;
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.code === ref.code);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + qty };
        return next;
      }
      return [
        ...prev,
        {
          code: ref.code,
          ref_pro: ref.ref_pro,
          diameter: ref.diameter,
          price_cdf: Number(ref.display_price_cdf) || 0,
          price_usd: Number(ref.display_price_usd) || 0,
          price_eur_ht: Number(ref.display_price_ht) || 0,
          price_source: ref.price_source,
          offer_label: ref.offer_label,
          variant_label: ref.variant_label,
          qty,
          productName,
        },
      ];
    });
  }, []);

  const setQty = useCallback((code, qty) => {
    setItems((prev) =>
      prev
        .map((i) => (i.code === code ? { ...i, qty } : i))
        .filter((i) => i.qty > 0)
    );
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const value = useMemo(() => {
    const count = items.reduce((s, i) => s + i.qty, 0);
    const total_cdf = items.reduce((s, i) => s + i.qty * i.price_cdf, 0);
    const total_eur = items.reduce((s, i) => s + i.qty * i.price_eur_ht, 0);
    const total_usd = items.reduce((s, i) => s + i.qty * i.price_usd, 0);
    return {
      items,
      addItem,
      setQty,
      clear,
      count,
      total_cdf,
      total_eur,
      total_usd,
      /** @deprecated utilisez total_cdf */
      total: total_cdf,
    };
  }, [items, addItem, setQty, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart outside provider');
  return ctx;
}
