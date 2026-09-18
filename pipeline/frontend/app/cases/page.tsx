"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, FilePlus2 } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { CasesTable } from "@/components/cases-table";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api/client";
import { listCases } from "@/lib/api/cases";
import type { Case } from "@/lib/api/types";

export default function CasesPage() {
  const [cases, setCases] = React.useState<Case[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const controller = new AbortController();
    listCases({ limit: 200, offset: 0 })
      .then((page) => setCases(page.items))
      .catch((err: unknown) => {
        if (err instanceof ApiError) setError(err.message);
        else if (!(err instanceof DOMException && err.name === "AbortError")) {
          setError("Could not reach the API.");
        }
      });
    return () => controller.abort();
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <Link
          href="/"
          className={buttonVariants({
            variant: "ghost",
            size: "sm",
            className: "gap-1.5 text-muted-foreground hover:text-foreground",
          })}
        >
          <ArrowLeft className="size-4" />
          Back to Home
        </Link>
        <Link
          href="/troubleshoot"
          className={buttonVariants({ size: "sm", className: "gap-1.5" })}
        >
          <FilePlus2 className="size-4" />
          Open New Case
        </Link>
      </div>

      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Past cases</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        {cases ? `${cases.length} case${cases.length === 1 ? "" : "s"} on file.` : "Loading..."}
      </p>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {!error && !cases && (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-11 w-full" />
          ))}
        </div>
      )}

      {!error && cases && cases.length === 0 && (
        <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          No cases yet. Open one from the home page to get started.
        </p>
      )}

      {!error && cases && cases.length > 0 && <CasesTable data={cases} />}
    </div>
  );
}
