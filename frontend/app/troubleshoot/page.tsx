"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

/**
 * `/troubleshoot` (no id) is the "open a new case" entry point. NSW-Automation
 * already has an identical open-case form at `/cases/new` (station/profile
 * pickers, material lot, complaint) — rather than keep two divergent copies
 * of the same form, this route redirects there. The actual wizard this
 * feature adds lives at `/troubleshoot/[id]`, reached from `/cases/new`'s
 * redirect after a case is opened, or from the "Continue troubleshooting"
 * link on an existing case's detail page.
 */
export default function TroubleshootIndexRedirect() {
  const router = useRouter();

  React.useEffect(() => {
    router.replace("/cases/new");
  }, [router]);

  return null;
}
