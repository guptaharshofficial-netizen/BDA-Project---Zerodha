/* Thin API client. All numbers come from the deterministic backend. */
export type Json = any; // eslint-disable-line @typescript-eslint/no-explicit-any

// Signed consent token from the server; sent back on every call so any server copy (serverless hosting)
// knows what this session has allowed.
let consentToken = "";

async function req(path: string, body?: unknown): Promise<Json> {
  const headers: Record<string, string> = consentToken ? { "X-Consent-Token": consentToken } : {};
  const r = await fetch(path, body === undefined ? { headers } : {
    method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  if (!r.ok) {
    let msg = `${r.status}`;
    try { msg = (await r.json()).detail ?? msg; } catch { /* ignore */ }
    throw new Error(msg);
  }
  const j = await r.json();
  if (j && typeof j === "object" && typeof j.token === "string") consentToken = j.token;
  return j;
}

export const api = {
  meta: () => req("/api/meta"),
  session: () => req("/api/session", {}),
  consent: (session: string, permission: string, granted: boolean) => req("/api/consent", { session, permission, granted }),
  consentState: (sid: string) => req(`/api/consent/${sid}`),
  existing: (b: Json) => req("/api/existing", b),
  newUser: (b: Json) => req("/api/new", b),
  sectors: () => req("/api/sectors"),
  fundGroups: () => req("/api/fund_groups"),
  search: (q: string, kind = "all") => req(`/api/search?q=${encodeURIComponent(q)}&kind=${kind}`),
  explore: (p: Record<string, string>) => req("/api/explore?" + new URLSearchParams(p).toString()),
  calc: (b: Json) => req("/api/calc", b),
  whatif: (b: Json) => req("/api/whatif", b),
  news: (kind: string, name: string, symbol?: string) => req(`/api/news?kind=${kind}&name=${encodeURIComponent(name)}${symbol ? `&symbol=${encodeURIComponent(symbol)}` : ""}`),
  summary: (b: Json) => req("/api/summary", b),
  learn: () => req("/api/learn"),
  evaluation: () => req("/api/evaluation"),
  testcases: () => req("/api/testcases"),
};

export const inr = (v: number | null | undefined, d = 0) =>
  v === null || v === undefined || Number.isNaN(v) ? "—" : "₹" + Number(v).toLocaleString("en-IN", { maximumFractionDigits: d });
export const pct = (v: number | null | undefined, d = 1) =>
  v === null || v === undefined || Number.isNaN(v) ? "—" : `${Number(v).toFixed(d)}%`;
export const signed = (v: number | null | undefined, d = 1) =>
  v === null || v === undefined || Number.isNaN(v) ? "—" : `${v > 0 ? "+" : ""}${Number(v).toFixed(d)}%`;
export const ASOF = "30 Oct 2026";

/** ₹ in Indian short form: 4,500 · 1.2L · 3.4Cr */
export const inrShort = (v: number | null | undefined) => {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  const a = Math.abs(v), sg = v < 0 ? "-" : "";
  if (a >= 1e7) return `${sg}₹${(a / 1e7).toFixed(a >= 1e8 ? 1 : 2)}Cr`;
  if (a >= 1e5) return `${sg}₹${(a / 1e5).toFixed(a >= 1e6 ? 1 : 2)}L`;
  return `${sg}₹${Math.round(a).toLocaleString("en-IN")}`;
};
