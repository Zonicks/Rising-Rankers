"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, tokenKey } from "@/lib/api";

type BookDetail = {
  id: string;
  title: string;
  authorName: string;
  program: string;
  inProgram: boolean;
  price: number;
  granted: boolean;
  cta: "study" | "add" | "unlock";
};

type Wallet = { deposited: string; promo: string; award: string };

function spendable(w: Wallet) {
  return Number(w.deposited) + Number(w.promo);
}

export function UnlockBookSheet({
  bookId,
  onClose,
  onUnlocked,
}: {
  bookId: string;
  onClose: () => void;
  onUnlocked: (bookId: string) => void;
}) {
  const [book, setBook] = useState<BookDetail | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [insufficient, setInsufficient] = useState(false);

  function load() {
    const token = localStorage.getItem(tokenKey);
    if (!token) return;
    setError(null);
    setErrorCode(null);
    Promise.all([
      api<BookDetail>(`/api/v1/catalog/books/${bookId}`, { token }),
      api<Wallet>("/api/v1/wallet", { token }),
    ])
      .then(([b, w]) => {
        setBook(b);
        setWallet(w);
      })
      .catch((e) => {
        const err = e as Error & { code?: string };
        setError(err.message || "Could not load");
        setErrorCode(err.code ?? null);
      });
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId]);

  async function pay() {
    const token = localStorage.getItem(tokenKey);
    if (!token || !book) return;
    setBusy(true);
    setError(null);
    setInsufficient(false);
    try {
      await api(`/api/v1/catalog/books/${book.id}/unlock`, { method: "POST", token });
      onUnlocked(book.id);
    } catch (e) {
      const err = e as Error & { code?: string };
      if (err.code === "WALLET_INSUFFICIENT") {
        setInsufficient(true);
        setError(err.message);
      } else {
        setError(err.message || "Could not add this book");
      }
    } finally {
      setBusy(false);
    }
  }

  const price = book?.price ?? 0;
  const alreadyFree = book?.granted || price === 0;
  const balance = wallet ? spendable(wallet) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="card w-full max-w-md p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
          {alreadyFree ? "Add to study set" : "Confirm add-on"}
        </p>
        {book ? (
          <>
            <h2 className="mt-2 text-xl font-bold">{book.title}</h2>
            <p className="mt-1 text-sm text-[var(--ink-soft)]">{book.authorName}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="chip">
                {book.inProgram ? "In your syllabus" : `${book.program} add-on`}
              </span>
              <span className={`text-sm font-bold ${alreadyFree ? "text-[var(--success)]" : ""}`}>
                {alreadyFree ? "FREE" : `₹${price}`}
              </span>
            </div>
            {wallet ? (
              <p className="mt-4 text-sm text-[var(--ink-soft)]">
                Wallet spendable <strong>₹{balance}</strong>
                {price > 0 ? " · deposited first, then promo." : ""}
              </p>
            ) : (
              <p className="mt-4 text-sm text-[var(--muted)]">Loading wallet…</p>
            )}
          </>
        ) : (
          <p className="mt-3 text-sm text-[var(--muted)]">Loading…</p>
        )}

        {error ? <p className="msg-err mt-4">{error}</p> : null}
        {!book && error ? (
          <button type="button" className="btn-secondary mt-3 text-sm" onClick={load}>
            Try again
          </button>
        ) : null}
        {errorCode === "CURRICULUM_REQUIRED" ? (
          <Link href="/app/curriculum" className="mt-3 inline-block text-sm font-semibold text-[var(--accent)]">
            Finish curriculum setup
          </Link>
        ) : null}
        {insufficient ? (
          <Link href="/app/wallet" className="mt-3 inline-block text-sm font-semibold text-[var(--accent)]">
            Add money in Wallet
          </Link>
        ) : null}

        <div className="mt-6 flex gap-3">
          <button type="button" className="btn-secondary flex-1" onClick={onClose}>
            Cancel
          </button>
          {insufficient ? (
            <Link href="/app/wallet" className="btn-primary flex-1 text-center">
              Open wallet
            </Link>
          ) : (
            <button type="button" disabled={busy || !book} className="btn-primary flex-1" onClick={pay}>
              {busy ? "Adding…" : alreadyFree ? "Add to study set" : `Pay ₹${price} & add`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
