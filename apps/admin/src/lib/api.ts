export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export async function api<T>(
  path: string,
  options: RequestInit & { token?: string | null } = {}
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (options.token) headers.set("Authorization", `Bearer ${options.token}`);
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    body:
      options.body ??
      (options.method && options.method !== "GET" && options.method !== "HEAD"
        ? "{}"
        : undefined),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = (json as { error?: { message?: string; code?: string } }).error;
    throw Object.assign(new Error(err?.message ?? "Request failed"), {
      code: err?.code,
      status: res.status,
    });
  }
  return (json as { data: T }).data;
}

export async function apiUpload<T>(
  path: string,
  file: File,
  fields: Record<string, string | undefined>,
  token: string
): Promise<T> {
  const body = new FormData();
  body.append("file", file);
  for (const [key, value] of Object.entries(fields)) {
    if (value) body.append(key, value);
  }
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = (json as { error?: { message?: string; code?: string } }).error;
    throw Object.assign(new Error(err?.message ?? "Request failed"), {
      code: err?.code,
      status: res.status,
    });
  }
  return (json as { data: T }).data;
}

export const adminTokenKey = "learning_admin_token";
