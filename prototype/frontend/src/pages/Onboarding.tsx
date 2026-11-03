import { useState } from "react";
import { useApp } from "../App";
import { inrShort } from "../api";
import { Button, Card, MoneyInput, Steps } from "../ui";

type N = number | "";
const STEPS = ["Your money", "What you already own", "Your plan", "How you feel about risk"];
const OUTSIDE = [["fd", "Fixed deposits"], ["mf", "Mutual funds"], ["stocks", "Stocks"], ["gold", "Gold"], ["ppf_nps", "PPF / NPS / EPF"], ["real_estate", "Property"], ["other", "Other"]] as const;

const Q = [
  { k: "market_fall_20pct", q: "If your investments fell 20% in a month, what would you do?", o: [["Sell", "Sell to stop the loss"], ["Wait", "Wait and watch"], ["Hold", "Hold, it'll recover"], ["Buy more", "Buy more while it's cheap"]] },
  { k: "check_frequency", q: "How often do you expect to check or trade?", o: [["Daily", "Every day"], ["Weekly", "Every week"], ["Monthly", "Every month"], ["Rarely", "Rarely"]] },
  { k: "invest_style", q: "How do you prefer to invest?", o: [["Set-and-forget (SIP)", "Automatic monthly (SIP)"], ["Mix", "A mix of both"], ["Pick it myself", "I like to pick myself"]] },
] as const;
const HORIZON = [["<1 yr", "Within a year"], ["1-3 years", "1 to 3 years"], ["3-5 years", "3 to 5 years"], ["5+ years", "More than 5 years"]] as const;

export default function Onboarding({ preset }: { preset: any }) {
  const { finishOnboarding, busy, signup } = useApp();
  const [pnts, setPnts] = useState(false);
  const [step, setStep] = useState(0);
  const p = preset;
  const [m, setM] = useState<Record<string, N>>(p ? { monthly_income: 60000, monthly_spending: 35000, emi: 0, bank_savings: 50000, invest_lumpsum: 100000, invest_monthly: 10000, age: p.age }
    : { monthly_income: "", monthly_spending: "", emi: "", bank_savings: "", invest_lumpsum: "", invest_monthly: "", age: signup?.age ?? "" });
  const [out, setOut] = useState<Record<string, N>>({});
  const [goal, setGoal] = useState(p ? "Grow long-term wealth" : "");
  const [horizon, setHorizon] = useState<string>(p ? "5+ years" : "");
  const [ans, setAns] = useState<Record<string, string>>(p ? { market_fall_20pct: "Buy more", check_frequency: "Daily", invest_style: "Pick it myself" } : {});
  const num = (v: N) => (v === "" ? 0 : v);
  const left = Math.max(0, num(m.monthly_income) - num(m.monthly_spending) - num(m.emi));
  const emMonths = num(m.monthly_spending) ? num(m.bank_savings) / num(m.monthly_spending) : null;

  const ok = [pnts || (num(m.monthly_income) > 0 && m.monthly_spending !== ""), true, horizon !== "" && (num(m.invest_lumpsum) > 0 || num(m.invest_monthly) > 0), Q.every((q) => ans[q.k])][step];

  const submit = async () => {
    const base = Object.fromEntries(Object.entries(m).map(([k, v]) => [k, num(v)]));
    if (pnts) { base.monthly_income = 0; base.monthly_spending = 0; base.emi = 0; }
    const money = { ...base, ...(pnts ? { undisclosed: 1 } : {}), outside: Object.fromEntries(Object.entries(out).map(([k, v]) => [k, num(v)])) };
    await finishOnboarding({
      money, goal, horizon,
      quiz: { ...ans, horizon, monthly_surplus: "5k-25k" },
      suitability: { age: num(m.age) || undefined, goal },
    });
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Steps step={step} labels={STEPS} />
      <h1 className="text-xl sm:text-2xl font-semibold tracking-tight mt-6">{STEPS[step]}</h1>
      {p && step === 0 && <p className="text-sm text-ink-faint mt-1">Pre-filled for Rohan (demo). Change anything you like.</p>}

      <Card className="mt-5">
        {step === 0 && (
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="sm:col-span-2 flex items-start gap-3 text-sm bg-gray-50 border border-line rounded-md px-3 py-2.5 cursor-pointer">
              <input type="checkbox" className="mt-0.5 w-4 h-4" checked={pnts} onChange={(e) => setPnts(e.target.checked)} />
              <span><b>Prefer not to say</b> my income, spending and EMIs<span className="block text-xs text-ink-faint">We'll use the middle capacity band (conservative) and say so on your risk profile. You can add them later.</span></span>
            </label>
            {!pnts && <>
            <MoneyInput id="inc" label="Monthly income (after tax)" value={m.monthly_income} onChange={(v) => setM({ ...m, monthly_income: v })} />
            <MoneyInput id="spend" label="Monthly spending" value={m.monthly_spending} onChange={(v) => setM({ ...m, monthly_spending: v })} hint="Rent, bills, food, travel…" />
            <MoneyInput id="emi" label="Loan EMIs per month" value={m.emi} onChange={(v) => setM({ ...m, emi: v })} hint="Leave empty if none" />
            </>}
            <MoneyInput id="sav" label="Savings in your bank account" value={m.bank_savings} onChange={(v) => setM({ ...m, bank_savings: v })} />
            <label className="block"><span className="text-sm font-medium">Your age</span>
              <input inputMode="numeric" className="mt-1.5 w-full border border-line rounded-md px-3.5 py-2.5 outline-none focus:border-brand" value={m.age} onChange={(e) => setM({ ...m, age: e.target.value === "" ? "" : Number(e.target.value.replace(/\D/g, "")) })} />
              <span className="text-xs text-ink-faint mt-1 block">Used only to check timelines, never to group you.</span></label>
            {!pnts && <div className="sm:col-span-2 bg-brand-soft rounded-lg p-4 flex flex-wrap gap-6">
              <div><div className="text-xs text-brand-ink">Left over each month</div><div className="text-2xl font-semibold num">{inrShort(left)}</div></div>
              {emMonths !== null && <div><div className="text-xs text-brand-ink">Emergency cushion</div><div className="text-2xl font-semibold num">{emMonths.toFixed(1)} months</div><div className="text-xs text-brand-ink">of spending in the bank</div></div>}
            </div>}
          </div>
        )}
        {step === 1 && (
          <div>
            <p className="text-sm text-ink-soft mb-4">Money you've invested outside this app. Rough amounts are fine; this helps us avoid suggesting what you already have. All optional: leave it blank if you'd rather not say.</p>
            <div className="grid sm:grid-cols-2 gap-4">
              {OUTSIDE.map(([k, l]) => <MoneyInput key={k} id={`o-${k}`} label={l} value={out[k] ?? ""} onChange={(v) => setOut({ ...out, [k]: v })} />)}
            </div>
            <p className="text-sm mt-4 text-ink-faint">Total elsewhere: <b className="text-ink num">{inrShort(Object.values(out).reduce<number>((a, v) => a + num(v), 0))}</b></p>
          </div>
        )}
        {step === 2 && (
          <div className="space-y-5">
            <div className="grid sm:grid-cols-2 gap-4">
              <MoneyInput id="lump" label="Amount to invest now" value={m.invest_lumpsum} onChange={(v) => setM({ ...m, invest_lumpsum: v })} />
              <MoneyInput id="sip" label="Amount to invest every month" value={m.invest_monthly} onChange={(v) => setM({ ...m, invest_monthly: v })}
                hint={left ? `That's ${Math.round((num(m.invest_monthly) / left) * 100)}% of what you have left each month` : undefined} />
            </div>
            <label className="block"><span className="text-sm font-medium">What's it for? <span className="text-ink-faint font-normal">(optional)</span></span>
              <input className="mt-1.5 w-full border border-line rounded-md px-3.5 py-2.5 outline-none focus:border-brand" placeholder="e.g. Buy a home, retirement, a car" value={goal} onChange={(e) => setGoal(e.target.value)} /></label>
            <fieldset><legend className="text-sm font-medium mb-2">When will you need this money?</legend>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {HORIZON.map(([v, l]) => <Choice key={v} on={horizon === v} onClick={() => setHorizon(v)}>{l}</Choice>)}
              </div></fieldset>
            {num(m.invest_monthly) > left && left > 0 && <p className="text-sm text-amber-800 bg-amber-50 rounded-md px-3 py-2">That's more than you have left each month ({inrShort(left)}). You may want to lower it.</p>}
          </div>
        )}
        {step === 3 && (
          <div className="space-y-6">
            {Q.map((q) => (
              <fieldset key={q.k}><legend className="text-sm font-medium mb-2">{q.q}</legend>
                <div className="grid grid-cols-2 gap-2">
                  {q.o.map(([v, l]) => <Choice key={v} on={ans[q.k] === v} onClick={() => setAns({ ...ans, [q.k]: v })}>{l}</Choice>)}
                </div></fieldset>
            ))}
            <p className="text-xs text-ink-faint">We don't ask you to rate your own risk tolerance: research shows people answer that inconsistently. A real situation tells us more.</p>
          </div>
        )}
      </Card>

      <div className="flex justify-between mt-5">
        <Button kind="secondary" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>Back</Button>
        {step < 3 ? <Button disabled={!ok} onClick={() => setStep(step + 1)}>Continue</Button>
          : <Button disabled={!ok || busy} onClick={submit}>{busy ? "Building your plan…" : "See my plan"}</Button>}
      </div>
    </div>
  );
}

function Choice({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button aria-pressed={on} onClick={onClick}
      className={`text-sm text-left px-4 py-3 rounded-lg border font-medium transition-colors ${on ? "border-brand bg-brand-soft text-brand-ink ring-1 ring-brand" : "border-line bg-white hover:border-ink-faint"}`}>{children}</button>
  );
}
