import type { CSSProperties, ReactNode } from "react";

export function Bone({ className = "", style }: { className?: string; style?: CSSProperties }) {
  return <div aria-hidden style={style} className={`animate-pulse rounded-md bg-[var(--line)] ${className}`} />;
}

export function SkeletonRegion({ children }: { children: ReactNode }) {
  return (
    <div role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading</span>
      {children}
    </div>
  );
}

export function SkeletonStatGrid({ n = 4 }: { n?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-hidden>
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="panel mt-0">
          <Bone className="h-3 w-20" />
          <Bone className="mt-3 h-9 w-16" />
          <Bone className="mt-2 h-3 w-28" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonTable({
  cols = 5,
  rows = 8,
  compact = false,
}: {
  cols?: number;
  rows?: number;
  compact?: boolean;
}) {
  return (
    <div aria-hidden>
      <div
        className="mb-3 hidden gap-4 sm:grid"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: cols }).map((_, i) => (
          <Bone key={i} className="h-2.5 w-16" />
        ))}
      </div>
      <div className="row-list">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${compact ? "py-3" : "py-4"}`}
          >
            <div className="min-w-0 flex-1 space-y-2">
              <Bone className={`h-4 ${compact ? "w-3/5 max-w-[16rem]" : "w-2/5 max-w-[12rem]"}`} />
              <Bone className={`h-3 ${compact ? "w-2/5 max-w-[10rem]" : "w-3/5 max-w-[18rem]"}`} />
            </div>
            {compact ? null : <Bone className="h-8 w-16 rounded-2xl" />}
          </div>
        ))}
      </div>
    </div>
  );
}

const TREE_INDENTS = [0, 1, 1, 2, 2, 1, 2, 3, 0, 1];

export function SkeletonTree({ rows = 10 }: { rows?: number }) {
  return (
    <div className="space-y-2.5" aria-hidden>
      {Array.from({ length: rows }).map((_, i) => {
        const depth = TREE_INDENTS[i % TREE_INDENTS.length] ?? 0;
        return (
          <Bone
            key={i}
            className="h-4"
            style={{ width: `${70 - depth * 10}%`, marginLeft: `${depth * 12}px` }}
          />
        );
      })}
    </div>
  );
}

export function SkeletonForm({ fields = 6 }: { fields?: number }) {
  return (
    <div className="max-w-md space-y-4" aria-hidden>
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i}>
          <Bone className="mb-2 h-3 w-28" />
          <Bone className="h-11 w-full rounded-2xl" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonUserDetail() {
  return (
    <div className="space-y-6">
      <div className="panel mt-0" aria-hidden>
        <Bone className="h-3 w-16" />
        <Bone className="mt-3 h-8 w-48" />
        <Bone className="mt-2 h-3 w-64" />
        <div className="mt-4 flex flex-wrap gap-2">
          <Bone className="h-8 w-24 rounded-2xl" />
          <Bone className="h-8 w-20 rounded-2xl" />
          <Bone className="h-8 w-28 rounded-2xl" />
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-2" aria-hidden>
        {[0, 1].map((i) => (
          <div key={i} className="panel mt-0 space-y-3">
            <Bone className="h-3 w-20" />
            {Array.from({ length: 5 }).map((_, j) => (
              <div key={j} className="flex justify-between gap-4">
                <Bone className="h-3 w-24" />
                <Bone className="h-3 w-32" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
