const BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public fields?: Record<string, string[]>,
    /** Seconds the server asked us to wait (429 Retry-After). */
    public retryAfter?: number,
  ) {
    super(message);
  }
}

/**
 * Which saved session a request uses:
 *  - 'customer' / 'staff': sends that session's token; a 401 means the token is no longer valid → sign out.
 *  - 'none': sign-in endpoints. They never send a token and never sign anyone out, so a failed sign-in
 *    attempt (e.g. stale Telegram data) can't wipe a valid saved session.
 */
export type AuthKind = 'customer' | 'staff' | 'none';
type SessionKind = Exclude<AuthKind, 'none'>;
type TokenGetter = (kind: SessionKind) => string | null;
let getToken: TokenGetter = () => null;
let onUnauthorized: (kind: SessionKind) => void = () => undefined;

/** Wired by the auth store so the client stays framework-free. */
export function configureApi(opts: { getToken: TokenGetter; onUnauthorized: (kind: SessionKind) => void }) {
  getToken = opts.getToken;
  onUnauthorized = opts.onUnauthorized;
}

const SIGN_IN_PATHS = /^\/auth\/(telegram\/|staff\/(login|telegram|forgot|reset)|dev$)/;

function defaultAuth(path: string): AuthKind {
  if (SIGN_IN_PATHS.test(path)) return 'none';
  return path.startsWith('/admin') ? 'staff' : 'customer';
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
  const kind: AuthKind = opts.auth ?? defaultAuth(path);
  const token = kind === 'none' ? null : getToken(kind);
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
    // Only a rejected session token signs out — never a failed sign-in attempt
    if (res.status === 401 && token && kind !== 'none') onUnauthorized(kind);
    const retryAfter = Number(res.headers.get('retry-after')) || undefined;
    throw new ApiError(res.status, e?.message ?? 'Something went wrong', e?.code, e?.fields, retryAfter);
  }
  return json as T;
}

/** Binary download with the staff session (e.g. an ID photo that must never be a public link). */
export async function apiBlob(path: string): Promise<Blob | null> {
  const token = getToken('staff');
  const res = await fetch(buildUrl(path), { headers: token ? { Authorization: `Bearer ${token}` } : {}, cache: 'no-store' });
  return res.ok ? res.blob() : null;
}
