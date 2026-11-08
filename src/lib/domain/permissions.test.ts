import { describe, expect, it } from "vitest";
import type { Role } from "@/generated/prisma/enums";
import { ROLES } from "./labels";
import { navItemsFor } from "./nav";
import { CAPABILITY_KEYS, can, canSeeProduct, defaultPermissions, normalizePermissions } from "./permissions";

const as = (role: Role, permissions: string[] = defaultPermissions(role)) => ({ role, permissions });

describe("permissions", () => {
  it("gives Admin every capability whatever is ticked", () => {
    for (const cap of CAPABILITY_KEYS) expect(can({ role: "ADMIN", permissions: [] }, cap)).toBe(true);
  });

  it("follows the ticked permissions, not the job role", () => {
    expect(can(as("IMAGE_DESIGNER"), "task.review")).toBe(false);
    expect(can(as("IMAGE_DESIGNER", ["task.review"]), "task.review")).toBe(true);
    expect(can(as("MEDIA_BUYER", []), "campaign.manage")).toBe(false);
  });

  it("role defaults: admin-only areas stay off for everyone else", () => {
    for (const role of ROLES.filter((r) => r !== "ADMIN")) {
      for (const cap of ["settings.manage", "overview.view", "product.override", "task.reassignAny"] as const) {
        expect(can(as(role), cap)).toBe(false);
      }
    }
  });

  it("role defaults match the agreed matrix", () => {
    expect(can(as("RESEARCHER"), "product.create")).toBe(true);
    expect(can(as("MEDIA_BUYER"), "product.create")).toBe(false);
    for (const cap of ["task.review", "brief.edit", "campaign.manage", "orders.manage", "product.kill"] as const) {
      expect(can(as("MEDIA_BUYER"), cap)).toBe(true);
      expect(can(as("IMAGE_DESIGNER"), cap)).toBe(false);
    }
    expect(can(as("REVIEWER"), "product.approve")).toBe(true);
    expect(can(as("REVIEWER"), "task.review")).toBe(true);
    expect(can(as("MEDIA_BUYER"), "product.approve")).toBe(false);
  });

  it("normalises unknown keys away and keeps a stable order", () => {
    expect(normalizePermissions(["orders.manage", "nope", "research.view"])).toEqual(["research.view", "orders.manage"]);
  });
});

describe("navigation", () => {
  const keys = (s: ReturnType<typeof as>, isMaster = false) => navItemsFor(s, { isMaster }).map((i) => i.key);
  it("gives the Master Admin every menu", () => {
    expect(keys(as("ADMIN"), true)).toEqual(["dashboard", "research", "creative", "tasks", "products", "pipeline", "orders", "shipments", "overview", "team", "roles"]);
  });
  it("hides Team and Roles from admins who aren't the master", () => {
    expect(keys(as("ADMIN"))).toEqual(["dashboard", "research", "creative", "tasks", "products", "pipeline", "orders", "shipments", "overview"]);
  });
  it("shows Research only to people allowed to see it", () => {
    for (const r of ["RESEARCHER", "REVIEWER"] as const) {
      expect(keys(as(r))).toEqual(["dashboard", "research", "creative", "tasks", "products", "pipeline", "orders"]);
    }
    expect(keys(as("MEDIA_BUYER"))).toEqual(["dashboard", "research", "creative", "tasks", "products", "pipeline", "orders", "shipments"]);
    for (const r of ["IMAGE_DESIGNER", "VIDEO_EDITOR"] as const) {
      expect(keys(as(r))).toEqual(["dashboard", "creative", "tasks", "products", "pipeline", "orders"]);
    }
    expect(keys(as("VIDEO_EDITOR", ["research.view"]))).toContain("research");
  });
});

describe("early-stage visibility", () => {
  it("hides research and review from people without Research access until approved", () => {
    expect(canSeeProduct(as("IMAGE_DESIGNER"), "RESEARCH", null)).toBe(false);
    expect(canSeeProduct(as("VIDEO_EDITOR"), "REVIEW", null)).toBe(false);
    expect(canSeeProduct(as("VIDEO_EDITOR"), "KILLED", "REVIEW")).toBe(false);
    expect(canSeeProduct(as("VIDEO_EDITOR"), "CREATIVE", null)).toBe(true);
    expect(canSeeProduct(as("MEDIA_BUYER"), "RESEARCH", null)).toBe(true);
  });
});

import { canSeeBrand } from "./permissions";
describe("restricted brands", () => {
  const bexven = { id: "bx", restricted: true };
  const timtom = { id: "tt", restricted: false };
  it("normal brands are visible to everyone", () => {
    expect(canSeeBrand({ isMaster: false, brandAccess: [] }, timtom)).toBe(true);
    expect(canSeeBrand({ isMaster: false, brandAccess: [] }, null)).toBe(true);
  });
  it("restricted brands only for the Master Admin and people given access — not for other admins", () => {
    expect(canSeeBrand({ isMaster: true, brandAccess: [] }, bexven)).toBe(true);
    expect(canSeeBrand({ isMaster: false, brandAccess: ["bx"] }, bexven)).toBe(true);
    expect(canSeeBrand({ isMaster: false, brandAccess: ["tt"] }, bexven)).toBe(false);
  });
});
