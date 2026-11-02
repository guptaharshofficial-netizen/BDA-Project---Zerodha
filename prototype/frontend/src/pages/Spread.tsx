import { useEffect, useState } from "react";
import { BasketItem, useApp } from "../App";
import { api, inrShort } from "../api";
import { Button, Card, Disclaimer, ErrorNote, fitLevel, GoToApp, Info, Modal, Pills, RiskMeter, SPREAD_WORDS } from "../ui";
import { icon, SectorGrid, SectorMix, TopList } from "../components/Market";

const MAX_ITEMS = 20;

export default function Spread() {
  const { analysis: a, wi, setWi } = useApp();
  const [sector, setSector] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);
  const [result, setResult] = useState(false);
  if (!a) return null;
  const ex = a.explore_sectors;
  const held = Object.entries(a.analysis.sector_mix as Record<string, number>).filter(([, v]) => v >= 2).map(([k]) => k);
  const add = (row: any, kind: "stock" | "fund") => {
    if (wi.some((b) => b.id === String(row.id)) || wi.length >= MAX_ITEMS) return;
    setWi([...wi, { kind, id: String(row.id), name: row.name, symbol: row.symbol, amount: step(kind === "stock" ? 0.05 : 0.1), sector: kind === "stock" ? row.sector : undefined }]);
  };
  // default amounts scale with the portfolio so the change is visible (5% per stock, 10% per fund)
  function step(f: number) { const t = a?.analysis?.total || 500000; return Math.max(5000, Math.round((t * f) / 5000) * 5000); }
  const sectorsIn = new Set(wi.map((b) => b.sector ?? "Funds")).size;
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Spread your risk</h1>
        <p className="text-sm text-ink-faint mt-1">Open any sector's top 10, add as many stocks or funds as you like to a what-if basket, then see how your risk would change.</p>
      </div>

      {(ex.next_sectors.length > 0 || ex.over_concentrated.length > 0) && (
        <div className="bg-white border border-line rounded-lg p-4">
          {ex.next_sectors.length > 0 && <>
            <div className="text-[13px] font-medium text-ink-soft">Sectors you barely hold <span className="font-normal text-ink-faint">· biggest share of the market first</span></div>
            <div className="flex gap-2 mt-2 overflow-x-auto no-scrollbar pb-1">
              {ex.next_sectors.map((n: any) => (
                <button key={n.sector} onClick={() => setSector(n.sector)} title={n.why}
                  className="shrink-0 text-[13px] border border-brand/40 text-brand-ink bg-brand-soft rounded-full px-3 py-1.5 hover:bg-brand hover:text-white">
                  {icon(n.sector)} {n.sector} <span className="opacity-70">· {n.market_share.toFixed(0)}% of market</span>
                </button>))}
            </div>
          </>}
          {ex.over_concentrated.length > 0 && <p className="text-[13px] text-amber-800 mt-3">⚠ You're already heavy in <b>{ex.over_concentrated.join(", ")}</b>; adding more there raises your risk.</p>}
        </div>
      )}

      <div className="grid lg:grid-cols-[1fr_340px] gap-5 items-start">
        <Card pad={false} className="py-2">
          <SectorGrid onPick={setSector} held={held} highlight={ex.next_sectors.slice(0, 3).map((n: any) => n.sector)} />
        </Card>
        <aside className="hidden lg:block lg:sticky lg:top-20">
          <WhatIfBasket onCheck={() => setResult(true)} />
        </aside>
      </div>

      {/* phone and tablet: the basket is a bar above the tab bar */}
      {wi.length > 0 && (
        <div className="lg:hidden fixed inset-x-0 bottom-[60px] md:bottom-0 z-20 px-3 pb-2" style={{ marginBottom: "env(safe-area-inset-bottom)" }}>
          <div className="max-w-6xl mx-auto bg-ink text-white rounded-lg shadow-pop flex items-center gap-3 px-4 py-3">
            <button className="flex-1 text-left text-sm min-w-0" onClick={() => setSheet(true)}>
              <b>What-if basket · {wi.length}</b><span className="block text-xs text-white/70 truncate">{inrShort(wi.reduce((s, b) => s + b.amount, 0))} across {sectorsIn} sector{sectorsIn > 1 ? "s" : ""} · tap to edit</span>
            </button>
            <Button size="sm" onClick={() => setResult(true)}>Check risk</Button>
          </div>
        </div>
      )}
      {sheet && <Modal title="What-if basket" onClose={() => setSheet(false)}><WhatIfBasket bare onCheck={() => { setSheet(false); setResult(true); }} /></Modal>}

      {sector && <TopList sector={sector} onClose={() => setSector(null)} addLabel="+ What-if" onAdd={add} added={wi.map((b) => b.id)}
        warn={ex.over_concentrated.includes(sector) ? `You already have a lot in ${sector}.` : undefined} />}
      {result && <WhatIfResult items={wi} onClose={() => setResult(false)} />}
    </div>
  );
}

/** The list of instruments being tried, with amounts. */
function WhatIfBasket({ onCheck, bare }: { onCheck: () => void; bare?: boolean }) {
  const { wi, setWi } = useApp();
  const total = wi.reduce((s, b) => s + b.amount, 0);
  const setAmt = (i: number, v: number) => setWi(wi.map((b, j) => (j === i ? { ...b, amount: v } : b)));
  const body = (
    <>
      {wi.length === 0 ? (
        <div className="text-sm text-ink-faint">
          <p>Empty. Open <b className="text-ink-soft">Top 10</b> in any sector and tap <b className="text-ink-soft">+ What-if</b>.</p>
          <p className="mt-2">Try mixing a few sectors, for example one IT stock, one healthcare stock and an index fund, to see how spreading changes your risk.</p>
        </div>
      ) : (
        <ul className="divide-y divide-line -mx-1">
          {wi.map((b, i) => (
            <li key={b.id} className="flex items-center gap-2 py-2 px-1 text-sm">
              <span aria-hidden className="w-6 text-center">{b.kind === "stock" ? icon(b.sector ?? "") : "📈"}</span>
              <div className="flex-1 min-w-0">
                <div className="truncate font-medium" title={b.name}>{b.symbol ?? b.name}</div>
                <div className="text-[11px] text-ink-faint truncate">{b.kind === "stock" ? b.sector : "Mutual fund"}</div>
              </div>
              <div className="flex items-center border border-line rounded"><span className="pl-2 text-ink-faint text-xs">₹</span>
                <input aria-label={`Amount for ${b.name}`} inputMode="numeric" className="w-20 px-1.5 py-1 text-right num text-[13px] outline-none rounded" value={b.amount.toLocaleString("en-IN")}
                  onChange={(e) => setAmt(i, Number(e.target.value.replace(/\D/g, "")) || 0)} /></div>
              <button aria-label={`Remove ${b.name}`} className="text-ink-faint hover:text-down px-1" onClick={() => setWi(wi.filter((_, j) => j !== i))}>✕</button>
            </li>
          ))}
        </ul>
      )}
      {wi.length > 0 && (
        <div className="mt-4 space-y-2">
          <div className="flex justify-between text-sm"><span className="text-ink-faint">Total to add</span><b className="num">{inrShort(total)}</b></div>
          <Button full onClick={onCheck} disabled={!total}>See how my risk changes →</Button>
          <button className="w-full text-[12px] text-ink-faint hover:text-down py-1" onClick={() => setWi([])}>Clear basket</button>
        </div>
      )}
    </>
  );
  if (bare) return body;
  return <Card title={`What-if basket${wi.length ? ` · ${wi.length}` : ""}`} subtitle="Nothing is bought. Add up to 20 stocks or funds.">{body}</Card>;
}

/** Before vs after: risk, how spread out, sector mix, and a value range for everything added. */
export function WhatIfResult({ items, onClose }: { items: BasketItem[]; onClose: () => void }) {
  const { analysis: a, sid, userId } = useApp();
  const [years, setYears] = useState(5);
  const [res, setRes] = useState<any>(null);
  const [err, setErr] = useState("");
  const fit = a ? fitLevel(a.recommendations) : undefined;
  const goal = a ? [...a.goals].sort((x: any, y: any) => (x.priority ?? 9) - (y.priority ?? 9))[0] : null;
  const key = JSON.stringify([items.map((b) => [b.id, b.amount]), years]);
  useEffect(() => {
    setErr("");
    api.whatif({ session: sid, user_id: userId, add: items.map((b) => ({ kind: b.kind, id: b.id, amount: b.amount, sip: b.sip ?? 0 })), years, horizon: goal?.years ?? null, capacity: a?.capacity_suitability ?? null })
      .then(setRes).catch((e) => setErr(String((e as Error).message)));
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const d = res ? res.after.risk.score - (res.before.risk?.score ?? 0) : 0;
  const t = res?.projection?.total;
  return (
    <Modal wide title={`What if you add ${items.length === 1 ? items[0].symbol ?? items[0].name : `these ${items.length}`}?`} onClose={onClose}>
      {err && <ErrorNote msg={err} />}
      {!res && !err && <p className="text-sm text-ink-faint">Working it out…</p>}
      {res && (
        <div className="space-y-5">
          <div className={`rounded-lg p-4 text-sm ${d > 1 ? "bg-amber-50 text-amber-950" : d < -1 ? "bg-green-50 text-green-900" : "bg-gray-50 text-ink-soft"}`}>
            <b>{Math.abs(d) < 1 ? "Your overall risk barely changes." : d < 0 ? `Your overall risk would fall by ${Math.abs(d).toFixed(0)} points.` : `Your overall risk would rise by ${d.toFixed(0)} points.`}</b>{" "}
            How spread out: {SPREAD_WORDS[res.before.concentration?.level] ?? "—"} → <b>{SPREAD_WORDS[res.after.concentration.level]}</b>.
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="border border-line rounded-lg p-4"><div className="text-[13px] text-ink-faint mb-3">Risk now</div>{res.before.risk ? <RiskMeter level={res.before.risk.band} fitMax={fit} score={res.before.risk.score} /> : "—"}</div>
            <div className="border border-brand rounded-lg p-4"><div className="text-[13px] text-brand-ink mb-3">Risk after adding</div><RiskMeter level={res.after.risk.band} fitMax={fit} score={res.after.risk.score} label="After" /></div>
          </div>
          <div className="grid md:grid-cols-2 gap-5">
            <div>
              <div className="text-sm font-medium mb-2">What you'd add, by sector</div>
              <ul className="space-y-1.5 text-sm">
                {Object.entries(res.added_by_sector as Record<string, number>).sort((x, y) => y[1] - x[1]).map(([s, v]) => (
                  <li key={s} className="flex justify-between gap-2"><span className="truncate">{s.startsWith("Mutual") ? "📈" : icon(s)} {s}</span><span className="num">{inrShort(v)}</span></li>))}
              </ul>
              <div className="mt-4 border-t border-line pt-3">
                <div className="flex items-center justify-between gap-2 flex-wrap"><span className="text-sm font-medium">Value after</span>
                  <Pills label="Years" value={years} onChange={setYears} options={[{ v: 1, l: "1y" }, { v: 3, l: "3y" }, { v: 5, l: "5y" }, { v: 10, l: "10y" }]} /></div>
                <div className="text-2xl font-semibold num mt-2">{inrShort(t.conservative)} – {inrShort(t.optimistic)}</div>
                <div className="text-xs text-ink-faint">Range for {inrShort(res.added_total)} in different market conditions{res.projection.past_total?.value ? `; if past returns repeat (where history exists): ${inrShort(res.projection.past_total.value)}` : ""}.</div>
              </div>
              <ul className="mt-4 divide-y divide-line border-y border-line">
                {items.map((b) => (
                  <li key={b.id} className="py-2 flex items-center gap-2 text-sm"><span className="flex-1 truncate">{b.symbol ?? b.name}</span><span className="num text-ink-faint">{inrShort(b.amount)}</span><GoToApp compact kind={b.kind} copy={b.symbol ?? b.name} /></li>))}
              </ul>
            </div>
            <div>
              <div className="text-sm font-medium mb-2">Sector mix: now vs after</div>
              <SectorMix mix={res.after.sector_mix} bench={res.benchmark_mix} compare={res.before.sector_mix ?? {}} youLabel="After" compareLabel="Now" />
            </div>
          </div>
          {res.after.risk.band > (fit ?? 4) && <Info tone="warn">After these additions your risk would be above what fits your goal timeline and finances.</Info>}
          <Disclaimer>A what-if, not a suggestion to buy. Ranges use fixed assumptions; past returns don't guarantee future returns. No fees or taxes.</Disclaimer>
        </div>
      )}
    </Modal>
  );
}
