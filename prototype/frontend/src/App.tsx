import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { api, Json } from "./api";
import { Button, ErrorNote, Loading, Modal, setAppLinks, Toggle } from "./ui";
import { Icon } from "./components/Icons";
import Welcome from "./pages/Welcome";
import Onboarding from "./pages/Onboarding";
import NewPlan from "./pages/NewPlan";
import Overview from "./pages/Overview";
import Spread from "./pages/Spread";
import PeersPage from "./pages/PeersPage";
import CalcPage from "./pages/CalcPage";
import ExplorePage from "./pages/ExplorePage";
import Learn from "./pages/Learn";
import ConsentPage from "./pages/Consent";
import Operated from "./pages/Operated";
import Reviewer from "./pages/Reviewer";
import Summary from "./pages/Summary";

export type Mode = "welcome" | "onboarding" | "new" | "existing" | "explore";
export type Tab = "plan" | "overview" | "spread" | "explore" | "peers" | "calc" | "learn" | "privacy" | "how" | "reviewer";

export interface BasketItem { kind: "stock" | "fund"; id: string; name: string; amount: number; sector?: string; sip?: number; symbol?: string }

interface AppCtx {
  meta: Json; sid: string; consents: Record<string, boolean>; mode: Mode; userId: string | null;
  analysis: Json | null; newA: Json | null; profile: Json | null; basket: BasketItem[];
  setBasket: (b: BasketItem[]) => void; finishOnboarding: (p: Json) => Promise<void>;
  tab: Tab; setTab: (t: Tab) => void; openLesson: (id: string) => void; lesson: string | null;
  grant: (perm: string, on: boolean) => Promise<void>; startAs: (who: "new" | "explore" | string) => void;
  reloadExisting: (extra?: Json) => void; openSummary: (a: Json) => void; busy: boolean;
  wi: BasketItem[]; setWi: (b: BasketItem[]) => void;
}
const Ctx = createContext<AppCtx>(null as unknown as AppCtx);
export const useApp = () => useContext(Ctx);

type TabDef = { id: Tab; label: string; short: string; icon: string };
const TABS: Record<string, TabDef[]> = {
  new: [{ id: "plan", label: "My plan", short: "Plan", icon: "home" }, { id: "explore", label: "Explore", short: "Explore", icon: "compass" }, { id: "calc", label: "Returns calculator", short: "Calculator", icon: "calc" }, { id: "peers", label: "Investors like you", short: "Peers", icon: "users" }, { id: "learn", label: "Learn", short: "Learn", icon: "book" }],
  existing: [{ id: "overview", label: "Overview", short: "Overview", icon: "home" }, { id: "spread", label: "Spread my risk", short: "Spread", icon: "layers" }, { id: "calc", label: "Returns calculator", short: "Calculator", icon: "calc" }, { id: "peers", label: "Investors like you", short: "Peers", icon: "users" }, { id: "learn", label: "Learn", short: "Learn", icon: "book" }],
  explore: [{ id: "explore", label: "Explore", short: "Explore", icon: "compass" }, { id: "calc", label: "Returns calculator", short: "Calculator", icon: "calc" }, { id: "learn", label: "Learn", short: "Learn", icon: "book" }],
};

export default function App() {
  const [meta, setMeta] = useState<Json>(null);
  const [sid, setSid] = useState("");
  const [consents, setConsents] = useState<Record<string, boolean>>({ profile: false, portfolio: false, tracking: false, analytics: false });
  const [wi, setWi] = useState<BasketItem[]>([]);
  const [att, setAtt] = useState(false);
  const [mode, setMode] = useState<Mode>("welcome");
  const [userId, setUserId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("plan");
  const [analysis, setAnalysis] = useState<Json | null>(null);
  const [newA, setNewA] = useState<Json | null>(null);
  const [profile, setProfile] = useState<Json | null>(null);
  const [basket, setBasketState] = useState<BasketItem[]>([]);
  const [lesson, setLesson] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [extra, setExtra] = useState<Json>({});
  const [summaryFor, setSummaryFor] = useState<Json | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [banner, setBanner] = useState(true);
  const reqId = useRef(0);

  useEffect(() => {
    Promise.all([api.meta(), api.session()]).then(([m, s]) => { setAppLinks(m.app_links); setMeta(m); setSid(s.session); setAtt(true); }).catch((e) => setErr(String(e)));
  }, []);

  const grant = useCallback(async (perm: string, on: boolean) => {
    let r;
    try { r = await api.consent(sid, perm, on); }
    catch (e) { setErr(`Couldn't save that choice (${(e as Error).message}). If you just updated the app, close the server window and run make_dev.bat again.`); return; }
    setConsents(r.consents);
    if (!on && (perm === "portfolio" || perm === "profile")) {
      setAnalysis(null); setNewA(null);
      if (perm === "profile") { setProfile(null); setBasketState([]); }
      setMode("explore"); setTab("explore");
    }
  }, [sid]);

  const runNew = useCallback(async (p: Json, b: BasketItem[]) => {
    const my = ++reqId.current;
    setBusy(true);
    try {
      const r = await api.newUser({ session: sid, quiz: p.quiz, suitability: p.suitability, money: p.money, budget: p.money?.invest_lumpsum || null,
        basket: b.map((x) => ({ kind: x.kind, id: x.id, amount: x.amount, sip: x.sip || 0 })) });
      if (my === reqId.current) setNewA(r);
    } catch (e) { setErr(String((e as Error).message)); }
    finally { if (my === reqId.current) setBusy(false); }
  }, [sid]);

  const setBasket = (b: BasketItem[]) => { setBasketState(b); if (profile) runNew(profile, b); };
  const finishOnboarding = async (p: Json) => { setProfile(p); setBasketState([]); await runNew(p, []); setMode("new"); setTab("plan"); };

  useEffect(() => {
    if (mode !== "existing" || !userId || !consents.portfolio || !consents.profile) return;
    setBusy(true); setErr("");
    api.existing({ session: sid, user_id: userId, surface: "All", ...extra })
      .then(setAnalysis).catch((e) => setErr(String((e as Error).message))).finally(() => setBusy(false));
  }, [mode, userId, extra, consents.portfolio, consents.profile, sid]);

  const needs = (who: string) => (who === "explore" ? [] : who === "new" || who === "U04" ? ["profile"] : ["profile", "portfolio"]);
  const go = (who: string) => {
    setAnalysis(null); setNewA(null); setExtra({}); setBasketState([]); setWi([]); setMenu(false);
    if (who === "explore") { setUserId(null); setMode("explore"); setTab("explore"); return; }
    if (who === "new") { setUserId(null); setProfile(null); setMode("onboarding"); return; }
    if (who === "U04") { setUserId("U04"); setProfile(null); setMode("onboarding"); return; }
    setUserId(who); setMode("existing"); setTab("overview");
  };
  const startAs = (who: string) => {
    if (needs(who).every((p) => consents[p])) go(who); else setPending(who);
  };

  if (err && !meta) return <div className="p-8"><ErrorNote msg={`The app's engine isn't responding (${err}). Is make_dev.bat still running?`} /></div>;
  if (!meta || !sid) return <div className="p-8"><Loading what="Starting" /></div>;

  const ctx: AppCtx = {
    meta, sid, consents, mode, userId, analysis, newA, profile, basket, setBasket, finishOnboarding, tab, setTab,
    openLesson: (id) => { setLesson(id); setTab("learn"); }, lesson, grant, startAs,
    reloadExisting: (ex) => setExtra({ ...extra, ...(ex || {}) }), openSummary: (a) => setSummaryFor(a), busy, wi, setWi,
  };
  const user = userId ? meta.test_users.find((x: Json) => x.id === userId) : null;
  const tabs = TABS[mode] ?? [];
  const summaryTarget = mode === "existing" ? analysis : mode === "new" ? newA : null;

  return (
    <Ctx.Provider value={ctx}>
      <div className={`min-h-screen flex flex-col ${tabs.length ? "has-bottom-nav" : ""}`}>
        <header className="bg-white border-b border-line sticky top-0 z-30">
          <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-4">
            <button onClick={() => { setMode("welcome"); setMenu(false); }} className="flex items-center gap-2 font-semibold text-[17px] tracking-tight shrink-0" aria-label="YourBroker home">
              <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden><path d="M3 20 L11 4 L14 10 L9 20 Z" fill="#ff5722" /><path d="M12 20 L16 12 L21 20 Z" fill="#387ed1" /></svg>
              <span>YourBroker</span>
            </button>
            <Ticker items={meta.indices ?? []} />
            <nav aria-label="Main" className="hidden md:flex ml-auto h-14 text-[14px]">
              {tabs.map((t) => (
                <button key={t.id} onClick={() => setTab(t.id)} aria-current={tab === t.id ? "page" : undefined}
                  className={`px-3 border-b-2 -mb-px whitespace-nowrap ${tab === t.id ? "border-kite text-kite" : "border-transparent text-ink-soft hover:text-kite"}`}>{t.label}</button>
              ))}
            </nav>
            <div className={`${tabs.length ? "md:ml-2" : ""} ml-auto flex items-center gap-2`}>
              {summaryTarget && <span className="whitespace-nowrap"><Button size="sm" kind="dark" onClick={() => setSummaryFor(summaryTarget)}>✦ <span className="hidden sm:inline">AI </span>summary</Button></span>}
              <div className="relative">
                <button aria-label="Menu" aria-expanded={menu} onClick={() => setMenu(!menu)}
                  className="h-9 w-9 sm:w-auto sm:pl-1 sm:pr-3 rounded-full border border-line flex items-center justify-center gap-2 text-sm hover:bg-gray-50">
                  <span className="w-7 h-7 rounded-full bg-brand-soft text-brand-ink grid place-items-center text-xs font-semibold">{user ? user.name[0] : "?"}</span>
                  <span className="hidden sm:inline max-w-[110px] truncate">{user ? user.name.split(" ")[0] : mode === "new" ? "New investor" : "Guest"}</span>
                </button>
                {menu && (
                  <div className="absolute right-0 mt-2 w-72 bg-white border border-line rounded-lg shadow-pop p-2 text-sm z-40">
                    <div className="px-3 py-2 text-xs font-semibold text-ink-faint uppercase">Try the demo as</div>
                    <button className="w-full text-left px-3 py-2 rounded hover:bg-gray-50" onClick={() => startAs("new")}>A brand-new investor (fill in yourself)</button>
                    {meta.test_users.map((u: Json) => (
                      <button key={u.id} className="w-full text-left px-3 py-2 rounded hover:bg-gray-50" onClick={() => startAs(u.id)}>
                        {u.name} <span className="text-ink-faint">· {u.track === "new" ? "new" : "existing"}, {u.age}</span>
                      </button>
                    ))}
                    <div className="border-t border-line my-2" />
                    {[["privacy", "Privacy & data"], ["how", "How this would work legally"], ["reviewer", "For reviewers: model & tests"]].map(([id, l]) => (
                      <button key={id} className="w-full text-left px-3 py-2 rounded hover:bg-gray-50" onClick={() => { setTab(id as Tab); setMenu(false); if (mode === "welcome") setMode("explore"); }}>{l}</button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          {(meta.indices ?? []).length > 0 && mode !== "welcome" && (
            <div className="2xl:hidden border-t border-line px-4 py-1.5 flex gap-5 overflow-x-auto no-scrollbar text-[11.5px]" aria-label="Indices, last close and 1-month change">
              {meta.indices.slice(0, 3).map((x: Json) => (
                <span key={x.name} className="whitespace-nowrap"><span className="text-ink-soft">{x.name}</span> <span className={`num ${x.chg_30d >= 0 ? "text-up" : "text-down"}`}>{x.ltp.toLocaleString("en-IN", { maximumFractionDigits: 1 })}</span> <span className="num text-ink-faint">{x.chg_30d >= 0 ? "+" : ""}{x.chg_30d.toFixed(2)}% 1M</span></span>))}
            </div>
          )}
        </header>

        {banner && mode !== "welcome" && (
          <div className="bg-amber-50 border-b border-amber-100 text-amber-950 text-[12.5px]">
            <div className="max-w-6xl mx-auto px-4 py-1.5 flex gap-3 items-start">
              <p className="flex-1">We show information and options to explore. We don't tell you what to buy, and nothing is bought for you. <button className="underline" onClick={() => setTab("how")}>Why?</button></p>
              <button aria-label="Dismiss" onClick={() => setBanner(false)}>✕</button>
            </div>
          </div>
        )}

        <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-5 sm:py-7" onClick={() => menu && setMenu(false)}>
          {err && <div className="mb-4"><ErrorNote msg={err} /></div>}
          {mode === "welcome" ? <Welcome /> :
            mode === "onboarding" ? <Onboarding preset={userId === "U04" ? meta.test_users.find((u: Json) => u.id === "U04") : null} /> :
            tab === "privacy" ? <ConsentPage /> : tab === "how" ? <Operated /> : tab === "reviewer" ? <Reviewer /> :
            tab === "learn" ? <Learn /> : tab === "calc" ? <CalcPage /> : tab === "explore" ? <ExplorePage /> :
            mode === "existing" && !analysis ? <Loading what="Reading your portfolio" /> :
            tab === "plan" ? <NewPlan /> : tab === "overview" ? <Overview /> : tab === "spread" ? <Spread /> :
            tab === "peers" ? <PeersPage /> : <Overview />}
        </main>

        <footer className="border-t border-line bg-white">
          <div className="max-w-6xl mx-auto px-4 py-4 text-xs text-ink-faint flex flex-wrap gap-x-4 gap-y-1 justify-between">
            <span>Academic prototype · not investment advice · stocks and funds: {meta.data_quality.equity_mode} data as of 30 Oct 2026 · "investors like you" figures are simulated</span>
            <span>{meta.model_version} · {meta.rules_version}</span>
          </div>
        </footer>

        {tabs.length > 0 && mode !== "onboarding" && mode !== "welcome" && (
          <nav aria-label="Sections" className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-line" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
            <div className="grid" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0,1fr))` }}>
              {tabs.map((t) => (
                <button key={t.id} onClick={() => { setTab(t.id); window.scrollTo({ top: 0 }); }} aria-current={tab === t.id ? "page" : undefined}
                  className={`flex flex-col items-center gap-0.5 pt-2 pb-1.5 text-[11px] ${tab === t.id ? "text-brand" : "text-ink-soft"}`}>
                  <Icon name={t.icon} active={tab === t.id} />{t.short}
                </button>
              ))}
            </div>
          </nav>
        )}

        {att && <TrackingPrompt onDone={() => setAtt(false)} />}
        {pending && <ConsentSheet who={pending} onCancel={() => setPending(null)} onDone={() => { const w = pending; setPending(null); go(w); }} onSkip={() => { setPending(null); go("explore"); }} />}
        {summaryFor && <Summary analysis={summaryFor} onClose={() => setSummaryFor(null)} />}
      </div>
    </Ctx.Provider>
  );
}

/** Index strip like Kite's header (last close and 1-month change; the files carry no intraday data). */
function Ticker({ items }: { items: Json[] }) {
  if (!items.length) return null;
  return (
    <div className="hidden 2xl:flex gap-4 text-[12px] overflow-x-auto no-scrollbar min-w-0 border-l border-line pl-4" aria-label="Indices, last close and 1-month change">
      {items.slice(0, 2).map((x) => (
        <span key={x.name} className="whitespace-nowrap">
          <span className="text-ink-soft font-medium">{x.name}</span>{" "}
          <span className={`num ${x.chg_30d >= 0 ? "text-up" : "text-down"}`}>{x.ltp.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span>{" "}
          <span className="num text-ink-faint">{x.chg_30d >= 0 ? "+" : ""}{x.chg_30d.toFixed(2)}% 1M</span>
        </span>
      ))}
    </div>
  );
}

/** Phone-style "Ask App Not to Track" prompt (shown once per session). A separate, unbundled choice:
 *  declining never limits the app, and it can be changed any time in Privacy & data. */
export function TrackingPrompt({ onDone }: { onDone: () => void }) {
  const { grant } = useApp();
  // close first, then record the choice; a failed save (e.g. an old server still running) must never trap the user
  const choose = (allow: boolean) => { onDone(); grant("tracking", allow).catch(() => { /* recorded as not tracking */ }); };
  return (
    <div role="dialog" aria-modal="true" aria-label="Tracking permission" className="fixed inset-0 z-[60] bg-black/40 grid place-items-center p-6">
      <div className="bg-white/95 backdrop-blur rounded-2xl w-full max-w-[300px] text-center shadow-pop overflow-hidden">
        <div className="px-5 pt-5 pb-4">
          <div className="text-[15px] font-semibold leading-snug">Allow "YourBroker" to track your activity across other companies' apps and websites?</div>
          <p className="text-[13px] text-ink-soft mt-2">This would let us use what you do in other apps for ads. This prototype doesn't need it: your analysis is exactly the same either way.</p>
        </div>
        <button type="button" className="w-full border-t border-line py-3 text-[15px] text-brand font-semibold hover:bg-gray-50" onClick={() => choose(false)}>Ask App Not to Track</button>
        <button type="button" className="w-full border-t border-line py-3 text-[15px] text-brand hover:bg-gray-50" onClick={() => choose(true)}>Allow</button>
      </div>
    </div>
  );
}

/** Two-choice control for the tracking permission (used in onboarding consent and Privacy & data). */
export function TrackingChoice() {
  const { consents, grant } = useApp();
  const on = !!consents.tracking;
  return (
    <div className="border border-line rounded-lg p-4">
      <div className="font-medium text-sm">Activity in other apps & websites</div>
      <div className="text-xs text-ink-faint mt-0.5">Background tracking for ads. Never needed for your analysis; you can change it any time.</div>
      <div role="radiogroup" aria-label="Tracking" className="mt-3 grid grid-cols-2 gap-2">
        {[[false, "Ask app not to track"], [true, "Allow"]].map(([v, l]) => (
          <button key={String(v)} role="radio" aria-checked={on === v} onClick={() => grant("tracking", v as boolean)}
            className={`text-[13px] py-2 rounded border font-medium ${on === v ? "border-brand bg-brand-soft text-brand-ink" : "border-line text-ink-soft hover:border-ink-faint"}`}>{l as string}</button>
        ))}
      </div>
    </div>
  );
}

function ConsentSheet({ who, onCancel, onDone, onSkip }: { who: string; onCancel: () => void; onDone: () => void; onSkip: () => void }) {
  const { meta, consents, grant } = useApp();
  const existing = who !== "new" && who !== "U04";
  const need = existing ? ["profile", "portfolio"] : ["profile"];
  const n = meta.notice;
  const plain: Record<string, [string, string]> = {
    profile: ["Your answers", "Income, spending, goals and risk answers, used to tailor what you see."],
    portfolio: ["Your holdings", "Stocks, funds and SIPs on Kite, Coin and smallcase, used to analyse your portfolio."],
    analytics: ["App usage (optional)", "Helps improve the app. Off by default and never used for your analysis."],
  };
  return (
    <Modal title="Before we start" onClose={onCancel}>
      <p className="text-sm text-ink-soft">Choose what you're happy to share. You can change this anytime in <b>Privacy & data</b>, and saying no won't affect your trading account.</p>
      <div className="mt-5 space-y-4">
        {(["profile", "portfolio", "analytics"] as const).filter((k) => existing || k !== "portfolio").map((k) => (
          <div key={k} className="flex gap-4 items-start justify-between border border-line rounded-lg p-4">
            <div><div className="font-medium text-sm">{plain[k][0]}</div><div className="text-xs text-ink-faint mt-0.5">{plain[k][1]}</div></div>
            <Toggle id={`cs-${k}`} label="" on={!!consents[k]} onChange={(v) => grant(k, v)} />
          </div>
        ))}
        <TrackingChoice />
      </div>
      <details className="mt-4 text-xs text-ink-faint">
        <summary className="cursor-pointer">Full notice</summary>
        <ul className="mt-2 space-y-1 list-disc pl-4">
          <li>Data: {n.data_categories.join("; ")}.</li><li>Use of AI: {n.ai_use}</li><li>Shared with: {n.recipients}</li>
          <li>Kept for: {n.retention}</li><li>{n.not_used}</li><li>{n.tracking}</li><li>{n.commencement}</li>
        </ul>
      </details>
      <div className="mt-6 flex flex-col sm:flex-row gap-2">
        <Button full size="lg" disabled={!need.every((p) => consents[p])} onClick={onDone}>Continue</Button>
        <Button full size="lg" kind="secondary" onClick={onSkip}>Explore without sharing</Button>
      </div>
    </Modal>
  );
}
