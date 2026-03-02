interface TableSkeletonProps {
  rows?: number;
  columns?: number;
}

export function TableSkeleton({ rows = 5, columns = 4 }: TableSkeletonProps) {
  return (
    <div className="animate-pulse">
      <div className="h-10 bg-dark-800 rounded-t-lg border border-dark-700 border-b-0 flex gap-4 px-4 items-center">
        {Array.from({ length: columns }).map((_, i) => (
          <div
            key={`header-${i}`}
            className="h-4 bg-dark-700 rounded"
            style={{ width: `${100 / columns}%` }}
          />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-14 bg-dark-800 border border-dark-700 border-t-0 flex gap-4 px-4 items-center"
        >
          {Array.from({ length: columns }).map((_, j) => (
            <div
              key={`cell-${i}-${j}`}
              className="h-4 bg-dark-700 rounded"
              style={{ width: `${100 / columns}%` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
