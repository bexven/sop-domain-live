import type { Role } from "@/generated/prisma/enums";

/**
 * Permissions. Each person has their own list of capabilities, ticked by the
 * Master Admin on the Roles page. A new person starts with the defaults for
 * their job role (below). Anyone with Admin access (or the Master Admin) has
 * every capability. The server enforces these in every action and page
 * loader; the UI only hides controls (cosmetic).
 */
export const CAPABILITIES = {
  "research.view": {
    label: "See Research",
    hint: "Research page and products before they are approved",
    defaults: ["RESEARCHER", "MEDIA_BUYER", "REVIEWER"],
  },
  "product.create": { label: "Add products", hint: "Add and research new products", defaults: ["RESEARCHER"] },
  "product.addRunning": {
    label: "Add running products",
    hint: "Add an existing product that's already selling (skips research and review)",
    defaults: ["MEDIA_BUYER"],
  },
  "product.approve": { label: "Product review", hint: "Approve a product for testing or drop it", defaults: ["REVIEWER"] },
  "task.review": {
    label: "Senior: approve creative",
    hint: "Approve website images, Meta ad images and videos, or ask for changes",
    defaults: ["MEDIA_BUYER", "REVIEWER"],
  },
  "brief.edit": { label: "Write creative brief", hint: "Write and update the brief designers follow", defaults: ["MEDIA_BUYER"] },
  "campaign.manage": { label: "Meta ads", hint: "Launch campaigns and update their status", defaults: ["MEDIA_BUYER"] },
  "batch.request": { label: "Request new creatives", hint: "Ask for a new creative batch while live", defaults: ["MEDIA_BUYER"] },
  "orders.manage": { label: "Orders & scaling", hint: "Move products to ordering, add orders, set the scaling plan", defaults: ["MEDIA_BUYER", "SUPPLY_CHAIN"] },
  "product.sendBack": { label: "Send back", hint: "Send a product back to an earlier stage", defaults: ["MEDIA_BUYER", "REVIEWER"] },
  "product.kill": { label: "Drop products", hint: "Stop working on a product", defaults: ["MEDIA_BUYER"] },
  "product.override": { label: "Edit any product", hint: "Correct product details at any stage (logged)", defaults: [] },
  "task.reassignAny": { label: "Reassign tasks", hint: "Hand anyone's task to someone else", defaults: [] },
  "overview.view": { label: "Overview", hint: "Workload, bottlenecks and drop reasons", defaults: [] },
  "settings.manage": { label: "Settings", hint: "Rates, SLAs, checklists and brands", defaults: [] },
} as const satisfies Record<string, { label: string; hint: string; defaults: readonly Role[] }>;

export type Capability = keyof typeof CAPABILITIES;
export const CAPABILITY_KEYS = Object.keys(CAPABILITIES) as Capability[];

/** Who is asking: their access role (ADMIN = everything) and their own permission list. */
export type Subject = { role: Role; permissions: readonly string[] };

export function can(subject: Subject, capability: Capability): boolean {
  if (subject.role === "ADMIN") return true;
  return subject.permissions.includes(capability);
}

/** The permissions a job role starts with. */
export function defaultPermissions(role: Role): Capability[] {
  if (role === "ADMIN") return [...CAPABILITY_KEYS];
  return CAPABILITY_KEYS.filter((k) => (CAPABILITIES[k].defaults as readonly Role[]).includes(role));
}

/** Keeps only known capability keys, in a stable order. */
export function normalizePermissions(list: readonly string[]): Capability[] {
  const set = new Set(list);
  return CAPABILITY_KEYS.filter((k) => set.has(k));
}

/** Products before approval are only visible to people who can see Research. */
export function canSeeEarlyStages(subject: Subject): boolean {
  return can(subject, "research.view");
}

export const EARLY_STAGES = ["RESEARCH", "REVIEW"] as const;

export function isEarly(stage: string, stageBeforeKill: string | null): boolean {
  if ((EARLY_STAGES as readonly string[]).includes(stage)) return true;
  return stage === "KILLED" && !!stageBeforeKill && (EARLY_STAGES as readonly string[]).includes(stageBeforeKill);
}

/** Whether a product is visible to this person (killed-before-approval counts as early). */
export function canSeeProduct(subject: Subject, stage: string, stageBeforeKill: string | null): boolean {
  return canSeeEarlyStages(subject) || !isEarly(stage, stageBeforeKill);
}

// ── Restricted brands (e.g. Bexven) ─────────────────────────────────────────

/** Who can see a brand's products: everyone for normal brands; for restricted ones, the Master Admin and people given access. */
export type BrandViewer = { isMaster: boolean; brandAccess: readonly string[] };

export function canSeeBrand(viewer: BrandViewer, brand: { id: string; restricted: boolean } | null | undefined): boolean {
  if (!brand || !brand.restricted) return true;
  return viewer.isMaster || viewer.brandAccess.includes(brand.id);
}
