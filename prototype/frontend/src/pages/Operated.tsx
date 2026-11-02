import { Card } from "../ui";

export default function Operated() {
  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">How this would be operated</h1>
      <Card>
        <dl className="text-sm space-y-4">
          <div><dt className="font-medium">Entity</dt><dd className="text-ink-soft mt-0.5">A separate group entity would run the advisory service. The broking and product apps (Kite, Coin, smallcase) would act only as distribution and execution channels.</dd></div>
          <div><dt className="font-medium">Registration</dt><dd className="text-ink-soft mt-0.5">That entity would seek SEBI registration as a non-individual Investment Adviser (RIA). No personalised advice would be enabled before registration and operating controls are in place (BRD BR-12).</dd></div>
          <div><dt className="font-medium">Segregation</dt><dd className="text-ink-soft mt-0.5">Arm's-length relationship, client-level segregation between advisory and distribution at group level, separate data purposes, and no forced execution path.</dd></div>
          <div><dt className="font-medium">What the prototype does not claim</dt><dd className="text-ink-soft mt-0.5">It does not give investment advice, name specific schemes or stocks to buy, place orders, or represent any real company's product. Data is synthetic or illustrative unless labelled otherwise.</dd></div>
          <div><dt className="font-medium">Open questions for counsel</dt><dd className="text-ink-soft mt-0.5">Entity structure and RIA registration path; whether category-level options and "investors like you" cards count as advice; DPDP consent wording; conflicts where a group fund house offers products in a suggested category.</dd></div>
        </dl>
      </Card>
    </div>
  );
}
