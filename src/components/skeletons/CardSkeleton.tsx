export function CardSkeleton() {
  return (
    <div className="animate-pulse bg-dark-800 rounded-lg p-4 border border-dark-700">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-lg bg-dark-700" />
        <div className="flex-1">
          <div className="h-4 bg-dark-700 rounded w-3/4 mb-2" />
          <div className="h-3 bg-dark-700 rounded w-1/2" />
        </div>
      </div>
      <div className="space-y-2">
        <div className="h-3 bg-dark-700 rounded" />
        <div className="h-3 bg-dark-700 rounded w-5/6" />
      </div>
    </div>
  );
}

export function StatsCardSkeleton() {
  return (
    <div className="animate-pulse bg-dark-800 rounded-lg p-6 border border-dark-700">
      <div className="flex items-center justify-between">
        <div className="w-12 h-12 rounded-lg bg-dark-700" />
        <div className="h-8 w-16 bg-dark-700 rounded" />
      </div>
      <div className="mt-4 h-4 bg-dark-700 rounded w-1/2" />
      <div className="mt-2 h-3 bg-dark-700 rounded w-1/3" />
    </div>
  );
}
