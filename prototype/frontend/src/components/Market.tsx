import { useEffect, useState } from "react";
import { api, inr } from "../api";
import { Badge, Button, GoToApp, Info, Loading, Modal, NewsList, Ret } from "../ui";

const SECTOR_ICON: Record<string, string> = {
  "Financial Services": "🏦", IT: "💻", Energy: "⚡", FMCG: "🛒", Auto: "🚗", "Capital Goods": "🏗️", Healthcare: "🩺",
  "Metals & Mining": "⛏️", Telecom: "📡", Utilities: "🔌", Others: "🧩",
};
export const icon = (s: string) => SECTOR_ICON[s] ?? "•";
export const TOP_N = 10;

/** Sectors as a compact, Kite-watchlist-style list, ranked by last-1-year performance. */
export function SectorGrid({ onPick, highlight, held }: { onPick: (s: string) => void; highlight?: string[]; held?: string[]; cols?: 2 | 3 }) {
  const [sv, setSv] = useState<any>(null);
  const [ctx, setCtx] = useState<any>(null);
  useEffect(() => { api.sectors().then(setSv); }, []);
  if (!sv) return <Loading what="Loading sectors" />;
  return (
    <div>
      <div className="hidden sm:grid grid-cols-[1fr_80px_80px_70px_auto] gap-3 px-3 pb-2 text-[11px] uppercase tracking-wide text-ink-faint border-b border-line">
        <span>Sector</span><span className="text-right">1 year</span><span className="text-right">1 month</span><span className="text-right">Stocks up</span><span className="w-[178px]" />
      </div>
      <ul className="divide-y divide-line">
        {sv.rows.map((r: any, i: number) => {
          const hi = highlight?.includes(r.sector) && !held?.includes(r.sector);
          return (
            <li key={r.sector} className={`px-3 py-3 sm:grid sm:grid-cols-[1fr_80px_80px_70px_auto] sm:items-center gap-3 hover:bg-gray-50/80 ${hi ? "bg-brand-soft/40" : ""}`}>
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-9 h-9 rounded-md bg-gray-50 border border-line grid place-items-center text-lg shrink-0" aria-hidden>{icon(r.sector)}</span>
                <div className="min-w-0">
                  <div className="font-medium text-[15px] truncate">{r.sector}</div>
                  <div className="text-xs text-ink-faint flex flex-wrap items-center gap-1.5">#{i + 1} · {r.n} stocks
                    {held?.includes(r.sector) && <Badge tone="muted">you hold</Badge>}
                    {hi && <Badge tone="ok">look here next</Badge>}
                  </div>
                </div>
              </div>
              <div className="flex sm:contents gap-5 mt-2 sm:mt-0 pl-12 sm:pl-0 text-sm">
                <div className="sm:text-right"><span className="sm:hidden text-[11px] text-ink-faint mr-1">1Y</span><Ret v={r.median_365d} /></div>
                <div className="sm:text-right"><span className="sm:hidden text-[11px] text-ink-faint mr-1">1M</span><Ret v={r.median_30d} /></div>
                <div className="sm:text-right num text-ink-soft"><span className="sm:hidden text-[11px] text-ink-faint mr-1">Up</span>{Math.round(r.share_positive_365d * 100)}%</div>
              </div>
              <div className="flex gap-2 mt-2.5 sm:mt-0 pl-12 sm:pl-0 sm:justify-end">
                <Button size="sm" onClick={() => onPick(r.sector)}>Top {TOP_N}</Button>
                <Button size="sm" kind="secondary" onClick={() => setCtx(r)}>What's happening?</Button>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-ink-faint mt-3 px-3">
        Ranked by the typical (median) stock's price change over the last year. Nifty 500: {sv.benchmark.chg_365d > 0 ? "+" : ""}{sv.benchmark.chg_365d?.toFixed(1)}%. Past performance, not a recommendation. Data: {sv.mode}, as of {sv.asof}.
      </p>
      {ctx && (
        <Modal title={`${icon(ctx.sector)} ${ctx.sector}: what's happening`} onClose={() => setCtx(null)}>
          <NewsList kind="sector" name={ctx.sector} notes={[...ctx.context.notes, ...ctx.context.general]} />
        </Modal>
      )}
    </div>
  );
}

/** Top 10 stocks (by sector) or funds (by type), each with an action, Go to Kite/Coin, and stock news. */
export function TopList({ sector, onClose, onAdd, addLabel = "Add", warn, initialKind = "stock", initialGroup = "index", added = [] }:
  { sector?: string | null; onClose: () => void; onAdd: (row: any, kind: "stock" | "fund") => void; addLabel?: string; warn?: string; initialKind?: "stock" | "fund"; initialGroup?: string; added?: string[] }) {
  const [kind, setKind] = useState<"stock" | "fund">(sector ? initialKind : "fund");
  const [sort, setSort] = useState("return");
  const [grp, setGrp] = useState(initialGroup);
  const [groups, setGroups] = useState<any[]>([]);
  const [rows, setRows] = useState<any>(null);
  const [news, setNews] = useState<any>(null);
  useEffect(() => { api.fundGroups().then(setGroups); }, []);
  useEffect(() => {
    setRows(null);
    api.explore(kind === "stock" ? { kind, sector: sector ?? "", sort, limit: String(TOP_N) } : { kind, category: grp, sort: "return", limit: String(TOP_N) }).then(setRows);
  }, [kind, sector, sort, grp]);
  const gl = groups.find((g) => g.key === grp)?.label ?? "mutual funds";
  return (
    <Modal wide title={kind === "stock" ? `${icon(sector ?? "")} Top ${TOP_N} in ${sector}` : `Top ${TOP_N}: ${gl}`} onClose={onClose}>
      <div className="flex flex-wrap gap-2 items-center justify-between">
        {sector ? (
          <div role="tablist" className="flex border-b border-line w-full sm:w-auto">
            {([["stock", "Stocks"], ["fund", "Mutual funds"]] as const).map(([k, l]) => (
              <button key={k} role="tab" aria-selected={kind === k} onClick={() => setKind(k)}
                className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 ${kind === k ? "border-kite text-kite" : "border-transparent text-ink-soft hover:text-ink"}`}>{l}</button>
            ))}
          </div>
        ) : <span />}
        {kind === "stock"
          ? <select aria-label="Sort" className="border border-line rounded px-3 py-1.5 text-[13px] bg-white" value={sort} onChange={(e) => setSort(e.target.value)}><option value="return">Best 1-year return</option><option value="alpha">A–Z</option></select>
          : <select aria-label="Fund type" className="border border-line rounded px-3 py-1.5 text-[13px] bg-white" value={grp} onChange={(e) => setGrp(e.target.value)}>{groups.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}</select>}
      </div>
      <p className="mt-3 flex flex-wrap items-center gap-2"><span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-800">Past performance screen, not a recommendation</span>
        <span className="text-xs text-ink-faint">{kind === "fund" ? "Direct plans only (no commission). " : ""}Sorted by past return only; no row is highlighted.</span></p>
      {kind === "fund" && sector && <p className="text-xs text-ink-faint mt-2">Funds aren't sorted by sector: each one spreads money across many sectors. Pick a type of fund instead.</p>}
      {warn && kind === "stock" && <div className="mt-3"><Info tone="warn">{warn}</Info></div>}
      {!rows ? <Loading what={kind === "fund" ? "Fetching fund returns (first time can take a few seconds)" : "Loading"} /> : (
        <>
          <ul className="mt-3 divide-y divide-line border-y border-line">
            {rows.rows.map((r: any, i: number) => {
              const isIn = added.includes(String(r.id));
              return (
                <li key={r.id} className="py-3 grid grid-cols-[20px_1fr_auto] lg:grid-cols-[20px_1fr_90px_auto] gap-x-3 gap-y-2 items-center">
                  <span className="text-xs text-ink-faint num">{i + 1}</span>
                  <div className="min-w-0">
                    <div className="font-medium text-[14px] truncate">{kind === "stock" ? r.symbol : r.name}</div>
                    <div className="text-xs text-ink-faint truncate">{kind === "stock" ? `${r.name} · ${r.industry ?? r.sector} · ${inr(r.ltp, 2)}` : `${r.amc ?? ""} · ${r.category} · NAV ${r.nav?.toFixed(2)}`}</div>
                  </div>
                  <div className="text-right text-sm">
                    {kind === "stock" ? <><Ret v={r.chg_365d} /><div className="text-[11px] text-ink-faint">1 year</div></>
                      : r.ret_1y !== null && r.ret_1y !== undefined ? <><Ret v={r.ret_1y} /><div className="text-[11px] text-ink-faint">1y{r.ret_3y != null ? ` · 3y ${r.ret_3y.toFixed(1)}%/yr` : ""}</div></> : <span className="text-xs text-ink-faint">return n/a</span>}
                  </div>
                  <div className="col-start-2 col-span-2 lg:col-start-auto lg:col-span-1 flex flex-wrap gap-2 justify-start lg:justify-end">
                    {isIn ? <span className="text-[13px] px-3 py-1.5 text-up font-medium">✓ Added</span> : <Button size="sm" onClick={() => onAdd(r, kind)}>{addLabel}</Button>}
                    <GoToApp kind={kind} copy={kind === "stock" ? r.symbol : r.name} />
                    {kind === "stock" && <Button size="sm" kind="ghost" onClick={() => setNews(r)}>News</Button>}
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-ink-faint mt-3">{rows.label} {rows.note ?? ""} Showing top {rows.rows.length} of {rows.total}. Data: {rows.mode}, as of {rows.asof}. "Go to" opens the app and copies the name; nothing is bought from here.</p>
        </>
      )}
      {news && (
        <Modal title={`${news.symbol}: what's happening`} onClose={() => setNews(null)}>
          <NewsList kind="stock" name={news.name} symbol={news.symbol} />
        </Modal>
      )}
    </Modal>
  );
}

/** Your sector mix vs the market (or before vs after): two clearly different bars per sector. */
export function SectorMix({ mix, bench, youLabel = "You", compareLabel = "Market", compare }: { mix: Record<string, number>; bench: Record<string, number>; youLabel?: string; compareLabel?: string; compare?: Record<string, number> }) {
  const other = compare ?? bench;
  const keys = Array.from(new Set([...Object.keys(bench), ...Object.keys(mix)]));
  const rows = keys.map((s) => ({ s, you: mix[s] ?? 0, mkt: other[s] ?? 0 })).sort((a, b) => b.you - a.you || b.mkt - a.mkt);
  const max = Math.max(30, ...rows.map((r) => Math.max(r.you, r.mkt)));
  const stripes = { backgroundImage: "repeating-linear-gradient(135deg,#c3c8d0 0 3px,#e3e6ea 3px 6px)" };
  return (
    <div>
      <div className="flex flex-wrap gap-4 text-xs text-ink-soft mb-3" aria-hidden>
        <span className="inline-flex items-center gap-1.5"><span className="w-4 h-2.5 rounded-sm bg-brand" />{youLabel}</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-4 h-2.5 rounded-sm" style={stripes} />{compareLabel}{compare ? "" : " (Nifty 500)"}</span>
      </div>
      <ul className="space-y-3" aria-label={`${youLabel} compared with ${compareLabel}`}>
        {rows.map((r) => {
          const d = r.you - r.mkt;
          const tag = compare
            ? (Math.abs(d) < 1 ? ["no change", "text-ink-faint"] : d > 0 ? [`+${d.toFixed(0)} pts`, "text-brand-ink"] : [`${d.toFixed(0)} pts`, "text-ink-faint"])
            : (Math.abs(d) < 2 ? ["in line", "text-ink-faint"] : d > 0 ? [`${d.toFixed(0)} pts more`, "text-amber-700"] : [`${(-d).toFixed(0)} pts less`, "text-ink-faint"]);
          return (
            <li key={r.s} className="text-sm">
              <div className="flex justify-between gap-2"><span className="truncate">{icon(r.s)} {r.s}</span><span className={`text-xs shrink-0 ${tag[1]}`}>{tag[0]}</span></div>
              <div className="mt-1.5 grid grid-cols-[1fr_40px] gap-x-2 gap-y-1 items-center">
                <div className="h-2.5 bg-gray-100 rounded-sm" aria-hidden><div className="h-2.5 rounded-sm bg-brand" style={{ width: `${(r.you / max) * 100}%` }} /></div>
                <span className="text-xs num font-semibold text-right">{r.you.toFixed(0)}%</span>
                <div className="h-1.5 bg-gray-50 rounded-sm" aria-hidden><div className="h-1.5 rounded-sm" style={{ width: `${(r.mkt / max) * 100}%`, ...stripes }} /></div>
                <span className="text-[11px] num text-ink-faint text-right">{r.mkt.toFixed(0)}%</span>
              </div>
            </li>
          );
        })}
      </ul>
      {!compare && <p className="text-xs text-ink-faint mt-3">Market = Nifty 500, by number of companies. Funds are assumed to follow the market.</p>}
    </div>
  );
}

/** Compact "what investors like you hold" (by major group). The full view is the Investors-like-you tab. */
export function PeersCard({ peers, persona, compact }: { peers: any; persona: any; compact?: boolean }) {
  if (!peers.enough) return <Info>{peers.message}</Info>;
  const groups = (peers.groups ?? []).filter((g: any) => !g.blocked).slice(0, compact ? 3 : 6);
  return (
    <div>
      <p className="text-sm text-ink-soft">Your group: <b className="text-ink">{persona.name}</b></p>
      <ul className="mt-3 space-y-2">
        {groups.map((g: any) => (
          <li key={g.key} className="text-sm flex justify-between gap-2"><span>{g.label}</span><span className="text-ink-faint">you hold {g.you_hold} of {g.subtypes.length}</span></li>
        ))}
      </ul>
    </div>
  );
}
