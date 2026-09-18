import Link from "next/link";
import { FilePlus2, History } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";

export default function HomePage() {
  return (
    <div className="mx-auto flex max-w-5xl flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">NSW Automation</h1>
      <p className="max-w-md text-muted-foreground">
        Dispense-defect troubleshooting pipeline — intake, vision, ranking, the
        troubleshooting loop, and the report, end to end.
      </p>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
        <Link href="/troubleshoot" className={buttonVariants({ size: "lg", className: "gap-2" })}>
          <FilePlus2 />
          Troubleshoot a case
        </Link>
        <Link
          href="/cases"
          className={buttonVariants({ size: "lg", variant: "outline", className: "gap-2" })}
        >
          <History />
          View past cases
        </Link>
      </div>
    </div>
  );
}
