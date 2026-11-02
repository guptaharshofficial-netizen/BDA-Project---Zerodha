import { useEffect, useRef, useState } from "react";
import { useApp } from "../App";
import { api } from "../api";
import { Card, Loading } from "../ui";

export default function Learn() {
  const { lesson } = useApp();
  const [ls, setLs] = useState<any[] | null>(null);
  const [active, setActive] = useState<string | null>(lesson);
  useEffect(() => { api.learn().then(setLs); }, []);
  useEffect(() => { if (lesson) setActive(lesson); }, [lesson]);
  if (!ls) return <Loading />;
  const cur = ls.find((l) => l.id === active) ?? ls[0];
  return (
    <div className="grid md:grid-cols-[240px_1fr] gap-5">
      <nav aria-label="Lessons" className="bg-white border border-line rounded-md p-2 h-fit">
        {ls.map((l) => (
          <button key={l.id} onClick={() => setActive(l.id)} aria-current={cur.id === l.id ? "true" : undefined}
            className={`w-full text-left text-sm px-3 py-2 rounded-lg ${cur.id === l.id ? "bg-accent-soft text-accent-dark font-medium" : "hover:bg-gray-50"}`}>{l.title}</button>
        ))}
      </nav>
      <div className="space-y-4">
        <Card title={cur.title}>
          <p className="text-[15px] leading-relaxed">{cur.body}</p>
          <div className="mt-4 bg-gray-50 border border-line rounded-lg p-3 text-sm"><b>Worked example.</b> {cur.example}</div>
        </Card>
        <Check key={cur.id} quiz={cur.quiz} />
        <p className="text-xs text-ink-faint">Free and open to everyone; no sign-up needed. Comprehension checks stay on this device and never change your profile or suitability.</p>
      </div>
    </div>
  );
}

function Check({ quiz }: { quiz: any[] }) {
  const [ans, setAns] = useState<Record<number, number>>({});
  const ref = useRef<HTMLDivElement>(null);
  return (
    <Card title="Optional check (2 questions)">
      <div ref={ref} className="space-y-4">
        {quiz.map((q, i) => (
          <fieldset key={i}>
            <legend className="text-sm font-medium">{q.q}</legend>
            <div className="flex flex-wrap gap-2 mt-1.5">
              {q.options.map((o: string, j: number) => {
                const chosen = ans[i] === j, right = j === q.answer;
                return (
                  <button key={j} aria-pressed={chosen} onClick={() => setAns({ ...ans, [i]: j })}
                    className={`text-sm px-3 py-1.5 rounded-full border ${chosen ? (right ? "bg-emerald-50 border-emerald-300" : "bg-amber-50 border-amber-300") : "border-line bg-white"}`}>
                    {o}{chosen ? (right ? " · correct" : " · not quite") : ""}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>
    </Card>
  );
}
