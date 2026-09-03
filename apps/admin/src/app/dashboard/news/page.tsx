"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminDialog, AdminShell, PageSection } from "@/components/admin-shell";
import { API_URL, adminTokenKey, api } from "@/lib/api";

type Program = { id: string; name: string };
type Article = {
  id: string;
  title: string;
  body: string;
  excerpt: string | null;
  imageUrl: string | null;
  tag: string | null;
  featured: boolean;
  programId: string | null;
  status: "DRAFT" | "PUBLISHED";
  publishedAt: string | null;
  program: { id: string; name: string } | null;
};

const emptyForm = {
  title: "",
  body: "",
  excerpt: "",
  tag: "",
  imageUrl: "",
  programId: "",
  featured: false,
  status: "DRAFT" as "DRAFT" | "PUBLISHED",
};

function imageSrc(url: string | null) {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  return `${API_URL}${url}`;
}

export default function NewsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Article[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    const token = localStorage.getItem(adminTokenKey);
    if (!token) {
      router.replace("/signin");
      return;
    }
    const [articles, programList] = await Promise.all([
      api<Article[]>("/api/v1/admin/articles", { token }),
      api<Program[]>("/api/v1/admin/programs", { token }),
    ]);
    setRows(articles);
    setPrograms(programList);
  }, [router]);

  useEffect(() => {
    load().catch(() => router.replace("/signin"));
  }, [load, router]);

  function startNew() {
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
    setFormOpen(true);
  }

  function startEdit(row: Article) {
    setEditingId(row.id);
    setForm({
      title: row.title,
      body: row.body,
      excerpt: row.excerpt ?? "",
      tag: row.tag ?? "",
      imageUrl: row.imageUrl ?? "",
      programId: row.programId ?? "",
      featured: row.featured,
      status: row.status,
    });
    setError(null);
    setFormOpen(true);
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    const token = localStorage.getItem(adminTokenKey);
    if (!token) return;
    setUploading(true);
    setError(null);
    try {
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Could not read image"));
        reader.readAsDataURL(file);
      });
      const uploaded = await api<{ url: string }>("/api/v1/admin/uploads", {
        method: "POST",
        token,
        body: JSON.stringify({ filename: file.name, contentType: file.type, data }),
      });
      setForm((cur) => ({ ...cur, imageUrl: uploaded.url }));
      setMsg("Cover image uploaded");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    const token = localStorage.getItem(adminTokenKey);
    if (!token) return;
    setError(null);
    const payload = {
      title: form.title,
      body: form.body,
      excerpt: form.excerpt || null,
      tag: form.tag || null,
      imageUrl: form.imageUrl || null,
      programId: form.programId || null,
      featured: form.featured,
      status: form.status,
    };
    try {
      if (editingId) {
        await api(`/api/v1/admin/articles/${editingId}`, {
          method: "PATCH",
          token,
          body: JSON.stringify(payload),
        });
        setMsg(`Updated “${form.title}”`);
      } else {
        await api("/api/v1/admin/articles", {
          method: "POST",
          token,
          body: JSON.stringify(payload),
        });
        setMsg(`Created “${form.title}”`);
      }
      setFormOpen(false);
      setEditingId(null);
      setForm(emptyForm);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  async function unpublish(id: string) {
    const token = localStorage.getItem(adminTokenKey);
    if (!token) return;
    await api(`/api/v1/admin/articles/${id}`, {
      method: "PATCH",
      token,
      body: JSON.stringify({ status: "DRAFT" }),
    });
    setMsg("Unpublished");
    await load();
  }

  const cover = imageSrc(form.imageUrl);

  return (
    <AdminShell title="News" subtitle="Current affairs articles with an optional cover image. Students will see published posts in Phase H.">
      {msg ? <p className="msg-ok mb-4">{msg}</p> : null}
      {error && !formOpen ? <p className="msg-err mb-4">{error}</p> : null}

      <PageSection
        title="Articles"
        action={
          <button type="button" className="btn-primary btn-sm" onClick={startNew}>
            New article
          </button>
        }
      >
        {rows.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No articles yet.</p>
        ) : (
          <div className="row-list">
            {rows.map((row) => (
              <div key={row.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold">{row.title}</p>
                  <p className="mt-1 text-sm text-[var(--ink-soft)]">
                    <span className="chip chip-accent mr-2">{row.status}</span>
                    {row.tag ? `${row.tag} · ` : ""}
                    {row.program?.name ?? "All programs"}
                    {row.featured ? " · Featured" : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn-secondary btn-sm" onClick={() => startEdit(row)}>
                    Edit
                  </button>
                  {row.status === "PUBLISHED" ? (
                    <button type="button" className="btn-secondary btn-sm" onClick={() => void unpublish(row.id)}>
                      Unpublish
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </PageSection>

      {formOpen ? (
        <AdminDialog title={editingId ? "Edit article" : "New article"} onClose={() => setFormOpen(false)} wide>
        {error ? <p className="msg-err mb-3">{error}</p> : null}
        <form onSubmit={save} className="space-y-4">
          <div>
            <label className="admin-label">Title</label>
            <input
              className="admin-input"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="admin-label">Body (markdown)</label>
            <textarea
              className="admin-textarea min-h-40"
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="admin-label">Excerpt</label>
            <input
              className="admin-input"
              value={form.excerpt}
              onChange={(e) => setForm({ ...form, excerpt: e.target.value })}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="admin-label">Tag</label>
              <input
                className="admin-input"
                placeholder="Polity"
                value={form.tag}
                onChange={(e) => setForm({ ...form, tag: e.target.value })}
              />
            </div>
            <div>
              <label className="admin-label">Program</label>
              <select
                className="admin-input"
                value={form.programId}
                onChange={(e) => setForm({ ...form, programId: e.target.value })}
              >
                <option value="">All programs</option>
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="admin-label">Cover image</label>
            <input
              className="admin-input"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={(e) => void onFile(e.target.files?.[0])}
              disabled={uploading}
            />
            {cover ? (
              <img src={cover} alt="" className="mt-3 h-32 rounded-2xl object-cover" />
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                className="accent-[var(--accent)]"
                checked={form.featured}
                onChange={(e) => setForm({ ...form, featured: e.target.checked })}
              />
              Featured
            </label>
            <select
              className="admin-input w-auto"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as "DRAFT" | "PUBLISHED" })}
            >
              <option value="DRAFT">DRAFT</option>
              <option value="PUBLISHED">PUBLISHED</option>
            </select>
          </div>
          <button className="btn-primary" disabled={uploading}>
            {editingId ? "Save article" : "Create article"}
          </button>
        </form>
        </AdminDialog>
      ) : null}
    </AdminShell>
  );
}
