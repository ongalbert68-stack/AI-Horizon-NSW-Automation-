// Exabytes domain pack: SME digital maturity, pain points and roadmap.
//
// Product names reflect Exabytes' public service lines. Indicative prices are
// placeholders in RM and are declared as such in the UI - verify against
// exabytes.my before submission rather than quoting these as real figures.

import type { CauseDef } from "@/core/infer";
import type { Question } from "@/core/types";

export const EXA_QUESTIONS: Question[] = [
  {
    id: "industry",
    prompt: "What industry is the business in?",
    kind: "choice",
    options: [
      "Retail or F&B",
      "Professional services",
      "Manufacturing",
      "Healthcare",
      "Education",
      "Logistics",
      "Other",
    ],
  },
  {
    id: "employees",
    prompt: "How many employees does the business have?",
    kind: "choice",
    options: ["1-5", "6-20", "21-50", "51-200"],
  },
  {
    id: "tools",
    prompt: "Which digital tools are already in place?",
    kind: "multi",
    options: [
      "Company website",
      "Business email on a custom domain",
      "Cloud file storage",
      "CRM system",
      "Accounting software",
      "E-commerce store",
      "Cloud backup",
      "None of these",
    ],
  },
  {
    id: "challenge",
    prompt: "What is the biggest business challenge right now?",
    kind: "choice",
    options: [
      "Too much manual admin work",
      "Losing track of customers and leads",
      "Customer enquiries take too long to answer",
      "Marketing spend with unclear return",
      "Staff cannot find internal information",
      "Growing sales beyond word of mouth",
    ],
  },
  {
    id: "goal",
    prompt: "What is the main growth objective for the next 12 months?",
    kind: "choice",
    options: [
      "Increase sales revenue",
      "Reduce operating cost",
      "Expand to new markets",
      "Improve customer service",
      "Scale without adding headcount",
    ],
  },
];

/** Dynamic follow-ups. The enquiry-hours branch is what makes the ROI bonus real. */
export const EXA_FOLLOWUPS: Record<string, Question> = {
  enquiries: {
    id: "enquiry_hours",
    prompt: "Roughly how many hours per week does your team spend answering repeat customer enquiries?",
    kind: "number",
    help: "Used to compute the automation saving, not stored.",
    dynamic: true,
  },
  admin: {
    id: "admin_hours",
    prompt: "Roughly how many hours per week go into manual admin and data re-entry?",
    kind: "number",
    help: "Used to compute the automation saving, not stored.",
    dynamic: true,
  },
};

export const EXA_DIMENSIONS = [
  { id: "website", label: "Website" },
  { id: "cloud", label: "Cloud" },
  { id: "crm", label: "CRM" },
  { id: "marketing", label: "Marketing" },
  { id: "cybersecurity", label: "Cybersecurity" },
  { id: "ai_adoption", label: "AI Adoption" },
] as const;

export const EXA_READINESS = [
  { id: "leadership", label: "Leadership commitment" },
  { id: "data", label: "Data availability" },
  { id: "skills", label: "Employee skills" },
  { id: "workflow", label: "Digital workflow" },
  { id: "process", label: "Process maturity" },
] as const;

export interface Product {
  id: string;
  name: string;
  vendor: "Exabytes" | "Partner";
  dimension: string;
  phase: 1 | 2 | 3;
  blurb: string;
  /** Indicative only - placeholder pending verification against exabytes.my. */
  indicativeMonthlyRM: number;
}

export const EXA_CATALOG: Product[] = [
  { id: "domain", name: "Domain Registration", vendor: "Exabytes", dimension: "website", phase: 1, blurb: "Owns the business identity rather than renting it from a social platform.", indicativeMonthlyRM: 8 },
  { id: "email", name: "Exabytes Business Email Hosting", vendor: "Exabytes", dimension: "website", phase: 1, blurb: "Moves the business off free consumer mailboxes onto its own domain.", indicativeMonthlyRM: 12 },
  { id: "gworkspace", name: "Google Workspace", vendor: "Partner", dimension: "cloud", phase: 1, blurb: "Email plus collaborative documents where the team already lives in Google tools.", indicativeMonthlyRM: 30 },
  { id: "m365", name: "Microsoft 365", vendor: "Partner", dimension: "cloud", phase: 1, blurb: "Preferred where the team is already standardised on Office desktop files.", indicativeMonthlyRM: 32 },
  { id: "webhosting", name: "Managed WordPress Hosting", vendor: "Exabytes", dimension: "website", phase: 1, blurb: "A managed site the business controls, with updates and backups handled.", indicativeMonthlyRM: 35 },
  { id: "aibuilder", name: "AI Website Builder", vendor: "Exabytes", dimension: "website", phase: 1, blurb: "Fastest route to a credible first site when there is no in-house web skill.", indicativeMonthlyRM: 25 },
  { id: "ssl", name: "SSL Certificate", vendor: "Exabytes", dimension: "cybersecurity", phase: 1, blurb: "Removes the browser warning that silently costs enquiries.", indicativeMonthlyRM: 10 },
  { id: "backup", name: "Acronis Cloud Backup", vendor: "Exabytes", dimension: "cybersecurity", phase: 1, blurb: "Off-site copy so a ransomware event or dead laptop is not an extinction event.", indicativeMonthlyRM: 28 },
  { id: "vps", name: "Cloud VPS", vendor: "Exabytes", dimension: "cloud", phase: 2, blurb: "Dedicated resources once shared hosting limits growth.", indicativeMonthlyRM: 90 },
  { id: "crm", name: "CRM Implementation", vendor: "Exabytes", dimension: "crm", phase: 2, blurb: "One place where every lead and customer conversation is recorded.", indicativeMonthlyRM: 120 },
  { id: "collab", name: "Team Collaboration Suite", vendor: "Partner", dimension: "cloud", phase: 2, blurb: "Shared channels and files replace scattered WhatsApp threads.", indicativeMonthlyRM: 45 },
  { id: "meeting", name: "AI Meeting Assistant", vendor: "Partner", dimension: "ai_adoption", phase: 2, blurb: "Turns meetings into searchable notes and action items automatically.", indicativeMonthlyRM: 40 },
  { id: "ecommerce", name: "E-commerce Store", vendor: "Exabytes", dimension: "website", phase: 2, blurb: "Opens a direct sales channel independent of marketplace fees.", indicativeMonthlyRM: 110 },
  { id: "chatbot", name: "AI Customer Support Chatbot", vendor: "Exabytes", dimension: "ai_adoption", phase: 3, blurb: "Answers the repeat questions that currently consume staff hours.", indicativeMonthlyRM: 150 },
  { id: "salesai", name: "AI Sales Assistant", vendor: "Exabytes", dimension: "ai_adoption", phase: 3, blurb: "Qualifies and follows up leads that would otherwise go cold.", indicativeMonthlyRM: 180 },
  { id: "martech", name: "Marketing Automation", vendor: "Exabytes", dimension: "marketing", phase: 3, blurb: "Campaigns become measurable and repeatable rather than ad hoc.", indicativeMonthlyRM: 160 },
  { id: "seo", name: "SEO and Digital Marketing Services", vendor: "Exabytes", dimension: "marketing", phase: 3, blurb: "Builds inbound demand beyond referral and word of mouth.", indicativeMonthlyRM: 200 },
];

export const EXA_PAINPOINTS: CauseDef[] = [
  {
    id: "manual_admin",
    label: "Too much manual work",
    prior: 0.35,
    rules: [
      { weight: 1.6, label: "Named as the primary challenge", detail: "the business itself identified manual admin as its biggest constraint.", answer: { id: "challenge", match: ["manual admin"] } },
      { weight: 0.7, label: "Scaling without headcount", detail: "the stated goal is to grow without hiring, which manual process directly blocks.", answer: { id: "goal", match: ["without adding headcount"] } },
      { weight: 0.6, label: "No accounting software", detail: "finance records are still being maintained by hand.", answer: { id: "tools", match: ["None of these"] } },
      { weight: 0.8, label: "Significant hours reported", detail: "the team reported a material weekly hour count lost to re-entry.", answer: { id: "admin_hours", match: ["1", "2", "3", "4", "5", "6", "7", "8", "9"] } },
    ],
    checks: ["Map the three most repeated weekly tasks and their true hour cost.", "Identify which of them are copy-between-systems rather than judgement work."],
  },
  {
    id: "no_crm",
    label: "No CRM - customer data is fragmented",
    prior: 0.4,
    rules: [
      { weight: 1.5, label: "Losing track of leads", detail: "the business reports losing visibility of customers and leads, which is the defining symptom of absent CRM.", answer: { id: "challenge", match: ["Losing track"] } },
      { weight: 1.2, label: "No CRM in the tool stack", detail: "no CRM was listed among current tools, so customer history lives in individual inboxes and spreadsheets.", answer: { id: "tools", match: ["None of these"] } },
      { weight: 0.6, label: "Revenue growth objective", detail: "a revenue target is difficult to manage without a pipeline that can be inspected.", answer: { id: "goal", match: ["Increase sales revenue"] } },
      { weight: 0.5, label: "Team large enough to need shared records", detail: "at this headcount customer knowledge no longer fits in one person's memory.", answer: { id: "employees", match: ["21-50", "51-200"] } },
    ],
    checks: ["Ask where a salesperson looks today to see a customer's last three interactions.", "Count how many leads from last month can still be accounted for."],
  },
  {
    id: "manual_enquiries",
    label: "Customer enquiries handled manually",
    prior: 0.35,
    rules: [
      { weight: 1.6, label: "Named as the primary challenge", detail: "response time on enquiries was identified as the main pain point.", answer: { id: "challenge", match: ["enquiries take too long"] } },
      { weight: 0.9, label: "Customer service objective", detail: "the stated goal is improving service, which response latency directly determines.", answer: { id: "goal", match: ["Improve customer service"] } },
      { weight: 1.0, label: "Substantial enquiry hours reported", detail: "the team quantified the weekly hours currently spent answering repeat questions.", answer: { id: "enquiry_hours", match: ["1", "2", "3", "4", "5", "6", "7", "8", "9"] } },
      { weight: 0.5, label: "Consumer-facing industry", detail: "retail and F&B carry high repeat-enquiry volume on price, stock and hours.", answer: { id: "industry", match: ["Retail or F&B"] } },
    ],
    checks: ["Sample one week of enquiries and count how many are the same five questions.", "Measure median first-response time during and outside business hours."],
  },
  {
    id: "marketing_unmeasured",
    label: "Marketing is not measurable",
    prior: 0.3,
    rules: [
      { weight: 1.6, label: "Named as the primary challenge", detail: "the business cannot currently attribute return to its marketing spend.", answer: { id: "challenge", match: ["Marketing spend"] } },
      { weight: 0.9, label: "Growth beyond word of mouth", detail: "referral-led growth has plateaued and no measurable channel has replaced it.", answer: { id: "challenge", match: ["word of mouth"] } },
      { weight: 0.8, label: "No website to measure", detail: "with no owned web property there is no analytics surface on which return could be observed.", answer: { id: "tools", match: ["None of these"] } },
      { weight: 0.6, label: "Market expansion objective", detail: "entering new markets without measurement makes spend impossible to steer.", answer: { id: "goal", match: ["Expand to new markets"] } },
    ],
    checks: ["Ask which channel produced last month's largest customer.", "Check whether analytics and conversion tracking are installed at all."],
  },
  {
    id: "no_knowledge_mgmt",
    label: "No internal knowledge management",
    prior: 0.25,
    rules: [
      { weight: 1.6, label: "Named as the primary challenge", detail: "staff report being unable to locate internal information when they need it.", answer: { id: "challenge", match: ["cannot find internal"] } },
      { weight: 0.7, label: "No cloud file storage", detail: "documents are held on individual machines rather than a shared searchable store.", answer: { id: "tools", match: ["None of these"] } },
      { weight: 0.6, label: "Headcount past the informal threshold", detail: "beyond roughly twenty staff, undocumented knowledge stops propagating by conversation.", answer: { id: "employees", match: ["21-50", "51-200"] } },
    ],
    checks: ["Time how long it takes a new hire to find the current price list.", "Identify which single person is the only source for any critical process."],
  },
  {
    id: "security_exposure",
    label: "Security and backup exposure",
    prior: 0.22,
    rules: [
      { weight: 1.1, label: "No cloud backup in place", detail: "there is no off-site copy, so a single device failure or ransomware event is unrecoverable.", answer: { id: "tools", match: ["None of these"] } },
      { weight: 0.9, label: "Site served without TLS", detail: "the live site was observed serving over plain HTTP, which browsers now flag to every visitor.", signal: { key: "https", lt: 1 } },
      { weight: 0.7, label: "Regulated data handling", detail: "healthcare operations carry patient data obligations beyond ordinary commercial risk.", answer: { id: "industry", match: ["Healthcare"] } },
    ],
    checks: ["Confirm whether any backup has been restored and tested in the last year.", "Check TLS and certificate expiry on every public domain."],
  },
  {
    id: "weak_web_presence",
    label: "Weak or absent web presence",
    prior: 0.28,
    rules: [
      { weight: 1.3, label: "No website observed", detail: "no reachable website was found for the business, so every enquiry depends on a platform the business does not own.", signal: { key: "site_reachable", lt: 1 } },
      { weight: 0.9, label: "Not mobile-ready", detail: "the live site declares no mobile viewport, so it renders poorly for the majority of Malaysian traffic.", signal: { key: "mobile_ready", lt: 1 } },
      { weight: 0.8, label: "No website in the tool stack", detail: "the business confirmed it has no website among its current tools.", answer: { id: "tools", match: ["None of these"] } },
      { weight: 0.7, label: "No contact path on site", detail: "the site exposes no contact form or visible enquiry route, so interested visitors leave without converting.", signal: { key: "has_contact", lt: 1 } },
    ],
    checks: ["Search the business name as a customer would and note what ranks.", "Load the site on a phone and attempt to make an enquiry."],
  },
];

/** Hours saved per week, by pain point, once the matching automation is in place. */
export const EXA_AUTOMATION_YIELD: Record<string, { share: number; lever: string }> = {
  manual_enquiries: { share: 0.66, lever: "AI Customer Support Chatbot" },
  manual_admin: { share: 0.5, lever: "Workflow automation and CRM" },
};

export const DEFAULT_HOURLY_RM = 45;
