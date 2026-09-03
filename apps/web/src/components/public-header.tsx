import Link from "next/link";
import { BrandMark } from "./brand";

export function PublicHeader({ homeHref = "/" }: { homeHref?: string }) {
  return (
    <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
      <Link href={homeHref} className="flex items-center gap-2.5">
        <BrandMark size={36} />
        <span className="text-[15px] font-semibold leading-tight tracking-tight text-[var(--accent)] sm:text-lg">
          Rising Rankers
        </span>
      </Link>
      <div className="flex items-center gap-4 text-sm">
        <Link href="/legal" className="text-[var(--ink-soft)] hover:text-[var(--accent)]">
          Policies
        </Link>
        <Link href="/auth" className="btn-primary h-10 px-4 text-sm">
          Sign in
        </Link>
      </div>
    </header>
  );
}
