import { useState } from "react";
import { Card, Modal } from "../ui";
import { SectorGrid, TopList } from "../components/Market";
import Calculator from "../components/Calculator";

export default function ExplorePage() {
  const [sector, setSector] = useState<string | null>(null);
  const [calc, setCalc] = useState<any>(null);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Explore sectors</h1>
        <p className="text-sm text-ink-faint mt-1">See how each sector did over the last year, what's driving it, and its top 15 stocks and funds.</p>
      </div>
      <Card><SectorGrid onPick={setSector} /></Card>
      {sector && <TopList sector={sector} onClose={() => setSector(null)} addLabel="Estimate" onAdd={(row, kind) => { setSector(null); setCalc({ kind, id: String(row.id), name: row.name, amount: 10000, sip: 0 }); }} />}
      {calc && <Modal wide title="Estimate returns" onClose={() => setCalc(null)}><Calculator seed={[calc]} title={calc.name} /></Modal>}
    </div>
  );
}
