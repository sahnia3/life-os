export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4 lg:p-6 animate-pulse">
      <div className="h-6 w-32 rounded bg-muted" />
      <div className="h-20 rounded-xl bg-muted/50" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-44 rounded-xl bg-muted/50" />
        ))}
      </div>
    </div>
  );
}
