/* Screens and parts for the separate-adviser setup: Tulana Advisory (a SEBI-registered adviser) reached from Kite / Coin.
   Kite screens here are clearly labelled mock-ups; the prototype never places orders. */
import { ReactNode, useState } from "react";
import { useApp } from "../App";
import { Json } from "../api";
import { appLink, Badge, Button, Card, Handoff, Info, Modal, RecCard, RISK_WORDS, Toggle } from "../ui";

/* ---------- adviser identity strip and footer ---------- */
export function RiaStrip() {
  const { meta } = useApp();
  const r = meta.ria;
  return (
    <div className="bg-[#f2f5fa] border-t border-line text-[11.5px] text-ink-soft">
      <div className="max-w-6xl mx-auto px-4 py-1.5 flex flex-wrap gap-x-4 gap-y-0.5">
        <b className="text-ink font-semibold">{r.name}</b>
        <span>{r.status} · Reg. No. <Ph>{r.reg_no}</Ph></span>
        <span className="hidden sm:inline">Principal Officer: <Ph>{r.principal_officer}</Ph></span>
        <b className="text-ink font-semibold">Free service</b><span>AI-assisted</span>
      </div>
    </div>
  );
}
export const Ph = ({ children }: { children: ReactNode }) => <span className="bg-amber-100 rounded px-1" title="Placeholder: a real registration detail would go here">{children}</span>;

export function ComplianceFooter() {
  const { meta, setTab, openSettings } = useApp();
  return (
    <div className="space-y-1">
      <p>{meta.ria.disclaimer}</p>
      <p>Tulana is a separate company from Zerodha Broking Ltd. <button className="text-brand-dark underline" onClick={() => openSettings("terms")}>How Tulana is funded</button> · Tulana earns nothing from your trades, SIPs or the platform you choose. · <button className="text-brand-dark underline" onClick={() => openSettings("help")}>Help and grievance</button> · <button className="text-brand-dark underline" onClick={() => setTab("how")}>How this works legally</button></p>
    </div>
  );
}

/* ---------- Kite mock chrome ---------- */
function KiteFrame({ tab, children }: { tab: string; children: ReactNode }) {
  return (
    <div className="max-w-4xl mx-auto bg-white border border-line rounded-lg overflow-hidden shadow-card">
      <div className="bg-orange-50 text-orange-900 text-xs px-4 py-1.5">Mock of the Kite / Coin app, shown only to explain where Tulana is offered. Not Zerodha's real screen.</div>
      <div className="flex items-center gap-6 px-4 h-12 border-b border-line overflow-x-auto no-scrollbar">
        <span className="font-extrabold text-kite text-lg tracking-tight whitespace-nowrap">Kite <span className="text-[11px] font-semibold text-ink-faint">mock</span></span>
        {["Dashboard", "Orders", "Holdings", "Positions", "Funds"].map((t) => (
          <span key={t} className={`text-[13px] whitespace-nowrap py-3 border-b-2 ${t === tab ? "border-kite text-kite" : "border-transparent text-ink-soft"}`}>{t}</span>
        ))}
      </div>
      <div className="p-4 sm:p-6">{children}</div>
    </div>
  );
}

/* Screen 1: entry button inside Kite's holdings page */
export function KiteEntry() {
  const { meta, journey, setJourney, journeyNext, exitJourney } = useApp();
  const existing = meta.test_users.filter((u: Json) => u.track === "existing");
  const who = existing.find((u: Json) => u.id === journey?.who) ?? existing[0];
  return (
    <KiteFrame tab="Holdings">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div><h1 className="text-lg font-semibold">Holdings</h1><p className="text-xs text-ink-faint">Demo Kite account</p></div>
        <label className="text-xs text-ink-faint">Viewing as{" "}
          <select className="border border-line rounded px-2 py-1 text-sm text-ink" value={who.id} onChange={(e) => setJourney({ ...journey!, who: e.target.value })}>
            {existing.map((u: Json) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select></label>
      </div>
      <div className="border border-blue-200 bg-gradient-to-r from-[#f5f9fe] to-white rounded-lg p-4 flex gap-4 items-start">
        <img src="/logo-icon.png" alt="" className="h-10 w-auto shrink-0" />
        <div className="min-w-0">
          <div className="font-semibold">Understand your portfolio with Tulana</div>
          <p className="text-[13px] text-ink-soft mt-1">A free analysis and learning service from <b>{meta.ria.name}</b>, a separate {meta.ria.status.replace("SEBI ", "SEBI-")}. Optional: Kite works exactly the same if you don't use it.</p>
          <div className="flex flex-wrap gap-2 mt-3"><Button size="sm" onClick={journeyNext}>Analyse with Tulana</Button><Button size="sm" kind="ghost" onClick={exitJourney}>Not now</Button></div>
        </div>
      </div>
      <div className="mt-4 space-y-2" aria-hidden>
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-9 rounded bg-gray-50 border border-line" />)}
      </div>
      <p className="text-xs text-ink-faint mt-2">{who.name}'s holdings would be listed here in Kite.</p>
    </KiteFrame>
  );
}

/* Screen 2: optional add-on during Zerodha account opening */
export function KiteSignup() {
  const { meta, journeyNext, exitJourney } = useApp();
  const [tick, setTick] = useState(false);
  const [msg, setMsg] = useState(false);
  return (
    <KiteFrame tab="Dashboard">
      <div className="max-w-xl mx-auto">
        <h1 className="text-xl font-semibold">Open your Zerodha account</h1>
        <p className="text-sm text-ink-faint">Mock sign-up · step 4 of 6</p>
        <div className="mt-4 text-sm font-medium">Segments</div>
        <div className="flex gap-2 mt-2">{["Equity", "Mutual funds"].map((s) => <Badge key={s} tone="accent">{s}</Badge>)}<Badge tone="muted">F&O</Badge></div>
        <hr className="my-5 border-line" />
        <label className="flex gap-3 items-start cursor-pointer">
          <input type="checkbox" className="mt-1 w-4 h-4" checked={tick} onChange={(e) => { setTick(e.target.checked); setMsg(false); }} />
          <span><b>Also open a free Tulana account (optional)</b>
            <span className="block text-[13px] text-ink-soft mt-0.5">{meta.ria.name} is a separate {meta.ria.status.replace("SEBI ", "SEBI-")}. It helps you plan, learn and review your investments, free of charge. Your Zerodha account opens whether or not you tick this.</span></span>
        </label>
        <p className="text-xs text-ink-faint mt-2">Not ticked by default. Tulana's own sign-up and consent follow on separate screens.</p>
        <div className="mt-5"><Button full onClick={() => (tick ? journeyNext() : setMsg(true))}>Continue</Button></div>
        {msg && <div className="mt-3"><Info>Your Zerodha account opens as normal, without Tulana. <button className="underline" onClick={exitJourney}>Back to start</button> or tick the box to see the Tulana path.</Info></div>}
      </div>
    </KiteFrame>
  );
}

/* Screen 3: Zerodha's own consent to share data with Tulana (no Account Aggregator) */
export function KiteApproval() {
  const { meta, journeyNext, setKiteLinked, logEvent, exitJourney } = useApp();
  const [no, setNo] = useState(false);
  const rows: [string, ReactNode][] = [
    ["What is shared", "Holdings, open positions, mutual fund holdings, active SIPs, and transactions from the last 12 months"],
    ["Who receives it", <>{meta.ria.name}, {meta.ria.status} Reg. No. <Ph>{meta.ria.reg_no}</Ph></>],
    ["Why", "To analyse your portfolio and show suggestions that fit your goals and risk profile"],
    ["For how long", "Read-only access for 12 months, renewed only if you allow it again. Stop anytime in Kite (Settings → Connected apps) or in Tulana."],
    ["Never shared", "Your Kite password, bank details, or any ability to place orders"],
  ];
  const allow = () => { setKiteLinked(true); logEvent("kite_link_allowed", { target: "Tulana" }); journeyNext(); };
  return (
    <KiteFrame tab="Holdings">
      <div className="max-w-xl mx-auto">
        <div className="text-xs text-ink-faint">Zerodha Broking Ltd asks for your permission</div>
        <h1 className="text-xl font-semibold mt-1">Share your Kite and Coin data with Tulana?</h1>
        <dl className="mt-4 divide-y divide-line border-y border-line text-sm">
          {rows.map(([k, v]) => <div key={k} className="grid sm:grid-cols-[150px_1fr] gap-1 py-2.5"><dt className="text-ink-faint">{k}</dt><dd>{v}</dd></div>)}
        </dl>
        <p className="text-xs text-ink-faint mt-3">Saying no doesn't change anything in Kite or Coin.</p>
        <div className="grid grid-cols-2 gap-2 mt-4">
          <Button kind="secondary" size="lg" onClick={() => { setNo(true); logEvent("kite_link_declined", { target: "Tulana" }); }}>Don't allow</Button>
          <Button kind="secondary" size="lg" onClick={allow}>Allow</Button>
        </div>
        {no && <div className="mt-3"><Info>Nothing was shared. You can still use Tulana with your own answers, or link Kite later from Tulana's Settings. <button className="underline" onClick={exitJourney}>Back to start</button></Info></div>}
      </div>
    </KiteFrame>
  );
}

/* ---------- Tulana onboarding pages ---------- */
function Progress({ n, of = 5 }: { n: number; of?: number }) {
  return <div className="flex gap-1.5 mb-5" aria-label={`Step ${n} of ${of}`}>{Array.from({ length: of }, (_, i) => <span key={i} className={`h-1 flex-1 rounded ${i < n ? "bg-brand" : "bg-gray-200"}`} />)}</div>;
}

/* Screen 4: Tulana's own sign-up and KYC, 18+ only */
export function Signup() {
  const { meta, journey, journeyNext, setSignup, logEvent } = useApp();
  const u = meta.test_users.find((x: Json) => x.id === journey?.who);
  const [name, setName] = useState(u?.name ?? "");
  const [dob, setDob] = useState(u ? `${2026 - u.age}-06-15` : "");
  const [kyc, setKyc] = useState(false);
  const age = ageOn(dob);
  const ok = name.trim() && kyc && age !== null && age >= 18;
  return (
    <div className="max-w-xl mx-auto">
      <Progress n={1} />
      <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Create your Tulana account</h1>
      <p className="text-sm text-ink-soft mt-1">Free. This is Tulana's own sign-up, separate from Zerodha.</p>
      <Card className="mt-5">
        <div className="space-y-4">
          <Field label="Full name (as on PAN)"><input className="inp" value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Mobile"><input className="inp" defaultValue="98••••••21" /></Field>
            <Field label="Email"><input className="inp" defaultValue="you@example.com" /></Field>
          </div>
          <Field label="PAN" hint="KYC is checked through a KYC registration agency (mocked in this prototype).">
            <div className="flex gap-2"><input className="inp" defaultValue="ABCDE••••F" /><Button kind="secondary" onClick={() => setKyc(true)}>{kyc ? "✓ KYC verified" : "Verify KYC"}</Button></div>
          </Field>
          <Field label="Date of birth"><input type="date" className="inp" value={dob} onChange={(e) => setDob(e.target.value)} /></Field>
          {age !== null && age < 18 && <Info tone="warn">Tulana is only for people aged 18 or over, so we can't open an account. Your Zerodha account is not affected.</Info>}
          {age !== null && age >= 18 && <p className="text-xs text-ink-faint">Age {age}. Used only for safety rules, never to group you with other investors.</p>}
        </div>
        <div className="mt-5"><Button full disabled={!ok} onClick={() => { setSignup({ name, age: age! }); logEvent("signup_completed", { kind: journey?.path }); journeyNext(); }}>Continue</Button></div>
      </Card>
    </div>
  );
}
export function ageOn(dob: string): number | null {
  if (!dob) return null;
  const d = new Date(dob); if (Number.isNaN(d.getTime())) return null;
  const t = new Date("2026-11-03");
  let a = t.getFullYear() - d.getFullYear();
  if (t.getMonth() < d.getMonth() || (t.getMonth() === d.getMonth() && t.getDate() < d.getDate())) a--;
  return a;
}
function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return <label className="block"><span className="text-sm font-medium">{label}</span><div className="mt-1.5">{children}</div>{hint && <span className="text-xs text-ink-faint mt-1 block">{hint}</span>}</label>;
}

/* Screen 5: service choice (SEBI client-level segregation) */
export function ServiceChoice() {
  const { journeyNext, exitJourney, logEvent } = useApp();
  const [ok, setOk] = useState(false);
  return (
    <div className="max-w-xl mx-auto">
      <Progress n={2} />
      <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">How you'll use Tulana</h1>
      <p className="text-sm text-ink-soft mt-1">SEBI requires advice and the selling of products to be kept apart within a business group.</p>
      <Card className="mt-5">
        <div className="flex gap-3 items-start"><span className="text-2xl" aria-hidden>🧭</span>
          <div><b>Analysis, learning and suggestions from Tulana</b><p className="text-[13px] text-ink-soft mt-1">Free. Portfolio analysis, education and suggestions that fit your risk profile.</p></div></div>
        <div className="mt-4"><Info tone="warn"><b>What this means for you:</b> as a Tulana client, no Zerodha group company will sell you commission-based products (for example insurance, regular-plan mutual funds, or partner products that pay a commission). You can still trade on Kite and invest in direct mutual funds on Coin, which carry no commission.</Info></div>
        <label className="flex gap-3 items-start mt-4 cursor-pointer"><input type="checkbox" className="mt-1 w-4 h-4" checked={ok} onChange={(e) => setOk(e.target.checked)} /><span className="text-sm">I understand and want to use Tulana.</span></label>
        <div className="grid grid-cols-2 gap-2 mt-5">
          <Button kind="secondary" onClick={exitJourney}>Not now</Button>
          <Button disabled={!ok} onClick={() => { logEvent("service_choice", { value: "tulana_advisory_free" }); journeyNext(); }}>Continue</Button>
        </div>
      </Card>
    </div>
  );
}

/* Tulana's notice and consent (C1 answers, C2 linked Kite data, optional analytics, tracking). Used as a page and in a sheet. */
export function ConsentBody({ existing, onDone, onSkip, demo }: { existing: boolean; onDone: () => void; onSkip: () => void; demo?: boolean }) {
  const { meta, consents, grant, kiteLinked } = useApp();
  const n = meta.notice;
  const need = existing ? ["profile", "portfolio"] : ["profile"];
  const rows: [string, string, string][] = [
    ["profile", "C1 · Use my answers", "Money, goals and risk answers, used to build your profile and check what suits you."],
    ...(existing ? [["portfolio", "C2 · Use my linked Kite and Coin data", "Holdings, positions and SIPs you allowed Zerodha to share. Used to analyse your portfolio and place you in a peer group."] as [string, string, string]] : []),
    ["analytics", "App usage analytics (optional)", "Helps improve the app. Off by default and never used for your analysis."],
  ];
  return (
    <div>
      <p className="text-sm text-ink-soft">Tulana's own notice. Choose what you're happy to share; you can change it anytime in <b>Settings</b>. Saying no never affects your Kite or Coin account.</p>
      {existing && !kiteLinked && demo && <p className="text-xs text-ink-faint mt-2">Demo shortcut: this assumes you've already allowed Zerodha to share your Kite data with Tulana.</p>}
      {!existing && <div className="mt-3"><Info>C2 (use your Kite and Coin activity) is asked later, only once your Kite account is active and you allow the data link. Until then we use your answers.</Info></div>}
      <div className="mt-4 space-y-3">
        {rows.map(([k, t, d]) => (
          <div key={k} className="flex gap-4 items-start justify-between border border-line rounded-lg p-4">
            <div><div className="font-medium text-sm">{t}</div><div className="text-xs text-ink-faint mt-0.5">{d}</div></div>
            <Toggle id={`c-${k}`} label="" on={!!consents[k]} onChange={(v) => grant(k, v)} />
          </div>
        ))}
        <div className="border border-line rounded-lg p-4 flex justify-between gap-3 items-start">
          <div><div className="font-medium text-sm">Tracking across other apps</div><div className="text-xs text-ink-faint mt-0.5">Your choice from the first prompt. The model never uses it either way.</div></div>
          <Badge tone="muted">{consents.tracking ? "Allowed" : "Not tracked"}</Badge>
        </div>
      </div>
      <div className="mt-4"><Info tone="good"><b>Our promise:</b> {n.promise}</Info></div>
      <details className="mt-3 text-xs text-ink-soft">
        <summary className="cursor-pointer text-brand-dark font-medium">Full notice</summary>
        <ul className="mt-2 space-y-1 list-disc pl-4">
          <li><b>Data:</b> {n.data_categories.join("; ")}.</li><li><b>Use of AI:</b> {n.ai_use}</li><li><b>Shared with:</b> {n.recipients}</li>
          <li><b>Kept for:</b> {n.retention}</li><li><b>Withdraw:</b> {n.withdraw}</li><li>{n.not_used}</li><li>{n.tracking}</li><li>{n.commencement}</li>
        </ul>
      </details>
      <div className="grid grid-cols-2 gap-2 mt-5">
        <Button kind="secondary" size="lg" onClick={onSkip}>Explore without sharing</Button>
        <Button kind="secondary" size="lg" disabled={!need.every((p) => consents[p])} onClick={onDone}>Continue</Button>
      </div>
      <p className="text-[11px] text-ink-faint mt-2 text-center">Both buttons carry equal weight. Continue needs C1{existing ? " and C2" : ""}.</p>
    </div>
  );
}
export function JourneyConsent() {
  const { journey, journeyNext, exitJourney, startAs } = useApp();
  const existing = journey?.path === "existing";
  return (
    <div className="max-w-xl mx-auto">
      <Progress n={3} />
      <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Before we start</h1>
      <Card className="mt-5"><ConsentBody existing={existing} onDone={journeyNext} onSkip={() => { exitJourney(); startAs("explore"); }} /></Card>
    </div>
  );
}

/* Screen 6: risk profile result (shown before any personalised suggestion) */
export function RiskResult() {
  const { mode, analysis, newA, accept, setModeTo, reloadExisting, profileVersion } = useApp();
  const a = mode === "existing" ? analysis : newA;
  const [edit, setEdit] = useState(false);
  if (!a) return null;
  const w = a.willingness ?? null, cap = a.capacity_suitability ?? null;
  const band = a.recommendations?.suitability_band ?? Math.min(w ?? 1, cap ?? 1);
  const WILL = ["", "Cautious", "Careful", "Steady", "Bold"];
  return (
    <div className="max-w-2xl mx-auto">
      <Progress n={4} />
      <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Your risk profile</h1>
      <p className="text-sm text-ink-soft mt-1">Please check it. Suggestions use the lower of the two bands below.</p>
      <div className="grid sm:grid-cols-2 gap-3 mt-5">
        <Card><div className="text-xs text-ink-faint uppercase tracking-wide font-medium">Risk willingness (your answers)</div>
          <div className="text-2xl font-semibold mt-1">{w ? WILL[w] : "Not answered"}</div><p className="text-xs text-ink-faint mt-1">From what you'd do if markets fell 20% in a month.</p></Card>
        <Card><div className="text-xs text-ink-faint uppercase tracking-wide font-medium">Risk capacity (your finances)</div>
          <div className="text-2xl font-semibold mt-1">{cap ? RISK_WORDS[cap] : "Not known"}{a.capacity_default ? " (default)" : ""}</div>
          <p className="text-xs text-ink-faint mt-1">{a.capacity_default ? "You preferred not to share income and spending, so the middle band is used." : (a.capacity_notes || []).slice(0, 2).join(" ") || "Monthly surplus, EMIs, emergency buffer and goal horizon."}</p></Card>
      </div>
      <Card className="mt-3">
        <b>Your suitability band: {RISK_WORDS[band]}</b>
        <p className="text-sm text-ink-soft mt-1">We use the lower of willingness and capacity. Suggestions go up to {RISK_WORDS[band].toLowerCase()}-risk products; anything riskier is shown only as education.</p>
        <ul className="text-xs text-ink-faint mt-2 list-disc pl-4 space-y-0.5">{(a.recommendations?.max_tier_reasons || []).map((r: string) => <li key={r}>{r}</li>)}<li>Profile version P-v{profileVersion + 1} · {a.rules_version}</li></ul>
        {edit && mode === "existing" && (
          <div className="mt-4 border-t border-line pt-4">
            <div className="text-sm font-medium mb-2">If your investments fell 20% in a month, what would you do?</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">{["Sell", "Wait", "Hold", "Buy more"].map((o) => (
              <Button key={o} kind="secondary" size="sm" onClick={() => { reloadExisting({ suitability: { ...(a.suitability || {}), market_fall_20pct: o } }); setEdit(false); }}>{o}</Button>))}</div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2 mt-5">
          <Button kind="secondary" onClick={() => (mode === "new" ? setModeTo("onboarding") : setEdit(!edit))}>Edit answers</Button>
          <Button onClick={() => accept("profile", { band: RISK_WORDS[band] })}>Accept</Button>
        </div>
      </Card>
    </div>
  );
}

/* Screen 7: terms and disclosures (free, one-time). Also shown read-only in Settings. */
export function TermsList() {
  const { meta } = useApp();
  const items: [string, string][] = [
    ["What Tulana does", "Analyses your portfolio, teaches the basics and suggests categories and options that fit your risk profile. It never places orders."],
    ["Free of charge", "There is no fee and no paid tier."],
    ["How Tulana is funded", meta.ria.funding],
    ["Conflict of interest", "Tulana and Zerodha Broking are in the same group. That's why every hand-off also offers 'any platform', and Tulana suggests direct plans only."],
    ["Use of AI", "Scores and suggestions come from versioned rules and a clustering model. An optional AI summary only rewords them. Tulana's adviser remains responsible."],
    ["No guarantees", "Past performance doesn't predict future returns. Projections are estimates, not promises."],
    ["Complaints", "Raise them in Help and grievance. If unresolved, escalate to SEBI SCORES or online dispute resolution (SMART ODR)."],
  ];
  return <ul className="divide-y divide-line">{items.map(([k, v]) => <li key={k} className="py-3"><b className="text-sm">{k}</b><p className="text-[13px] text-ink-soft mt-0.5">{v}</p></li>)}</ul>;
}
export function TermsGate() {
  const { meta, accept } = useApp();
  const [ok, setOk] = useState(false);
  return (
    <div className="max-w-2xl mx-auto">
      <Progress n={5} />
      <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Terms and disclosures</h1>
      <p className="text-sm text-ink-soft mt-1">One-time and free. Needed before we show any personalised suggestion.</p>
      <Card className="mt-5">
        <TermsList />
        <label className="flex gap-3 items-start mt-3 cursor-pointer"><input type="checkbox" className="mt-1 w-4 h-4" checked={ok} onChange={(e) => setOk(e.target.checked)} /><span className="text-sm">I have read the terms and disclosures (version {meta.ria.terms_version}).</span></label>
        <div className="mt-4"><Button full disabled={!ok} onClick={() => accept("terms", { version: meta.ria.terms_version })}>Accept and continue</Button></div>
      </Card>
    </div>
  );
}

/* Screen 9: hand-off before every jump to Kite or Coin */
export function HandoffModal({ h, onClose }: { h: Handoff; onClose: () => void }) {
  const { logEvent, markLeaving } = useApp();
  const l = appLink(h.kind);
  const [msg, setMsg] = useState("");
  const copy = async () => { if (h.copy) { try { await navigator.clipboard.writeText(h.copy); } catch { /* blocked */ } } };
  const cont = async () => {
    await copy(); logEvent("handoff", { app: l.app, category: h.category ?? "" }); markLeaving(h.category);
    window.open(l.url, "_blank", "noopener,noreferrer"); onClose();
  };
  const other = async () => { await copy(); logEvent("handoff", { app: "other", category: h.category ?? "" }); setMsg(`${h.copy ? "Details copied. " : ""}Use any platform you like; Tulana's suggestion stays the same.`); };
  return (
    <Modal title="You're leaving Tulana" onClose={onClose}>
      <p className="text-sm text-ink-soft">You're going to <b>{l.app} by Zerodha</b>, a <b>group company</b> of Tulana.</p>
      <ul className="text-sm text-ink-soft list-disc pl-5 mt-3 space-y-1">
        <li>Tulana earns nothing from what you do next.</li>
        {h.kind === "fund" && <li>Choose a <b>direct plan</b>. Tulana only suggests direct plans.</li>}
        <li>Nothing is bought automatically. You decide there.</li>
        <li>You can do this on <b>any platform</b> you prefer.</li>
        <li>When you come back, Tulana updates your portfolio automatically.</li>
      </ul>
      {h.copy && <div className="mt-3 bg-gray-50 border border-line rounded-md px-3 py-2 text-sm"><span className="text-xs text-ink-faint block">Will be copied for you to paste</span><b>{h.copy}</b></div>}
      {msg && <div className="mt-3"><Info tone="good">{msg}</Info></div>}
      <div className="grid grid-cols-2 gap-2 mt-5"><Button kind="secondary" onClick={onClose}>Cancel</Button><Button kind="secondary" onClick={other}>Other platform</Button></div>
      <div className="mt-2"><Button full onClick={cont}>Continue to {l.app} ↗</Button></div>
    </Modal>
  );
}

/* Screen 10: partner / credit products are education only; C3 only if the user chooses a provider */
export const PARTNER: Record<string, { title: string; body: string; provider: string; regulator: string }> = {
  las: { title: "Loan against securities", body: "Borrowing against your holdings instead of selling them. It's a credit product, not an investment: interest is charged, and a fall in the pledged holdings can lead to a margin call.", provider: "[Partner NBFC name]", regulator: "the RBI" },
  fd: { title: "Fixed deposit", body: "A bank deposit with a fixed rate for a fixed term. Low risk, but returns can trail inflation and breaking it early may cost a penalty.", provider: "[Partner bank name]", regulator: "the RBI" },
  diversified_smallcase: { title: "Diversified smallcase", body: "A ready-made basket of stocks or ETFs spread across sectors, managed on the smallcase platform.", provider: "smallcase Technologies", regulator: "SEBI" },
  thematic_smallcase: { title: "Thematic smallcase", body: "A concentrated basket around one theme. Higher risk because it leans on one idea.", provider: "smallcase Technologies", regulator: "SEBI" },
  nps: { title: "National Pension System", body: "A long-term retirement product with a lock-in until retirement age, run under PFRDA.", provider: "[NPS point of presence]", regulator: "PFRDA" },
};
export function PartnerModal({ cat, onClose }: { cat: string; onClose: () => void }) {
  const p = PARTNER[cat];
  const [go, setGo] = useState(false);
  if (!p) return null;
  return (
    <Modal title={p.title} onClose={onClose}>
      <Badge tone="muted">Education only</Badge>
      <p className="text-sm text-ink-soft mt-3">{p.body}</p>
      <div className="mt-3"><Info tone="warn">Tulana {cat === "las" ? "doesn't suggest borrowing to invest, and " : ""}earns no commission on this product.</Info></div>
      <h3 className="font-semibold text-sm mt-4">If you want to look at a provider</h3>
      <p className="text-[13px] text-ink-soft mt-1">You'd go to a separate regulated provider. Before anything is shared you'd see this (C3 consent):</p>
      <dl className="mt-2 divide-y divide-line border-y border-line text-sm">
        <div className="grid grid-cols-[120px_1fr] gap-1 py-2"><dt className="text-ink-faint">Provider</dt><dd>{p.provider.startsWith("[") ? <Ph>{p.provider}</Ph> : p.provider}, regulated by {p.regulator}</dd></div>
        <div className="grid grid-cols-[120px_1fr] gap-1 py-2"><dt className="text-ink-faint">What's shared</dt><dd>Nothing from Tulana. You sign up directly with them.</dd></div>
        <div className="grid grid-cols-[120px_1fr] gap-1 py-2"><dt className="text-ink-faint">Why</dt><dd>Only if you choose to apply</dd></div>
      </dl>
      {go && <div className="mt-3"><Info>In the real product this opens the provider's own site and consent. Nothing has been shared.</Info></div>}
      <div className="grid grid-cols-2 gap-2 mt-5"><Button kind="secondary" onClick={onClose}>Cancel</Button><Button kind="secondary" onClick={() => setGo(true)}>Continue to provider</Button></div>
    </Modal>
  );
}

/* Suggestion cards with the new controls: dismiss, helpful, turn off, and fuller "Why" */
export function SuggestionCards({ cards, cols = 3 }: { cards: Json[]; cols?: number }) {
  const { openLesson, sugOff, setSugOff, dismissed, dismiss, undismiss, feedback, giveFeedback, profileVersion, consentIds, lastUpdated, mode, openPartner } = useApp();
  if (sugOff) return <Info>Suggestions are turned off. Your analysis still works. <button className="underline font-medium" onClick={() => setSugOff(false)}>Turn back on</button></Info>;
  const cid = mode === "existing" ? consentIds.portfolio ?? consentIds.profile : consentIds.profile;
  const when = lastUpdated ? lastUpdated.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";
  return (
    <div className={`grid gap-3 ${cols === 2 ? "md:grid-cols-2" : "md:grid-cols-3"}`}>
      {cards.map((c) => {
        if (dismissed.includes(c.category)) return (
          <div key={c.category} className="border border-dashed border-line rounded-lg p-4 text-sm text-ink-faint flex items-center justify-between gap-2">"{c.label}" dismissed<Button size="sm" kind="ghost" onClick={() => undismiss(c.category)}>Undo</Button></div>);
        const f = feedback[c.category];
        const partner = PARTNER[c.category] || c.surface === "off-platform" || c.surface === "smallcase";
        return (
          <RecCard key={c.category} c={c} onLearn={openLesson}
            top={<button className="text-xs text-brand-dark hover:underline" onClick={() => dismiss(c.category)}>✕ Dismiss</button>}
            action={partner ? <Button size="sm" kind="secondary" onClick={() => openPartner(c.category)}>Learn more</Button> : undefined}
            whyExtra={[["Your profile", `Profile version P-v${profileVersion}, accepted by you`], ["Consent used", `${cid ?? "—"} · ${"notice-2026-10-31-v1"}`], ["Data updated", when]]}
            footer={
              <div className="flex flex-wrap items-center justify-between gap-2 mt-3 pt-3 border-t border-line text-xs text-ink-faint">
                <span>Helpful?{" "}
                  <button aria-pressed={f === "y"} className={`px-1 ${f === "y" ? "text-brand-dark font-bold" : ""}`} onClick={() => giveFeedback(c.category, "y")}>👍</button>
                  <button aria-pressed={f === "n"} className={`px-1 ${f === "n" ? "text-brand-dark font-bold" : ""}`} onClick={() => giveFeedback(c.category, "n")}>👎</button>
                  {f && <span> Thanks. It won't change your risk profile.</span>}</span>
                <button className="text-brand-dark hover:underline" onClick={() => setSugOff(true)}>Turn off suggestions</button>
              </div>} />
        );
      })}
    </div>
  );
}

/* "Start here" checklist for new investors (My plan) */
export function StartHere({ a, basket }: { a: Json; basket: Json[] }) {
  const { openLesson } = useApp();
  const em = a.money?.emergency_months;
  const held: string[] = a.held_categories || [];
  const funds = basket.filter((b) => b.kind === "fund").length;
  const sectors = new Set(basket.filter((b) => b.kind === "stock").map((b) => b.sector)).size;
  const steps = [
    { done: (em ?? 0) >= 3 || held.includes("liquid_fund") || held.includes("fd"), t: "Emergency buffer", d: "3–6 months of expenses somewhere safe and easy to reach", g: "guide-emergency" },
    { done: funds > 0 || held.includes("core_mf_sip"), t: "Start your first SIP", d: "a broad index fund, an amount you can keep up", g: "guide-first-sip" },
    { done: funds > 0 && (sectors >= 2 || a.concentration?.level === "Low"), t: "Learn diversification", d: "why one sector or stock shouldn't dominate", g: "guide-index" },
    { done: false, t: "Then consider individual stocks", d: "once you have some investing history", g: "guide-first-stock" },
  ];
  const nDone = steps.filter((s) => s.done).length;
  return (
    <Card title="Start here" subtitle="A simple order for first-time investors. Each step has a short guide." right={<span className="text-xs text-ink-faint">{nDone} of 4 done</span>}>
      <ol className="divide-y divide-line">
        {steps.map((s, i) => {
          const locked = i === 3 && nDone < 3;
          return (
            <li key={s.t} className="py-3 flex items-center gap-3">
              <span aria-hidden className={`w-6 h-6 rounded-full grid place-items-center text-xs font-semibold shrink-0 ${s.done ? "bg-up text-white" : locked ? "bg-gray-100 text-ink-faint" : "bg-brand-soft text-brand-ink"}`}>{s.done ? "✓" : locked ? "🔒" : i + 1}</span>
              <div className="flex-1 min-w-0"><b className="text-sm">{s.t}</b><span className="text-xs text-ink-faint block sm:inline sm:ml-2">{s.d}</span></div>
              <Button size="sm" kind={!s.done && !locked && steps.slice(0, i).every((x) => x.done) ? "primary" : "ghost"} onClick={() => openLesson(s.g)}>{locked ? "Read first" : s.done ? "Guide" : "Show me how"}</Button>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

/* Getting started guides (shown at the top of Learn) */
export const GUIDES: { id: string; title: string; mins: number; steps: string[]; app?: "stock" | "fund"; copy?: string }[] = [
  { id: "guide-first-sip", title: "Your first SIP on Coin", mins: 4, app: "fund", copy: "Nifty 50 index fund · Direct · Growth", steps: [
    "Pick the type, not a 'hot' fund. For a first SIP, a broad index fund is simple and low-cost.",
    "Choose a direct plan. Direct plans have no distributor commission, so more of your money stays invested.",
    "Set an amount you can keep up. Consistency matters more than size; you can step it up later.",
    "Pick a date a few days after your salary arrives so the debit never bounces.",
    "Leave it alone. Markets will fall at times; an SIP buys more units when prices are low."] },
  { id: "guide-first-stock", title: "Buying your first stock on Kite", mins: 5, app: "stock", steps: [
    "Start only after your emergency buffer and a first SIP are in place.",
    "Read what the company does and how it makes money before looking at the price.",
    "Use a small amount: as a new investor, keep single stocks under 20% of what you invest.",
    "Place a limit order at a price you're comfortable with, and check the total including charges.",
    "Decide in advance what would make you sell, so a bad day doesn't decide for you."] },
  { id: "guide-index", title: "What an index fund is", mins: 3, app: "fund", copy: "Nifty 50 index fund · Direct · Growth", steps: [
    "An index fund buys every company in an index, such as the Nifty 50, in the same proportions.",
    "You get the market's return, minus a small cost, instead of betting on a few stocks.",
    "It spreads your money across sectors automatically, which is diversification in one step.",
    "Compare index funds on cost (expense ratio) and tracking error, not on last year's return."] },
  { id: "guide-emergency", title: "Emergency fund before investing", mins: 3, steps: [
    "Keep 3–6 months of essential spending somewhere safe and easy to reach.",
    "A savings account, a fixed deposit or a liquid fund are common places.",
    "Don't count money you've invested in shares: it can be down exactly when you need it.",
    "Rebuild the buffer first if you ever use it."] },
];
export function Guide({ id }: { id: string }) {
  const g = GUIDES.find((x) => x.id === id)!;
  return (
    <Card title={g.title} right={<Badge tone="muted">Guide · {g.mins} min</Badge>}>
      <ol className="list-decimal pl-5 space-y-2 text-[14.5px] leading-relaxed">{g.steps.map((s) => <li key={s}>{s}</li>)}</ol>
      {g.app && <>
        <div className="mt-4"><Info>Tulana won't place this for you. When you're ready, continue to {appLink(g.app).app} or any platform you prefer.</Info></div>
        <div className="mt-3"><GoToAppBtn kind={g.app} copy={g.copy} /></div>
      </>}
      <p className="text-xs text-ink-faint mt-3">Education only. No risk profile needed.</p>
    </Card>
  );
}
function GoToAppBtn({ kind, copy }: { kind: "stock" | "fund"; copy?: string }) {
  const { openHandoff } = useApp();
  return <Button onClick={() => openHandoff({ kind, copy })}>Continue to {appLink(kind).app}</Button>;
}
