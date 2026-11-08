import "server-only";
import type { Priority } from "@/generated/prisma/enums";
import type { Tx } from "../db";
import { ActionError } from "../action";
import { autoAssign } from "./assign";
import { logEvents } from "./events";
import { currentRates } from "./product-helpers";

/**
 * Lists an old product that is already selling (owner's rule): no research or review, it starts Live with its
 * existing campaign as #1. Used by Add Product → Already running and by Shipments → "Add a product".
 */
export async function createRunningProduct(
  tx: Tx,
  user: { id: string; jobRole: string },
  p: {
    brandId: string;
    name: string;
    websiteUrl?: string | null;
    imageUrl?: string | null;
    oldImageAssets?: string[];
    oldVideoAssets?: string[];
    referenceLinks?: string[];
    priority?: Priority;
  },
  now: Date,
): Promise<string> {
  const brand = await tx.brand.findUnique({ where: { id: p.brandId } });
  if (!brand?.active) throw new ActionError("Choose one of the brands.");
  const { rates } = await currentRates(tx);
  const mediaBuyerId = user.jobRole === "MEDIA_BUYER" ? user.id : ((await autoAssign(tx, ["MEDIA_BUYER"], now, { brandId: p.brandId }))[0] ?? null);
  const product = await tx.product.create({
    data: {
      brandId: p.brandId,
      name: p.name,
      websiteUrl: p.websiteUrl ?? null,
      imageUrl: p.imageUrl ?? null,
      oldImageAssets: p.oldImageAssets ?? [],
      oldVideoAssets: p.oldVideoAssets ?? [],
      referenceLinks: p.referenceLinks ?? [],
      priority: p.priority ?? "MEDIUM",
      ...rates,
      stage: "LIVE",
      stageEnteredAt: now,
      addedRunning: true,
      mediaBuyerId,
      createdById: user.id,
    },
  });
  await tx.stageTransition.create({ data: { productId: product.id, fromStage: null, toStage: "LIVE", actorId: user.id, at: now } });
  // Its ads are already running: record that as campaign #1 (name and details can be filled in later).
  await tx.adCampaign.create({
    data: { productId: product.id, number: 1, name: "Running campaign", status: "RUNNING", launchedAt: now, launchedById: user.id, createdById: user.id },
  });
  await logEvents(tx, [{ type: "PRODUCT_CREATED", actorId: user.id, productId: product.id, data: { running: true } }]);
  return product.id;
}
