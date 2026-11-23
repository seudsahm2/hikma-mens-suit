const BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public fields?: Record<string, string[]>,
  ) {
    super(message);
  }
}

export type AuthKind = 'customer' | 'staff';
type TokenGetter = (kind: AuthKind) => string | null;
let getToken: TokenGetter = () => null;
let onUnauthorized: (kind: AuthKind) => void = () => undefined;

/** Wired by the auth store so the client stays framework-free. */
export function configureApi(opts: { getToken: TokenGetter; onUnauthorized: (kind: AuthKind) => void }) {
  getToken = opts.getToken;
  onUnauthorized = opts.onUnauthorized;
}

type Query = Record<string, string | number | boolean | undefined | null | string[]>;

function buildUrl(path: string, query?: Query) {
  const url = `${BASE}/api${path}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === '' || v === false) continue;
    params.set(k, Array.isArray(v) ? v.join(',') : String(v));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

export async function api<T>(
  path: string,
  opts: { method?: string; body?: unknown; query?: Query; form?: FormData; signal?: AbortSignal; auth?: AuthKind } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  const kind: AuthKind = opts.auth ?? (path.startsWith('/admin') ? 'staff' : 'customer');
  const token = getToken(kind);
  if (token) headers.Authorization = `Bearer ${token}`;
  let body: BodyInit | undefined;
  if (opts.form) body = opts.form;
  else if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }

  let res: Response;
  try {
    res = await fetch(buildUrl(path, opts.query), { method: opts.method ?? (body ? 'POST' : 'GET'), headers, body, signal: opts.signal });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    throw new ApiError(0, 'No connection. Check your internet and try again.', 'NETWORK');
  }

  const json = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    const e = (json as { error?: { message?: string; code?: string; fields?: Record<string, string[]> } } | null)?.error;
    if (res.status === 401 && token) onUnauthorized(kind);
    throw new ApiError(res.status, e?.message ?? 'Something went wrong', e?.code, e?.fields);
  }
  return json as T;
}
