import { useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { useApp } from "../App";
import { inr, inrShort } from "../api";
import { Badge, Button, Card, Disclaimer, fitLevel, Info, Modal, NewsList, PALETTE, RecCard, Ret, RiskMeter, RISK_WORDS } from "../ui";
import { icon, SectorMix } from "../components/Market";

const SPREAD: Record<string, string> = { Low: "Well spread", Moderate: "Somewhat concentrated", High: "Concentrated" };

export default function Overview() {
  const { analysis: a, openLesson, setTab, reloadExisting } = useApp();
  const [showNo, setShowNo] = useState(false);
  const [newsFor, setNewsFor] = useState<any>(null);
  if (!a) return null;
  const an = a.analysis, r = a.risk, rec = a.recommendations, fit = fitLevel(rec);
  const goal = [...a.goals].sort((x: any, y: any) => (x.priority ?? 9) - (y.priority ?? 9))[0];
  const money = Object.entries(an.money_by_bucket as Record<string, number>).filter(([, v]) => v > 0).sort((x, y) => y[1] - x[1]);
  const over = r && r.band > fit;
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-ink-faint">Hi {a.user.name.split(" ")[0]} · {a.user.platforms.join(", ")} connected · data as of 30 Oct 2026</p>
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Your portfolio health check</h1>
      </div>

      <div className="grid lg:grid-cols-3 gap-3">
        <Card>
          <div className="text-xs font-medium text-ink-faint uppercase tracking-wide">Total value</div>
          <div className="text-3xl font-semibold num mt-1">{inrShort(an.total)}</div>
          <div className="text-sm text-ink-soft mt-2">{an.n_holdings} holdings · {an.n_stocks} stocks</div>
          {a.idle_cash_inr > 0 && <div className="text-sm text-ink-soft">+ {inrShort(a.idle_cash_inr)} unused cash in your account</div>}
        </Card>
        <Card className="lg:col-span-2">
          <div className="flex flex-wrap justify-between gap-2">
            <div className="text-xs font-medium text-ink-faint uppercase tracking-wide">Risk vs your goal</div>
            {goal && <Badge tone="muted">Goal: {goal.name} · {goal.years} yr{goal.years === 1 ? "" : "s"}</Badge>}
          </div>
          <div className="mt-2"><RiskMeter level={r.band} fitMax={fit} score={r.score} /></div>
          <p className={`text-sm mt-3 ${over ? "text-amber-800" : "text-ink-soft"}`}>
            {over ? `Your portfolio carries more risk than fits a ${goal?.years ?? ""}-year goal and your finances (${RISK_WORDS[r.band]} vs up to ${RISK_WORDS[fit]}).`
              : `Your portfolio's risk is within what fits your goal and finances.`}
            {" "}<span className="text-ink-faint">{(rec.max_tier_reasons || []).slice(1).join(" ")}</span>
          </p>
        </Card>
      </div>

      {(a.flags.length > 0 || a.concentration.level !== "Low" || a.fno_overlay) && (
        <div className="grid gap-2">
          {a.concentration.level !== "Low" && <Alert icon="⚖️">{SPREAD[a.concentration.level]}: {a.concentration.most_overweight_sector} is {Math.round(a.concentration.overweight_pts)} points above its share of the market{an.top_stock ? `, and your biggest stock is ${Math.round(an.top_stock.weight * 100)}% of the portfolio` : ""}. <button className="underline" onClick={() => setTab("spread")}>See ways to spread it</button></Alert>}
          {a.flags.map((f: string) => <Alert key={f} icon="⚠️">{f}</Alert>)}
          {a.fno_overlay && <Alert icon="🎯">You have {a.fno_overlay.positions} open options positions ({inrShort(a.fno_overlay.premium_at_risk_inr)} at risk). We show these separately and never suggest more: SEBI found about 9 in 10 individual options buyers lost money in FY26. <button className="underline" onClick={() => openLesson("fno-leverage")}>Learn why</button></Alert>}
        </div>
      )}

      <Card title="Options to explore" subtitle="Types of investment that could fit you. We don't name specific stocks or funds to buy."
        right={<Button size="sm" kind="ghost" onClick={() => setShowNo(!showNo)}>{showNo ? "Hide" : "What we didn't suggest"}</Button>}>
        {rec.education_only ? <Info>{rec.message}</Info> : <div className="grid md:grid-cols-3 gap-3">{rec.cards.map((c: any) => <RecCard key={c.category} c={c} onLearn={openLesson} />)}</div>}
        {showNo && <ul className="mt-4 text-sm space-y-1.5 bg-gray-50 rounded-md p-4">{rec.not_suggested.map((n: any) => <li key={n.category}><b>{n.label}:</b> <span className="text-ink-soft">{n.reason}</span></li>)}</ul>}
      </Card>

      <Goals a={a} reload={reloadExisting} />

      <div className="grid lg:grid-cols-[1fr_1.2fr] gap-6">
        <Card title="Where your money is">
          <div className="h-52"><ResponsiveContainer>
            <PieChart><Pie data={money.map(([name, value]) => ({ name, value }))} dataKey="value" nameKey="name" innerRadius={58} outerRadius={88} paddingAngle={2} stroke="none" isAnimationActive={false}>
              {money.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}</Pie><Tooltip formatter={(v: number) => inrShort(v)} /></PieChart>
          </ResponsiveContainer></div>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-3 text-sm">
            {money.map(([k, v], i) => <li key={k} className="flex items-center gap-2 min-w-0"><span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: PALETTE[i % PALETTE.length] }} aria-hidden /><span className="truncate flex-1">{k}</span><span className="num text-ink-faint">{Math.round((v / an.total) * 100)}%</span></li>)}
          </ul>
        </Card>
        <Card title="Your sectors vs the market" subtitle={`${SPREAD[a.concentration.level] ?? ""}`}><SectorMix mix={an.sector_mix} bench={an.benchmark_mix} /></Card>
      </div>

      <Card title="Your holdings" pad={false}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-ink-faint border-y border-line bg-gray-50"><th className="px-4 sm:px-6 py-2.5 font-medium">Name</th><th className="px-3 py-2.5 font-medium">Type</th><th className="px-3 py-2.5 font-medium text-right">Value</th><th className="px-3 py-2.5 font-medium text-right">Share</th><th className="px-4 sm:px-6 py-2.5 font-medium text-right">1 year</th></tr></thead>
            <tbody>{a.holdings.map((h: any) => (
              <tr key={h.id} className="border-b border-line last:border-0">
                <td className="px-4 sm:px-6 py-3"><div className="font-medium">{h.display_label || (h.type === "stock" ? h.company : h.name)}</div>
                  <div className="text-xs text-ink-faint">{h.type === "stock" ? `${h.symbol} · ${h.sector}` : h.type === "fund" ? h.name : h.surface}{h.sip_monthly ? ` · SIP ${inr(h.sip_monthly)}/mo` : ""}{h.sip_status?.startsWith("stopped") ? ` · SIP ${h.sip_status}` : ""}{h.declared ? " · added by you" : ""}</div></td>
                <td className="px-3 py-3 text-ink-soft">{h.type === "stock" ? "Stock" : h.type === "fund" ? "Fund" : h.type === "smallcase" ? "smallcase" : "Outside"}</td>
                <td className="px-3 py-3 text-right num">{inrShort(h.value)}</td>
                <td className="px-3 py-3 text-right num">{Math.round((h.value / an.total) * 100)}%</td>
                <td className="px-4 sm:px-6 py-3 text-right">{h.last_1y != null ? <Ret v={h.last_1y} /> : <span className="text-ink-faint">—</span>}</td>
              </tr>))}</tbody>
          </table>
        </div>
      </Card>

      {(!!a.unknowns || a.declared?.length > 0) && <Unknowns a={a} reload={reloadExisting} />}

      {a.sector_trends.length > 0 && (
        <Card title="Your sectors: what's happening" subtitle="How the sectors you own have done, with context from the sources we have. Not a forecast.">
          <div className="grid md:grid-cols-2 gap-3">
            {a.sector_trends.map((t: any) => (
              <div key={t.sector} className="border border-line rounded-lg p-4">
                <div className="flex justify-between items-center"><b>{icon(t.sector)} {t.sector}</b><span className="text-sm">1 yr <Ret v={t.median_365d} /></span></div>
                {t.context.notes.filter((n: any) => n.source !== "—").map((n: any, i: number) => <p key={i} className="text-sm text-ink-soft mt-2">{n.text}</p>)}
                {t.context.notes.every((n: any) => n.source === "—") && <p className="text-sm text-ink-faint mt-2">No specific note in our research. Broad picture: {t.context.general[0].text}</p>}
                <div className="mt-3"><Button size="sm" kind="secondary" onClick={() => setNewsFor(t)}>Latest headlines</Button></div>
              </div>
            ))}
          </div>
          <p className="text-xs text-ink-faint mt-3">Notes: founder's letter "16 years of Zerodha", 26 Aug 2026. Headlines: Google News, live when the app's computer is online.</p>
        </Card>
      )}
      {newsFor && <Modal title={`${icon(newsFor.sector)} ${newsFor.sector}: what's happening`} onClose={() => setNewsFor(null)}><NewsList kind="sector" name={newsFor.sector} notes={[...newsFor.context.notes, ...newsFor.context.general]} /></Modal>}
      <Disclaimer>Holdings shown are illustrative demo data. A holdings snapshot can't show lifetime returns or tax lots.</Disclaimer>
    </div>
  );
}

function Alert({ icon, children }: { icon: string; children: React.ReactNode }) {
  return <div className="flex gap-3 items-start bg-white border border-line rounded-lg px-4 py-3 text-sm shadow-card"><span aria-hidden>{icon}</span><p>{children}</p></div>;
}

function Goals({ a, reload }: { a: any; reload: (x: any) => void }) {
  const [goals, setGoals] = useState<any[]>(a.goals);
  const [edit, setEdit] = useState(false);
  const upd = (i: number, k: string, v: string) => setGoals(goals.map((g, j) => (j === i ? { ...g, [k]: k === "name" ? v : Number(v.replace(/[^0-9.]/g, "")) || 0 } : g)));
  return (
    <Card title="Your goals" subtitle="Your most important goal sets how much risk fits you." right={<Button size="sm" kind="secondary" onClick={() => setEdit(!edit)}>{edit ? "Cancel" : "Edit goals"}</Button>}>
      {!edit ? (
        <div className="grid md:grid-cols-2 gap-3">
          {a.goal_fit.map((g: any, i: number) => (
            <div key={i} className="border border-line rounded-lg p-4">
              <div className="flex justify-between gap-2"><b>{g.name}</b><Badge tone={g.position === "inside" ? "ok" : g.position === "above" ? "warn" : "muted"}>{g.position === "inside" ? "On track" : g.position === "above" ? "May fall short" : g.position === "below" ? "Ahead" : "—"}</Badge></div>
              <div className="text-sm text-ink-soft mt-1">{inrShort(g.target)} in {g.years} yr{g.years === 1 ? "" : "s"} · {inrShort(g.monthly)}/month</div>
              {g.range && <div className="text-xs text-ink-faint mt-2">Monthly savings could reach {inrShort(g.range[0])}–{inrShort(g.range[2])} (estimate)</div>}
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {goals.map((g, i) => (
            <div key={i} className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-sm">
              <input aria-label="Goal" className="col-span-2 border border-line rounded-lg px-2.5 py-2" value={g.name} onChange={(e) => upd(i, "name", e.target.value)} />
              {(["target", "years", "monthly"] as const).map((k) => (
                <label key={k} className="text-xs text-ink-faint">{{ target: "Target ₹", years: "Years", monthly: "Monthly ₹" }[k]}<input className="w-full border border-line rounded-lg px-2.5 py-1.5 text-sm text-ink num" value={g[k]} onChange={(e) => upd(i, k, e.target.value)} /></label>
              ))}
            </div>
          ))}
          <div className="flex gap-2">
            <Button kind="secondary" size="sm" onClick={() => setGoals([...goals, { name: "New goal", target: 500000, years: 5, monthly: 5000, priority: goals.length + 1 }])}>+ Add goal</Button>
            <Button size="sm" onClick={() => { reload({ goals }); setEdit(false); }}>Save and re-check</Button>
          </div>
        </div>
      )}
    </Card>
  );
}

function Unknowns({ a, reload }: { a: any; reload: (x: any) => void }) {
  const d = a.off_platform_declarable;
  const [val, setVal] = useState<number>(d?.value ?? 0);
  return (
    <Card title="What we can't see">
      {a.unknowns?.map((u: string) => <p key={u} className="text-sm text-ink-soft">{u}</p>)}
      {a.declared?.length > 0 && <Info tone="good">Included: {a.declared.map((x: any) => `${x.label} ${inrShort(x.value)}`).join(", ")}. Your risk check now counts them.</Info>}
      {d && !a.declared?.length && (
        <div className="flex flex-wrap items-end gap-2 mt-3">
          <label className="text-sm">{d.label} (₹)<br /><input className="border border-line rounded-md px-3 py-2 w-44 num" value={val.toLocaleString("en-IN")} onChange={(e) => setVal(Number(e.target.value.replace(/\D/g, "")) || 0)} /></label>
          <Button onClick={() => reload({ declared: [{ label: d.label, category: d.category, value: val }] })}>Add and re-check</Button>
        </div>
      )}
    </Card>
  );
}
