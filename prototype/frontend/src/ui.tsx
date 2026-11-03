import { ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { api } from "./api";

// Colour-blind-safe palette (always paired with labels)
export const PALETTE = ["#0e9f6e", "#2e90fa", "#f79009", "#7a5af8", "#ee46bc", "#15b79e", "#875bf7", "#f04438", "#667085", "#84adff", "#fdb022", "#3cc9a4", "#98a2b3"];

export function Card({ title, children, right, className = "", subtitle, pad = true, tag }: { title?: ReactNode; children: ReactNode; right?: ReactNode; className?: string; subtitle?: ReactNode; pad?: boolean; tag?: string }) {
  return (
    <section className={`relative bg-white border border-line rounded-lg min-w-0 ${tag ? "mt-3" : ""} ${pad ? "p-4 sm:p-5" : ""} ${className}`}>
      {tag && <span className="absolute -top-3 left-4 bg-gray-100 border border-line text-ink-soft text-xs px-3 py-0.5 rounded-full">{tag}</span>}
      {(title || right) && (
        <div className={`flex items-start justify-between gap-3 ${pad ? "mb-4" : "p-4 sm:p-5 pb-0 mb-4"}`}>
          <div className="min-w-0">
            {title && <h2 className="text-[15px] sm:text-base font-semibold text-ink">{title}</h2>}
            {subtitle && <p className="text-[13px] text-ink-faint mt-0.5">{subtitle}</p>}
          </div>
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "accent" | "warn" | "ok" | "muted" | "bad" }) {
  const t = {
    neutral: "bg-gray-100 text-ink-soft", accent: "bg-brand-soft text-brand-ink", ok: "bg-brand-soft text-brand-ink",
    warn: "bg-amber-50 text-amber-800", muted: "bg-white text-ink-faint border border-line", bad: "bg-red-50 text-down",
  }[tone];
  return <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${t}`}>{children}</span>;
}

export function AsOf({ date = "30 Oct 2026", extra }: { date?: string; extra?: string }) {
  return <span className="text-xs text-ink-faint">As of {date}{extra ? ` · ${extra}` : ""}</span>;
}

export function Disclaimer({ children }: { children?: ReactNode }) {
  return (
    <p className="text-xs text-ink-faint mt-3 flex gap-1.5 items-start">
      <span aria-hidden>ⓘ</span>
      <span>{children ?? "Past returns don't guarantee future returns. These are estimates, not promises."}</span>
    </p>
  );
}

export function Info({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "warn" | "good" }) {
  const t = { info: "bg-blue-50 border-blue-100 text-blue-950", warn: "bg-amber-50 border-amber-200 text-amber-950", good: "bg-brand-soft border-emerald-100 text-brand-ink" }[tone];
  return <div className={`text-sm border rounded-md px-4 py-3 ${t}`}>{children}</div>;
}

export function Toggle({ label, on, onChange, id, hint }: { label: string; on: boolean; onChange: (v: boolean) => void; id: string; hint?: string }) {
  return (
    <label htmlFor={id} className="inline-flex items-center gap-3 text-sm cursor-pointer select-none">
      <button id={id} role="switch" aria-checked={on} onClick={() => onChange(!on)}
        className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${on ? "bg-brand" : "bg-gray-300"}`}>
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${on ? "translate-x-5" : ""}`} />
      </button>
      <span>{label}{hint && <span className="block text-xs text-ink-faint">{hint}</span>}</span>
    </label>
  );
}

export function Button({ children, onClick, kind = "primary", disabled, title, type = "button", size = "md", full }: { children: ReactNode; onClick?: () => void; kind?: "primary" | "secondary" | "ghost" | "dark"; disabled?: boolean; title?: string; type?: "button" | "submit"; size?: "sm" | "md" | "lg"; full?: boolean }) {
  const k = {
    primary: "bg-brand text-white hover:bg-brand-dark border-brand",
    secondary: "bg-white text-brand-dark hover:bg-brand-soft border-brand/40",
    ghost: "bg-transparent text-brand-dark hover:bg-brand-soft border-transparent",
    dark: "bg-ink text-white hover:bg-black border-ink",
  }[kind];
  const s = { sm: "text-[13px] px-3 py-1.5", md: "text-sm px-4 py-2", lg: "text-[15px] px-5 py-2.5" }[size];
  return (
    <button type={type} title={title} disabled={disabled} onClick={onClick}
      className={`font-medium border rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${k} ${s} ${full ? "w-full" : ""}`}>
      {children}
    </button>
  );
}

/** Inert hand-off button: the prototype never places orders. */
export function InertAction({ label }: { label: string }) {
  return (
    <span className="relative group inline-block">
      <button aria-disabled="true" onClick={(e) => e.preventDefault()}
        className="text-[13px] font-medium border border-line text-ink-soft rounded px-3 py-1.5 cursor-not-allowed bg-gray-50">{label} ↗</button>
      <span role="tooltip" className="pointer-events-none absolute left-0 bottom-full mb-1 w-56 text-xs bg-ink text-white rounded-md px-2.5 py-2 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 z-20">
        Demo only. You would complete this yourself in the app; nothing is bought for you.
      </span>
    </span>
  );
}

let LINKS: Record<string, { app: string; url: string }> = {};
export const setAppLinks = (l: Record<string, { app: string; url: string }>) => { LINKS = l || {}; };
export const appLink = (kind: "stock" | "fund") => LINKS[kind] ?? { app: kind === "stock" ? "Kite" : "Coin", url: kind === "stock" ? "https://kite.zerodha.com/" : "https://coin.zerodha.com/funds" };

/** Every jump to Kite or Coin goes through the hand-off screen (group-company disclosure, any-platform option). */
export type Handoff = { kind: "stock" | "fund"; copy?: string; category?: string };
let HANDOFF: ((h: Handoff) => void) | null = null;
export const setHandoff = (f: (h: Handoff) => void) => { HANDOFF = f; };

/** "Go to Kite" (stocks) / "Go to Coin" (funds). Opens the app in a new tab and copies the name to paste into its search.
 *  Nothing is bought from here. */
export function GoToApp({ kind, copy, compact, category }: { kind: "stock" | "fund"; copy?: string; compact?: boolean; category?: string }) {
  const l = appLink(kind);
  const [done, setDone] = useState(false);
  const go = async () => {
    if (HANDOFF) { HANDOFF({ kind, copy, category }); return; }
    if (copy) { try { await navigator.clipboard.writeText(copy); } catch { /* clipboard may be blocked */ } }
    window.open(l.url, "_blank", "noopener,noreferrer");
    setDone(true); setTimeout(() => setDone(false), 2500);
  };
  const dot = kind === "stock" ? "bg-kite" : "bg-brand";
  return (
    <button onClick={go} title={`Opens ${l.app} in a new tab${copy ? ` and copies "${copy}" so you can paste it into search` : ""}. Nothing is bought from here.`}
      className={`inline-flex items-center gap-1.5 whitespace-nowrap border border-line bg-white hover:border-ink-faint rounded text-ink-soft font-medium ${compact ? "text-xs px-2 py-1" : "text-[13px] px-3 py-1.5"}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} aria-hidden />{done ? (copy ? "Copied · opened" : "Opened") : compact ? l.app : `Go to ${l.app}`} <span aria-hidden>↗</span>
    </button>
  );
}

/** Top 5 Google News headlines for a sector or a stock, with the project's own notes as background. */
export function NewsList({ kind, name, symbol, notes }: { kind: "sector" | "stock"; name: string; symbol?: string; notes?: { text: string; source: string }[] }) {
  const [n, setN] = useState<any>(null);
  useEffect(() => { setN(null); api.news(kind, name, symbol).then(setN).catch((e) => setN({ ok: false, items: [], reason: String(e.message), open_url: `https://news.google.com/search?q=${encodeURIComponent(name)}` })); }, [kind, name, symbol]);
  const ago = (iso?: string) => {
    if (!iso) return "";
    const h = Math.round((Date.now() - new Date(iso).getTime()) / 36e5);
    return h < 1 ? "just now" : h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
  };
  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs font-semibold text-ink-faint uppercase tracking-wide">Top 5 headlines · Google News</div>
          {n?.open_url && <a className="text-[13px] text-brand-dark hover:underline whitespace-nowrap" href={n.open_url} target="_blank" rel="noreferrer">More ↗</a>}
        </div>
        {!n ? <Loading what="Fetching headlines" /> : n.items.length ? (
          <ol className="mt-2 divide-y divide-line border border-line rounded-lg">
            {n.items.map((it: any, i: number) => (
              <li key={i} className="p-3 flex gap-3">
                <span className="text-ink-faint text-sm num w-4 shrink-0">{i + 1}</span>
                <div className="min-w-0">
                  <a href={it.link} target="_blank" rel="noreferrer" className="text-sm font-medium text-ink hover:text-brand-dark leading-snug">{it.title}</a>
                  <div className="text-xs text-ink-faint mt-1">{it.source}{it.published ? ` · ${ago(it.published)}` : ""}</div>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <div className="mt-2"><Info>{n.reason ?? "No headlines found."} {n.open_url && <a className="underline whitespace-nowrap" href={n.open_url} target="_blank" rel="noreferrer">Open Google News ↗</a>}</Info></div>
        )}
        <p className="text-[11px] text-ink-faint mt-2">{n?.label ?? "Headlines are third-party content."} They never change your risk score or what we show you.</p>
      </div>
      {notes && notes.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-[13px] font-medium text-ink-soft">Background notes from our research</summary>
          <div className="mt-2 space-y-2">{notes.map((x, i) => <div key={i} className="bg-gray-50 rounded-md p-3"><p>{x.text}</p>{x.source !== "—" && <p className="text-xs text-ink-faint mt-1">Source: {x.source}</p>}</div>)}</div>
        </details>
      )}
    </div>
  );
}

export function WhyDrawer({ why, learn, onLearn, extra }: { why: any; learn?: string; onLearn?: (id: string) => void; extra?: [string, ReactNode][] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-3">
      <button className="text-sm text-brand-dark font-medium hover:underline" aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? "Hide details" : "Why am I seeing this?"}
      </button>
      {open && (
        <dl className="mt-2 grid gap-2 text-[13px] bg-gray-50 rounded-md p-3">
          <Row k="Why">{why.rule_fired}</Row>
          <Row k="Based on">{(why.inputs || []).join(", ")} · data as of {why.asof}</Row>
          <Row k="Risks">{why.risks}</Row>
          <Row k="What could change it">{why.what_could_change}</Row>
          <Row k="What we don't know">{why.unknowns}</Row>
          <Row k="Method">{why.evidence} {why.assumptions}</Row>
          {(extra || []).map(([k, v]) => <Row key={k} k={k}>{v}</Row>)}
          {learn && onLearn && <div><button className="text-brand-dark text-[13px] font-medium hover:underline" onClick={() => onLearn(learn)}>Learn about this →</button></div>}
        </dl>
      )}
    </div>
  );
}

function Row({ k, children }: { k: string; children: ReactNode }) {
  return <div className="grid sm:grid-cols-[150px_1fr] gap-0.5"><dt className="text-ink-faint">{k}</dt><dd className="text-ink-soft">{children}</dd></div>;
}

const TIER_WORD: Record<string, string> = { Low: "Low risk", Medium: "Medium risk", High: "High risk", Credit: "Loan, not an investment" };
export function TierBadge({ tier }: { tier: string }) {
  const tone = tier === "Low" ? "ok" : tier === "Medium" ? "neutral" : tier === "High" ? "warn" : "muted";
  return <Badge tone={tone as any}>{TIER_WORD[tier] ?? tier}</Badge>;
}

export function RecCard({ c, onLearn, action, whyExtra, footer, top }: { c: any; onLearn?: (id: string) => void; action?: ReactNode; whyExtra?: [string, ReactNode][]; footer?: ReactNode; top?: ReactNode }) {
  return (
    <article className="border border-line rounded-lg p-4 bg-white flex flex-col hover:border-ink-faint/50 transition-colors">
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <TierBadge tier={c.tier} />
        <span className="text-xs text-ink-faint">on {c.surface}</span>
        {top && <span className="ml-auto">{top}</span>}
      </div>
      <h3 className="font-semibold text-ink">{c.label}</h3>
      <p className="text-sm text-ink-soft mt-1 flex-1">{c.headline}</p>
      <div className="mt-3">{action ?? (c.surface === "Kite" || c.surface === "Coin" ? <GoToApp kind={c.surface === "Kite" ? "stock" : "fund"} category={c.category} /> : <InertAction label={c.action_label} />)}</div>
      <WhyDrawer why={c.why} learn={c.learn} onLearn={onLearn} extra={whyExtra} />
      {footer}
    </article>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "good" | "warn" }) {
  return (
    <div className="bg-white border border-line rounded-lg p-4">
      <div className="text-xs font-medium text-ink-faint uppercase tracking-wide">{label}</div>
      <div className={`text-2xl font-semibold mt-1 num ${tone === "warn" ? "text-amber-700" : ""}`}>{value}</div>
      {sub && <div className="text-xs text-ink-faint mt-1">{sub}</div>}
    </div>
  );
}

export function Loading({ what = "Loading" }: { what?: string }) {
  return (
    <div className="py-10 flex items-center gap-3 text-sm text-ink-faint" role="status">
      <span className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin" aria-hidden />{what}…
    </div>
  );
}

export function ErrorNote({ msg }: { msg: string }) {
  return <p className="text-sm text-down bg-red-50 border border-red-100 rounded-md px-4 py-3" role="alert">{msg}</p>;
}

export function Ret({ v, d = 1, size = "sm" }: { v: number | null | undefined; d?: number; size?: "sm" | "lg" }) {
  if (v === null || v === undefined || Number.isNaN(v)) return <span className="text-ink-faint">—</span>;
  const pos = v >= 0;
  return <span className={`num font-semibold whitespace-nowrap ${pos ? "text-up" : "text-down"} ${size === "lg" ? "text-lg" : ""}`}>{pos ? "▲" : "▼"} {Math.abs(v).toFixed(d)}%</span>;
}

export function Pills<T extends string | number>({ value, options, onChange, label }: { value: T; options: { v: T; l: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button key={String(o.v)} role="radio" aria-checked={value === o.v} onClick={() => onChange(o.v)}
          className={`text-[13px] px-3 py-1.5 rounded-full border font-medium transition-colors ${value === o.v ? "bg-brand-soft text-brand-ink border-brand/50" : "bg-white text-ink-soft border-line hover:border-ink-faint"}`}>
          {o.l}
        </button>
      ))}
    </div>
  );
}

export function Modal({ children, onClose, title, wide }: { children: ReactNode; onClose: () => void; title: string; wide?: boolean }) {
  useEffect(() => {
    const f = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, [onClose]);
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div className={`bg-white w-full ${wide ? "sm:max-w-3xl" : "sm:max-w-lg"} rounded-t-2xl sm:rounded-md shadow-pop max-h-[92vh] overflow-y-auto`} onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur px-4 sm:px-6 pt-4 pb-3 flex items-center justify-between border-b border-line">
          <h2 className="text-base sm:text-lg font-semibold pr-2">{title}</h2>
          <button aria-label="Close" onClick={onClose} className="w-8 h-8 rounded-full hover:bg-gray-100 text-ink-faint">✕</button>
        </div>
        <div className="px-4 sm:px-6 py-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

export const RISK_WORDS = ["", "Low", "Moderate", "High", "Very high"];
/** Highest risk level that fits: the lower of the suitability band and the tier cap from goal timeline / life stage. */
export const fitLevel = (rec: any) => Math.min(rec?.suitability_band ?? 4, ({ Low: 1, Medium: 2, High: 4 } as Record<string, number>)[rec?.max_tier] ?? 4);
export const SPREAD_WORDS: Record<string, string> = { Low: "Well spread", Moderate: "Somewhat concentrated", High: "Concentrated" };
const RISK_COLORS = ["", "#1f9d55", "#8bc34a", "#f5a623", "#df514c"];

/** Plain risk meter: 4 labelled segments, a marker for "you" and an optional "fits you" range. */
export function RiskMeter({ level, fitMax, score, label = "Your portfolio" }: { level: number; fitMax?: number | null; score?: number; label?: string }) {
  return (
    <div>
      <div className="flex justify-between items-baseline">
        <div><span className="text-2xl font-semibold">{RISK_WORDS[level]}</span>{score !== undefined && <span className="text-sm text-ink-faint ml-2 num">{score}/100</span>}</div>
        {fitMax ? <span className="text-sm text-ink-soft">Fits you: up to <b>{RISK_WORDS[fitMax]}</b></span> : null}
      </div>
      <div className="relative mt-3">
        <div className="grid grid-cols-4 gap-1" aria-hidden>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-2.5 rounded-full" style={{ background: RISK_COLORS[i], opacity: fitMax && i > fitMax ? 0.35 : 1 }} />
          ))}
        </div>
        <div className="absolute -top-1.5" style={{ left: `calc(${(level - 0.5) * 25}% - 8px)` }} aria-hidden>
          <div className="w-4 h-[22px] rounded-md bg-ink border-2 border-white shadow" />
        </div>
        <div className="grid grid-cols-4 gap-1 mt-1.5 text-[11px] text-ink-faint">{[1, 2, 3, 4].map((i) => <span key={i} className="text-center">{RISK_WORDS[i]}</span>)}</div>
      </div>
      <p className="sr-only">{label} risk is {RISK_WORDS[level]}{fitMax ? `; what fits you is up to ${RISK_WORDS[fitMax]}` : ""}.</p>
    </div>
  );
}

export function MoneyInput({ label, value, onChange, hint, id }: { label: string; value: number | ""; onChange: (v: number | "") => void; hint?: string; id: string }) {
  return (
    <label htmlFor={id} className="block">
      <span className="text-sm font-medium text-ink">{label}</span>
      <div className="mt-1.5 flex items-center border border-line rounded-md bg-white focus-within:border-brand focus-within:ring-2 focus-within:ring-brand-soft">
        <span className="pl-3.5 text-ink-faint">₹</span>
        <input id={id} inputMode="numeric" className="w-full px-2 py-2.5 rounded-md outline-none num bg-transparent" value={value === "" ? "" : Number(value).toLocaleString("en-IN")}
          onChange={(e) => { const d = e.target.value.replace(/[^0-9]/g, ""); onChange(d === "" ? "" : Number(d)); }} placeholder="0" />
      </div>
      {hint && <span className="text-xs text-ink-faint mt-1 block">{hint}</span>}
    </label>
  );
}

export function Steps({ step, labels }: { step: number; labels: string[] }) {
  return (
    <ol className="flex gap-2" aria-label="Progress">
      {labels.map((l, i) => (
        <li key={l} className="flex-1">
          <div className={`h-1.5 rounded-full ${i <= step ? "bg-brand" : "bg-gray-200"}`} />
          <div className={`text-xs mt-1.5 hidden sm:block ${i === step ? "text-ink font-medium" : "text-ink-faint"}`}>{l}</div>
        </li>
      ))}
    </ol>
  );
}
