import { useEffect, useState } from "react";
import { useApp } from "../App";
import { api } from "../api";
import { Badge, Button, Loading, Toggle } from "../ui";

export default function Summary({ analysis, onClose }: { analysis: any; onClose: () => void }) {
  const { sid, meta } = useApp();
  const [llm, setLlm] = useState(false);
  const [s, setS] = useState<any>(null);
  useEffect(() => {
    setS(null);
    api.summary({ session: sid, analysis, use_llm: llm }).then(setS);
  }, [llm]);
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="sum-title" className="fixed inset-0 bg-black/30 flex items-start sm:items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-md max-w-2xl w-full p-6 shadow-lg">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="sum-title" className="text-lg font-semibold">Summary of your analysis</h2>
            <p className="text-xs text-ink-faint">AI-generated wording of rule-based results · mode: {s?.mode ?? "…"}</p>
            <p className="text-xs text-ink-faint">Tulana's adviser is responsible for this content. The summary cannot add or change suggestions.</p>
          </div>
          <button aria-label="Close summary" className="text-ink-faint hover:text-ink px-1" onClick={onClose}>✕</button>
        </div>
        <div className="mt-3">
          {meta.llm_available ? <Toggle id="llm" label="Use the optional language model to rephrase" on={llm} onChange={setLlm} />
            : <p className="text-xs text-ink-faint">Template mode. The optional language-model mode is off because no API key is set.</p>}
        </div>
        {!s ? <Loading what="Summarising" /> : (
          <div className="mt-4 space-y-4">
            {s.rejected_reason && <p className="text-xs bg-amber-50 border border-amber-200 rounded p-2">The language-model output was not used ({s.rejected_reason}); showing the template summary.</p>}
            {Object.entries(s.sections).map(([h, t]: any) => (
              <section key={h}><h3 className="text-sm font-semibold">{h}</h3><p className="text-sm text-ink-soft mt-1 leading-relaxed">{t}</p></section>
            ))}
            <p className="text-xs text-ink-faint border-t border-line pt-3">{s.footer} <Badge tone="muted">{s.model_version} · {s.rules_version}</Badge></p>
          </div>
        )}
        <div className="mt-4 text-right"><Button kind="secondary" onClick={onClose}>Close</Button></div>
      </div>
    </div>
  );
}
