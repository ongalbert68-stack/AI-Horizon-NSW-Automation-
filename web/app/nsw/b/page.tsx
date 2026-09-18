import Assessment from "@/components/Assessment";

export const metadata = { title: "AI Dispensing Defect Detective" };

export default function Page() {
  return (
    <Assessment
      config={{
        track: "nsw",
        variant: "b",
        sponsor: "NSW Automation",
        title: "AI Dispensing Defect Detective",
        tagline: "Measure the deposit, then diagnose the cause",
        engineName: "Deterministic engine",
        engineNote: "Deposits are measured by computer vision, then a weighted fault tree ranks causes from those measurements. Every percentage can be traced to the evidence that produced it.",
        signalStep: "image",
      }}
    />
  );
}
