import { useState } from "react";
import { useApp } from "../App";
import { Badge, Button, GoToApp, Info, WhyDrawer } from "../ui";
import { TopList } from "../components/Market";

const GROUP_STYLE: Record<string, { icon: string; bar: string; tint: string }> = {
  safety: { icon: "🛟", bar: "#1f9d55", tint: "bg-green-50" },
  funds: { icon: "🧺", bar: "#387ed1", tint: "bg-blue-50" },
  diversifiers: { icon: "🪙", bar: "#d4a017", tint: "bg-amber-50" },
  stocks: { icon: "📊", bar: "#7a5af8", tint: "bg-violet-50" },
  credit: { icon: "🏷️", bar: "#8a919c", tint: "bg-gray-50" },
  trading: { icon: "⛔", bar: "#c3c8d0", tint: "bg-gray-50" },
};
const pct = (v: number) => `${Math.round(v * 100)}%`;

export default function PeersPage() {
  const { analysis, newA, mode, openLesson } = useApp();
  const [funds, setFunds] = useState<string | null>(null);
  const a = mode === "existing" ? analysis : newA;
  if (!a) return null;
  const p = a.peers;
  const rec = a.recommendations;
  const cardFor = (c: string) => rec.cards?.find((x: any) => x.category === c);
  const notFor = (c: string) => rec.not_suggested?.find((x: any) => x.category === c);
  const common = p.enough ? p.rows.filter((r: any) => r.adoption >= p.threshold && !r.blocked && r.tier !== "Credit") : [];
  const haveCommon = common.filter((r: any) => r.you_hold).length;

  return (
    <div className="space-y-6">
      {/* Who your group is */}
      <section className="rounded-lg overflow-hidden border border-line bg-white">
        <div className="bg-gradient-to-r from-[#1f5aa6] to-[#387ed1] text-white px-5 py-5 sm:px-6 sm:py-6 flex flex-col sm:flex-row gap-5 sm:items-center">
          <div className="flex-1 min-w-0">
            <div className="text-xs uppercase tracking-wider text-white/70">Investors like you</div>
            <h1 className="text-2xl sm:text-[28px] font-semibold mt-1">{a.persona.name}</h1>
            <p className="text-sm text-white/85 mt-1.5 max-w-xl">{a.persona.description}</p>
          </div>
          {p.enough && (
            <div className="flex gap-6 sm:gap-8 shrink-0">
              <div><div className="text-3xl font-semibold num">{p.n.toLocaleString("en-IN")}</div><div className="text-xs text-white/75">people in your group</div></div>
              <div><div className="text-3xl font-semibold num">{haveCommon}<span className="text-lg text-white/70">/{common.length}</span></div><div className="text-xs text-white/75">of their common picks you have</div></div>
            </div>
          )}
        </div>
        <p className="px-5 sm:px-6 pt-3 text-xs text-ink-soft">Figures come only from investors who agreed to this use, and a group figure is shown only when at least 50 people are in it, so no one can be singled out.</p>
        <p className="px-5 sm:px-6 py-3 text-xs text-ink-faint">Grouped by how people invest (how often they trade, how much is automatic, how much risk they hold, how much they put in), never by age, gender or where they live. In this demo the group is simulated.</p>
      </section>

      {!p.enough ? <Info>{p.message}</Info> : <>
        {/* Areas to improve */}
        <section>
          <div className="flex items-end justify-between gap-3 mb-3">
            <div><h2 className="text-lg font-semibold">Areas to improve</h2>
              <p className="text-[13px] text-ink-faint">Things at least {pct(p.threshold)} of your group hold that you don't. Common isn't the same as right for you, so each one says whether it fits your profile.</p></div>
          </div>
          {p.gaps.length === 0 ? <Info tone="good">Nice: you already hold everything that's common in your group.</Info> : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {p.gaps.map((g: any) => {
                const card = cardFor(g.category);
                const no = notFor(g.category);
                const st = GROUP_STYLE[Object.keys(GROUP_STYLE).find((k) => p.groups.find((x: any) => x.key === k)?.label === g.group) ?? "funds"];
                return (
                  <article key={g.category} className="bg-white border border-line rounded-lg p-4 flex flex-col">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${st.tint} text-ink-soft`}>{st.icon} {g.group}</span>
                      {card ? <Badge tone="ok">Fits your profile</Badge> : <Badge tone="warn">Not for you right now</Badge>}
                    </div>
                    <h3 className="font-semibold mt-3">{g.label}</h3>
                    <div className="flex items-baseline gap-2 mt-2"><span className="text-3xl font-semibold num" style={{ color: st.bar }}>{pct(g.adoption)}</span><span className="text-[13px] text-ink-faint">of your group hold this · you don't</span></div>
                    <div className="h-1.5 bg-gray-100 rounded-full mt-2" aria-hidden><div className="h-1.5 rounded-full" style={{ width: pct(g.adoption), background: st.bar }} /></div>
                    {!card && no && <p className="text-[13px] text-amber-800 mt-3">{no.reason}</p>}
                    {card && <p className="text-[13px] text-ink-soft mt-3 flex-1">{card.headline}</p>}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {card && g.fund_group && <Button size="sm" onClick={() => setFunds(g.fund_group)}>See top 10 funds</Button>}
                      {card && (card.surface === "Kite" || card.surface === "Coin") && <GoToApp kind={card.surface === "Kite" ? "stock" : "fund"} />}
                      <Button size="sm" kind="ghost" onClick={() => openLesson(card?.learn ?? "diversification")}>Learn</Button>
                    </div>
                    {card && <WhyDrawer why={card.why} />}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* What they hold, by major group → product type → scheme types */}
        <section>
          <h2 className="text-lg font-semibold">What they hold</h2>
          <p className="text-[13px] text-ink-faint mb-3">Big groups first, then the types inside each. Bars show the share of your group holding each type.</p>
          <div className="grid md:grid-cols-2 gap-3">
            {p.groups.map((g: any) => {
              const st = GROUP_STYLE[g.key] ?? GROUP_STYLE.funds;
              return (
                <article key={g.key} className={`bg-white border border-line rounded-lg overflow-hidden ${g.blocked ? "opacity-70" : ""}`}>
                  <header className={`px-4 py-3 border-b border-line flex items-start gap-3 ${st.tint}`} style={{ borderLeft: `4px solid ${st.bar}` }}>
                    <span className="text-2xl leading-none" aria-hidden>{st.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-semibold">{g.label}</h3>
                        {!g.blocked && <span className="text-xs text-ink-soft whitespace-nowrap">You: {g.you_hold} of {g.subtypes.length}</span>}
                      </div>
                      <p className="text-xs text-ink-soft mt-0.5">{g.blurb}</p>
                    </div>
                  </header>
                  <ul className="divide-y divide-line">
                    {g.subtypes.map((s: any) => (
                      <li key={s.category} className="px-4 py-3">
                        <div className="flex items-center justify-between gap-2 text-sm">
                          <span className="font-medium truncate">{s.label}</span>
                          <span className="flex items-center gap-2 shrink-0">
                            <b className="num">{pct(s.adoption)}</b>
                            {s.blocked ? <Badge tone="muted">never suggested</Badge> : s.tier === "Credit" ? <Badge tone="muted">only if you need cash</Badge> : s.you_hold ? <Badge tone="ok">✓ you have</Badge> : s.common ? <Badge tone="warn">gap</Badge> : null}
                          </span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full mt-1.5" aria-hidden><div className="h-1.5 rounded-full" style={{ width: pct(s.adoption), background: s.blocked ? "#c3c8d0" : st.bar, opacity: s.you_hold ? 1 : 0.55 }} /></div>
                        {s.kinds.length > 0 && (
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            <span className="text-[11px] text-ink-faint">Scheme types inside:</span>
                            {s.kinds.map((k: string) => <span key={k} className="text-[11px] px-2 py-0.5 rounded border border-line text-ink-soft bg-white">{k}</span>)}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </article>
              );
            })}
          </div>
          <p className="text-xs text-ink-faint mt-3">Share of {p.n.toLocaleString("en-IN")} similar investors holding each type (simulated in this demo). A "type" is a kind of product, not one fund. F&O and margin trading are shown for context and never suggested.</p>
        </section>
      </>}
      {funds && <TopList initialGroup={funds} onClose={() => setFunds(null)} addLabel="Estimate" onAdd={() => setFunds(null)} />}
    </div>
  );
}
