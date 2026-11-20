export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function api<T = any>(path: string, init?: RequestInit & { json?: unknown; timeoutMs?: number }): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), init?.timeoutMs ?? 30000);
  try {
    const res = await fetch(`${API_URL}${path}`, {
      ...init,
      method: init?.method ?? (init?.json !== undefined ? "POST" : "GET"),
      headers: { "content-type": "application/json", ...(init?.headers || {}) },
      body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
      signal: ctrl.signal,
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`${res.status} ${path}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(t);
  }
}

export function uid(prefix = "evt"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}
