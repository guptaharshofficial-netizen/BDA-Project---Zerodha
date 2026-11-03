import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { api, Json } from "./api";
import { Button, ErrorNote, Handoff, Info, Loading, Modal, setAppLinks, setHandoff } from "./ui";
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
import Settings, { SettingsSection } from "./pages/Settings";
import Operated from "./pages/Operated";
import Reviewer from "./pages/Reviewer";
import Summary from "./pages/Summary";
import {
  ComplianceFooter, ConsentBody, HandoffModal, JourneyConsent, KiteApproval, KiteEntry, KiteSignup, PartnerModal, RiaStrip,
  RiskResult, ServiceChoice, Signup, TermsGate,
} from "./components/Compliance";

export type Mode = "welcome" | "journey" | "onboarding" | "new" | "existing" | "explore";
export type Tab = "plan" | "overview" | "spread" | "explore" | "peers" | "calc" | "learn" | "settings" | "how" | "reviewer";
export type JourneyPath = "existing" | "new";
export type JourneyStep = "kite_entry" | "kite_signup" | "kite_approval" | "signup" | "service" | "consent";
export interface Journey { path: JourneyPath; step: JourneyStep; who: string; relink?: { mode: Mode; tab: Tab } }
const JPATH: Record<JourneyPath, JourneyStep[]> = {
  existing: ["kite_entry", "kite_approval", "signup", "service", "consent"],
  new: ["kite_signup", "signup", "service", "consent"],
};

export interface BasketItem { kind: "stock" | "fund"; id: string; name: string; amount: number; sector?: string; sip?: number; symbol?: string }
export interface HistoryRow { ts: string; label: string; category: string; rule: string; profile: number; consent?: string; versions: string; action: string }

interface AppCtx {
  meta: Json; sid: string; consents: Record<string, boolean>; mode: Mode; userId: string | null;
  analysis: Json | null; newA: Json | null; profile: Json | null; basket: BasketItem[];
  setBasket: (b: BasketItem[]) => void; finishOnboarding: (p: Json) => Promise<void>;
  tab: Tab; setTab: (t: Tab) => void; openLesson: (id: string) => void; lesson: string | null;
  grant: (perm: string, on: boolean) => Promise<void>; startAs: (who: "new" | "explore" | string) => void;
  reloadExisting: (extra?: Json) => void; openSummary: (a: Json) => void; busy: boolean;
  wi: BasketItem[]; setWi: (b: BasketItem[]) => void;
  // separate-adviser flow
  journey: Journey | null; setJourney: (j: Journey) => void; journeyNext: () => void; exitJourney: () => void;
  startJourneyAt: (path: JourneyPath, step: JourneyStep, who?: string) => void; setModeTo: (m: Mode) => void;
  kiteLinked: boolean; setKiteLinked: (v: boolean) => void; disconnectKite: () => void;
  signup: { name: string; age: number } | null; setSignup: (s: { name: string; age: number }) => void;
  accepted: { profile: boolean; terms: boolean }; accept: (k: "profile" | "terms", d?: Json) => void; profileVersion: number;
  sugOff: boolean; setSugOff: (v: boolean) => void; dismissed: string[]; dismiss: (c: string) => void; undismiss: (c: string) => void;
  feedback: Record<string, string>; giveFeedback: (c: string, v: string) => void; history: HistoryRow[];
  lastUpdated: Date | null; consentIds: Record<string, string>; logEvent: (e: string, d?: Json) => Promise<Json>;
  openHandoff: (h: Handoff) => void; markLeaving: (category?: string) => void; openPartner: (c: string) => void;
  settingsSection: SettingsSection | null; openSettings: (s: SettingsSection) => void; tickets: { ref: string; about: string }[];
  closeAccount: () => void;
}
const Ctx = createContext<AppCtx>(null as unknown as AppCtx);
export const useApp = () => useContext(Ctx);

type TabDef = { id: Tab; label: string; short: string; icon: string };
const TABS: Record<string, TabDef[]> = {
  new: [{ id: "plan", label: "My plan", short: "Plan", icon: "home" }, { id: "explore", label: "Explore", short: "Explore", icon: "compass" }, { id: "calc", label: "Returns calculator", short: "Calculator", icon: "calc" }, { id: "peers", label: "Investors like you", short: "Peers", icon: "users" }, { id: "learn", label: "Learn", short: "Learn", icon: "book" }],
  existing: [{ id: "overview", label: "Overview", short: "Overview", icon: "home" }, { id: "spread", label: "Spread my risk", short: "Spread", icon: "layers" }, { id: "calc", label: "Returns calculator", short: "Calculator", icon: "calc" }, { id: "peers", label: "Investors like you", short: "Peers", icon: "users" }, { id: "learn", label: "Learn", short: "Learn", icon: "book" }],
  explore: [{ id: "explore", label: "Explore", short: "Explore", icon: "compass" }, { id: "calc", label: "Returns calculator", short: "Calculator", icon: "calc" }, { id: "learn", label: "Learn", short: "Learn", icon: "book" }],
};
const PERSONAL_TABS: Tab[] = ["overview", "plan", "spread", "peers"];
const stamp = () => new Date().toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default function App() {
  const [meta, setMeta] = useState<Json>(null);
  const [sid, setSid] = useState("");
  const [consents, setConsents] = useState<Record<string, boolean>>({ profile: false, portfolio: false, tracking: false, analytics: false });
  const [consentIds, setConsentIds] = useState<Record<string, string>>({});
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
  const [flash, setFlash] = useState("");
  const [busy, setBusy] = useState(false);
  const [extra, setExtra] = useState<Json>({});
  const [summaryFor, setSummaryFor] = useState<Json | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [banner, setBanner] = useState(true);
  // separate-adviser flow state
  const [journey, setJourney] = useState<Journey | null>(null);
  const [kiteLinked, setKiteLinked] = useState(false);
  const [signup, setSignup] = useState<{ name: string; age: number } | null>(null);
  const [accepted, setAccepted] = useState({ profile: false, terms: false });
  const [profileVersion, setProfileVersion] = useState(0);
  const [sugOff, setSugOffState] = useState(false);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [handoff, setHandoffState] = useState<Handoff | null>(null);
  const [partner, setPartner] = useState<string | null>(null);
  const [settingsSection, setSettingsSection] = useState<SettingsSection | null>(null);
  const [tickets, setTickets] = useState<{ ref: string; about: string }[]>([]);
  const reqId = useRef(0);
  const leaving = useRef(false);
  const seen = useRef(new WeakSet<object>());
  const live = useRef<{ mode: Mode; profile: Json | null; basket: BasketItem[] }>({ mode, profile, basket });
  live.current = { mode, profile, basket };

  useEffect(() => {
    Promise.all([api.meta(), api.session()]).then(([m, s]) => { setAppLinks(m.app_links); setMeta(m); setSid(s.session); setAtt(true); }).catch((e) => setErr(String(e)));
    setHandoff((h) => setHandoffState(h));
  }, []);

  const logEvent = useCallback(async (event: string, detail?: Json) => {
    try {
      const r = await api.event(sid, event, detail);
      if (r?.consents) setConsents(r.consents);
      if (event === "grievance_raised" && r?.ref) setTickets((t) => [...t, { ref: r.ref, about: String(detail?.about ?? "") }]);
      return r;
    } catch { return null; }
  }, [sid]);

  const noteAction = (category: string, action: string) => setHistory((h) => {
    const i = h.map((r) => r.category).lastIndexOf(category);
    if (i < 0) return h;
    const n = [...h]; n[i] = { ...n[i], action }; return n;
  });

  const grant = useCallback(async (perm: string, on: boolean) => {
    let r;
    try { r = await api.consent(sid, perm, on); }
    catch (e) { setErr(`Couldn't save that choice (${(e as Error).message}). If you just updated the app, close the server window and run make_dev.bat again.`); return; }
    setConsents(r.consents); setConsentIds(r.consent_ids || {});
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
      if (my === reqId.current) { setNewA(r); setLastUpdated(new Date()); }
    } catch (e) { setErr(String((e as Error).message)); }
    finally { if (my === reqId.current) setBusy(false); }
  }, [sid]);

  const setBasket = (b: BasketItem[]) => { setBasketState(b); if (profile) runNew(profile, b); };
  const finishOnboarding = async (p: Json) => { setProfile(p); setBasketState([]); await runNew(p, []); setMode("new"); setTab("plan"); };

  useEffect(() => {
    if (mode !== "existing" || !userId || !consents.portfolio || !consents.profile) return;
    setBusy(true); setErr("");
    api.existing({ session: sid, user_id: userId, surface: "All", ...extra })
      .then((r) => { setAnalysis(r); setLastUpdated(new Date()); if (r.consent_ids) setConsentIds(r.consent_ids); })
      .catch((e) => setErr(String((e as Error).message))).finally(() => setBusy(false));
  }, [mode, userId, extra, consents.portfolio, consents.profile, sid, refreshKey]);

  // Automatic update: whenever the user comes back to Tulana from Kite or Coin (no manual refresh button)
  useEffect(() => {
    const back = () => {
      if (document.visibilityState !== "visible" || !leaving.current) return;
      leaving.current = false;
      const s = live.current;
      if (s.mode === "existing") setRefreshKey((k) => k + 1);
      else if (s.mode === "new" && s.profile) runNew(s.profile, s.basket);
      setFlash("Welcome back. Your portfolio was updated automatically.");
      setTimeout(() => setFlash(""), 4000);
    };
    document.addEventListener("visibilitychange", back); window.addEventListener("focus", back);
    return () => { document.removeEventListener("visibilitychange", back); window.removeEventListener("focus", back); };
  }, [runNew]);

  // Suggestion history: every card shown after the risk profile and terms were accepted
  useEffect(() => {
    if (!accepted.profile || !accepted.terms) return;
    const a = mode === "existing" ? analysis : mode === "new" ? newA : null;
    if (!a || seen.current.has(a)) return;
    seen.current.add(a);
    const cid = mode === "existing" ? (a.consent_ids?.portfolio ?? consentIds.portfolio) : (a.consent_ids?.profile ?? consentIds.profile);
    const rows: HistoryRow[] = (a.recommendations?.cards || []).map((c: Json) => ({
      ts: stamp(), label: c.label, category: c.category, rule: c.why?.rule_fired ?? "", profile: profileVersion, consent: cid,
      versions: `${a.model_version} · ${a.rules_version}`, action: dismissed.includes(c.category) ? "Dismissed" : "Shown" }));
    if (rows.length) setHistory((h) => [...h, ...rows]);
  }, [analysis, newA, accepted, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const resetPerson = () => {
    setAnalysis(null); setNewA(null); setExtra({}); setBasketState([]); setWi([]); setMenu(false);
    setAccepted({ profile: false, terms: false }); setDismissed([]); setFeedback({}); setSugOffState(false);
  };
  const needs = (who: string) => (who === "explore" ? [] : who === "new" || who === "U04" ? ["profile"] : ["profile", "portfolio"]);
  const go = (who: string) => {
    resetPerson(); setJourney(null);
    if (who === "explore") { setUserId(null); setMode("explore"); setTab("explore"); return; }
    if (who === "new") { setUserId(null); setProfile(null); setMode("onboarding"); return; }
    if (who === "U04") { setUserId("U04"); setProfile(null); setMode("onboarding"); return; }
    setUserId(who); setMode("existing"); setTab("overview");
  };
  const startAs = (who: string) => {
    if (needs(who).every((p) => consents[p])) { if (needs(who).includes("portfolio")) setKiteLinked(true); go(who); } else setPending(who);
  };

  const startJourneyAt = (path: JourneyPath, step: JourneyStep, who?: string) => {
    setMenu(false);
    const relink = step === "kite_approval" && mode !== "welcome" && mode !== "journey" ? { mode, tab } : undefined;
    const existing = meta?.test_users?.filter((u: Json) => u.track === "existing") ?? [];
    setJourney({ path, step, who: who ?? (path === "new" ? "new" : existing[1]?.id ?? existing[0]?.id), relink });
    setMode("journey"); window.scrollTo({ top: 0 });
  };
  const exitJourney = () => { setJourney(null); setMode("welcome"); };
  const journeyNext = () => {
    if (!journey) return;
    if (journey.relink) { const r = journey.relink; setJourney(null); setMode(r.mode); setTab(r.tab); setFlash("Kite linked. Turn on C2 in Settings to use the linked data."); setTimeout(() => setFlash(""), 4000); return; }
    const steps = JPATH[journey.path];
    const i = steps.indexOf(journey.step);
    if (i < steps.length - 1) { setJourney({ ...journey, step: steps[i + 1] }); window.scrollTo({ top: 0 }); return; }
    go(journey.path === "new" ? "new" : journey.who);
  };
  const disconnectKite = () => { setKiteLinked(false); logEvent("kite_link_disconnected", { target: "Tulana" }); grant("portfolio", false); setTab("settings"); };
  const accept = (k: "profile" | "terms", d?: Json) => {
    if (k === "profile") { const v = profileVersion + 1; setProfileVersion(v); logEvent("profile_accepted", { profile_version: `P-v${v}`, ...(d || {}) }); }
    else logEvent("terms_accepted", d);
    setAccepted((a) => ({ ...a, [k]: true })); window.scrollTo({ top: 0 });
  };
  const closeAccount = async () => {
    await logEvent("account_closed");
    setConsents({ profile: false, portfolio: false, tracking: false, analytics: false }); setConsentIds({});
    resetPerson(); setUserId(null); setProfile(null); setKiteLinked(false); setSignup(null); setHistory([]); setTickets([]);
    setMode("welcome"); setFlash("Your Tulana account was closed: consents withdrawn and the Kite link revoked. Your Zerodha account is unaffected.");
  };

  if (err && !meta) return <div className="p-8"><ErrorNote msg={`The app's engine isn't responding (${err}). Is make_dev.bat still running?`} /></div>;
  if (!meta || !sid) return <div className="p-8"><Loading what="Starting" /></div>;

  const ctx: AppCtx = {
    meta, sid, consents, mode, userId, analysis, newA, profile, basket, setBasket, finishOnboarding, tab, setTab,
    openLesson: (id) => { setLesson(id); setTab("learn"); if (mode === "welcome" || mode === "journey") setMode("explore"); window.scrollTo({ top: 0 }); }, lesson, grant, startAs,
    reloadExisting: (ex) => setExtra({ ...extra, ...(ex || {}) }), openSummary: (a) => setSummaryFor(a), busy, wi, setWi,
    journey, setJourney, journeyNext, exitJourney, startJourneyAt, setModeTo: setMode,
    kiteLinked, setKiteLinked, disconnectKite, signup, setSignup, accepted, accept, profileVersion,
    sugOff, setSugOff: (v) => { setSugOffState(v); logEvent(v ? "suggestions_off" : "suggestions_on"); },
    dismissed, dismiss: (c) => { setDismissed((d) => [...d, c]); noteAction(c, "Dismissed"); logEvent("suggestion_dismissed", { category: c }); },
    undismiss: (c) => { setDismissed((d) => d.filter((x) => x !== c)); noteAction(c, "Shown"); },
    feedback, giveFeedback: (c, v) => { setFeedback((f) => ({ ...f, [c]: v })); noteAction(c, v === "y" ? "Marked helpful" : "Marked not helpful"); logEvent("suggestion_feedback", { category: c, value: v === "y" ? "helpful" : "not_helpful" }); },
    history, lastUpdated, consentIds, logEvent,
    openHandoff: (h) => setHandoffState(h), markLeaving: (c) => { leaving.current = true; if (c) noteAction(c, "Went to Kite / Coin"); },
    openPartner: setPartner, settingsSection, openSettings: (s) => { setSettingsSection(s); setTab("settings"); setMenu(false); if (mode === "welcome" || mode === "journey") setMode("explore"); window.scrollTo({ top: 0 }); },
    tickets, closeAccount,
  };
  const user = userId ? meta.test_users.find((x: Json) => x.id === userId) : null;
  const tabs = TABS[mode] ?? [];
  const summaryTarget = (mode === "existing" ? analysis : mode === "new" ? newA : null);
  const personal = (mode === "existing" && analysis) || (mode === "new" && newA);
  const gated = personal && PERSONAL_TABS.includes(tab) && (!accepted.profile || !accepted.terms);

  const page = () => {
    if (mode === "welcome") return <Welcome />;
    if (mode === "journey" && journey) {
      return { kite_entry: <KiteEntry />, kite_signup: <KiteSignup />, kite_approval: <KiteApproval />, signup: <Signup />, service: <ServiceChoice />, consent: <JourneyConsent /> }[journey.step];
    }
    if (mode === "onboarding") return <Onboarding preset={userId === "U04" ? meta.test_users.find((u: Json) => u.id === "U04") : null} />;
    if (tab === "settings") return <Settings />;
    if (tab === "how") return <Operated />;
    if (tab === "reviewer") return <Reviewer />;
    if (tab === "learn") return <Learn />;
    if (tab === "calc") return <CalcPage />;
    if (tab === "explore") return <ExplorePage />;
    if (mode === "existing" && !analysis) return <Loading what="Reading your linked portfolio" />;
    if (gated) return !accepted.profile ? <RiskResult /> : <TermsGate />;
    if (tab === "plan") return <NewPlan />;
    if (tab === "overview") return <Overview />;
    if (tab === "spread") return <Spread />;
    if (tab === "peers") return <PeersPage />;
    return <Overview />;
  };

  return (
    <Ctx.Provider value={ctx}>
      <div className={`min-h-screen flex flex-col ${tabs.length ? "has-bottom-nav" : ""}`}>
        <header className="bg-white border-b border-line sticky top-0 z-30">
          <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-4">
            <button onClick={() => { setMode("welcome"); setJourney(null); setMenu(false); }} className="flex items-center gap-2 font-semibold text-[17px] tracking-tight shrink-0" aria-label="Tulana home">
              <img src="/logo-icon.png" alt="" className="h-8 w-auto" />
              <span className="text-[#14295c] text-[22px] font-bold lowercase tracking-tight leading-none">tulana</span>
            </button>
            <Ticker items={meta.indices ?? []} />
            <nav aria-label="Main" className="hidden md:flex ml-auto h-14 text-[14px]">
              {tabs.map((t) => (
                <button key={t.id} onClick={() => setTab(t.id)} aria-current={tab === t.id ? "page" : undefined}
                  className={`px-3 border-b-2 -mb-px whitespace-nowrap ${tab === t.id ? "border-kite text-kite" : "border-transparent text-ink-soft hover:text-kite"}`}>{t.label}</button>
              ))}
            </nav>
            <div className={`${tabs.length ? "md:ml-2" : ""} ml-auto flex items-center gap-2`}>
              {summaryTarget && !gated && <span className="whitespace-nowrap"><Button size="sm" kind="dark" onClick={() => setSummaryFor(summaryTarget)}>✦ <span className="hidden sm:inline">AI </span>summary</Button></span>}
              <div className="relative">
                <button aria-label="Menu" aria-expanded={menu} onClick={() => setMenu(!menu)}
                  className="h-9 w-9 sm:w-auto sm:pl-1 sm:pr-3 rounded-full border border-line flex items-center justify-center gap-2 text-sm hover:bg-gray-50">
                  <span className="w-7 h-7 rounded-full bg-brand-soft text-brand-ink grid place-items-center text-xs font-semibold">{user ? user.name[0] : "?"}</span>
                  <span className="hidden sm:inline max-w-[110px] truncate">{user ? user.name.split(" ")[0] : mode === "new" ? "New investor" : "Guest"}</span>
                </button>
                {menu && (
                  <div className="absolute right-0 mt-2 w-72 bg-white border border-line rounded-lg shadow-pop p-2 text-sm z-40">
                    <div className="px-3 py-2 text-xs font-semibold text-ink-faint uppercase">Full journey</div>
                    <button className="w-full text-left px-3 py-2 rounded hover:bg-gray-50" onClick={() => startJourneyAt("existing", "kite_entry")}>Existing investor, from Kite</button>
                    <button className="w-full text-left px-3 py-2 rounded hover:bg-gray-50" onClick={() => startJourneyAt("new", "kite_signup")}>New investor, from Zerodha sign-up</button>
                    <div className="px-3 py-2 text-xs font-semibold text-ink-faint uppercase">Demo shortcuts</div>
                    <button className="w-full text-left px-3 py-2 rounded hover:bg-gray-50" onClick={() => startAs("new")}>A brand-new investor (fill in yourself)</button>
                    {meta.test_users.map((u: Json) => (
                      <button key={u.id} className="w-full text-left px-3 py-2 rounded hover:bg-gray-50" onClick={() => startAs(u.id)}>
                        {u.name} <span className="text-ink-faint">· {u.track === "new" ? "new" : "existing"}, {u.age}</span>
                      </button>
                    ))}
                    <div className="border-t border-line my-2" />
                    <button className="w-full text-left px-3 py-2 rounded hover:bg-gray-50" onClick={() => ctx.openSettings("permissions")}>Settings (permissions, data, help)</button>
                    {[["how", "How this would work legally"], ["reviewer", "For reviewers: model & tests"]].map(([id, l]) => (
                      <button key={id} className="w-full text-left px-3 py-2 rounded hover:bg-gray-50" onClick={() => { setTab(id as Tab); setMenu(false); if (mode === "welcome" || mode === "journey") setMode("explore"); }}>{l}</button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          {(meta.indices ?? []).length > 0 && mode !== "welcome" && mode !== "journey" && (
            <div className="2xl:hidden border-t border-line px-4 py-1.5 flex gap-5 overflow-x-auto no-scrollbar text-[11.5px]" aria-label="Indices, last close and 1-month change">
              {meta.indices.slice(0, 3).map((x: Json) => (
                <span key={x.name} className="whitespace-nowrap"><span className="text-ink-soft">{x.name}</span> <span className={`num ${x.chg_30d >= 0 ? "text-up" : "text-down"}`}>{x.ltp.toLocaleString("en-IN", { maximumFractionDigits: 1 })}</span> <span className="num text-ink-faint">{x.chg_30d >= 0 ? "+" : ""}{x.chg_30d.toFixed(2)}% 1M</span></span>))}
            </div>
          )}
          <RiaStrip />
        </header>

        {banner && mode !== "welcome" && mode !== "journey" && (
          <div className="bg-amber-50 border-b border-amber-100 text-amber-950 text-[12.5px]">
            <div className="max-w-6xl mx-auto px-4 py-1.5 flex gap-3 items-start">
              <p className="flex-1">Free suggestions from a SEBI-registered adviser, based on your accepted risk profile. Nothing is bought for you: you decide, on any platform. <button className="underline" onClick={() => setTab("how")}>Why?</button></p>
              <button aria-label="Dismiss" onClick={() => setBanner(false)}>✕</button>
            </div>
          </div>
        )}

        <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-5 sm:py-7" onClick={() => menu && setMenu(false)}>
          {err && <div className="mb-4"><ErrorNote msg={err} /></div>}
          {flash && <div className="mb-4" role="status"><Info tone="good">{flash}</Info></div>}
          {page()}
        </main>

        <footer className="border-t border-line bg-white">
          <div className="max-w-6xl mx-auto px-4 py-4 text-xs text-ink-faint space-y-2">
            <ComplianceFooter />
            <div className="flex flex-wrap gap-x-4 gap-y-1 justify-between border-t border-line pt-2">
              <span>Academic prototype · stocks and funds: {meta.data_quality.equity_mode} data as of 30 Oct 2026 · "investors like you" figures are simulated · registration details are placeholders</span>
              <span>{meta.model_version} · {meta.rules_version}</span>
            </div>
          </div>
        </footer>

        {tabs.length > 0 && mode !== "onboarding" && mode !== "welcome" && mode !== "journey" && (
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
        {pending && <ConsentSheet who={pending} onCancel={() => setPending(null)} onDone={() => { const w = pending; setPending(null); if (needs(w).includes("portfolio")) setKiteLinked(true); go(w); }} onSkip={() => { setPending(null); go("explore"); }} />}
        {summaryFor && <Summary analysis={summaryFor} onClose={() => setSummaryFor(null)} />}
        {handoff && <HandoffModal h={handoff} onClose={() => setHandoffState(null)} />}
        {partner && <PartnerModal cat={partner} onClose={() => setPartner(null)} />}
      </div>
    </Ctx.Provider>
  );
}

function ConsentSheet({ who, onCancel, onDone, onSkip }: { who: string; onCancel: () => void; onDone: () => void; onSkip: () => void }) {
  const existing = who !== "new" && who !== "U04";
  return <Modal title="Before we start" onClose={onCancel}><ConsentBody existing={existing} onDone={onDone} onSkip={onSkip} demo /></Modal>;
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
          <div className="text-[15px] font-semibold leading-snug">Allow "Tulana" to track your activity across other companies' apps and websites?</div>
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

