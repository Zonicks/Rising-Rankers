"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminDialog, AdminShell } from "@/components/admin-shell";
import { Bone, SkeletonRegion, SkeletonTree } from "@/components/skeleton";
import { adminTokenKey, api } from "@/lib/api";

type Kind = "program" | "subject" | "book" | "topic" | "chapter" | "category" | "subcategory";

type TreeNode = {
  id: string;
  kind: Kind;
  name: string;
  sortOrder: number;
  status: string;
  children: TreeNode[];
  slug?: string;
  examBoard?: string | null;
  description?: string | null;
  blurb?: string | null;
  iconKey?: string | null;
  subject?: string;
  subtitle?: string | null;
  coverUrl?: string | null;
  price?: number;
  includedInProgram?: boolean;
  authorId?: string;
  authorName?: string;
  mcqCount?: number;
  flashCardCount?: number;
};

type Author = { id: string; name: string; slug: string; bookCount: number };

const KIND_LABEL: Record<Kind, string> = {
  program: "Program",
  subject: "Subject",
  book: "Book",
  topic: "Topic",
  chapter: "Chapter",
  category: "Category",
  subcategory: "Subcategory",
};

const CHILD_OF: Partial<Record<Kind, { kind: Kind; label: string }>> = {
  program: { kind: "subject", label: "Add subject" },
  subject: { kind: "book", label: "Add book" },
  book: { kind: "chapter", label: "Add chapter" },
  chapter: { kind: "category", label: "Add category" },
  category: { kind: "subcategory", label: "Add subcategory" },
};

function findNode(nodes: TreeNode[], id: string, kind: Kind): TreeNode | null {
  for (const node of nodes) {
    if (node.id === id && node.kind === kind) return node;
    const nested = findNode(node.children, id, kind);
    if (nested) return nested;
  }
  return null;
}

export default function SyllabusPage() {
  const router = useRouter();
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [authors, setAuthors] = useState<Author[]>([]);
  const [selected, setSelected] = useState<{ id: string; kind: Kind } | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [childName, setChildName] = useState("");
  const [programName, setProgramName] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addProgramOpen, setAddProgramOpen] = useState(false);
  const [bookDraft, setBookDraft] = useState({
    title: "",
    authorId: "",
    authorName: "",
    price: 0,
    includedInProgram: true,
  });
  const [form, setForm] = useState({
    name: "",
    slug: "",
    examBoard: "",
    description: "",
    blurb: "",
    iconKey: "",
    subtitle: "",
    coverUrl: "",
    price: 0,
    includedInProgram: true,
    authorId: "",
    authorName: "",
    sortOrder: 0,
    status: "ACTIVE",
  });

  const node = useMemo(
    () => (selected ? findNode(tree, selected.id, selected.kind) : null),
    [tree, selected]
  );

  const load = useCallback(async () => {
    const token = localStorage.getItem(adminTokenKey);
    if (!token) {
      router.replace("/signin");
      return;
    }
    const [data, authorRows] = await Promise.all([
      api<TreeNode[]>("/api/v1/admin/programs/tree", { token }),
      api<Author[]>("/api/v1/admin/authors", { token }),
    ]);
    setTree(data);
    setAuthors(authorRows);
    setExpanded((prev) => {
      if (prev.size > 0) return prev;
      return new Set(data.map((p) => p.id));
    });
    setSelected((cur) => {
      if (cur && findNode(data, cur.id, cur.kind)) return cur;
      return data[0] ? { id: data[0].id, kind: "program" } : null;
    });
    setReady(true);
  }, [router]);

  useEffect(() => {
    load().catch(() => router.replace("/signin"));
  }, [load, router]);

  useEffect(() => {
    if (!node) return;
    setForm({
      name: node.name,
      slug: node.slug ?? "",
      examBoard: node.examBoard ?? "",
      description: node.description ?? "",
      blurb: node.blurb ?? "",
      iconKey: node.iconKey ?? "",
      subtitle: node.subtitle ?? "",
      coverUrl: node.coverUrl ?? "",
      price: node.price ?? 0,
      includedInProgram: node.includedInProgram ?? true,
      authorId: node.authorId ?? "",
      authorName: "",
      sortOrder: node.sortOrder,
      status: node.status,
    });
  }, [node]);

  useEffect(() => {
    setEditOpen(false);
    setAddOpen(false);
  }, [selected?.id, selected?.kind]);

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!node) return;
    const token = localStorage.getItem(adminTokenKey);
    if (!token) return;
    setError(null);
    try {
      const body: Record<string, unknown> = {
        name: form.name,
        sortOrder: Number(form.sortOrder) || 0,
        status: form.status,
      };
      let path = "";
      if (node.kind === "program") {
        path = `/api/v1/admin/programs/${node.id}`;
        body.slug = form.slug || undefined;
        body.examBoard = form.examBoard || undefined;
        body.description = form.description || undefined;
      } else if (node.kind === "subject") {
        path = `/api/v1/admin/program-subjects/${node.id}`;
        body.blurb = form.blurb || undefined;
        body.iconKey = form.iconKey || undefined;
      } else if (node.kind === "book") {
        path = `/api/v1/admin/books/${node.id}`;
        body.title = form.name;
        delete body.name;
        body.slug = form.slug || undefined;
        body.subtitle = form.subtitle || null;
        body.coverUrl = form.coverUrl || null;
        body.price = Number(form.price) || 0;
        body.includedInProgram = form.includedInProgram;
        if (form.authorId) body.authorId = form.authorId;
        else if (form.authorName.trim()) body.authorName = form.authorName.trim();
      } else if (node.kind === "topic") {
        path = `/api/v1/admin/topics/${node.id}`;
      } else if (node.kind === "chapter") {
        path = `/api/v1/admin/chapters/${node.id}`;
        body.title = form.name;
        delete body.name;
        body.description = form.description || null;
      } else if (node.kind === "category") {
        path = `/api/v1/admin/categories/${node.id}`;
      } else {
        path = `/api/v1/admin/subcategories/${node.id}`;
      }
      await api(path, { method: "PATCH", token, body: JSON.stringify(body) });
      setMsg(`Saved ${KIND_LABEL[node.kind].toLowerCase()} “${form.name}”`);
      setEditOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  async function addProgram(e: FormEvent) {
    e.preventDefault();
    const token = localStorage.getItem(adminTokenKey);
    if (!token || !programName.trim()) return;
    setError(null);
    try {
      const created = await api<{ id: string; name: string }>("/api/v1/admin/programs", {
        method: "POST",
        token,
        body: JSON.stringify({ name: programName.trim() }),
      });
      setProgramName("");
      setMsg(`Created program “${created.name}”`);
      setAddProgramOpen(false);
      await load();
      setSelected({ id: created.id, kind: "program" });
      setExpanded((prev) => new Set(prev).add(created.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    }
  }

  async function addBook(e: FormEvent) {
    e.preventDefault();
    if (!node || node.kind !== "subject" || !bookDraft.title.trim()) return;
    const token = localStorage.getItem(adminTokenKey);
    if (!token) return;
    if (!bookDraft.authorId && !bookDraft.authorName.trim()) {
      setError("Pick an author or type a new author name");
      return;
    }
    setError(null);
    try {
      const created = await api<{ id: string; name: string }>("/api/v1/admin/subjects/" + node.id + "/books", {
        method: "POST",
        token,
        body: JSON.stringify({
          title: bookDraft.title.trim(),
          authorId: bookDraft.authorId || undefined,
          authorName: bookDraft.authorId ? undefined : bookDraft.authorName.trim(),
          price: Number(bookDraft.price) || 0,
          includedInProgram: bookDraft.includedInProgram,
        }),
      });
      setBookDraft({ title: "", authorId: "", authorName: "", price: 0, includedInProgram: true });
      setMsg(`Added book “${created.name}”`);
      setAddOpen(false);
      setExpanded((prev) => new Set(prev).add(node.id));
      await load();
      setSelected({ id: created.id, kind: "book" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    }
  }

  async function addChild(e: FormEvent) {
    e.preventDefault();
    if (!node) return;
    const child = CHILD_OF[node.kind];
    if (!child || child.kind === "book" || !childName.trim()) return;
    const token = localStorage.getItem(adminTokenKey);
    if (!token) return;
    setError(null);
    try {
      const name = childName.trim();
      let created: { id: string };
      if (child.kind === "subject") {
        created = await api("/api/v1/admin/program-subjects", {
          method: "POST",
          token,
          body: JSON.stringify({ programId: node.id, name }),
        });
      } else if (child.kind === "chapter") {
        created = await api("/api/v1/admin/chapters", {
          method: "POST",
          token,
          body: JSON.stringify({ bookId: node.id, title: name }),
        });
      } else if (child.kind === "category") {
        created = await api("/api/v1/admin/categories", {
          method: "POST",
          token,
          body: JSON.stringify({ chapterId: node.id, name }),
        });
      } else {
        created = await api("/api/v1/admin/subcategories", {
          method: "POST",
          token,
          body: JSON.stringify({ categoryId: node.id, name }),
        });
      }
      setChildName("");
      setMsg(`Added ${KIND_LABEL[child.kind].toLowerCase()} “${name}”`);
      setAddOpen(false);
      setExpanded((prev) => new Set(prev).add(node.id));
      await load();
      setSelected({ id: created.id, kind: child.kind });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    }
  }

  function renderTree(nodes: TreeNode[], depth = 0) {
    return nodes.map((item) => {
      const open = expanded.has(item.id);
      const active = selected?.id === item.id && selected.kind === item.kind;
      const hasKids = item.children.length > 0;
      return (
        <div key={`${item.kind}-${item.id}`}>
          <div
            className={`flex items-center gap-1 rounded-xl px-2 py-1.5 text-sm ${
              active ? "bg-[var(--accent-soft)] font-semibold text-[var(--accent)]" : "hover:bg-[var(--bg)]"
            }`}
            style={{ paddingLeft: 8 + depth * 14 }}
          >
            {hasKids ? (
              <button
                type="button"
                className="h-5 w-5 shrink-0 text-[var(--muted)]"
                onClick={() => toggle(item.id)}
                aria-label={open ? "Collapse" : "Expand"}
              >
                {open ? "▾" : "▸"}
              </button>
            ) : (
              <span className="inline-block w-5 shrink-0" />
            )}
            <button
              type="button"
              className="min-w-0 flex-1 truncate text-left"
              onClick={() => {
                setSelected({ id: item.id, kind: item.kind });
                if (hasKids && !open) toggle(item.id);
              }}
            >
              {item.name}
              {item.kind === "book" ? (
                <span className="ml-2 text-xs font-normal text-[var(--muted)]">
                  {item.authorName}
                  {item.includedInProgram ? " · in syllabus" : ` · ₹${item.price ?? 0}`}
                  {` · ${item.mcqCount ?? 0} MCQ`}
                </span>
              ) : null}
              {item.kind === "chapter" ? (
                <span className="ml-2 text-xs font-normal text-[var(--muted)]">
                  {item.mcqCount ?? 0} MCQ · {item.flashCardCount ?? 0} flash
                </span>
              ) : null}
            </button>
          </div>
          {open && hasKids ? renderTree(item.children, depth + 1) : null}
        </div>
      );
    });
  }

  const child = node ? CHILD_OF[node.kind] : undefined;

  return (
    <AdminShell
      title="Syllabus"
      subtitle="Program → subject → book → chapter → category → subcategory. Questions still live under Content."
    >
      {msg ? <p className="msg-ok mb-4">{msg}</p> : null}
      {error && !editOpen && !addOpen && !addProgramOpen ? <p className="msg-err mb-4">{error}</p> : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(260px,340px)_1fr]">
        <section className="panel mt-0">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
              Tree
            </h2>
            <button type="button" className="btn-secondary btn-sm" onClick={() => setAddProgramOpen(true)}>
              Add program
            </button>
          </div>
          {tree.length === 0 && !ready ? (
            <SkeletonRegion>
              <SkeletonTree />
            </SkeletonRegion>
          ) : tree.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No programs yet. Add one to start the tree.</p>
          ) : (
            <div className="max-h-[70vh] overflow-auto">{renderTree(tree)}</div>
          )}
        </section>

        <section className="panel mt-0">
          {!ready ? (
            <SkeletonRegion>
              <Bone className="h-3 w-16" />
              <Bone className="mt-3 h-8 w-48" />
              <Bone className="mt-2 h-4 w-64" />
              <Bone className="mt-6 h-10 w-32 rounded-2xl" />
            </SkeletonRegion>
          ) : !node ? (
            <p className="text-sm text-[var(--muted)]">Select a node in the tree.</p>
          ) : (
            <>
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                {KIND_LABEL[node.kind]}
              </p>
              <h2 className="mt-2 text-2xl font-extrabold tracking-tight">{node.name}</h2>
              <p className="mt-2 text-sm text-[var(--ink-soft)]">
                <span className="chip chip-accent mr-2">{node.status}</span>
                {node.kind === "program" && node.slug ? `${node.slug}` : null}
                {node.kind === "program" && node.examBoard ? ` · ${node.examBoard}` : null}
                {node.kind === "book" && node.authorName ? node.authorName : null}
                {node.kind === "book" && node.includedInProgram ? " · in syllabus" : null}
                {node.kind === "book" && !node.includedInProgram ? ` · ₹${node.price ?? 0}` : null}
                {node.kind === "chapter"
                  ? `${node.mcqCount ?? 0} MCQ · ${node.flashCardCount ?? 0} flash`
                  : null}
              </p>
              {node.description || node.blurb || node.subtitle ? (
                <p className="mt-3 text-sm text-[var(--ink-soft)]">
                  {node.description || node.blurb || node.subtitle}
                </p>
              ) : null}
              <div className="mt-5 flex flex-wrap gap-2">
                <button type="button" className="btn-primary" onClick={() => setEditOpen(true)}>
                  Edit {KIND_LABEL[node.kind].toLowerCase()}
                </button>
                {child || node.kind === "subject" ? (
                  <button type="button" className="btn-secondary" onClick={() => setAddOpen(true)}>
                    {node.kind === "subject" ? "Add book" : child?.label}
                  </button>
                ) : (
                  <p className="self-center text-sm text-[var(--ink-soft)]">
                    Add MCQs and flash cards for this chapter in Content.
                  </p>
                )}
              </div>

              {editOpen ? (
                <AdminDialog
                  title={`Edit ${KIND_LABEL[node.kind].toLowerCase()}`}
                  onClose={() => setEditOpen(false)}
                >
              {error ? <p className="msg-err mb-3">{error}</p> : null}
              <form onSubmit={save} className="space-y-4">
                <div>
                  <label className="admin-label">
                    {node.kind === "chapter" || node.kind === "book" ? "Title" : "Name"}
                  </label>
                  <input
                    className="admin-input"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </div>
                {node.kind === "program" ? (
                  <>
                    <div>
                      <label className="admin-label">Slug</label>
                      <input
                        className="admin-input"
                        value={form.slug}
                        onChange={(e) => setForm({ ...form, slug: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="admin-label">Exam board</label>
                      <input
                        className="admin-input"
                        value={form.examBoard}
                        onChange={(e) => setForm({ ...form, examBoard: e.target.value })}
                      />
                    </div>
                  </>
                ) : null}
                {node.kind === "book" ? (
                  <>
                    <div>
                      <label className="admin-label">Author</label>
                      <select
                        className="admin-input"
                        value={form.authorId}
                        onChange={(e) => setForm({ ...form, authorId: e.target.value, authorName: "" })}
                      >
                        <option value="">New author…</option>
                        {authors.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    {!form.authorId ? (
                      <div>
                        <label className="admin-label">New author name</label>
                        <input
                          className="admin-input"
                          placeholder="M. Laxmikanth"
                          value={form.authorName}
                          onChange={(e) => setForm({ ...form, authorName: e.target.value })}
                        />
                      </div>
                    ) : null}
                    <div>
                      <label className="admin-label">Slug</label>
                      <input
                        className="admin-input"
                        value={form.slug}
                        onChange={(e) => setForm({ ...form, slug: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="admin-label">Subtitle</label>
                      <input
                        className="admin-input"
                        value={form.subtitle}
                        onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="admin-label">Cover URL</label>
                      <input
                        className="admin-input"
                        value={form.coverUrl}
                        onChange={(e) => setForm({ ...form, coverUrl: e.target.value })}
                      />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="admin-label">Price (₹)</label>
                        <input
                          type="number"
                          min={0}
                          className="admin-input"
                          value={form.price}
                          onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
                        />
                      </div>
                      <label className="flex items-end gap-2 pb-2 text-sm">
                        <input
                          type="checkbox"
                          className="accent-[var(--accent)]"
                          checked={form.includedInProgram}
                          onChange={(e) => setForm({ ...form, includedInProgram: e.target.checked })}
                        />
                        Included in this program (free)
                      </label>
                    </div>
                  </>
                ) : null}
                {node.kind === "program" || node.kind === "chapter" ? (
                  <div>
                    <label className="admin-label">Description</label>
                    <textarea
                      className="admin-textarea"
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                    />
                  </div>
                ) : null}
                {node.kind === "subject" ? (
                  <>
                    <div>
                      <label className="admin-label">Blurb</label>
                      <input
                        className="admin-input"
                        value={form.blurb}
                        onChange={(e) => setForm({ ...form, blurb: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="admin-label">Icon key</label>
                      <input
                        className="admin-input"
                        placeholder="science"
                        value={form.iconKey}
                        onChange={(e) => setForm({ ...form, iconKey: e.target.value })}
                      />
                    </div>
                  </>
                ) : null}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="admin-label">Sort order</label>
                    <input
                      type="number"
                      className="admin-input"
                      value={form.sortOrder}
                      onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="admin-label">Status</label>
                    <select
                      className="admin-input"
                      value={form.status}
                      onChange={(e) => setForm({ ...form, status: e.target.value })}
                    >
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="DRAFT">DRAFT</option>
                      <option value="INACTIVE">INACTIVE</option>
                    </select>
                  </div>
                </div>
                <button className="btn-primary">Save</button>
              </form>
                </AdminDialog>
              ) : null}

              {addOpen && node.kind === "subject" ? (
                <AdminDialog title="Add book" onClose={() => setAddOpen(false)}>
                  {error ? <p className="msg-err mb-3">{error}</p> : null}
                  <form onSubmit={addBook} className="space-y-3">
                    <input
                      className="admin-input"
                      placeholder="Title (e.g. Indian Polity)"
                      value={bookDraft.title}
                      onChange={(e) => setBookDraft({ ...bookDraft, title: e.target.value })}
                    />
                    <select
                      className="admin-input"
                      value={bookDraft.authorId}
                      onChange={(e) => setBookDraft({ ...bookDraft, authorId: e.target.value, authorName: "" })}
                    >
                      <option value="">New author…</option>
                      {authors.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                    {!bookDraft.authorId ? (
                      <input
                        className="admin-input"
                        placeholder="Author name (e.g. M. Laxmikanth)"
                        value={bookDraft.authorName}
                        onChange={(e) => setBookDraft({ ...bookDraft, authorName: e.target.value })}
                      />
                    ) : null}
                    <div>
                      <label className="admin-label">Price (₹)</label>
                      <input
                        type="number"
                        min={0}
                        className="admin-input"
                        value={bookDraft.price}
                        onChange={(e) => setBookDraft({ ...bookDraft, price: Number(e.target.value) })}
                      />
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="accent-[var(--accent)]"
                        checked={bookDraft.includedInProgram}
                        onChange={(e) => setBookDraft({ ...bookDraft, includedInProgram: e.target.checked })}
                      />
                      In syllabus
                    </label>
                    <button className="btn-primary w-full" type="submit" disabled={!bookDraft.title.trim()}>
                      Add book
                    </button>
                  </form>
                </AdminDialog>
              ) : null}

              {addOpen && child && node.kind !== "subject" ? (
                <AdminDialog title={child.label} onClose={() => setAddOpen(false)}>
                  {error ? <p className="msg-err mb-3">{error}</p> : null}
                  <form onSubmit={addChild} className="space-y-3">
                    <input
                      className="admin-input"
                      value={childName}
                      onChange={(e) => setChildName(e.target.value)}
                      placeholder={`Name for new ${KIND_LABEL[child.kind].toLowerCase()}`}
                    />
                    <button className="btn-primary w-full" type="submit" disabled={!childName.trim()}>
                      Add
                    </button>
                  </form>
                </AdminDialog>
              ) : null}
            </>
          )}
        </section>
      </div>

      {addProgramOpen ? (
        <AdminDialog title="Add program" onClose={() => setAddProgramOpen(false)}>
          {error ? <p className="msg-err mb-3">{error}</p> : null}
          <form onSubmit={addProgram} className="space-y-3">
            <input
              className="admin-input"
              placeholder="New program (e.g. NEET)"
              value={programName}
              onChange={(e) => setProgramName(e.target.value)}
            />
            <button className="btn-primary w-full" type="submit" disabled={!programName.trim()}>
              Add program
            </button>
          </form>
        </AdminDialog>
      ) : null}
    </AdminShell>
  );
}
