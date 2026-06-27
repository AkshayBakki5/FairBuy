// Loading skeleton shown while SSE results arrive
const ProductCardSkeleton = () => (
  <div className="rounded-xl border bg-card overflow-hidden animate-pulse">
    <div className="h-1 w-full bg-muted" />
    <div className="aspect-square bg-muted/60" />
    <div className="p-3 space-y-2">
      <div className="h-3 w-16 rounded bg-muted" />
      <div className="h-4 w-full rounded bg-muted" />
      <div className="h-3 w-3/4 rounded bg-muted" />
      <div className="h-6 w-1/2 rounded bg-muted mt-2" />
      <div className="flex gap-1.5 mt-1">
        <div className="h-7 flex-1 rounded bg-muted" />
        <div className="h-7 w-7 rounded bg-muted" />
        <div className="h-7 w-7 rounded bg-muted" />
      </div>
    </div>
  </div>
);

export default ProductCardSkeleton;
