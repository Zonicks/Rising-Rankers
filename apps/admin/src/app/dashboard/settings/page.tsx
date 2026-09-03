"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminShell, PageSection } from "@/components/admin-shell";
import { adminTokenKey, api } from "@/lib/api";

type Settings = {
  flashFreePerDay: number;
  flashDailyGoal: number;
  flashUnlockPrice: number;
  flashPaidQuota: number;
  mcqFreePerDay: number;
  mcqUnlockPrice: number;
  mcqPaidQuota: number;
  grievanceOfficerName: string;
  grievanceOfficerEmail: string;
  grievanceOfficerPhone: string;
  requireAdminMfa: boolean;
  geoOnLogin: boolean;
  parentalConsentVendor: "none" | "manual" | "digilocker_planned";
  certInContactEmail: string;
  incidentLeadName: string;
  userNotifyLeadName: string;
};

export default function SettingsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [incident, setIncident] = useState({
    kind: "data_breach" as "data_breach" | "account_compromise" | "availability" | "malware" | "other",
    notes: "",
    certInWithin6h: false,
    usersWithin72h: false,
  });

  useEffect(() => {
    const token = localStorage.getItem(adminTokenKey);
    if (!token) return router.replace("/signin");
    api<Settings>("/api/v1/admin/settings", { token }).then(setSettings);
  }, [router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const token = localStorage.getItem(adminTokenKey);
    if (!token || !settings) return;
    const data = await api<Settings>("/api/v1/admin/settings", {
      method: "PATCH",
      token,
      body: JSON.stringify(settings),
    });
    setSettings(data);
    setMsg("Settings saved");
  }

  return (
    <AdminShell title="Settings" subtitle="Freemium quotas and the named grievance officer.">
      {!settings ? (
        <p className="text-sm text-[var(--muted)]">Loading…</p>
      ) : (
        <>
          {msg ? <p className="msg-ok mb-6">{msg}</p> : null}
          <PageSection title="Freemium">
            <form onSubmit={onSubmit} className="max-w-md space-y-4">
              {(
                [
                  ["flashFreePerDay", "Flash free / day"],
                  ["flashDailyGoal", "Flash daily goal"],
                  ["flashUnlockPrice", "Flash unlock price (₹)"],
                  ["flashPaidQuota", "Flash paid quota"],
                  ["mcqFreePerDay", "MCQ free / day"],
                  ["mcqUnlockPrice", "MCQ unlock price (₹)"],
                  ["mcqPaidQuota", "MCQ paid quota"],
                ] as const
              ).map(([key, label]) => (
                <div key={key}>
                  <label className="admin-label">{label}</label>
                  <input
                    type="number"
                    className="admin-input metric"
                    value={settings[key]}
                    onChange={(e) =>
                      setSettings({ ...settings, [key]: Number(e.target.value) })
                    }
                  />
                </div>
              ))}
              <button className="btn-primary w-full">Save settings</button>
            </form>
          </PageSection>
          <PageSection title="Grievance officer">
            <p className="mb-4 text-sm text-[var(--ink-soft)]">
              Shown on student Help and the public privacy notice (IT Rules + DPDP s. 8).
            </p>
            <form onSubmit={onSubmit} className="max-w-md space-y-4">
              <div>
                <label className="admin-label">Name</label>
                <input
                  className="admin-input"
                  value={settings.grievanceOfficerName ?? ""}
                  onChange={(e) => setSettings({ ...settings, grievanceOfficerName: e.target.value })}
                />
              </div>
              <div>
                <label className="admin-label">Email</label>
                <input
                  type="email"
                  className="admin-input"
                  value={settings.grievanceOfficerEmail ?? ""}
                  onChange={(e) => setSettings({ ...settings, grievanceOfficerEmail: e.target.value })}
                />
              </div>
              <div>
                <label className="admin-label">Phone</label>
                <input
                  className="admin-input"
                  value={settings.grievanceOfficerPhone ?? ""}
                  onChange={(e) => setSettings({ ...settings, grievanceOfficerPhone: e.target.value })}
                />
              </div>
              <button className="btn-primary w-full">Save officer</button>
            </form>
          </PageSection>
          <PageSection title="Hardening">
            <form onSubmit={onSubmit} className="max-w-md space-y-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="accent-[var(--accent)]"
                  checked={Boolean(settings.requireAdminMfa)}
                  onChange={(e) => setSettings({ ...settings, requireAdminMfa: e.target.checked })}
                />
                Require authenticator for staff sign-in
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="accent-[var(--accent)]"
                  checked={Boolean(settings.geoOnLogin)}
                  onChange={(e) => setSettings({ ...settings, geoOnLogin: e.target.checked })}
                />
                Store country/city on login when the proxy sends it (no paid geo API)
              </label>
              <div>
                <label className="admin-label">Parental consent vendor</label>
                <select
                  className="admin-input"
                  value={settings.parentalConsentVendor ?? "manual"}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      parentalConsentVendor: e.target.value as Settings["parentalConsentVendor"],
                    })
                  }
                >
                  <option value="none">None</option>
                  <option value="manual">Manual attested note (v1)</option>
                  <option value="digilocker_planned">DigiLocker / vendor — planned, not wired</option>
                </select>
              </div>
              <button className="btn-primary w-full">Save hardening</button>
            </form>
          </PageSection>
          <PageSection title="CERT-In incident checklist">
            <p className="mb-4 text-sm text-[var(--ink-soft)]">
              This does not file to CERT-In. It records that someone ran the 6-hour / 72-hour checklist.
            </p>
            <form onSubmit={onSubmit} className="mb-6 max-w-md space-y-3">
              <div>
                <label className="admin-label">CERT-In contact email</label>
                <input
                  type="email"
                  className="admin-input"
                  value={settings.certInContactEmail ?? ""}
                  onChange={(e) => setSettings({ ...settings, certInContactEmail: e.target.value })}
                />
              </div>
              <div>
                <label className="admin-label">Incident lead</label>
                <input
                  className="admin-input"
                  value={settings.incidentLeadName ?? ""}
                  onChange={(e) => setSettings({ ...settings, incidentLeadName: e.target.value })}
                />
              </div>
              <div>
                <label className="admin-label">User-notify lead (72h)</label>
                <input
                  className="admin-input"
                  value={settings.userNotifyLeadName ?? ""}
                  onChange={(e) => setSettings({ ...settings, userNotifyLeadName: e.target.value })}
                />
              </div>
              <button className="btn-primary w-full">Save contacts</button>
            </form>
            <ul className="mb-4 list-disc space-y-1 pl-5 text-sm text-[var(--ink-soft)]">
              <li>Confirm clocks (IST / NTP) and preserve auth + admin logs.</li>
              <li>Email CERT-In within 6 hours for a specified incident.</li>
              <li>Notify affected students within 72 hours on a personal-data breach (DPDP Rules).</li>
              <li>Do not auto-file. A lawyer / incident lead sends the notice.</li>
            </ul>
            <form
              className="max-w-md space-y-3"
              onSubmit={async (e) => {
                e.preventDefault();
                const token = localStorage.getItem(adminTokenKey);
                if (!token) return;
                await api("/api/v1/admin/incidents", {
                  method: "POST",
                  token,
                  body: JSON.stringify(incident),
                });
                setMsg("Incident review logged on Audit. Nothing was sent to CERT-In.");
              }}
            >
              <div>
                <label className="admin-label">Kind</label>
                <select
                  className="admin-input"
                  value={incident.kind}
                  onChange={(e) => setIncident({ ...incident, kind: e.target.value as typeof incident.kind })}
                >
                  <option value="data_breach">Personal data breach</option>
                  <option value="account_compromise">Account compromise</option>
                  <option value="availability">Availability / outage</option>
                  <option value="malware">Malware / ransomware</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <textarea
                className="admin-textarea min-h-24"
                value={incident.notes}
                onChange={(e) => setIncident({ ...incident, notes: e.target.value })}
                minLength={10}
                required
                placeholder="What happened, systems touched, who is leading…"
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="accent-[var(--accent)]"
                  checked={incident.certInWithin6h}
                  onChange={(e) => setIncident({ ...incident, certInWithin6h: e.target.checked })}
                />
                CERT-In notice planned / sent within 6 hours
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="accent-[var(--accent)]"
                  checked={incident.usersWithin72h}
                  onChange={(e) => setIncident({ ...incident, usersWithin72h: e.target.checked })}
                />
                User notice planned / sent within 72 hours
              </label>
              <button className="btn-secondary w-full">Log incident review</button>
            </form>
          </PageSection>
        </>
      )}
    </AdminShell>
  );
}
