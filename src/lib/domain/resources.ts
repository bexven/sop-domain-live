import { can, type Subject } from "./permissions";

/** Creative lanes that keep their own extra resource links. */
export type ResourceLane = "images" | "videos";

type Person = Subject & { jobRole?: string | null };

/**
 * Who adds products: "Add products" (research) or "Add running products" (straight to Live). Admins have both.
 */
export function canAddProduct(user: Person): boolean {
  return can(user, "product.create") || canAddRunningProduct(user);
}

export function canAddRunningProduct(user: Person): boolean {
  return can(user, "product.addRunning");
}

/** Extra links on a creative tab: that tab's makers, Seniors, Media Buyers and Admins. */
export function canEditResources(user: Person, lane: ResourceLane): boolean {
  if (can(user, "task.review") || can(user, "campaign.manage")) return true;
  const job = user.jobRole ?? user.role;
  return lane === "images" ? job === "IMAGE_DESIGNER" : job === "VIDEO_EDITOR";
}
