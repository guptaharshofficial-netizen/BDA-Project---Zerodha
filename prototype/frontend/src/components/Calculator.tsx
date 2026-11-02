import { useEffect, useRef, useState } from "react";
import { api, inrShort } from "../api";
import { Badge, Button, Disclaimer, ErrorNote, Info, Pills } from "../ui";

export interface CalcItem { kind: "stock" | "fund"; id: string; name: string; amount: number; sip: number }

export function SearchBox({ onPick, kind = "all", placeholder = "Search a stock or mutual fund, e.g. Infosys or Nifty 50" }: { onPick: (r: any) => void; kind?: string; placeholder?: string }) {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<any[]>([]);
  const t = useRef<number>();
  useEffect(() => {
    window.clearTimeout(t.current);
    if (q.trim().length < 2) { setRes([]); return; }
    t.current = window.setTimeout(() => api.search(q, kind).then(setRes), 200);
  }, [q, kind]);
  return (
    <div className="relative">
      <input aria-label="Search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder}
        className="w-full border border-line rounded-md pl-10 pr-3 py-3 outline-none focus:border-brand focus:ring-2 focus:ring-brand-soft" />
      <span className="absolute left-3.5 top-3 text-ink-faint" aria-hidden>⌕</span>
      {res.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full bg-white border border-line rounded-lg shadow-pop max-h-80 overflow-y-auto">
          {res.map((r) => (
            <li key={r.kind + r.id}>
              <button className="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-center gap-3" onClick={() => { onPick(r); setQ(""); setRes([]); }}>
                <Badge tone={r.kind === "stock" ? "neutral" : "accent"}>{r.kind === "stock" ? "Stock" : "Fund"}</Badge>
                <span className="min-w-0"><span className="block text-sm font-medium truncate">{r.name}</span><span className="block text-xs text-ink-faint truncate">{r.sub}</span></span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function Calculator({ seed, title = "What could my investments grow to?" }: { seed?: CalcItem[]; title?: string }) {
  const [items, setItems] = useState<CalcItem[]>(seed ?? []);
  const [years, setYears] = useState<number>(5);
  const [custom, setCustom] = useState("");
  const [res, setRes] = useState<any>(null);
  const [err, setErr] = useState("");
  const [how, setHow] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (seed) setItems(seed); }, [JSON.stringify(seed)]);
  const ns = items.filter((i) => i.kind === "stock").length, nf = items.length - ns;
  const y = custom ? Number(custom) : years;

  const add = (r: any) => {
    if (items.some((i) => i.id === r.id)) return;
    if ((r.kind === "stock" && ns >= 10) || (r.kind === "fund" && nf >= 10)) { setErr("You can add up to 10 stocks and 10 funds."); return; }
    setErr(""); setItems([...items, { kind: r.kind, id: r.id, name: r.name, amount: 10000, sip: 0 }]); setRes(null);
  };
  const upd = (i: number, k: "amount" | "sip", v: number) => { setItems(items.map((x, j) => (j === i ? { ...x, [k]: v } : x))); setRes(null); };
  const run = async () => {
    setBusy(true); setErr("");
    try { setRes(await api.calc({ items: items.map(({ kind, id, amount, sip }) => ({ kind, id, amount, sip })), years: y })); }
    catch (e) { setErr(String((e as Error).message)); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-ink-faint">Add up to 10 stocks and 10 mutual funds, set an amount for each, and choose how long.</p>
      </div>
      <SearchBox onPick={add} />
      {items.length > 0 && (
        <ul className="divide-y divide-line border border-line rounded-lg bg-white">
          {items.map((it, i) => (
            <li key={it.id} className="p-3 sm:p-4 flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[160px]"><div className="font-medium text-sm truncate">{it.name}</div><div className="text-xs text-ink-faint">{it.kind === "stock" ? "Stock" : "Mutual fund"}</div></div>
              <label className="text-xs text-ink-faint">One-time<br />
                <input aria-label={`One-time amount for ${it.name}`} inputMode="numeric" className="w-28 border border-line rounded-lg px-2 py-1.5 text-sm text-ink num" value={it.amount.toLocaleString("en-IN")} onChange={(e) => upd(i, "amount", Number(e.target.value.replace(/\D/g, "")) || 0)} /></label>
              <label className="text-xs text-ink-faint">Monthly (SIP)<br />
                <input aria-label={`Monthly amount for ${it.name}`} inputMode="numeric" className="w-24 border border-line rounded-lg px-2 py-1.5 text-sm text-ink num" value={it.sip.toLocaleString("en-IN")} onChange={(e) => upd(i, "sip", Number(e.target.value.replace(/\D/g, "")) || 0)} /></label>
              <button aria-label={`Remove ${it.name}`} className="text-ink-faint hover:text-down text-sm" onClick={() => { setItems(items.filter((_, j) => j !== i)); setRes(null); }}>Remove</button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium">For</span>
        <Pills label="Years" value={custom ? -1 : years} onChange={(v) => { if (v > 0) { setYears(v); setCustom(""); } }} options={[{ v: 1, l: "1 year" }, { v: 3, l: "3 years" }, { v: 5, l: "5 years" }]} />
        <input aria-label="Custom years" placeholder="or years…" className="w-24 border border-line rounded-full px-3 py-1.5 text-sm" value={custom} onChange={(e) => { setCustom(e.target.value.replace(/[^0-9.]/g, "")); setRes(null); }} />
        <Button onClick={run} disabled={!items.length || busy || !(y > 0)}>{busy ? "Calculating…" : "Calculate"}</Button>
      </div>
      {err && <ErrorNote msg={err} />}
      {res && <Result res={res} how={how} setHow={setHow} />}
    </div>
  );
}

function Result({ res, how, setHow }: { res: any; how: boolean; setHow: (v: boolean) => void }) {
  const pt = res.past_total;
  const inv = res.total_invested;
  const lo = res.total.conservative, hi = res.total.optimistic, base = res.total.base;
  const max = Math.max(hi, pt.value || 0, inv);
  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-2 gap-3">
        <div className="bg-ink text-white rounded-lg p-5">
          <div className="text-sm text-white/70">If past returns repeat</div>
          {pt.holdings_covered > 0 ? <>
            <div className="text-3xl font-semibold num mt-1">{inrShort(pt.value)}</div>
            <div className="text-sm text-white/70 mt-1">from {inrShort(pt.invested)} invested in {res.years} year{res.years === 1 ? "" : "s"} · {pt.holdings_covered} of {pt.holdings_total} holdings have enough history</div>
          </> : <div className="text-sm text-white/80 mt-2">None of these holdings has a past return long enough for a {res.years}-year view. See the range instead.</div>}
        </div>
        <div className="bg-white border border-line rounded-lg p-5">
          <div className="text-sm text-ink-faint">Range in different market conditions</div>
          <div className="text-2xl font-semibold num mt-1">{inrShort(lo)} – {inrShort(hi)}</div>
          <div className="text-sm text-ink-faint mt-1">middle case {inrShort(base)} · you invest {inrShort(inv)}</div>
          <div className="mt-3 space-y-1.5" aria-hidden>
            {[["You invest", inv, "bg-gray-300"], ["Weak markets", lo, "bg-amber-400"], ["Middle case", base, "bg-brand/70"], ["Strong markets", hi, "bg-brand"]].map(([l, v, c]) => (
              <div key={l as string} className="flex items-center gap-2 text-xs"><span className="w-24 text-ink-faint">{l}</span><div className="flex-1 h-2 bg-gray-100 rounded-full"><div className={`h-2 rounded-full ${c}`} style={{ width: `${((v as number) / max) * 100}%` }} /></div></div>
            ))}
          </div>
        </div>
      </div>
      <div className="overflow-x-auto bg-white border border-line rounded-lg">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-ink-faint border-b border-line"><th className="p-3 font-medium">Holding</th><th className="p-3 font-medium text-right">Invested</th><th className="p-3 font-medium">Past return used</th><th className="p-3 font-medium text-right">If past repeats</th><th className="p-3 font-medium text-right">Range</th></tr></thead>
          <tbody>
            {res.rows.map((r: any, i: number) => (
              <tr key={i} className="border-b border-line last:border-0 align-top">
                <td className="p-3 font-medium">{r.name}</td>
                <td className="p-3 text-right num">{inrShort(r.invested)}</td>
                <td className="p-3">{r.past ? <span className="num">{r.past.rate_pct >= 0 ? "+" : ""}{r.past.rate_pct.toFixed(1)}% <span className="text-ink-faint">({r.past.basis}{r.past.basis_years > 1 ? ", per year" : ""})</span></span> : <span className="text-xs text-ink-faint">{r.past_note}</span>}</td>
                <td className="p-3 text-right num font-semibold">{r.past ? inrShort(r.past.value) : "—"}</td>
                <td className="p-3 text-right num text-ink-soft whitespace-nowrap">{inrShort(r.scenarios.conservative.value)} – {inrShort(r.scenarios.optimistic.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button className="text-sm text-brand-dark font-medium hover:underline" aria-expanded={how} onClick={() => setHow(!how)}>{how ? "Hide" : "How is this calculated?"}</button>
      {how && (
        <Info>
          <p><b>One-time amount:</b> grows as amount × (1 + yearly return)<sup>years</sup>. <b>Monthly SIP:</b> each instalment grows from the month it's invested.</p>
          <p className="mt-1">{res.method.worked_example}</p>
          <p className="mt-1">{res.method.data}</p>
        </Info>
      )}
      <Disclaimer>Past returns don't guarantee future returns. No fees or taxes included. The range uses placeholder assumptions, not forecasts.</Disclaimer>
    </div>
  );
}
