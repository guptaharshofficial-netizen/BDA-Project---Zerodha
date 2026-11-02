import { useState } from "react";
import { Pills } from "../ui";
import Evaluation from "./Evaluation";
import TestCases from "./TestCases";

export default function Reviewer() {
  const [t, setT] = useState("model");
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">For reviewers</h1>
        <p className="text-sm text-ink-faint mt-1">The technical detail behind "investors like you": clustering quality, stability, accuracy, and the acceptance tests for the five demo personas.</p>
      </div>
      <Pills label="Section" value={t} onChange={setT} options={[{ v: "model", l: "Model evaluation" }, { v: "tests", l: "Persona tests" }]} />
      {t === "model" ? <Evaluation /> : <TestCases />}
    </div>
  );
}
