// Client-side fetch + JSON that never throws. A server error page, a dropped connection or a
// non-JSON body all come back as { ok: false }, so the UI can show a message instead of hanging.

export interface ApiResult<T = any> {
  ok: boolean;
  status: number; // 0 = network error (offline, server down)
  data: T;
  error: string | null; // friendly message when !ok
}

export async function api<T = any>(url: string, init?: RequestInit): Promise<ApiResult<T>> {
  let res: Response;
  try {
    res = await fetch(url, { cache: "no-store", ...init });
  } catch {
    return { ok: false, status: 0, data: {} as T, error: "Can't reach the server. Check your connection and try again." };
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (res.ok) return { ok: true, status: res.status, data, error: null };
  const msg = typeof data?.error === "string" && data.error !== "no_profile" ? data.error : null;
  return { ok: false, status: res.status, data, error: msg ?? "Something went wrong on our side. Please try again in a moment." };
}

export const jsonBody = (body: unknown): RequestInit => ({
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
