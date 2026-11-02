import { useEffect, useState } from "react";
import { api } from "../api";
import { Badge, Card, Loading } from "../ui";

export default function TestCases() {
  const [rows, setRows] = useState<any[] | null>(null);
  useEffect(() => { api.testcases().then(setRows); }, []);
  if (!rows) return <Loading what="Running persona checks" />;
  const passed = rows.filter((r) => r.passed).length;
  const groups = [...new Set(rows.map((r) => r.persona))];
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Test cases</h1>
        <p className="text-sm text-ink-soft mt-1">Live run of the acceptance checks for the five test personas (the same checks run in <code>make test</code>). {passed} of {rows.length} passed.</p>
      </div>
      {groups.map((g) => (
        <Card key={g} title={g}>
          <ul className="space-y-1.5 text-sm">
            {rows.filter((r) => r.persona === g).map((r, i) => (
              <li key={i} className="flex gap-3 items-start">
                <Badge tone={r.passed ? "ok" : "warn"}>{r.passed ? "Pass" : "Fail"}</Badge>
                <div><div>{r.check}</div>{r.detail && <div className="text-xs text-ink-faint break-all">{r.detail}</div>}</div>
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}
