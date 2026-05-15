// ─────────────────────────────────────────────────────────────────────────────
// client-side API wrapper
// ─────────────────────────────────────────────────────────────────────────────

export const searchProducts = async (query) => {
  try {
    const response = await fetch('/api/search', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ query }),
    });

    if (!response.ok) {
      let errMessage = `Server error ${response.status}`;
      try {
        const errorData = await response.json();
        errMessage = errorData.error || errMessage;
      } catch {
        errMessage = await response.text();
      }
      return { success: false, products: [], meta: null, error: errMessage };
    }

    const data = await response.json();
    // data = { success, products, meta: { query, total, enabledStores, cheapestPrice, cheapestStore } }
    return data;

  } catch (err) {
    console.error('Search error:', err);
    return {
      success:  false,
      products: [],
      meta:     null,
      error:    'Cannot reach the server. Is the backend running on port 3000?',
    };
  }
};

// Fetch which platforms are currently enabled (from platforms.config.js)
export const fetchEnabledPlatforms = async () => {
  try {
    const res  = await fetch('/api/platforms');
    const data = await res.json();
    return data.platforms ?? {};
  } catch {
    return {};
  }
};
