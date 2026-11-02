import { useApp } from "../App";
import { Card, Info } from "../ui";
import Calculator from "../components/Calculator";

export default function CalcPage() {
  const { mode, basket, setTab } = useApp();
  const seed = mode === "new" ? basket.map((b) => ({ kind: b.kind, id: b.id, name: b.name, amount: b.amount, sip: b.sip ?? 0 })) : undefined;
  return (
    <div className="space-y-4 max-w-4xl">
      <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Returns calculator</h1>
      {mode === "new" && basket.length > 0 && <Info tone="good">Your basket from "My plan" is loaded. Add monthly amounts or more holdings if you like.</Info>}
      {mode === "existing" && <Info>Want to see how a new investment changes your risk too? Use <button className="underline font-medium" onClick={() => setTab("spread")}>Spread my risk → What if?</button></Info>}
      <Card><Calculator seed={seed} /></Card>
    </div>
  );
}
