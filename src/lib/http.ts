import { log } from "./log.js";

export interface HttpOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  headers?: Record<string, string>;
  body?: string | URLSearchParams;
  retries?: number;
  timeoutMs?: number;
}

/** fetch with timeout + exponential backoff on 429/5xx/network errors. */
export async function http(url: string, opts: HttpOptions = {}): Promise<Response> {
  const retries = opts.retries ?? 3;
  let attempt = 0;
  for (;;) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 30_000);
    try {
      const res = await fetch(url, { method: opts.method ?? "GET", headers: opts.headers, body: opts.body, signal: ctrl.signal });
      clearTimeout(timer);
      if ((res.status === 429 || res.status >= 500) && attempt < retries) {
        const retryAfter = Number(res.headers.get("retry-after"));
        const wait = retryAfter > 0 ? retryAfter * 1000 : 1000 * 2 ** attempt;
        log.warn("http retry", { url, status: res.status, wait, attempt });
        await new Promise((r) => setTimeout(r, wait));
        attempt++;
        continue;
      }
      return res;
    } catch (err) {
      clearTimeout(timer);
      if (attempt >= retries) throw err;
      const wait = 1000 * 2 ** attempt;
      log.warn("http network retry", { url, wait, attempt, err: String(err) });
      await new Promise((r) => setTimeout(r, wait));
      attempt++;
    }
  }
}

export async function httpJson<T>(url: string, opts: HttpOptions = {}): Promise<T> {
  const res = await http(url, opts);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}: ${(await res.text()).slice(0, 500)}`);
  return (await res.json()) as T;
}
