"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminShell, PageSection } from "@/components/admin-shell";
import { adminTokenKey, api } from "@/lib/api";

export default function CreditPage() {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [amount, setAmount] = useState(100);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!localStorage.getItem(adminTokenKey)) router.replace("/signin");
  }, [router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const token = localStorage.getItem(adminTokenKey);
    if (!token) return;
    setError(null);
    setMsg(null);
    try {
      const data = await api<Record<string, string>>("/api/v1/admin/wallet/credit", {
        method: "POST",
        token,
        body: JSON.stringify({
          userId,
          amount,
          bucket: "deposited",
          note: "Admin test credit",
        }),
      });
      setMsg(`Credited. Deposited now ₹${data.deposited}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <AdminShell
      title="Credit wallet"
      subtitle="Dev/ops tool to fund a student’s deposited balance."
    >
      <PageSection title="Manual credit">
        <form onSubmit={onSubmit} className="max-w-md space-y-4">
          <div>
            <label className="admin-label">Student user id</label>
            <input
              className="admin-input"
              placeholder="cuid…"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="admin-label">Amount (₹)</label>
            <input
              type="number"
              className="admin-input metric"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              required
            />
          </div>
          {msg ? <p className="msg-ok">{msg}</p> : null}
          {error ? <p className="msg-err">{error}</p> : null}
          <button className="btn-primary w-full">Credit deposited balance</button>
        </form>
      </PageSection>
    </AdminShell>
  );
}
