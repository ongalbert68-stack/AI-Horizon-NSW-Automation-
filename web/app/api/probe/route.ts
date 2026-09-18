// Exa-B's evidence source: observe a real business website and turn what is
// publicly visible into signals, so maturity is measured rather than self-reported.

import { NextResponse } from "next/server";
import { resolveMx } from "node:dns/promises";
import type { Signal } from "@/core/types";

export const runtime = "nodejs";

function normalise(raw: string): URL | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    return new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }
}

/** Keep the head and the tail of a large page.
 *
 * Contact links and social profiles almost always live in the footer, so
 * truncating to a leading slice discards precisely the region those signals
 * occupy and reports a confident false negative.
 */
function clip(html: string, head = 250_000, tail = 150_000): string {
  if (html.length <= head + tail) return html;
  return `${html.slice(0, head)}\n<!-- clipped -->\n${html.slice(-tail)}`;
}

async function mxProvider(hostname: string): Promise<string> {
  try {
    const records = await resolveMx(hostname.replace(/^www\./, ""));
    const joined = records.map((r) => r.exchange.toLowerCase()).join(" ");
    if (joined.includes("google")) return "Google Workspace";
    if (joined.includes("outlook") || joined.includes("microsoft")) return "Microsoft 365";
    if (!records.length) return "none configured";
    return "self-hosted or other provider";
  } catch {
    return "none configured";
  }
}

export async function POST(req: Request) {
  const { url } = (await req.json()) as { url?: string };
  const target = normalise(url ?? "");
  if (!target) return NextResponse.json({ error: "Enter a website address." }, { status: 400 });

  const signals: Signal[] = [];
  const started = Date.now();

  let html = "";
  let trueBytes = 0;
  let reachable = 0;
  let finalUrl = target.toString();

  try {
    const res = await fetch(target, {
      redirect: "follow",
      headers: { "User-Agent": "AIHorizon-SME-Advisor/1.0 (student prototype)" },
      signal: AbortSignal.timeout(12_000),
    });
    reachable = res.ok ? 1 : 0;
    finalUrl = res.url || finalUrl;
    if (res.ok) {
      const full = await res.text();
      trueBytes = full.length;
      html = clip(full);
    }
  } catch {
    reachable = 0;
  }

  const lower = html.toLowerCase();
  const elapsed = Date.now() - started;

  signals.push({ key: "site_reachable", label: "Website reachable", value: reachable, note: reachable ? `Loaded ${finalUrl}` : "No response from this address" });

  if (reachable) {
    const https = finalUrl.startsWith("https://") ? 1 : 0;
    const mobile = /<meta[^>]+name=["']viewport["']/i.test(html) ? 1 : 0;
    const contact = /(contact|enquiry|enquire|get in touch|<form)/i.test(lower) ? 1 : 0;
    const analytics = /(gtag\(|googletagmanager|google-analytics|fbq\(|clarity\.ms)/i.test(lower) ? 1 : 0;
    const cms = /(wp-content|wp-includes|shopify|wix\.com|squarespace|joomla|drupal)/i.test(lower) ? 1 : 0;
    const social = /(facebook\.com\/|instagram\.com\/|linkedin\.com\/company)/i.test(lower) ? 1 : 0;
    // Measured before clipping, so the figure reflects the real page.
    const weightKb = Math.round(trueBytes / 1024);

    // Heuristic: a small HTML body carrying many scripts is a client-rendered
    // shell, so content-presence checks below are unreliable for this site.
    const scriptCount = (lower.match(/<script/g) ?? []).length;
    const textLength = html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<[^>]+>/g, " ").trim().length;
    const jsRendered = textLength < 1500 && scriptCount >= 3 ? 1 : 0;
    const caveat = jsRendered ? " Site appears client-rendered, so this check may under-report." : "";

    const cmsName = /wp-content|wp-includes/i.test(lower) ? "WordPress"
      : /shopify/i.test(lower) ? "Shopify"
      : /wix\.com/i.test(lower) ? "Wix"
      : /squarespace/i.test(lower) ? "Squarespace"
      : cms ? "detected" : "none detected";

    signals.push(
      { key: "https", label: "Served over HTTPS", value: https, note: https ? "Valid TLS on the final URL" : "Served without TLS - browsers will warn visitors" },
      { key: "mobile_ready", label: "Mobile viewport declared", value: mobile, note: mobile ? "Responsive meta viewport present" : "No viewport tag - renders poorly on phones" },
      { key: "has_contact", label: "Contact path present", value: contact, note: (contact ? "Contact form or enquiry route found" : "No visible enquiry route in the served HTML") + caveat },
      { key: "has_analytics", label: "Analytics installed", value: analytics, note: (analytics ? "Tag manager or analytics detected" : "No analytics found - marketing return cannot be measured") + caveat },
      { key: "has_cms", label: "CMS", value: cms, note: `CMS: ${cmsName}` },
      { key: "has_social", label: "Social profiles linked", value: social, note: social ? "Social profiles linked from the site" : "No social profiles linked" },
      { key: "page_weight_kb", label: "Landing page HTML weight", value: weightKb, unit: " KB",
        note: weightKb > 500 ? "Heavy for a landing page; likely slow on mobile data." : "Within a reasonable range." },
      { key: "response_ms", label: "Response time", value: elapsed, unit: " ms" },
      { key: "js_rendered", label: "Client-side rendered", value: jsRendered,
        note: jsRendered
          ? "Content is assembled in the browser; content checks above are based on the served HTML only."
          : "Content is present in the served HTML, so the checks above are reliable." },
    );
  }

  const mx = await mxProvider(target.hostname);
  signals.push({ key: "email_provider", label: "Business email provider", value: mx, note: mx === "none configured" ? "No MX records - likely using free consumer email" : `MX indicates ${mx}` });

  return NextResponse.json({ signals, finalUrl });
}
