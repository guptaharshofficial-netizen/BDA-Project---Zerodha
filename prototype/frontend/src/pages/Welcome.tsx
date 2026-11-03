import { useApp } from "../App";


const BLURB: Record<string, string> = {
  U01: "27 · invests through SIPs plus a few mid-cap stocks",
  U02: "44 · trades often, all in stocks, some options",
  U03: "61 · retired, inherited large-cap stocks",
  U04: "23 · first job, wants to start investing",
  U05: "35 · hasn't invested since 2023",
};

export default function Welcome() {
  const { meta, startAs, startJourneyAt } = useApp();
  const existing = meta.test_users.filter((u: any) => u.track === "existing");
  return (
    <div className="max-w-5xl mx-auto">
      <section className="text-center pt-4 sm:pt-10 pb-8">
        <img src="/logo-full.png" alt="Tulana, Portfolio Navigator" className="h-20 sm:h-28 w-auto mx-auto mb-1" />
        <div className="text-[11px] text-ink-faint mb-4">by {meta.ria.name} · {meta.ria.status} · free</div>
        <span className="inline-block text-xs font-semibold text-brand-ink bg-brand-soft px-3 py-1 rounded-full">Portfolio insights · demo</span>
        <h1 className="text-3xl sm:text-5xl font-bold tracking-tight mt-4">Invest with a clearer picture.</h1>
        <p className="text-ink-soft text-base sm:text-lg mt-3 max-w-2xl mx-auto">
          See how risky your money is, where it's concentrated, what investors like you hold, and what your investments could grow to.
          You stay in control of every decision.
        </p>
      </section>

      <div className="grid md:grid-cols-2 gap-4">
        <button onClick={() => startJourneyAt("new", "kite_signup")} className="text-left bg-ink text-white rounded-md p-6 sm:p-8 hover:bg-black transition-colors group">
          <div className="text-sm text-white/70">I'm new to investing</div>
          <div className="text-2xl font-semibold mt-1">Build my first portfolio</div>
          <p className="text-sm text-white/70 mt-2">Starts where you'd really meet Tulana: an optional tick-box while opening your Zerodha account. Then Tulana's own sign-up, consent, a few questions about your money, your risk profile and a plan.</p>
          <div className="mt-6 inline-flex items-center gap-2 font-semibold">Start the journey <span className="group-hover:translate-x-1 transition-transform">→</span></div>
        </button>
        <div className="bg-white border border-line rounded-md p-6 sm:p-8 shadow-card">
          <div className="text-sm text-ink-faint">I already invest on Kite</div>
          <div className="text-2xl font-semibold mt-1">Check my portfolio</div>
          <p className="text-sm text-ink-soft mt-2">Starts from the "Analyse with Tulana" button on Kite's holdings page, then Zerodha's data-sharing approval. Pick a sample investor:</p>
          <div className="mt-4 grid gap-2">
            {existing.map((u: any) => (
              <button key={u.id} onClick={() => startJourneyAt("existing", "kite_entry", u.id)} className="flex items-center gap-3 text-left border border-line rounded-lg px-3 py-2.5 hover:border-brand hover:bg-brand-soft/40 transition-colors">
                <span className="w-9 h-9 rounded-full bg-gray-100 grid place-items-center font-semibold text-sm shrink-0">{u.name[0]}</span>
                <span className="min-w-0"><span className="block text-sm font-medium truncate">{u.name}</span><span className="block text-xs text-ink-faint truncate">{BLURB[u.id]}</span></span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-4 mt-6 text-sm">
        {[["Your money, your call", "We show information and options. We never tell you what to buy and never place orders."],
          ["Plain explanations", "Every suggestion comes with why it's there, what it's based on, and what could change it."],
          ["Private by default", "Nothing personal is read until you allow it, and you can switch it off anytime."]].map(([t, d]) => (
          <div key={t} className="bg-white border border-line rounded-lg p-5"><div className="font-semibold">{t}</div><p className="text-ink-faint mt-1">{d}</p></div>
        ))}
      </div>
      <p className="text-center text-sm text-ink-faint mt-8">
        Just looking? <button className="text-brand-dark font-semibold hover:underline" onClick={() => startAs("explore")}>Explore sectors and the calculator without sharing anything</button>
        <span className="block mt-3">Demo shortcuts (skip the Kite and sign-up screens):{" "}
          <button className="text-brand-dark font-medium hover:underline" onClick={() => startAs("new")}>new investor</button>
          {existing.map((u: any) => <span key={u.id}> · <button className="text-brand-dark font-medium hover:underline" onClick={() => startAs(u.id)}>{u.name.split(" ")[0]}</button></span>)}</span>
        <span className="block text-xs mt-2">Rohan ({BLURB.U04}) is also available from the menu for a pre-filled new-investor demo. Market data: {meta.data_quality.equity_mode}, as of 30 Oct 2026.</span>
      </p>
    </div>
  );
}
