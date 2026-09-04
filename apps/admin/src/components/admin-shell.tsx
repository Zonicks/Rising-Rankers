"use client";

import Link from "next/link";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { adminTokenKey } from "@/lib/api";

const groups = [
  {
    label: "Operate",
    items: [
      { href: "/dashboard", label: "Overview", exact: true, icon: IconGrid },
      { href: "/dashboard/syllabus", label: "Syllabus", icon: IconTree },
      { href: "/dashboard/content", label: "Content", icon: IconBook },
      { href: "/dashboard/news", label: "News", icon: IconNews },
      { href: "/dashboard/achievements", label: "Achievements", icon: IconBadge },
      { href: "/dashboard/tests", label: "Live tests", icon: IconTimer },
      { href: "/dashboard/submissions", label: "Submissions", icon: IconList },
    ],
  },
  {
    label: "Money",
    items: [
      { href: "/dashboard/finance", label: "P&L", icon: IconChart },
      { href: "/dashboard/withdrawals", label: "Withdrawals", icon: IconWallet },
      { href: "/dashboard/credit", label: "Credit", icon: IconPlus },
    ],
  },
  {
    label: "Trust",
    items: [
      { href: "/dashboard/users", label: "Users", icon: IconUsers },
      { href: "/dashboard/support", label: "Support", icon: IconLifeBuoy },
      { href: "/dashboard/fraud", label: "Fraud", icon: IconShield },
      { href: "/dashboard/audit", label: "Audit", icon: IconScroll },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/dashboard/staff", label: "Staff", icon: IconUsers },
      { href: "/dashboard/security", label: "Security", icon: IconShield },
      { href: "/dashboard/settings", label: "Settings", icon: IconSliders },
    ],
  },
];

export function BrandMark({ size = 36 }: { size?: number }) {
  return (
    <img
      src="/brand/logo.png"
      alt="Rising Rankers"
      width={size}
      height={size}
      className="brand-mark"
      style={{ width: size, height: size }}
    />
  );
}

export function AdminShell({
  children,
  title,
  subtitle,
}: {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();

  function signOut() {
    localStorage.removeItem(adminTokenKey);
    router.replace("/signin");
  }

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <div className="min-h-screen md:flex">
      <aside className="bg-[var(--deep)] text-white md:sticky md:top-0 md:flex md:h-screen md:w-64 md:flex-col">
        <div className="flex items-center gap-3 px-5 py-6">
          <BrandMark size={40} />
          <div>
            <p className="text-[15px] font-semibold leading-tight tracking-tight">Rising Rankers</p>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/50">
              Admin
            </p>
          </div>
        </div>
        <nav className="admin-sidebar-nav flex gap-1 overflow-x-auto px-3 pb-4 md:flex-1 md:flex-col md:overflow-y-auto md:overflow-x-hidden md:pb-6">
          {groups.map((group) => (
            <div key={group.label} className="mb-1 md:mb-4">
              <p className="mb-1 hidden px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35 md:block">
                {group.label}
              </p>
              <div className="flex gap-1 md:flex-col">
                {group.items.map((item) => {
                  const active = isActive(item.href, item.exact);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-2.5 whitespace-nowrap rounded-2xl px-3 py-2.5 text-sm transition-colors ${
                        active
                          ? "bg-white/15 font-semibold text-white"
                          : "text-white/65 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      <Icon />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        <div className="border-t border-white/10 p-3">
          <button
            onClick={signOut}
            className="w-full rounded-2xl px-3 py-2.5 text-left text-sm text-white/65 hover:bg-white/10 hover:text-white"
          >
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex-1">
        <header className="px-5 pt-8 pb-2 md:px-10 md:pt-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
            Console
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--ink)] md:text-[2.15rem]">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-2 max-w-xl text-sm text-[var(--ink-soft)]">{subtitle}</p>
          ) : null}
        </header>
        <main className="animate-fade-rise px-5 py-6 md:px-10 md:py-8">{children}</main>
      </div>
    </div>
  );
}

export function PageSection({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="panel mt-6 first:mt-0">
      <div className="mb-4 flex items-end justify-between gap-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function AdminDialog({
  title,
  children,
  onClose,
  wide,
  xl,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
  xl?: boolean;
}) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`w-full overflow-y-auto rounded-[var(--radius-xl)] border border-[var(--line)] bg-[var(--bg-elevated)] p-6 shadow-[var(--shadow-card)] ${
          xl
            ? "max-h-[calc(100vh-2rem)] max-w-6xl"
            : `max-h-[min(44rem,calc(100vh-2rem))] ${wide ? "max-w-3xl" : "max-w-xl"}`
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between gap-3">
          <h2 className="text-xl font-extrabold tracking-tight text-[var(--ink)]">{title}</h2>
          <button type="button" className="btn-secondary btn-sm shrink-0" onClick={onClose}>
            Close
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}

export function StatCard({
  label,
  value,
  hint,
  loading,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  loading?: boolean;
}) {
  return (
    <div className="panel mt-0">
      <p className="text-xs font-medium text-[var(--muted)]">{label}</p>
      {loading ? (
        <div className="mt-3 h-9 w-20 animate-pulse rounded-md bg-[var(--line)]" aria-hidden />
      ) : (
        <p className="metric mt-3 text-3xl font-semibold tracking-tight">{value ?? "—"}</p>
      )}
      {loading ? (
        hint ? <div className="mt-2 h-3 w-28 animate-pulse rounded-md bg-[var(--line)]" aria-hidden /> : null
      ) : hint ? (
        <p className="mt-2 text-xs text-[var(--ink-soft)]">{hint}</p>
      ) : null}
    </div>
  );
}

function IconGrid() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" />
    </svg>
  );
}
function IconBook() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M5 5.5A2.5 2.5 0 0 1 7.5 3H20v16H7.5A2.5 2.5 0 0 0 5 21.5V5.5Z" />
      <path d="M5 5.5A2.5 2.5 0 0 1 7.5 3" />
    </svg>
  );
}
function IconTree() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 4v7M12 11h6v4M12 11H6v4M8 19h8" strokeLinecap="round" />
      <circle cx="12" cy="4" r="1.5" fill="currentColor" />
    </svg>
  );
}
function IconNews() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M5 5h11a2 2 0 0 1 2 2v12H7a2 2 0 0 0-2 2V5Z" />
      <path d="M8 9h7M8 13h5" />
    </svg>
  );
}
function IconBadge() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="10" r="5" />
      <path d="m9 15-1 5 4-2 4 2-1-5" />
    </svg>
  );
}
function IconTimer() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2.5 1.5M9 4h6" />
    </svg>
  );
}
function IconList() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M8 7h12M8 12h12M8 17h12M4 7h.01M4 12h.01M4 17h.01" strokeLinecap="round" />
    </svg>
  );
}
function IconChart() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 19V5M4 19h16" strokeLinecap="round" />
      <path d="M8 15v-4M12 15V8M16 15v-7" strokeLinecap="round" />
    </svg>
  );
}
function IconWallet() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 8h16v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V8Z" />
      <path d="M4 8V6.5A1.5 1.5 0 0 1 5.5 5H16" />
      <circle cx="16.5" cy="13.5" r="1" fill="currentColor" />
    </svg>
  );
}
function IconPlus() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 6v12M6 12h12" strokeLinecap="round" />
    </svg>
  );
}
function IconUsers() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19c.6-2.6 2.8-4 5.5-4s4.9 1.4 5.5 4" />
      <circle cx="17" cy="9" r="2.2" />
      <path d="M16 15c2.2.2 3.8 1.4 4.3 3.4" />
    </svg>
  );
}
function IconLifeBuoy() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3" />
      <path d="m7 7 2.2 2.2M17 7l-2.2 2.2M7 17l2.2-2.2M17 17l-2.2-2.2" />
    </svg>
  );
}
function IconShield() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6l-7-3Z" />
    </svg>
  );
}
function IconScroll() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M7 4h10a2 2 0 0 1 2 2v13H9a2 2 0 0 0-2 2" />
      <path d="M7 4a2 2 0 0 0-2 2v14" />
      <path d="M10 9h6M10 13h6" />
    </svg>
  );
}
function IconSliders() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 8h16M4 16h16" strokeLinecap="round" />
      <circle cx="8" cy="8" r="2" fill="currentColor" />
      <circle cx="16" cy="16" r="2" fill="currentColor" />
    </svg>
  );
}
