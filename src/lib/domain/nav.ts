import { can, canSeeEarlyStages, type Subject } from "./permissions";

export type NavKey = "dashboard" | "tasks" | "research" | "creative" | "pipeline" | "products" | "orders" | "shipments" | "overview" | "team" | "roles";

export type NavItem = {
  key: NavKey;
  label: string;
  href: string;
  /** Short help shown under the label in the menu. */
  hint: string;
  /** "products" items sit under the Products ▾ menu, "admin" under Admin ▾. */
  section: "main" | "products" | "admin";
};


type Ctx = { isMaster: boolean };

const ALL: (NavItem & { visible: (s: Subject, ctx: Ctx) => boolean })[] = [
  { key: "dashboard", label: "Dashboard", href: "/dashboard", hint: "What's waiting on you", section: "main", visible: () => true },
  {
    key: "research",
    label: "Research",
    href: "/research",
    hint: "Products being researched and reviewed",
    section: "main",
    // Image and video makers only see products once they pass Product review.
    visible: (r) => canSeeEarlyStages(r),
  },
  {
    key: "creative",
    label: "Creative",
    href: "/creative",
    hint: "Images and videos in progress",
    section: "main",
    visible: () => true,
  },
  { key: "tasks", label: "Tasks", href: "/tasks", hint: "Team to-dos on a board", section: "main", visible: () => true },
  { key: "products", label: "Products", href: "/products", hint: "Search all products", section: "products", visible: () => true },
  { key: "pipeline", label: "Pipeline", href: "/pipeline", hint: "Every product by stage", section: "products", visible: () => true },
  { key: "orders", label: "Orders", href: "/orders", hint: "Stock orders and scaling", section: "products", visible: () => true },
  { key: "shipments", label: "Shipments", href: "/shipments", hint: "Purchases on the way, costs and arrivals", section: "products", visible: (r) => can(r, "shipments.view") },
  { key: "overview", label: "Overview", href: "/overview", hint: "Workload and bottlenecks", section: "admin", visible: (r) => can(r, "overview.view") },
  // Only the Master Admin manages people, names, roles and PINs.
  { key: "team", label: "Team", href: "/team", hint: "People, names and PINs", section: "admin", visible: (_r, ctx) => ctx.isMaster },
  { key: "roles", label: "Roles & permissions", href: "/team/roles", hint: "Tick what each person can do", section: "admin", visible: (_r, ctx) => ctx.isMaster },
];

/** Menu items for a role. Cosmetic: every page re-checks on the server. */
export function navItemsFor(subject: Subject, ctx: Ctx = { isMaster: false }): NavItem[] {
  return ALL.filter((i) => i.visible(subject, ctx)).map(({ key, label, href, hint, section }) => ({ key, label, href, hint, section }));
}
