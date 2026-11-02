import { useEffect, useState } from "react";
import { TrackingChoice, useApp } from "../App";
import { api } from "../api";
import { Card, Toggle } from "../ui";

export default function ConsentPage() {
  const { meta, sid, consents, grant } = useApp();
  const [log, setLog] = useState<any[]>([]);
  useEffect(() => { api.consentState(sid).then((r) => setLog(r.log)); }, [sid, consents]);
  return (
    <div className="space-y-5 max-w-4xl">
      <h1 className="text-2xl font-semibold tracking-tight">Consent and data</h1>
      <Card title="Your permissions" subtitle="Withdrawing is as easy as granting. Withdrawal drops your data from this session and is logged.">
        <div className="space-y-4">
          {Object.entries(meta.permissions).filter(([k]) => k !== "tracking").map(([k, p]: [string, any]) => (
            <div key={k} className="flex flex-col sm:flex-row gap-2 sm:gap-6 border-b border-line last:border-0 pb-3 last:pb-0">
              <div className="flex-1">
                <div className="font-medium text-sm">{p.label}</div>
                <div className="text-xs text-ink-soft mt-0.5">Purpose: {p.purpose}</div>
                <div className="text-xs text-ink-faint mt-0.5">If you turn this off: {p.stops}</div>
              </div>
              <Toggle id={`c-${k}`} label="Allow" on={!!consents[k]} onChange={(v) => grant(k, v)} />
            </div>
          ))}
          <TrackingChoice />
          <p className="text-xs text-ink-faint">{meta.notice.tracking}</p>
        </div>
      </Card>
      <Card title="Audit log for this session" subtitle="Local file audit.jsonl. Identifiers are masked (DPDP Rule 6: masking and access logs).">
        <div className="overflow-x-auto"><table className="w-full text-xs">
          <thead><tr className="text-left text-ink-faint border-b border-line"><th className="py-1.5 font-medium">Time (UTC)</th><th className="py-1.5 font-medium">Event</th><th className="py-1.5 font-medium">Detail</th><th className="py-1.5 font-medium">Versions</th></tr></thead>
          <tbody>{[...log].reverse().map((r, i) => (
            <tr key={i} className="border-b border-line last:border-0 align-top">
              <td className="py-1.5 pr-2 whitespace-nowrap">{r.ts}</td><td className="py-1.5 pr-2">{r.event}</td>
              <td className="py-1.5 pr-2 text-ink-soft">{r.permission ? `${r.permission} · ${r.notice_version}` : r.cards ? `cards: ${r.cards.join(", ")}` : r.mode ? `summary mode: ${r.mode}` : r.surface ? `surface ${r.surface}` : ""}</td>
              <td className="py-1.5 text-ink-faint">{r.model_version} · {r.rules_version}</td></tr>))}</tbody>
        </table></div>
      </Card>
      <Card title="Notice details">
        <ul className="text-sm space-y-1 text-ink-soft">
          <li><b className="text-ink">Retention:</b> {meta.notice.retention}</li>
          <li><b className="text-ink">Recipients:</b> {meta.notice.recipients}</li>
          <li><b className="text-ink">Never used:</b> {meta.notice.not_used}</li>
          <li><b className="text-ink">Dates:</b> {meta.notice.commencement}</li>
          <li><b className="text-ink">Never asked for:</b> passwords, bank details or ID numbers.</li>
        </ul>
      </Card>
    </div>
  );
}
