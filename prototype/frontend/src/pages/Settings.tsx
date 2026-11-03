import { useEffect, useState } from "react";
import { TrackingChoice, useApp } from "../App";
import { api } from "../api";
import { Badge, Button, Card, Info, Toggle } from "../ui";
import { Ph, TermsList } from "../components/Compliance";

export type SettingsSection = "permissions" | "linked" | "rights" | "help" | "history" | "terms" | "close" | "audit";
const SECTIONS: [SettingsSection, string, string][] = [
  ["permissions", "🔐", "Your permissions"], ["linked", "🔗", "Linked accounts"], ["rights", "🗂", "My data rights"],
  ["help", "🛟", "Help and grievance"], ["history", "🧾", "Suggestion history"], ["terms", "📄", "Terms and disclosures"],
  ["close", "🚪", "Close account"], ["audit", "📜", "Audit log"],
];

export default function Settings() {
  const { settingsSection, openSettings } = useApp();
  const cur = settingsSection ?? "permissions";
  return (
    <div className="space-y-5">
      <div><h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Settings</h1><p className="text-sm text-ink-faint">Your permissions, data and help, in one place.</p></div>
      <div className="grid md:grid-cols-[220px_1fr] gap-5 items-start">
        <nav aria-label="Settings sections" className="bg-white border border-line rounded-md p-2 flex md:flex-col gap-1 overflow-x-auto no-scrollbar">
          {SECTIONS.map(([id, ic, l]) => (
            <button key={id} onClick={() => openSettings(id)} aria-current={cur === id ? "page" : undefined}
              className={`text-left text-sm px-3 py-2 rounded-lg whitespace-nowrap ${cur === id ? "bg-brand-soft text-brand-ink font-medium" : "hover:bg-gray-50 text-ink-soft"}`}><span aria-hidden>{ic}</span> {l}</button>
          ))}
        </nav>
        <div className="min-w-0">
          {cur === "permissions" && <Permissions />}{cur === "linked" && <Linked />}{cur === "rights" && <Rights />}
          {cur === "help" && <Help />}{cur === "history" && <History />}{cur === "terms" && <Terms />}
          {cur === "close" && <Close />}{cur === "audit" && <Audit />}
        </div>
      </div>
    </div>
  );
}

function Permissions() {
  const { meta, consents, grant, consentIds } = useApp();
  const label: Record<string, string> = { profile: "C1 · Use my answers", portfolio: "C2 · Use my linked Kite and Coin data", analytics: "App usage analytics (optional)" };
  return (
    <Card title="Your permissions" subtitle="Withdrawing is as easy as granting. Withdrawal stops that use straight away and is logged.">
      <div className="space-y-4">
        {(["profile", "portfolio", "analytics"] as const).map((k) => {
          const p = meta.permissions[k];
          return (
            <div key={k} className="flex flex-col sm:flex-row gap-2 sm:gap-6 border-b border-line pb-3">
              <div className="flex-1">
                <div className="font-medium text-sm">{label[k]}</div>
                <div className="text-xs text-ink-soft mt-0.5">Purpose: {p.purpose}</div>
                <div className="text-xs text-ink-faint mt-0.5">If you turn this off: {p.stops}{k === "portfolio" ? " Suggestions fall back to your own answers." : ""}</div>
                {consents[k] && consentIds[k] && <div className="text-xs text-ink-faint mt-0.5">Consent ID {consentIds[k]} · notice {meta.notice_version}</div>}
              </div>
              <Toggle id={`p-${k}`} label="Allow" on={!!consents[k]} onChange={(v) => grant(k, v)} />
            </div>
          );
        })}
        <TrackingChoice />
        <p className="text-xs text-ink-faint">{meta.notice.tracking}</p>
        <Info tone="good"><b>Our promise:</b> {meta.notice.promise}</Info>
      </div>
    </Card>
  );
}

function Linked() {
  const { kiteLinked, disconnectKite, lastUpdated, mode, startJourneyAt, userId } = useApp();
  const when = lastUpdated ? lastUpdated.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "not yet";
  return (
    <Card title="Linked accounts" subtitle="What Tulana can see, and how to stop it.">
      <div className="flex flex-wrap justify-between gap-2 items-start">
        <div><b className="text-sm">Kite and Coin (Zerodha Broking Ltd)</b>
          <div className="text-xs text-ink-faint">{kiteLinked ? "Read-only · access valid for 12 months from linking" : "Not linked. Tulana uses only your own answers."}</div></div>
        <Badge tone={kiteLinked ? "ok" : "muted"}>{kiteLinked ? "Connected" : "Not linked"}</Badge>
      </div>
      {kiteLinked && (
        <table className="w-full text-sm mt-4"><thead><tr className="text-left text-xs text-ink-faint border-b border-line"><th className="py-1.5 font-medium">Data</th><th className="py-1.5 font-medium">Last updated</th></tr></thead>
          <tbody>{["Equity holdings", "Open positions (F&O, shown separately)", "Mutual fund holdings and SIPs"].map((d) => <tr key={d} className="border-b border-line"><td className="py-2">{d}</td><td className="py-2">{when}</td></tr>)}
            <tr><td className="py-2">Transactions</td><td className="py-2">Last 12 months only</td></tr></tbody></table>
      )}
      <p className="text-xs text-ink-faint mt-3">Updated automatically each time you open Tulana or come back from Kite or Coin. If Kite can't be reached, we show the last successful update time and say so.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {kiteLinked ? <Button kind="secondary" onClick={disconnectKite}>Disconnect</Button>
          : <Button kind="secondary" onClick={() => startJourneyAt("existing", "kite_approval", userId && mode === "existing" ? userId : undefined)}>Link Kite (goes to Zerodha's approval screen)</Button>}
      </div>
      <div className="mt-4"><Info>Disconnecting stops all future data flow from Kite and Coin, revokes the access token on both sides, and moves you back to your own answers.</Info></div>
    </Card>
  );
}

function Rights() {
  const { logEvent, consents, profileVersion, accepted, mode } = useApp();
  const [done, setDone] = useState<string>("");
  const [show, setShow] = useState(false);
  const items: [string, string, string][] = [
    ["access", "See my data", "A summary of everything Tulana holds about you"], ["correct", "Correct my data", "Fix a wrong answer or holding"],
    ["download", "Download my data", "A copy in a common format"], ["erase", "Delete my data", "Erase what we don't have to keep by law"],
    ["nominate", "Nominate someone", "A person who can act for you if you can't"],
  ];
  return (
    <Card title="My data rights" subtitle="Under the Digital Personal Data Protection Act, 2023.">
      <div className="grid sm:grid-cols-2 gap-3">
        {items.map(([k, t, d]) => (
          <div key={k} className="border border-line rounded-lg p-4"><b className="text-sm">{t}</b><p className="text-xs text-ink-faint mt-1">{d}</p>
            <div className="mt-3"><Button size="sm" kind="secondary" onClick={() => { logEvent("data_request", { request: k }); setDone(t); if (k === "access") setShow(true); }}>{t.split(" ")[0]}</Button></div></div>
        ))}
        <div className="border border-line rounded-lg p-4"><b className="text-sm">How long we keep it</b><p className="text-xs text-ink-faint mt-1">While your account is open. Records SEBI requires (risk profile, suggestions shown, consents) are kept for 5 years after closure, then deleted.</p></div>
      </div>
      {done && <div className="mt-3"><Info tone="good">"{done}" request logged. In the real product it would be answered within the time the DPDP Rules set.</Info></div>}
      {show && (
        <pre className="mt-3 text-xs bg-gray-50 border border-line rounded-md p-3 overflow-x-auto">{JSON.stringify({ journey: mode, consents, profile_version: `P-v${profileVersion}`, accepted }, null, 2)}</pre>
      )}
    </Card>
  );
}

function Help() {
  const { meta, logEvent, tickets } = useApp();
  const [about, setAbout] = useState("suggestion");
  const [txt, setTxt] = useState("");
  const submit = async () => { await logEvent("grievance_raised", { about }); setTxt(""); };
  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <Card title="Raise a complaint" subtitle="Every complaint gets an owner and a ticket number.">
        <label className="block text-sm font-medium">About
          <select className="inp mt-1.5" value={about} onChange={(e) => setAbout(e.target.value)}>
            <option value="suggestion">A suggestion I disagree with</option><option value="data">Wrong data about me</option><option value="privacy">Consent or privacy</option><option value="other">Something else</option>
          </select></label>
        <label className="block text-sm font-medium mt-3">Details<textarea className="inp mt-1.5" rows={3} value={txt} onChange={(e) => setTxt(e.target.value)} placeholder="What happened?" /></label>
        <p className="text-xs text-ink-faint mt-1">In this prototype only the topic is recorded; your text isn't stored.</p>
        <div className="mt-3"><Button onClick={submit}>Submit</Button></div>
        {tickets.length > 0 && <ul className="mt-3 space-y-1 text-sm">{tickets.map((t) => <li key={t.ref} className="flex justify-between border border-line rounded px-3 py-1.5"><span>{t.ref} · {t.about}</span><Badge tone="accent">Open · grievance officer</Badge></li>)}</ul>}
      </Card>
      <Card title="Who handles it">
        <ul className="text-sm divide-y divide-line">
          <li className="py-2 flex justify-between gap-2"><span>Grievance officer</span><Ph>{meta.ria.grievance_officer}</Ph></li>
          <li className="py-2 flex justify-between gap-2"><span>Principal Officer</span><Ph>{meta.ria.principal_officer}</Ph></li>
          <li className="py-2 flex justify-between gap-2"><span>Data protection contact</span><Ph>{meta.ria.dpo}</Ph></li>
        </ul>
        <h3 className="font-semibold text-sm mt-4">Not resolved?</h3>
        <p className="text-[13px] text-ink-soft mt-1">Escalate to SEBI SCORES, then online dispute resolution (SMART ODR). Privacy complaints can go to the Data Protection Board of India.</p>
      </Card>
    </div>
  );
}

function History() {
  const { history } = useApp();
  return (
    <Card title="My suggestion history" subtitle="Everything Tulana showed you in this session, and what it was based on.">
      {history.length === 0 ? <p className="text-sm text-ink-faint">Nothing yet. Suggestions appear here once you've accepted your risk profile and the terms.</p> : (
        <div className="overflow-x-auto"><table className="w-full text-xs">
          <thead><tr className="text-left text-ink-faint border-b border-line"><th className="py-1.5 pr-2 font-medium">Time</th><th className="py-1.5 pr-2 font-medium">Suggestion</th><th className="py-1.5 pr-2 font-medium">Based on</th><th className="py-1.5 font-medium">Your action</th></tr></thead>
          <tbody>{[...history].reverse().map((h, i) => (
            <tr key={i} className="border-b border-line align-top"><td className="py-1.5 pr-2 whitespace-nowrap">{h.ts}</td><td className="py-1.5 pr-2"><b>{h.label}</b><div className="text-ink-faint">{h.rule}</div></td>
              <td className="py-1.5 pr-2 text-ink-soft">P-v{h.profile} · {h.consent ?? "—"} · {h.versions}</td><td className="py-1.5">{h.action}</td></tr>))}</tbody>
        </table></div>
      )}
      <p className="text-xs text-ink-faint mt-3">Kept for 5 years as SEBI requires, so any suggestion can be explained later.</p>
    </Card>
  );
}

function Terms() {
  const { meta, accepted } = useApp();
  return (
    <Card title="Terms and disclosures" subtitle={`Version ${meta.ria.terms_version} · ${accepted.terms ? "accepted in this session" : "not accepted yet"}`}>
      <TermsList />
      <p className="text-xs text-ink-faint mt-3">{meta.ria.disclaimer}</p>
    </Card>
  );
}

function Close() {
  const { closeAccount } = useApp();
  const [sure, setSure] = useState(false);
  return (
    <Card title="Close your Tulana account">
      <ul className="text-sm text-ink-soft list-disc pl-5 space-y-1">
        <li>All consents are withdrawn and the Kite link is disconnected.</li><li>Your answers, profile and analysis are deleted.</li>
        <li>Records SEBI requires (risk profile, suggestions shown, consents) are kept for 5 years, then deleted.</li><li>Your Zerodha account is not affected.</li>
      </ul>
      {sure && <div className="mt-3"><Info tone="warn">Are you sure? This can't be undone in the real product.</Info></div>}
      <div className="grid grid-cols-2 gap-2 mt-4 max-w-md">
        <Button kind="secondary" onClick={() => setSure(false)}>Keep my account</Button>
        <Button kind="secondary" onClick={() => (sure ? closeAccount() : setSure(true))}>{sure ? "Yes, close it" : "Close account"}</Button>
      </div>
    </Card>
  );
}

function Audit() {
  const { sid, consents } = useApp();
  const [log, setLog] = useState<any[]>([]);
  useEffect(() => { api.consentState(sid).then((r) => setLog(r.log)).catch(() => setLog([])); }, [sid, consents]);
  return (
    <Card title="Audit log for this session" subtitle="Identifiers are masked (DPDP Rule 6). On the hosted demo this resets when the server restarts; production would use a durable, access-controlled store.">
      <div className="overflow-x-auto"><table className="w-full text-xs">
        <thead><tr className="text-left text-ink-faint border-b border-line"><th className="py-1.5 font-medium">Time (UTC)</th><th className="py-1.5 font-medium">Event</th><th className="py-1.5 font-medium">Detail</th><th className="py-1.5 font-medium">Versions</th></tr></thead>
        <tbody>{[...log].reverse().map((r, i) => (
          <tr key={i} className="border-b border-line last:border-0 align-top">
            <td className="py-1.5 pr-2 whitespace-nowrap">{r.ts}</td><td className="py-1.5 pr-2">{r.event}</td>
            <td className="py-1.5 pr-2 text-ink-soft">{r.permission ? `${r.permission} · ${r.consent_id ?? ""} · ${r.notice_version}` : r.cards ? `cards: ${r.cards.join(", ")}` : r.mode ? `summary mode: ${r.mode}` : Object.entries(r).filter(([k]) => !["ts", "session", "event", "model_version", "rules_version", "consent_ids"].includes(k)).map(([k, v]) => `${k}: ${v}`).join(" · ")}</td>
            <td className="py-1.5 text-ink-faint">{r.model_version} · {r.rules_version}</td></tr>))}</tbody>
      </table></div>
    </Card>
  );
}
