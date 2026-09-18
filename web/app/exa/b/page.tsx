import Assessment from "@/components/Assessment";

export const metadata = { title: "AI SME Digital Growth Advisor" };

export default function Page() {
  return (
    <Assessment
      config={{
        track: "exa",
        variant: "b",
        sponsor: "Exabytes Malaysia",
        title: "AI SME Digital Growth Advisor",
        tagline: "Inspect the business first, then advise",
        engineName: "Deterministic engine",
        engineNote: "The live website is inspected before any question is asked, so digital maturity is scored from observed evidence and the interview only fills the gaps.",
        signalStep: "url",
      }}
    />
  );
}
