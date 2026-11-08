"use server";

import { revalidatePath } from "next/cache";
import { missingRequiredCount, snapshotChecklist } from "@/lib/domain/checklist";
import { dueAtFrom } from "@/lib/domain/due";
import { TASK_TYPE_LABELS } from "@/lib/domain/labels";
import { KILL_REASON_LABELS } from "@/lib/domain/labels";
import {
  canWorkOnTask,
  planApproveProduct,
  planRejectProduct,
  planResearchSubmit,
  researchBlockers,
  planNewBatch,
  researchTask,
} from "@/lib/domain/workflow";
import { canAddProduct, canAddRunningProduct, canEditResources } from "@/lib/domain/resources";
import {
  createProductSchema,
  createRunningProductSchema,
  productIdSchema,
  resourceLinkSchema,
  rejectSchema,
  reviewDecisionSchema,
  toggleChecklistSchema,
  updateResearchSchema,
} from "@/lib/validation/product";
import { ActionError, defineAction } from "../action";
import { db } from "../db";
import { applyPlan } from "../services/apply-plan";
import { autoAssign } from "../services/assign";
import { logEvents, notify } from "../services/events";
import { createRunningProduct } from "../services/running-product";
import { adminShippingData, currentRates, researchData, settingsRateFor, shippingData } from "../services/product-helpers";
import { loadSnapshot } from "../services/snapshot";

function revalidateProduct() {
  revalidatePath("/", "layout");
}

const FIELD_LABELS: Record<string, string> = {
  brandId: "brand",
  name: "name",
  supplierUrl: "supplier link",
  imageUrl: "image",
  chinaPriceBdt: "China price",
  weightKg: "weight",
  shippingMethod: "shipping method",
  shippingRatePerKgBdt: "shipping rate",
  shippingPerUnitBdt: "shipping",
  sellingPriceBdt: "selling price",
  targetCustomer: "target customer",
  problemSolved: "problem solved",
  sellingAngle: "selling angle",
  referenceLinks: "reference links",
  priority: "priority",
  targetLaunchDate: "target launch date",
};

export const createProductAction = defineAction({
  schema: createProductSchema,
  run: async (input, { user }) => {
    if (!canAddProduct(user)) throw new ActionError("You don't have permission to add products.");
    const now = new Date();
    const id = await db.$transaction(async (tx) => {
      const brand = await tx.brand.findUnique({ where: { id: input.brandId! } });
      if (!brand?.active) throw new ActionError("Choose one of the brands.");
      const { rates, settings } = await currentRates(tx);
      const product = await tx.product.create({
        data: { ...researchData(input), ...rates, ...shippingData(input.weightKg, settingsRateFor(input.shippingMethod, settings)), createdById: user.id, stageEnteredAt: now },
      });
      await tx.stageTransition.create({
        data: { productId: product.id, fromStage: null, toStage: "RESEARCH", actorId: user.id, at: now },
      });

      // The research task belongs to its creator when they are a researcher; otherwise
      // (e.g. an Admin) it goes to a researcher — or stays with the creator if there is none.
      const assigneeId =
        user.jobRole === "RESEARCHER" ? user.id : ((await autoAssign(tx, ["RESEARCHER"], now, { brandId: product.brandId }))[0] ?? user.id);
      if (assigneeId === user.id) await tx.user.update({ where: { id: user.id }, data: { lastAssignedAt: now } });
      const [templates, sla] = await Promise.all([
        tx.checklistTemplateItem.findMany({ where: { taskType: "RESEARCH", active: true } }),
        tx.taskTypeConfig.findUnique({ where: { taskType: "RESEARCH" } }),
      ]);
      const task = await tx.task.create({
        data: {
          productId: product.id,
          type: "RESEARCH",
          role: "RESEARCHER",
          phase: 1,
          status: "TODO",
          assigneeId,
          assignedAt: assigneeId ? now : null,
          unlockedAt: now,
          dueAt: dueAtFrom(now, sla?.slaHours),
          checklist: { create: snapshotChecklist(templates) },
        },
      });
      await logEvents(tx, [
        { type: "PRODUCT_CREATED", actorId: user.id, productId: product.id },
        { type: "TASK_CREATED", actorId: user.id, productId: product.id, taskId: task.id, data: { assignee: null } },
      ]);
      await notify(tx, user.id, [
        {
          userId: assigneeId,
          type: "TASK_ASSIGNED",
          productId: product.id,
          taskId: task.id,
          message: `New research: ${product.name}`,
        },
      ]);
      return product.id;
    });
    revalidateProduct();
    return { ok: true, message: `${input.name} created`, data: { id } };
  },
});

export const updateResearchAction = defineAction({
  schema: updateResearchSchema,
  run: async ({ productId, ...input }, { user }) => {
    await db.$transaction(async (tx) => {
      const { product, snap } = await loadSnapshot(tx, productId);
      const inResearch = product.stage === "RESEARCH";
      if (!inResearch && user.role !== "ADMIN") {
        throw new ActionError("Research is locked after submission. Ask an Admin to change it.");
      }
      const task = researchTask(snap);
      if (inResearch && (!task || !canWorkOnTask(user, task))) throw new ActionError("Only the assigned researcher or an Admin can edit this.");
      if (input.brandId) {
        const brand = await tx.brand.findUnique({ where: { id: input.brandId } });
        if (!brand) throw new ActionError("Choose one of the brands.");
      }

      // Rate snapshot refreshes on every save while in RESEARCH; after that it stays frozen.
      const current = inResearch ? await currentRates(tx) : null;
      const data: Record<string, unknown> = researchData(input);
      if (current) {
        Object.assign(data, shippingData(input.weightKg, settingsRateFor(input.shippingMethod, current.settings)));
      } else {
        Object.assign(data, await adminShippingData(tx, product, input.weightKg, input.shippingMethod));
      }
      const changed = Object.entries(data)
        .filter(([key, value]) => {
          const before = (product as Record<string, unknown>)[key];
          const norm = (v: unknown) => {
            if (v === null || v === undefined) return null;
            if (v instanceof Date) return v.toISOString().slice(0, 10);
            const text = String(v);
            // Decimals: "262.50" and 262.5 are the same value.
            return /^\d+\.\d+$/.test(text) ? String(Number(text)) : text;
          };
          return norm(before) !== norm(value);
        })
        .map(([key]) => key);

      if (!inResearch) {
        // Admin edit after research: the rate snapshot stays frozen; log old → new.
        const norm = (v: unknown) =>
          v === null || v === undefined || v === "" ? null : v instanceof Date ? v.toISOString().slice(0, 10) : Array.isArray(v) ? v.join(", ") || null : String(v);
        const changes = Object.fromEntries(
          changed.map((k) => [k, { old: norm((product as Record<string, unknown>)[k]), new: norm((data as Record<string, unknown>)[k]) }]),
        );
        await tx.product.update({ where: { id: productId }, data });
        if (changed.length) await logEvents(tx, [{ type: "OVERRIDE", actorId: user.id, productId, data: { changes } }]);
        return;
      }
      await tx.product.update({ where: { id: productId }, data: { ...data, ...current!.rates } });
      if (changed.length) {
        await logEvents(tx, [
          {
            type: "PRODUCT_UPDATED",
            actorId: user.id,
            productId,
            data: { fields: changed.map((k) => FIELD_LABELS[k] ?? k) },
          },
        ]);
      }
    });
    revalidateProduct();
    return { ok: true, message: "Research saved" };
  },
});

export const submitResearchAction = defineAction({
  schema: productIdSchema,
  run: async ({ productId }, { user }) => {
    const now = new Date();
    const result = await db.$transaction(async (tx) => {
      const { product, snap } = await loadSnapshot(tx, productId);
      const task = researchTask(snap);
      if (!task || !canWorkOnTask(user, task)) throw new ActionError("Only the assigned researcher or an Admin can submit.");

      const checklist = await tx.checklistItem.findMany({ where: { taskId: task.id } });
      const blockers = researchBlockers(
        {
          brandId: product.brandId,
          name: product.name,
          supplierUrl: product.supplierUrl,
          chinaPriceBdt: product.chinaPriceBdt?.toString() ?? null,
          weightKg: product.weightKg?.toString() ?? null,
          shippingMethod: product.shippingMethod,
          sellingPriceBdt: product.sellingPriceBdt?.toString() ?? null,
        },
        missingRequiredCount(checklist),
      );
      if (blockers.length) throw new ActionError(`Still needed: ${blockers.join(", ")}.`);

      const planned = planResearchSubmit(snap);
      if (!planned.ok) throw new ActionError(planned.error);

      const applied = await applyPlan(tx, planned.plan, { actorId: user.id, product, now });
      await logEvents(tx, [{ type: "RESEARCH_SUBMITTED", actorId: user.id, productId, taskId: task.id }]);
      return applied;
    });
    revalidateProduct();
    const reviewer = result.createdTasks[0]?.assigneeName;
    return { ok: true, message: `Research submitted · waiting for product review${reviewer ? ` by ${reviewer}` : ""}` };
  },
});

export const toggleChecklistItemAction = defineAction({
  schema: toggleChecklistSchema,
  run: async ({ itemId, checked }, { user }) => {
    const item = await db.checklistItem.findUnique({
      where: { id: itemId },
      include: { task: { select: { id: true, type: true, status: true, assigneeId: true } } },
    });
    if (!item) throw new ActionError("That checklist item no longer exists.");
    if (!canWorkOnTask(user, item.task)) throw new ActionError("Only the assignee or an Admin can tick this.");
    if (!(item.task.status === "TODO" || item.task.status === "REVISION")) {
      throw new ActionError(
        item.task.status === "LOCKED"
          ? "This task is still locked."
          : `${TASK_TYPE_LABELS[item.task.type]} isn't open for changes right now.`,
      );
    }
    await db.checklistItem.update({
      where: { id: itemId },
      data: checked
        ? { checked: true, checkedById: user.id, checkedAt: new Date() }
        : { checked: false, checkedById: null, checkedAt: null },
    });
    revalidateProduct();
    return { ok: true };
  },
});


/** Reviewer / Admin: approve the product for testing → Creative starts (7 tasks, assigned). */
export const approveProductAction = defineAction({
  capability: "product.approve",
  schema: reviewDecisionSchema,
  run: async ({ productId, note }, { user }) => {
    const now = new Date();
    const result = await db.$transaction(async (tx) => {
      const { product, snap } = await loadSnapshot(tx, productId);
      const planned = planApproveProduct(snap);
      if (!planned.ok) throw new ActionError(planned.error);
      // Q1: the product gets an owning media buyer when it enters Creative.
      let mediaBuyerId = product.mediaBuyerId;
      const owner = mediaBuyerId ? await tx.user.findUnique({ where: { id: mediaBuyerId } }) : null;
      if (!owner?.active) {
        mediaBuyerId = (await autoAssign(tx, ["MEDIA_BUYER"], now, { brandId: product.brandId }))[0] ?? null;
        await tx.product.update({ where: { id: productId }, data: { mediaBuyerId } });
      }
      const applied = await applyPlan(tx, planned.plan, { actorId: user.id, product, now });
      await logEvents(tx, [{ type: "PRODUCT_APPROVED", actorId: user.id, productId, data: { note } }]);
      await notify(tx, user.id, [
        { userId: product.createdById, type: "TASK_APPROVED", productId, message: `${user.name} approved ${product.name} for testing${note ? `: ${note}` : ""}` },
        { userId: mediaBuyerId, type: "TASK_ASSIGNED", productId, message: `${product.name} was approved for testing — you're the media buyer. Write the creative brief.` },
      ]);
      return applied;
    });
    revalidateProduct();
    const unassigned = result.createdTasks.filter((t) => !t.assigneeId).length;
    return {
      ok: true,
      message: `Approved for testing · ${result.createdTasks.length} creative tasks created${unassigned ? ` (${unassigned} need an assignee)` : ""}`,
    };
  },
});

/** Reviewer / Admin: not approved → the product is closed with the reason recorded. */
export const rejectProductAction = defineAction({
  capability: "product.approve",
  schema: rejectSchema,
  run: async ({ productId, note }, { user }) => {
    const now = new Date();
    await db.$transaction(async (tx) => {
      const { product, snap } = await loadSnapshot(tx, productId);
      const planned = planRejectProduct(snap);
      if (!planned.ok) throw new ActionError(planned.error);
      await tx.product.update({
        where: { id: productId },
        data: { killReason: "NOT_APPROVED", killNote: note, killedAt: now, stageBeforeKill: "REVIEW" },
      });
      await applyPlan(tx, planned.plan, { actorId: user.id, product, now });
      await logEvents(tx, [{ type: "PRODUCT_REJECTED", actorId: user.id, productId, data: { note } }]);
      await notify(tx, user.id, [
        { userId: product.createdById, type: "PRODUCT_KILLED", productId, message: `${product.name}: ${KILL_REASON_LABELS.NOT_APPROVED} — ${note}` },
      ]);
    });
    revalidateProduct();
    return { ok: true, message: "Marked as not approved" };
  },
});

/** End of the chosen calendar day in Dhaka (23:59), as a UTC instant. */
function endOfDhakaDay(day: string): Date {
  return new Date(`${day}T23:59:00+06:00`);
}

/**
 * An old product that is already selling (owner's rule): no research or review. It starts as Live with its
 * existing campaign, and the new creative batch picked in the form goes straight to the designers / editor.
 */
export const createRunningProductAction = defineAction({
  schema: createRunningProductSchema,
  run: async (input, { user }) => {
    if (!canAddRunningProduct(user)) throw new ActionError("You don't have permission to add running products.");
    const { brandId, name, websiteUrl, imageUrl, oldImageAssets, oldVideoAssets, referenceLinks, priority, withBatch, batchName, types, dueDate } = input;
    const now = new Date();
    const dueAt = withBatch ? endOfDhakaDay(dueDate) : null;
    if (dueAt && dueAt.getTime() <= now.getTime()) return { ok: false, error: "Pick a due date in the future.", fieldErrors: { dueDate: ["Pick a future date"] } };
    const result = await db.$transaction(async (tx) => {
      const id = await createRunningProduct(tx, user, { brandId, name, websiteUrl, imageUrl, oldImageAssets, oldVideoAssets, referenceLinks, priority }, now);
      let count = 0;
      if (withBatch && dueAt) {
        const { product: full, snap } = await loadSnapshot(tx, id);
        const planned = planNewBatch(snap, { types, dueAt, reason: null, name: batchName });
        if (!planned.ok) throw new ActionError(planned.error);
        const applied = await applyPlan(tx, planned.plan, { actorId: user.id, product: full, now });
        await logEvents(tx, [
          { type: "BATCH_REQUESTED", actorId: user.id, productId: id, data: { number: planned.plan.newBatch!.number, name: batchName, types, dueAt: dueAt.toISOString() } },
        ]);
        count = applied.createdTasks.length;
      }
      return { id, count };
    });
    revalidateProduct();
    return {
      ok: true,
      message: `${name} added as running${result.count ? ` · ${result.count} creative task${result.count === 1 ? "" : "s"} assigned` : ""}`,
      data: { id: result.id },
    };
  },
});

/** Add an extra resource link on the Image or Video creative tab. */
export const addResourceLinkAction = defineAction({
  schema: resourceLinkSchema,
  run: async ({ productId, lane, url }, { user }) => {
    if (!canEditResources(user, lane)) throw new ActionError("You can't add links on this tab.");
    const field = lane === "images" ? "imageResourceLinks" : "videoResourceLinks";
    await db.$transaction(async (tx) => {
      const p = await tx.product.findUnique({ where: { id: productId }, select: { imageResourceLinks: true, videoResourceLinks: true } });
      if (!p) throw new ActionError("This product no longer exists.");
      const list = p[field];
      if (list.includes(url)) throw new ActionError("That link is already there.");
      if (list.length >= 30) throw new ActionError("Up to 30 links per tab.");
      await tx.product.update({ where: { id: productId }, data: { [field]: { push: url } } });
      await logEvents(tx, [{ type: "PRODUCT_UPDATED", actorId: user.id, productId, data: { fields: [`${lane === "images" ? "image" : "video"} resources`] } }]);
    });
    revalidateProduct();
    return { ok: true, message: "Link added" };
  },
});

export const removeResourceLinkAction = defineAction({
  schema: resourceLinkSchema,
  run: async ({ productId, lane, url }, { user }) => {
    if (!canEditResources(user, lane)) throw new ActionError("You can't change links on this tab.");
    const field = lane === "images" ? "imageResourceLinks" : "videoResourceLinks";
    await db.$transaction(async (tx) => {
      const p = await tx.product.findUnique({ where: { id: productId }, select: { imageResourceLinks: true, videoResourceLinks: true } });
      if (!p) throw new ActionError("This product no longer exists.");
      await tx.product.update({ where: { id: productId }, data: { [field]: p[field].filter((l) => l !== url) } });
    });
    revalidateProduct();
    return { ok: true, message: "Link removed" };
  },
});
