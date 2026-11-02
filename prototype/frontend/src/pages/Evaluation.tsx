import { useEffect, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts";
import { api, pct } from "../api";
import { Badge, Card, Info, Loading, PALETTE, Stat } from "../ui";

export default function Evaluation() {
  const [e, setE] = useState<any>(null);
  useEffect(() => { api.evaluation().then(setE); }, []);
  if (!e) return <Loading />;
  const ev = e.evaluation, st = e.stability, km = e.k_meta;
  const names = Object.fromEntries(e.clusters.map((c: any) => [c.cluster, c.name]));
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Evaluation</h1>
        <Info>{e.synthetic_note} Population: {e.n_users.toLocaleString("en-IN")} users, k-means on four standardised dimensions, {e.model_version}.</Info>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Chosen k" value={e.k} sub={km.outside_range_flag ? `Unconstrained best was k=${km.unconstrained_best_k}` : "Best combined rank"} />
        <Stat label="Silhouette (chosen k)" value={ev.silhouette.toFixed(3)} sub="Higher is better (max 1)" />
        <Stat label="Davies–Bouldin (chosen k)" value={ev.davies_bouldin.toFixed(3)} sub="Lower is better" />
        <Stat label="precision@3 (hide-one)" value={ev.precision.precision_at_3.toFixed(3)} sub={`Popularity baseline ${ev.precision.global_popularity_baseline.toFixed(3)} · n=${ev.precision.users_evaluated.toLocaleString("en-IN")}`} />
      </div>

      <Card title="1 · Choosing k" subtitle={e.k_rule}>
        <div className="h-64"><ResponsiveContainer>
          <LineChart data={e.k_selection_rows} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid stroke="#eee" /><XAxis dataKey="k" label={{ value: "k", position: "insideBottomRight", offset: -2 }} />
            <YAxis yAxisId="l" domain={[0, "auto"]} /><YAxis yAxisId="r" orientation="right" domain={[0, "auto"]} />
            <Tooltip /><Legend />
            <Line yAxisId="l" type="monotone" dataKey="silhouette" name="Silhouette (left)" stroke={PALETTE[0]} strokeWidth={2} dot isAnimationActive={false} />
            <Line yAxisId="r" type="monotone" dataKey="davies_bouldin" name="Davies–Bouldin (right)" stroke={PALETTE[1]} strokeWidth={2} strokeDasharray="5 3" dot isAnimationActive={false} />
          </LineChart></ResponsiveContainer></div>
        {km.outside_range_flag && <p className="text-sm mt-3"><Badge tone="warn">Finding</Badge> On this synthetic population the metrics prefer k={km.unconstrained_best_k}, outside the 4–6 range reported by Thompson et al. (2021) and Kumar et al. (2018). The pre-set rule picks the best k inside that range (k={e.k}). With quartile-banded features, the Hands-on Wealth Builder persona tends to merge into Active Traders; this needs re-testing on real data.</p>}
      </Card>

      <div className="grid lg:grid-cols-2 gap-5">
        <Card title="2 · Stability" subtitle="Practitioner test from Mehta et al. (2025)">
          <ul className="text-sm space-y-2">
            <li>Adjusted Rand index across {st.n_seeds} random seeds: mean <b>{st.seed_ari_mean.toFixed(3)}</b>, min {st.seed_ari_min.toFixed(3)}</li>
            <li>Adjusted Rand index between two time windows: <b>{st.window_ari.toFixed(3)}</b></li>
            <li className="text-xs text-ink-faint">{st.window_note}</li>
          </ul>
        </Card>
        <Card title="3 · Recommendation accuracy" subtitle={ev.precision.protocol}>
          <ul className="text-sm space-y-1">
            {Object.entries(ev.precision.per_cluster).map(([c, v]: any) => <li key={c} className="flex justify-between"><span>{names[c]}</span><span className="tabular-nums">{(v as number).toFixed(3)}</span></li>)}
          </ul>
          <p className="text-xs text-ink-faint mt-2">Overall {ev.precision.precision_at_3.toFixed(3)} vs {ev.precision.global_popularity_baseline.toFixed(3)} for recommending the most popular products overall (metric used by Yang 2024; cite the method, not the paper's numbers).</p>
        </Card>
      </div>

      <Card title="Persona naming" subtitle="Centroids compared with the five hypothesised personas by RMS distance in band units (tolerance 0.9). Names are not forced.">
        <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-ink-faint border-b border-line"><th className="py-2 font-medium">Cluster</th><th className="py-2 font-medium">Name</th><th className="py-2 pr-6 font-medium text-right">Size</th><th className="py-2 font-medium">Centroid (Act / Auto / Risk / Cap)</th><th className="py-2 font-medium text-right">Distance</th></tr></thead>
          <tbody>{e.clusters.map((c: any) => (
            <tr key={c.cluster} className="border-b border-line last:border-0">
              <td className="py-2">{c.cluster}</td><td className="py-2">{c.name} {!c.matched && <Badge tone="warn">unnamed</Badge>}</td>
              <td className="py-2 pr-6 text-right tabular-nums">{e.business_view.find((b: any) => b.cluster === c.cluster)?.size}</td>
              <td className="py-2 tabular-nums">{e.centroids_band[c.cluster].map((v: number) => v.toFixed(1)).join(" / ")}</td>
              <td className="py-2 text-right tabular-nums">{c.distance.toFixed(2)}</td></tr>))}</tbody>
        </table></div>
        <p className="text-xs text-ink-faint mt-2">Hypothesised personas not matched to any cluster: {Object.keys(e.persona_vectors).filter((p) => !e.clusters.some((c: any) => c.name === p)).join(", ") || "none"}.</p>
      </Card>

      <Card title="Clusters on Grid 1 (activity × automation)" subtitle="A sample of the synthetic population, in band units">
        <div className="h-72"><ResponsiveContainer>
          <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
            <CartesianGrid stroke="#eee" /><XAxis type="number" dataKey="activity" name="Activity" domain={[0.5, 4.5]} /><YAxis type="number" dataKey="automation" name="Automation" domain={[0.5, 4.5]} /><ZAxis range={[12, 12]} />
            <Tooltip cursor={{ strokeDasharray: "3 3" }} /><Legend />
            {e.clusters.map((c: any, i: number) => <Scatter key={c.cluster} name={c.name} data={e.scatter_sample.filter((p: any) => p.cluster === c.cluster)} fill={PALETTE[i]} shape={["circle", "square", "triangle", "diamond", "cross", "star"][i % 6] as any} isAnimationActive={false} />)}
          </ScatterChart></ResponsiveContainer></div>
      </Card>

      <Card title="4 · Business view" subtitle="Cluster sizes next to the size of each gap (synthetic population)">
        <div className="grid md:grid-cols-2 gap-3">
          {e.business_view.map((b: any) => (
            <div key={b.cluster} className="border border-line rounded-lg p-3 text-sm">
              <div className="flex justify-between"><b>{b.name}</b><span className="text-ink-faint">{b.size.toLocaleString("en-IN")} people</span></div>
              <ul className="mt-2 space-y-1 text-xs">{b.top_categories.map((t: any) => (
                <li key={t.category} className="flex justify-between"><span>{t.label}: {pct(t.adoption * 100, 0)} hold</span><span className="text-ink-soft">{t.members_without.toLocaleString("en-IN")} do not</span></li>))}</ul>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Test users: expected vs computed profile" subtitle="Differences of more than 1 band are flagged findings. The model was not tuned to match.">
        <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-ink-faint border-b border-line"><th className="py-2 font-medium">User</th><th className="py-2 font-medium">Basis</th><th className="py-2 font-medium">Expected</th><th className="py-2 font-medium">Computed</th><th className="py-2 font-medium">Cluster</th><th className="py-2 font-medium">Flag</th></tr></thead>
          <tbody>{e.test_users.map((t: any) => {
            const f = (o: any) => ["activity", "automation", "risk", "capacity"].map((d) => o[d]).join(" / ");
            return <tr key={t.id} className="border-b border-line last:border-0">
              <td className="py-2">{t.id} {t.name}</td><td className="py-2 text-xs text-ink-soft">{t.basis}</td><td className="py-2 tabular-nums">{f(t.expected)}</td><td className="py-2 tabular-nums">{f(t.computed)}</td><td className="py-2">{t.cluster_name}</td>
              <td className="py-2">{t.flagged.length ? <Badge tone="warn">{t.flagged.join(", ")} differs by &gt;1</Badge> : <span className="text-xs text-ink-faint">within 1</span>}</td></tr>;
          })}</tbody>
        </table></div>
        <p className="text-xs text-ink-faint mt-2">Why Farah's capacity differs: capacity rank-averages AUM with monthly inflow, and her inflow is zero (dormant), which pulls the composite to the bottom quartile. The expected value reflects her ₹6.8 lakh AUM alone.</p>
      </Card>

      <Card title="Future work"><ul className="text-sm list-disc pl-5">{e.future_work.map((f: string) => <li key={f}>{f}</li>)}</ul></Card>
    </div>
  );
}
