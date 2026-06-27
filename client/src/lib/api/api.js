// client/src/lib/api/api.js
// All HTTP calls to the backend live here.

// ── Blocking search (kept as fallback) ───────────────────────────────────────
export const searchProducts = async (query) => {
  try {
    const response = await fetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    if (!response.ok) {
      let msg = `Server error ${response.status}`;
      try { msg = (await response.json()).error || msg; } catch { msg = await response.text(); }
      return { success: false, products: [], meta: null, error: msg };
    }
    return await response.json();
  } catch (err) {
    console.error('Search error:', err);
    return { success: false, products: [], meta: null, error: 'Cannot reach server.' };
  }
};

// ── SSE streaming search ──────────────────────────────────────────────────────
// Calls onStore(storePayload) each time a store finishes.
// Calls onDone(finalPayload)  when all stores are done.
// Calls onError(message)      on fatal error.
// Returns a cleanup function — call it to abort early.
export function searchProductsSSE(query, { onStore, onDone, onError }) {
  const url = `/api/search/stream?q=${encodeURIComponent(query)}`;
  const es = new EventSource(url);

  es.addEventListener('store', (e) => {
    try { onStore?.(JSON.parse(e.data)); } catch { /* ignore parse errors */ }
  });

  es.addEventListener('done', (e) => {
    es.close();
    try { onDone?.(JSON.parse(e.data)); } catch { /* ignore */ }
  });

  es.addEventListener('error', (e) => {
    es.close();
    let msg = 'Search failed';
    try { msg = JSON.parse(e.data)?.message || msg; } catch { /* ignore */ }
    onError?.(msg);
  });

  // native onerror = network/connection failure
  es.onerror = () => {
    es.close();
    onError?.('Connection to server lost');
  };

  return () => es.close();
}

// ── Platform list ─────────────────────────────────────────────────────────────
export const fetchEnabledPlatforms = async () => {
  try {
    const res = await fetch('/api/platforms');
    return (await res.json()).platforms ?? {};
  } catch {
    return {};
  }
};
