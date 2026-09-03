"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminShell, PageSection } from "@/components/admin-shell";
import { adminTokenKey, api } from "@/lib/api";

export default function AdminSecurityPage() {
  const router = useRouter();
  const [status, setStatus] = useState<{ mfaEnabled: boolean; requireAdminMfa: boolean; geoOnLogin: boolean } | null>(
    null
  );
  const [setup, setSetup] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const token = localStorage.getItem(adminTokenKey);
    if (!token) return router.replace("/signin");
    setStatus(await api("/api/v1/admin/me/security", { token }));
  }

  useEffect(() => {
    void load().catch((err) => setError(err instanceof Error ? err.message : "Failed"));
  }, []);

  async function startSetup() {
    const token = localStorage.getItem(adminTokenKey);
    if (!token) return;
    setError(null);
    setSetup(await api("/api/v1/auth/mfa/setup", { method: "POST", token }));
  }

  async function enable(e: FormEvent) {
    e.preventDefault();
    const token = localStorage.getItem(adminTokenKey);
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      await api("/api/v1/auth/mfa/enable", { method: "POST", token, body: JSON.stringify({ code }) });
      setMsg("Authenticator is on. The next sign-in will ask for a 6-digit code.");
      setSetup(null);
      setCode("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not enable");
    } finally {
      setBusy(false);
    }
  }

  async function disable(e: FormEvent) {
    e.preventDefault();
    const token = localStorage.getItem(adminTokenKey);
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      await api("/api/v1/auth/mfa/disable", { method: "POST", token, body: JSON.stringify({ code }) });
      setMsg("Authenticator turned off.");
      setCode("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not disable");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell title="Security" subtitle="Authenticator app for this staff login. No SMS vendor.">
      {msg ? <p className="msg-ok mb-4">{msg}</p> : null}
      {error ? <p className="msg-err mb-4">{error}</p> : null}
      <PageSection title="Authenticator">
        {!status ? (
          <p className="text-sm text-[var(--muted)]">Loading…</p>
        ) : (
          <div className="max-w-lg space-y-4 text-sm text-[var(--ink-soft)]">
            <p>
              Status: <strong>{status.mfaEnabled ? "On" : "Off"}</strong>
              {status.requireAdminMfa ? " · Super-admin requires MFA for all staff" : ""}
            </p>
            {status.geoOnLogin ? <p>Geo-on-login is on. Country is stored when the proxy sends CF-IPCountry.</p> : null}
            {!status.mfaEnabled && !setup ? (
              <button type="button" className="btn-primary" onClick={() => void startSetup()}>
                Set up authenticator
              </button>
            ) : null}
            {setup ? (
              <form onSubmit={enable} className="space-y-3">
                <p>Add this secret in Google Authenticator or any TOTP app, then enter the 6-digit code.</p>
                <p className="break-all rounded-xl bg-[var(--accent-soft)] p-3 font-mono text-xs">{setup.secret}</p>
                <p className="break-all text-xs">{setup.otpauthUrl}</p>
                <input
                  className="admin-input"
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="123456"
                  required
                />
                <button className="btn-primary w-full" disabled={busy || code.length !== 6}>
                  {busy ? "Checking…" : "Enable"}
                </button>
              </form>
            ) : null}
            {status.mfaEnabled ? (
              <form onSubmit={disable} className="space-y-3">
                <p>Enter a current code to turn MFA off.</p>
                <input
                  className="admin-input"
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                />
                <button className="btn-secondary" disabled={busy || code.length !== 6}>
                  {busy ? "Saving…" : "Disable MFA"}
                </button>
              </form>
            ) : null}
          </div>
        )}
      </PageSection>
    </AdminShell>
  );
}
