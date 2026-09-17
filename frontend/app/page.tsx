import Link from "next/link";
import { FilePlus2, ListTree } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";

export default function HomePage() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 px-6 py-24 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">NSW Automation Case Desk</h1>
      <p className="max-w-md text-muted-foreground">
        Open a new dispense-defect investigation, or review what has already been diagnosed.
      </p>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Link href="/cases/new" className={buttonVariants({ size: "lg", className: "gap-2" })}>
          <FilePlus2 />
          Troubleshoot a case
        </Link>
        <Link
          href="/cases"
          className={buttonVariants({ size: "lg", variant: "outline", className: "gap-2" })}
        >
          <ListTree />
          View past cases
        </Link>
      </div>
    </div>
  );
}
