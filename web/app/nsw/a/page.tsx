import Assessment from "@/components/Assessment";

export const metadata = { title: "AI Dispensing Defect Detective" };

export default function Page() {
  return (
    <Assessment
      config={{
        track: "nsw",
        variant: "a",
        sponsor: "NSW Automation",
        title: "AI Dispensing Defect Detective",
        tagline: "Helping manufacturers identify dispensing problems faster with AI",
        engineName: "LLM reasoner",
        engineNote: "The model conducts the interview and produces the ranked diagnosis in one pass. It handles any symptom an operator can describe, but its confidence figures are asserted rather than computed.",
        
      }}
    />
  );
}
