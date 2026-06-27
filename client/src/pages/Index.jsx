import React, { useState } from "react";

import { useNavigate } from "react-router-dom";
import { Search, ArrowRight, TrendingUp, ShieldCheck, Zap, Clock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CATEGORIES, SUGGESTED_PRODUCTS, STORES } from "@/lib/stores";
import Navbar from "@/components/Navbar";

const Index = () => {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  // Recent searches — stored in localStorage, max 6
  const [recent, setRecent] = useState(() => {
    try { return JSON.parse(localStorage.getItem("fb_recent") || "[]"); } catch { return []; }
  });

  const saveRecent = (term) => {
    const updated = [term, ...recent.filter(r => r !== term)].slice(0, 6);
    setRecent(updated);
    localStorage.setItem("fb_recent", JSON.stringify(updated));
  };

  const clearRecent = () => {
    setRecent([]);
    localStorage.removeItem("fb_recent");
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (query.trim()) {
      saveRecent(query.trim());
      navigate(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  const handleQuickSearch = (term) => {
    saveRecent(term);
    navigate(`/search?q=${encodeURIComponent(term)}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero */}
      <section className="relative overflow-hidden py-16 md:py-28">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-transparent to-accent/8" />
        <div className="absolute top-20 left-10 w-72 h-72 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute bottom-10 right-10 w-96 h-96 rounded-full bg-accent/5 blur-3xl" />
        <div className="container relative mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border bg-card px-4 py-1.5 text-xs font-medium mb-6 shadow-sm">
            <Zap className="h-3 w-3 text-accent" />
            <span>Live prices from 6 Indian grocery stores</span>
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight mb-4 leading-tight">
            Compare Grocery Prices
            <br />
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Save Money Instantly
            </span>
          </h1>
          <p className="text-base md:text-lg text-muted-foreground mb-8 max-w-2xl mx-auto leading-relaxed">
            Search any product and get real-time prices from BigBasket, Blinkit,
            Zepto, Swiggy Instamart, Flipkart, and Amazon Fresh — all in one
            place.
          </p>

          <form onSubmit={handleSearch} className="max-w-xl mx-auto flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder='Try "Cadbury Dairy Milk" or "Amul Butter"...'
                className="w-full rounded-2xl border-2 bg-card px-12 py-4 text-base outline-none ring-ring focus:ring-2 focus:border-primary shadow-lg transition-all"
              />
            </div>
            <Button
              type="submit"
              size="lg"
              className="rounded-2xl px-6 gap-2 shadow-lg"
            >
              Search <ArrowRight className="h-4 w-4" />
            </Button>
          </form>

          {/* Recent searches */}
          {recent.length > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" /> Recent:
              </span>
              {recent.map((r, i) => (
                <button
                  key={i}
                  onClick={() => handleQuickSearch(r)}
                  className="rounded-full bg-card border px-3 py-1 text-xs hover:bg-primary/5 transition-colors"
                >
                  {r}
                </button>
              ))}
              <button onClick={clearRecent} className="text-xs text-muted-foreground hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Store logos */}
      <section className="py-8 border-y bg-card/30">
        <div className="container mx-auto px-4">
          <p className="text-center text-xs text-muted-foreground mb-4 uppercase tracking-widest font-medium">
            Comparing prices from
          </p>
          <div className="flex items-center justify-center gap-6 md:gap-10 flex-wrap">
            {STORES.map((store) => (
              <div
                key={store.id}
                className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground"
              >
                <span className="text-lg">{store.logo}</span>
                <span className="hidden sm:inline">{store.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-6">
            <div className="rounded-2xl border bg-card p-6 text-center">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <Search className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-bold mb-1">Real-Time Scraping</h3>
              <p className="text-sm text-muted-foreground">
                Live prices scraped directly from store websites — no fake or
                cached data.
              </p>
            </div>
            <div className="rounded-2xl border bg-card p-6 text-center">
              <div className="h-12 w-12 rounded-xl bg-accent/10 flex items-center justify-center mx-auto mb-3">
                <TrendingUp className="h-6 w-6 text-accent" />
              </div>
              <h3 className="font-bold mb-1">Price Drop Alerts</h3>
              <p className="text-sm text-muted-foreground">
                Watch any product and get notified instantly when the price
                drops.
              </p>
            </div>
            <div className="rounded-2xl border bg-card p-6 text-center">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <ShieldCheck className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-bold mb-1">Direct Store Links</h3>
              <p className="text-sm text-muted-foreground">
                Buy directly from the cheapest store — we redirect you to the
                real product page.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="py-12 bg-card/50">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold mb-6">Browse Categories</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => handleQuickSearch(cat.query)}
                className="flex flex-col items-center gap-2 rounded-2xl border-2 border-transparent bg-card p-5 transition-all hover:border-primary hover:shadow-lg hover:-translate-y-0.5"
              >
                <span className="text-3xl">{cat.emoji}</span>
                <span className="font-medium text-sm">{cat.name}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Popular Searches */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold mb-6">Popular Searches</h2>
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_PRODUCTS.map((p) => (
              <button
                key={p.name}
                onClick={() => handleQuickSearch(p.name)}
                className="rounded-full border bg-card px-4 py-2 text-sm transition-all hover:border-primary hover:bg-primary/5 hover:shadow-sm"
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p className="font-medium">FairBuy</p>
          <p className="mt-1">
            Compare grocery prices across India's top platforms. Real prices,
            real savings.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
