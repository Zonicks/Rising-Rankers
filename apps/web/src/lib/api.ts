export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export type ApiError = { code: string; message: string; details?: unknown };

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
    const body = json as {
      error?: ApiError;
      message?: string;
      code?: string;
    };
    const message = body.error?.message ?? body.message ?? "Request failed";
    const code = body.error?.code ?? body.code ?? "ERROR";
    throw Object.assign(new Error(message), {
      code,
      status: res.status,
      details: body.error?.details,
    });
  }
  return (json as { data: T }).data;
}

export function mediaUrl(url?: string | null) {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  return `${API_URL}${url.startsWith("/") ? url : `/${url}`}`;
}

export const tokenKey = "learning_student_token";
export const adminTokenKey = "learning_admin_token";
export const newsBookmarkKey = "rr-news-bookmarks";
