import Assessment from "@/components/Assessment";

export const metadata = { title: "AI SME Digital Growth Advisor" };

export default function Page() {
  return (
    <Assessment
      config={{
        track: "exa",
        variant: "a",
        sponsor: "Exabytes Malaysia",
        title: "AI SME Digital Growth Advisor",
        tagline: "Helping SMEs discover their next digital step",
        engineName: "LLM reasoner",
        engineNote: "The model runs the discovery interview and writes the transformation blueprint. Fluent and broad, but its maturity scores are judgements rather than measurements.",
        
      }}
    />
  );
}
