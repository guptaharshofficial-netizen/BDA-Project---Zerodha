import { useState } from "react";
import { BasketItem, useApp } from "../App";
import { inrShort } from "../api";
import { Button, Card, fitLevel, Info, Modal, RecCard, RiskMeter, RISK_WORDS, SPREAD_WORDS } from "../ui";
import { icon, PeersCard, SectorGrid, SectorMix, TopList } from "../components/Market";

export default function NewPlan() {
  const { newA: a, profile, basket, setBasket, openLesson, setTab, meta, busy } = useApp();
  const [sector, setSector] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<BasketItem | null>(null);
  const [last, setLast] = useState<string>("");
  if (!a || !profile) return null;
  const ms = a.money;
  const fit = fitLevel(a.recommendations);
  const budget = ms?.invest_lumpsum || a.budget || 0;
  const spent = basket.reduce((s, b) => s + b.amount, 0);
  const stocks = basket.filter((b) => b.kind === "stock").reduce((s, b) => s + b.amount, 0);
  const cap = meta.thresholds.new_user_direct_equity_cap;
  const next = a.explore_sectors?.next_sectors ?? [];
  const heldSectors = Object.entries(a.analysis?.sector_mix ?? {}).filter(([, v]) => (v as number) >= 2).map(([k]) => k);

  const add = (row: any, kind: "stock" | "fund") => {
    if (basket.some((b) => b.id === row.id)) { setLast(`${row.name} is already in your basket.`); setSector(null); return; }
    const amt = kind === "stock" ? Math.max(1000, Math.round((budget || 100000) * 0.1 / 1000) * 1000) : Math.max(1000, Math.round((budget || 100000) * 0.2 / 1000) * 1000);
    const item: BasketItem = { kind, id: String(row.id), name: row.name, amount: amt, sector: row.sector };
    if (kind === "stock" && budget && (stocks + amt) / budget > cap) { setConfirm(item); return; }
    commit(item);
  };
  const commit = (item: BasketItem) => {
    setBasket([...basket, item]); setSector(null);
    setLast(`Added ${item.name}${item.sector ? ` (${item.sector})` : ""}.`);
  };
  const setAmt = (i: number, v: number) => setBasket(basket.map((b, j) => (j === i ? { ...b, amount: v } : b)));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-ink-faint">Your plan{profile.goal ? ` · ${profile.goal}` : ""}</p>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Let's build your portfolio, one step at a time</h1>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        <Card>
          <div className="text-xs font-medium text-ink-faint uppercase tracking-wide">Your money</div>
          <div className="text-2xl font-semibold num mt-1">{inrShort(ms?.left_each_month)} <span className="text-sm font-normal text-ink-faint">left / month</span></div>
          <div className="text-sm text-ink-soft mt-2 space-y-0.5">
            <div>Investing now: <b className="num">{inrShort(ms?.invest_lumpsum)}</b>{ms?.invest_monthly ? <> + <b className="num">{inrShort(ms.invest_monthly)}</b>/month</> : null}</div>
            {ms?.emergency_months != null && <div>Emergency cushion: <b>{ms.emergency_months.toFixed(1)} months</b> of spending{ms.emergency_months < 3 && <span className="text-amber-700"> (3–6 is a common target)</span>}</div>}
            {ms?.outside_total > 0 && <div>Invested elsewhere: <b className="num">{inrShort(ms.outside_total)}</b></div>}
          </div>
        </Card>
        <Card>
          <div className="text-xs font-medium text-ink-faint uppercase tracking-wide">Risk that fits you</div>
          <div className="text-2xl font-semibold mt-1">Up to {RISK_WORDS[fit]}</div>
          <p className="text-sm text-ink-soft mt-2">You said you'd be <b>{["", "cautious", "careful", "steady", "bold"][a.willingness]}</b> in a market fall; your finances can take <b>{RISK_WORDS[a.capacity_suitability ?? 1].toLowerCase()}</b> risk. We go with the lower of the two.</p>
        </Card>
        <Card>
          <div className="text-xs font-medium text-ink-faint uppercase tracking-wide">Investors like you</div>
          <div className="text-xl font-semibold mt-1">{a.persona.name}</div>
          <p className="text-sm text-ink-soft mt-1">{a.persona.description}</p>
          <Button size="sm" kind="ghost" onClick={() => setTab("peers")}>See what they invest in →</Button>
        </Card>
      </div>

      {a.consistency_flag && <Info tone="warn"><b>Worth a second look:</b> you said you'd buy more in a crash, but your monthly surplus and savings suggest a big fall would hurt. We'll keep suggestions within what your finances can take.</Info>}

      <Card title="A good place to start" subtitle="Simple options that suit people starting out. We never suggest individual stocks to new investors; you can still pick your own below.">
        {a.recommendations.education_only ? <Info>{a.recommendations.message}</Info> :
          <div className="grid md:grid-cols-3 gap-3">{a.recommendations.cards.map((c: any) => <RecCard key={c.category} c={c} onLearn={openLesson} />)}</div>}
      </Card>

      <div className="grid lg:grid-cols-[1fr_360px] gap-6 items-start">
        <div className="space-y-6">
          <Card title={basket.length ? "Keep building: spread your risk" : "Step 1 · Pick a sector to start"}
            subtitle={basket.length ? "Sectors marked 'look here next' are ones you don't hold yet, biggest share of the market first." : "Sectors ranked by how their stocks did over the last year. Open one to see its top 15 stocks or funds."}>
            <SectorGrid cols={2} onPick={setSector} highlight={basket.length ? next.slice(0, 3).map((n: any) => n.sector) : []} held={heldSectors} />
          </Card>
          {basket.length > 0 && a.analysis && !a.analysis.empty && (
            <Card title="Your mix vs the market" subtitle="Being far above the market in one sector means one bad sector hurts more."><SectorMix mix={a.analysis.sector_mix} bench={a.analysis.benchmark_mix} /></Card>
          )}
        </div>

        <aside className="lg:sticky lg:top-24 space-y-3">
          <Card title="Your basket" subtitle={budget ? `${inrShort(spent)} of ${inrShort(budget)} planned` : undefined}>
            {budget > 0 && <div className="h-2 bg-gray-100 rounded-full mb-4" aria-hidden><div className={`h-2 rounded-full ${spent > budget ? "bg-amber-500" : "bg-brand"}`} style={{ width: `${Math.min(100, (spent / budget) * 100)}%` }} /></div>}
            {basket.length === 0 ? <p className="text-sm text-ink-faint">Empty. Open a sector and add a stock or fund to begin.</p> : (
              <ul className="space-y-2.5">
                {basket.map((b, i) => (
                  <li key={b.id} className="flex items-center gap-2 text-sm">
                    <span aria-hidden>{b.kind === "stock" ? icon(b.sector ?? "") : "📈"}</span>
                    <span className="flex-1 min-w-0 truncate" title={b.name}>{b.name}</span>
                    <input aria-label={`Amount for ${b.name}`} inputMode="numeric" className="w-24 border border-line rounded-lg px-2 py-1 text-right num" defaultValue={b.amount.toLocaleString("en-IN")}
                      onBlur={(e) => setAmt(i, Number(e.target.value.replace(/\D/g, "")) || 0)} />
                    <button aria-label={`Remove ${b.name}`} className="text-ink-faint hover:text-down" onClick={() => setBasket(basket.filter((_, j) => j !== i))}>✕</button>
                  </li>
                ))}
              </ul>
            )}
            {last && <p className="text-xs text-brand-ink bg-brand-soft rounded-lg px-3 py-2 mt-3">{last}</p>}
            {a.risk && (
              <div className="mt-5 pt-4 border-t border-line space-y-4">
                <RiskMeter level={a.risk.band} fitMax={fit} score={a.risk.score} label="Your basket" />
                <div className="text-sm"><span className="text-ink-faint">How spread out:</span> <b>{SPREAD_WORDS[a.concentration?.level as string] ?? "—"}</b>
                  {a.concentration?.level !== "Low" && a.concentration?.most_overweight_sector && <span className="text-ink-faint"> (heavy in {a.concentration.most_overweight_sector})</span>}</div>
                {budget > 0 && <div className="text-sm"><span className="text-ink-faint">Single stocks:</span> <b className="num">{Math.round((stocks / budget) * 100)}%</b> of your plan <span className="text-ink-faint">(suggested limit {Math.round(cap * 100)}% while you're new)</span></div>}
                {next.length > 0 && (
                  <div>
                    <div className="text-sm font-medium">To spread your risk, look at next</div>
                    <div className="flex flex-wrap gap-2 mt-2">{next.slice(0, 3).map((n: any) => (
                      <button key={n.sector} onClick={() => setSector(n.sector)} className="text-sm border border-brand text-brand-ink bg-brand-soft rounded-full px-3 py-1 hover:bg-brand hover:text-white" title={n.why}>{icon(n.sector)} {n.sector}</button>))}</div>
                    <p className="text-xs text-ink-faint mt-2">{next[0]?.why} Spreading across sectors that move differently lowers the chance one bad sector hurts the whole portfolio.</p>
                  </div>
                )}
              </div>
            )}
            {basket.length > 0 && <div className="mt-5 grid gap-2"><Button full onClick={() => setTab("calc")}>See what this could grow to →</Button>
              <p className="text-[11px] text-ink-faint text-center">This basket is for planning. Nothing is bought.</p></div>}
            {busy && <p className="text-xs text-ink-faint mt-2" role="status">Updating…</p>}
          </Card>
        </aside>
      </div>

      {sector && <TopList sector={sector} onClose={() => setSector(null)} onAdd={add} addLabel="Add"
        warn={a.explore_sectors?.over_concentrated?.includes(sector) ? `You already have a lot in ${sector}. Adding more increases your risk.` : undefined} />}
      {confirm && (
        <Modal title="Quick check before adding" onClose={() => setConfirm(null)}>
          <p className="text-sm text-ink-soft">Adding <b>{confirm.name}</b> puts {Math.round(((stocks + confirm.amount) / budget) * 100)}% of your plan into single stocks. While you're new, we suggest keeping that under {Math.round(cap * 100)}%: individual companies can fall a lot, and a few picks aren't well spread.</p>
          <p className="text-sm text-ink-soft mt-2">You can still add it. This is just a pause to check.</p>
          <div className="flex gap-2 justify-end mt-5"><Button kind="secondary" onClick={() => setConfirm(null)}>Cancel</Button><Button onClick={() => { const c = confirm; setConfirm(null); commit(c); }}>Add anyway</Button></div>
        </Modal>
      )}
    </div>
  );
}
