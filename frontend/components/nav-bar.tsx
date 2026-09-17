"use client";

import * as React from "react";
import Link from "next/link";
import { Search } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";

export function NavBar() {
  function openPalette() {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
  }

  return (
    <header className="border-b">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link href="/" className="font-semibold tracking-tight">
          AI Horizon &middot; NSW Automation
        </Link>
        <nav className="flex items-center gap-2">
          <Link href="/cases" className={buttonVariants({ variant: "ghost", size: "sm" })}>
            Cases
          </Link>
          <Link href="/cases/new" className={buttonVariants({ variant: "ghost", size: "sm" })}>
            New case
          </Link>
          <Button variant="outline" size="sm" onClick={openPalette} className="gap-2">
            <Search className="size-4" />
            <span className="hidden sm:inline">Search</span>
            <kbd className="hidden rounded border bg-muted px-1.5 py-0.5 text-xs sm:inline">⌘K</kbd>
          </Button>
        </nav>
      </div>
    </header>
  );
}
