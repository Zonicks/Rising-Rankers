import type { ReactNode } from "react";

export function Bone({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-lg bg-[var(--bg-high)] ${className}`} />;
}

export function BoneSoft({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-lg bg-[var(--bg-low)] ${className}`} />;
}

export function BoneOnNavy({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-lg bg-white/15 ${className}`} />;
}

export function SkeletonRegion({ children }: { children: ReactNode }) {
  return (
    <div role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading</span>
      {children}
    </div>
  );
}

export function SkeletonHero({ className = "" }: { className?: string }) {
  return (
    <div
      className={`hero-progress p-8 ${className}`}
      aria-hidden
    >
      <BoneOnNavy className="h-2.5 w-24 rounded-full" />
      <BoneOnNavy className="mt-4 h-8 w-3/4 max-w-xs" />
      <div className="mt-6 flex items-end justify-between gap-4">
        <BoneOnNavy className="h-10 w-24" />
        <BoneOnNavy className="h-4 w-28" />
      </div>
      <BoneOnNavy className="mt-3 h-3 w-full rounded-full" />
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div className="card flex items-start gap-4 p-5" aria-hidden>
      <BoneSoft className="h-12 w-12 shrink-0 rounded-2xl" />
      <div className="min-w-0 flex-1 space-y-2">
        <BoneSoft className="h-3 w-16 rounded-full" />
        <Bone className="h-5 w-2/3" />
        <BoneSoft className="h-3 w-1/2" />
      </div>
    </div>
  );
}

export function SkeletonFace({ className = "" }: { className?: string }) {
  return (
    <div className={`lift-face p-6 sm:p-8 ${className}`} aria-hidden>
      <Bone className="h-6 w-5/6" />
      <Bone className="mt-3 h-6 w-2/3" />
      <BoneSoft className="mt-3 h-4 w-1/2" />
    </div>
  );
}

export function SkeletonTiles({ n = 2 }: { n?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4" aria-hidden>
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="focus-tile min-h-[8.5rem] pointer-events-none">
          <BoneSoft className="h-12 w-12 rounded-xl" />
          <div className="mt-auto space-y-2">
            <Bone className="h-5 w-28" />
            <BoneSoft className="h-3 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonLedger({ n = 4 }: { n?: number }) {
  return (
    <ul className="card divide-y divide-[var(--line)]" aria-hidden>
      {Array.from({ length: n }).map((_, i) => (
        <li key={i} className="flex items-baseline justify-between gap-4 px-5 py-3.5">
          <div className="space-y-2">
            <BoneSoft className="h-3 w-24 rounded-full" />
            <BoneSoft className="h-2.5 w-16" />
          </div>
          <Bone className="h-5 w-14" />
        </li>
      ))}
    </ul>
  );
}

export function PageSkeleton({
  hero = true,
  rows = 3,
  tiles = 0,
}: {
  hero?: boolean;
  rows?: number;
  tiles?: number;
}) {
  return (
    <SkeletonRegion>
      <div className="space-y-6">
        {hero ? <SkeletonHero /> : null}
        {tiles > 0 ? <SkeletonTiles n={tiles} /> : null}
        <div className="space-y-3">
          {Array.from({ length: rows }).map((_, i) => (
            <SkeletonRow key={i} />
          ))}
        </div>
      </div>
    </SkeletonRegion>
  );
}

export function SkeletonList({ n = 3 }: { n?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: n }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  );
}

export function HomeSkeleton() {
  return (
    <SkeletonRegion>
      <SkeletonHero />
      <Bone className="mt-8 h-14 w-full rounded-[24px]" />
      <div className="mt-10">
        <div className="mb-5 flex items-center justify-between">
          <Bone className="h-6 w-32" />
          <BoneSoft className="h-4 w-24" />
        </div>
        <div className="grid grid-cols-2 gap-4" aria-hidden>
          <div className="hero-progress col-span-2 min-h-[6.5rem] p-6">
            <div className="flex items-center gap-5">
              <BoneOnNavy className="h-14 w-14 rounded-2xl" />
              <div className="space-y-2">
                <BoneOnNavy className="h-2.5 w-12 rounded-full" />
                <BoneOnNavy className="h-5 w-32" />
                <BoneOnNavy className="h-3 w-40" />
              </div>
            </div>
          </div>
          {[0, 1].map((i) => (
            <div key={i} className="focus-tile min-h-[8.5rem] pointer-events-none">
              <BoneSoft className="h-12 w-12 rounded-xl" />
              <div className="mt-auto space-y-2">
                <Bone className="h-5 w-28" />
                <BoneSoft className="h-3 w-20" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="card mt-8 flex items-center justify-between p-5" aria-hidden>
        <div className="space-y-2">
          <BoneSoft className="h-2.5 w-16 rounded-full" />
          <Bone className="h-5 w-28" />
          <BoneSoft className="h-3 w-48" />
        </div>
        <BoneSoft className="h-5 w-5 rounded-full" />
      </div>
      <div className="mt-10 space-y-3">
        <Bone className="mb-5 h-6 w-40" />
        <SkeletonList n={3} />
      </div>
    </SkeletonRegion>
  );
}

export function StudySkeleton() {
  return (
    <SkeletonRegion>
      <SkeletonHero />
      <div className="hero-progress relative mt-8 p-6 sm:p-7" aria-hidden>
        <BoneOnNavy className="h-2.5 w-28 rounded-full" />
        <BoneOnNavy className="mt-3 h-7 w-3/4" />
        <BoneOnNavy className="mt-2 h-4 w-1/2" />
        <div className="mt-5 flex gap-2">
          <BoneOnNavy className="h-12 flex-1 rounded-2xl" />
          <BoneOnNavy className="h-12 flex-1 rounded-2xl" />
        </div>
      </div>
      <div className="mt-10 grid gap-5 md:grid-cols-2" aria-hidden>
        {[0, 1].map((i) => (
          <div key={i} className="card p-6">
            <div className="mb-4 flex items-start justify-between">
              <BoneSoft className="h-12 w-12 rounded-2xl" />
              <Bone className="h-6 w-16 rounded-lg" />
            </div>
            <BoneSoft className="h-2.5 w-16 rounded-full" />
            <Bone className="mt-2 h-6 w-40" />
            <BoneSoft className="mt-3 h-4 w-full" />
            <BoneSoft className="mt-2 h-4 w-2/3" />
            <BoneSoft className="mt-6 h-1.5 w-full rounded-full" />
            <Bone className="mt-4 h-11 w-full rounded-2xl" />
          </div>
        ))}
      </div>
    </SkeletonRegion>
  );
}

export function TestsSkeleton() {
  return (
    <SkeletonRegion>
      <BoneSoft className="h-12 w-full rounded-2xl" />
      <div className="hero-progress relative mt-8 min-h-[16rem] p-8" aria-hidden>
        <BoneOnNavy className="h-6 w-16 rounded-full" />
        <BoneOnNavy className="mt-4 h-9 w-3/4 max-w-xs" />
        <BoneOnNavy className="mt-3 h-4 w-40" />
        <BoneOnNavy className="mt-6 h-12 w-32 rounded-xl" />
      </div>
      <div className="mt-8 space-y-3">
        <SkeletonList n={3} />
      </div>
    </SkeletonRegion>
  );
}

export function FlashcardsSkeleton() {
  return (
    <SkeletonRegion>
      <div className="mb-8">
        <div className="mb-2 flex items-end justify-between">
          <BoneSoft className="h-3 w-20 rounded-full" />
          <Bone className="h-5 w-12" />
        </div>
        <BoneSoft className="h-1.5 w-full rounded-full" />
      </div>
      <div className="mx-auto w-full max-w-lg">
        <div className="lift-face flex min-h-[22rem] flex-col items-center justify-center px-8 py-8" aria-hidden>
          <BoneSoft className="h-6 w-20 rounded-full" />
          <Bone className="mt-10 h-8 w-4/5" />
          <Bone className="mt-3 h-8 w-3/5" />
          <BoneSoft className="mt-3 h-4 w-1/3" />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3" aria-hidden>
          <BoneSoft className="h-[4.5rem] rounded-2xl" />
          <BoneSoft className="h-[4.5rem] rounded-2xl" />
        </div>
      </div>
    </SkeletonRegion>
  );
}

export function McqSkeleton() {
  return (
    <SkeletonRegion>
      <div className="lift-face p-6 sm:p-8">
        <Bone className="h-6 w-full" />
        <Bone className="mt-3 h-6 w-4/5" />
        <Bone className="mt-3 h-6 w-2/3" />
        <div className="mt-5 space-y-2" aria-hidden>
          {["w-full", "w-11/12", "w-full", "w-4/5"].map((w, i) => (
            <div key={i} className="option-btn pointer-events-none">
              <BoneSoft className="h-5 w-5 shrink-0 rounded-md" />
              <Bone className={`h-4 ${w}`} />
            </div>
          ))}
        </div>
      </div>
    </SkeletonRegion>
  );
}

export function NewsSkeleton() {
  return (
    <SkeletonRegion>
      <div className="overflow-hidden rounded-[3rem] bg-gradient-to-br from-[#050B18] via-[#0C1B3D] to-[#1E4FC4] p-6 shadow-[var(--shadow-lift)]" aria-hidden>
        <BoneOnNavy className="h-6 w-24 rounded-full" />
        <BoneOnNavy className="mt-6 h-8 w-5/6" />
        <BoneOnNavy className="mt-3 h-8 w-3/5" />
        <BoneOnNavy className="mt-4 h-4 w-full" />
        <BoneOnNavy className="mt-2 h-4 w-4/5" />
        <BoneOnNavy className="mt-6 h-12 w-full rounded-2xl" />
      </div>
      <div className="mt-12 space-y-10">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col gap-6 sm:flex-row" aria-hidden>
            <div className="flex-1 space-y-3">
              <BoneSoft className="h-3 w-24 rounded-full" />
              <Bone className="h-6 w-5/6" />
              <BoneSoft className="h-4 w-full" />
              <BoneSoft className="h-4 w-2/3" />
            </div>
            <BoneSoft className="h-32 w-full shrink-0 rounded-2xl sm:w-32" />
          </div>
        ))}
      </div>
    </SkeletonRegion>
  );
}

export function ArticleSkeleton() {
  return (
    <SkeletonRegion>
      <div className="mt-6 space-y-4">
        <div className="flex items-center gap-3" aria-hidden>
          <BoneSoft className="h-6 w-16 rounded-md" />
          <BoneSoft className="h-3 w-20" />
        </div>
        <Bone className="h-9 w-full" />
        <Bone className="h-9 w-4/5" />
        <BoneSoft className="mt-2 h-52 w-full rounded-[1.5rem]" />
        <div className="mt-4 space-y-3" aria-hidden>
          <BoneSoft className="h-4 w-full" />
          <BoneSoft className="h-4 w-full" />
          <BoneSoft className="h-4 w-5/6" />
          <BoneSoft className="h-4 w-3/4" />
        </div>
      </div>
    </SkeletonRegion>
  );
}

export function WalletSkeleton() {
  return (
    <SkeletonRegion>
      <div className="hero-wallet p-7" aria-hidden>
        <div className="flex items-center justify-between">
          <BoneOnNavy className="h-2.5 w-16 rounded-full" />
          <BoneOnNavy className="h-6 w-24 rounded-full" />
        </div>
        <BoneOnNavy className="mt-4 h-12 w-40" />
        <div className="mt-8 grid grid-cols-2 gap-4 border-t border-white/15 pt-5">
          <div className="space-y-2">
            <BoneOnNavy className="h-3 w-16" />
            <BoneOnNavy className="h-6 w-20" />
          </div>
          <div className="space-y-2">
            <BoneOnNavy className="h-3 w-12" />
            <BoneOnNavy className="h-6 w-20" />
          </div>
        </div>
      </div>
      <div className="mt-6">
        <SkeletonTiles n={2} />
      </div>
      <BoneSoft className="mt-10 h-3 w-16 rounded-full" />
      <div className="mt-3">
        <SkeletonLedger n={4} />
      </div>
    </SkeletonRegion>
  );
}

export function LeaderboardSkeleton() {
  return (
    <SkeletonRegion>
      <SkeletonHero className="min-h-[13rem]" />
      <div className="mt-10">
        <Bone className="mb-5 h-6 w-36" />
        <div className="flex gap-4 overflow-hidden" aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex h-44 w-32 shrink-0 flex-col items-center justify-center rounded-[2rem] bg-white p-4 shadow-[var(--shadow-card)]"
            >
              <BoneSoft className="h-16 w-16 rounded-full" />
              <BoneSoft className="mt-4 h-2.5 w-12 rounded-full" />
              <Bone className="mt-2 h-3 w-16" />
            </div>
          ))}
        </div>
      </div>
      <div className="mt-8 space-y-3">
        <div className="mb-6 flex items-center justify-between">
          <Bone className="h-7 w-40" />
          <BoneSoft className="h-10 w-36 rounded-2xl" />
        </div>
        <SkeletonList n={5} />
      </div>
    </SkeletonRegion>
  );
}

export function SupportSkeleton() {
  return (
    <SkeletonRegion>
      <div className="card space-y-4 rounded-3xl p-6" aria-hidden>
        <BoneSoft className="h-3 w-20 rounded-full" />
        <Bone className="h-12 w-full rounded-2xl" />
        <Bone className="h-12 w-full rounded-2xl" />
        <BoneSoft className="h-28 w-full rounded-2xl" />
        <Bone className="h-12 w-full rounded-2xl" />
      </div>
      <BoneSoft className="mt-10 h-3 w-24 rounded-full" />
      <div className="mt-4 space-y-3">
        <SkeletonRow />
        <SkeletonRow />
      </div>
    </SkeletonRegion>
  );
}

export function SearchSkeleton() {
  return (
    <SkeletonRegion>
      <SkeletonHero className="min-h-[14rem]" />
      <div className="mt-8">
        <SkeletonList n={3} />
      </div>
    </SkeletonRegion>
  );
}

export function ProfileSkeleton() {
  return (
    <SkeletonRegion>
      <div className="space-y-6">
        <SkeletonHero className="h-[220px] min-h-[220px]" />
        <div className="h-[120px] rounded-3xl bg-white" aria-hidden>
          <div className="flex h-full items-center gap-4 p-5">
            <BoneSoft className="h-12 w-12 rounded-2xl" />
            <div className="flex-1 space-y-2">
              <Bone className="h-5 w-1/2" />
              <BoneSoft className="h-3 w-2/3" />
            </div>
          </div>
        </div>
        <div className="h-40 rounded-3xl bg-white p-5" aria-hidden>
          <Bone className="h-5 w-40" />
          <BoneSoft className="mt-4 h-3 w-full" />
          <BoneSoft className="mt-2 h-3 w-4/5" />
          <Bone className="mt-6 h-11 w-full rounded-2xl" />
        </div>
      </div>
    </SkeletonRegion>
  );
}

export function TestJoinSkeleton() {
  return (
    <SkeletonRegion>
      <div className="card mt-6 p-6 text-center sm:p-8" aria-hidden>
        <BoneSoft className="mx-auto h-3 w-28 rounded-full" />
        <Bone className="mx-auto mt-4 h-7 w-2/3" />
        <Bone className="mx-auto mt-6 h-14 w-32" />
        <BoneSoft className="mx-auto mt-4 h-4 w-48" />
      </div>
    </SkeletonRegion>
  );
}

export function UnlockSheetSkeleton() {
  return (
    <SkeletonRegion>
      <div className="mt-3 space-y-3" aria-hidden>
        <Bone className="h-7 w-3/4" />
        <BoneSoft className="h-4 w-1/2" />
        <div className="flex gap-2">
          <BoneSoft className="h-6 w-28 rounded-full" />
          <Bone className="h-6 w-14 rounded-full" />
        </div>
        <BoneSoft className="mt-2 h-4 w-40" />
      </div>
    </SkeletonRegion>
  );
}

export function StreakSheetSkeleton() {
  return (
    <SkeletonRegion>
      <div className="mt-5 grid grid-cols-7 gap-2" aria-hidden>
        {Array.from({ length: 7 }).map((_, i) => (
          <BoneSoft key={i} className="h-9 rounded-xl" />
        ))}
      </div>
    </SkeletonRegion>
  );
}
