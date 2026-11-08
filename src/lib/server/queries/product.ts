import "server-only";
import { overallCampaignStatus } from "@/lib/domain/campaigns";
import { canSeeBrand, type BrandViewer } from "@/lib/domain/permissions";
import type { ProductStage, TaskType } from "@/generated/prisma/enums";
import { laneOf } from "@/lib/domain/labels";
import { computeMargin, marginBand, type MarginBand, type MarginResult } from "@/lib/domain/margin";
import { deriveStepper, type Stepper } from "@/lib/domain/stepper";
import { latestBatch } from "@/lib/domain/workflow";
import { productRef } from "@/lib/format";
import { db } from "../db";

const person = { select: { id: true, name: true, avatarColor: true, avatarAssetId: true } } as const;
export type PersonDTO = { id: string; name: string; avatarColor: string; avatarAssetId: string | null };

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);
const str = (d: { toString(): string } | null | undefined) => (d === null || d === undefined ? null : d.toString());

export async function getMarginThresholds() {
  const s = await db.settings.findUnique({ where: { id: 1 } });
  return s
    ? {
        healthyMarginPct: s.healthyMarginPct.toString(),
        thinMarginPct: s.thinMarginPct.toString(),
        usdToBdtRate: s.usdToBdtRate.toString(),
        rmbToBdtRate: s.rmbToBdtRate.toString(),
        courierChargePct: s.courierChargePct.toString(),
        shippingRatePerKgBdt: str(s.shippingRatePerKgBdt),
        seaShippingRatePerKgBdt: str(s.seaShippingRatePerKgBdt),
      }
    : null;
}

/** Image / video progress of the current batch, for the stepper. */
export function laneProgress(
  tasks: { type: TaskType; status: string; batchId: string | null }[],
  batches: { id: string; number: number }[],
) {
  const batch = latestBatch({ batches } as never);
  const live = tasks.filter((t) => batch && t.batchId === batch.id && t.status !== "CANCELLED");
  const of = (lane: "images" | "videos") => {
    const l = live.filter((t) => laneOf(t.type) === lane);
    return { approved: l.filter((t) => t.status === "APPROVED").length, total: l.length };
  };
  return { images: of("images"), videos: of("videos") };
}

/** A product for this viewer, or null if it doesn't exist or is a restricted brand they can't see. */
export async function getProductDetail(id: string, viewer: BrandViewer & { role?: string }) {
  const [p, thresholds] = await Promise.all([
    db.product.findUnique({
      where: { id },
      include: {
        createdBy: person,
        mediaBuyer: person,
        brand: { select: { id: true, name: true, color: true, restricted: true } },
        adCampaigns: { orderBy: { number: "asc" } },
        batches: { orderBy: { number: "asc" } },
        transitions: { orderBy: { at: "asc" } },
        orders: { orderBy: { number: "desc" }, include: { createdBy: person } },
        testOrders: { orderBy: { createdAt: "desc" }, include: { createdBy: person } },
        tasks: {
          orderBy: [{ createdAt: "asc" }],
          include: {
            assignee: person,
            checklist: { orderBy: { order: "asc" } },
            submissions: {
              orderBy: { version: "desc" },
              include: {
                submittedBy: person,
                decidedBy: person,
                items: { where: { kind: "LINK" }, orderBy: { order: "asc" } },
              },
            },
          },
        },
      },
    }),
    getMarginThresholds(),
  ]);
  if (!p || !canSeeBrand(viewer, p.brand)) return null;
  const brands = await getBrands(viewer);

  const people = await db.user.findMany({
    where: { removedAt: null },
    select: { id: true, name: true, avatarColor: true, avatarAssetId: true, role: true, active: true, isMaster: true, brandAccess: true },
  });
  const nameOf = (uid: string | null | undefined) => (uid ? (people.find((u) => u.id === uid)?.name ?? null) : null);

  const comments = await db.comment.findMany({
    where: { productId: id },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    include: { author: person },
  });


  const margin: MarginResult | null = computeMargin({
    chinaPriceBdt: str(p.chinaPriceBdt),
    shippingPerUnitBdt: str(p.shippingPerUnitBdt),
    sellingPriceBdt: str(p.sellingPriceBdt),
    courierChargePct: p.courierChargePct.toString(),
  });
  const band: MarginBand | null = margin?.marginPct && thresholds ? marginBand(margin.marginPct, thresholds) : null;

  const stepper: Stepper = deriveStepper({
    stage: p.stage,
    stageBeforeKill: p.stageBeforeKill,
    campaignStatus: overallCampaignStatus(p.adCampaigns.map((c) => c.status)),
    lanes: laneProgress(p.tasks, p.batches),
    ordering: Boolean(p.orderingSince),
  });

  return {
    id: p.id,
    number: p.number,
    ref: productRef(p.number),
    name: p.name,
    stage: p.stage,
    stageBeforeKill: p.stageBeforeKill,
    brand: p.brand,
    brandId: p.brandId,
    stageEnteredAt: p.stageEnteredAt.toISOString(),
    priority: p.priority,
    imageUrl: p.imageUrl,
    supplierUrl: p.supplierUrl,
    chinaPriceBdt: str(p.chinaPriceBdt),
    shippingPerUnitBdt: str(p.shippingPerUnitBdt),
    weightKg: str(p.weightKg),
    shippingMethod: p.shippingMethod,
    shippingRatePerKgBdt: str(p.shippingRatePerKgBdt),
    sellingPriceBdt: str(p.sellingPriceBdt),
    rmbToBdtRate: p.rmbToBdtRate.toString(),
    courierChargePct: p.courierChargePct.toString(),
    targetCustomer: p.targetCustomer,
    problemSolved: p.problemSolved,
    sellingAngle: p.sellingAngle,
    referenceLinks: p.referenceLinks,
    imageResourceLinks: p.imageResourceLinks,
    videoResourceLinks: p.videoResourceLinks,
    addedRunning: p.addedRunning,
    oldImageAssets: p.oldImageAssets,
    oldVideoAssets: p.oldVideoAssets,
    targetLaunchDate: p.targetLaunchDate ? p.targetLaunchDate.toISOString().slice(0, 10) : null,
    creativeBrief: p.creativeBrief,
    creativeBriefUpdatedAt: iso(p.creativeBriefUpdatedAt),
    killReason: p.killReason,
    killNote: p.killNote,
    killedAt: iso(p.killedAt),
    completedAt: iso(p.completedAt),
    createdAt: p.createdAt.toISOString(),
    createdBy: p.createdBy,
    mediaBuyer: p.mediaBuyer,
    campaignStatus: overallCampaignStatus(p.adCampaigns.map((c) => c.status)),
    campaigns: p.adCampaigns.map((c) => ({
      id: c.id,
      number: c.number,
      name: c.name,
      type: c.type,
      status: c.status,
      adsManagerUrl: c.adsManagerUrl,
      metaCampaignId: c.metaCampaignId,
      dailyBudgetUsd: str(c.dailyBudgetUsd),
      strategyNotes: c.strategyNotes,
      launchedAt: iso(c.launchedAt),
      launchedBy: nameOf(c.launchedById),
    })),
    batches: p.batches.map((b) => ({
      id: b.id,
      number: b.number,
      name: b.name,
      reason: b.reason,
      dueAt: iso(b.dueAt),
      imageFolderUrl: b.imageFolderUrl,
      videoFolderUrl: b.videoFolderUrl,
      createdAt: b.createdAt.toISOString(),
      requestedBy: (({ id, name, avatarColor, avatarAssetId }) => ({ id, name, avatarColor, avatarAssetId }))(
        people.find((u) => u.id === b.requestedById) ?? { id: "", name: "Someone", avatarColor: "slate", avatarAssetId: null },
      ),
    })),
    transitions: p.transitions.map((t) => ({ toStage: t.toStage, at: t.at.toISOString() })),
    tasks: p.tasks.map((t) => ({
      id: t.id,
      type: t.type,
      role: t.role,
      phase: t.phase,
      status: t.status,
      batchId: t.batchId,
      dependsOnId: t.dependsOnId,
      assignee: t.assignee,
      dueAt: iso(t.dueAt),
      unlockedAt: iso(t.unlockedAt),
      revisionNote: t.revisionNote,
      submittedAt: iso(t.submittedAt),
      approvedAt: iso(t.approvedAt),
      approvedBy: nameOf(t.approvedById),
      followUpOfId: t.followUpOfId,
      requestKind: t.requestKind,
      requestNote: t.requestNote,
      createdAt: t.createdAt.toISOString(),
      checklist: t.checklist.map((c) => ({
        id: c.id,
        label: c.label,
        required: c.required,
        checked: c.checked,
        checkedBy: nameOf(c.checkedById),
        checkedAt: iso(c.checkedAt),
      })),
      submissions: t.submissions.map((s) => ({
        id: s.id,
        version: s.version,
        url: s.url,
        note: s.note,
        submittedBy: s.submittedBy,
        createdAt: s.createdAt.toISOString(),
        decision: s.decision,
        decisionNote: s.decisionNote,
        decidedBy: s.decidedBy,
        decidedAt: iso(s.decidedAt),
        links: s.items.map((it) => it.url).filter((u): u is string => Boolean(u)),
      })),
    })),
    comments: comments.map((c) => ({
      id: c.id,
      parentId: c.parentId,
      phase: c.phase,
      taskId: c.taskId,
      body: c.body,
      author: c.author,
      createdAt: c.createdAt.toISOString(),
      editedAt: iso(c.editedAt),
    })),
    websiteUrl: p.websiteUrl,
    orderingSince: iso(p.orderingSince),
    scalable: p.scalable,
    scalePlans: p.scalePlans,
    scaleNote: p.scaleNote,
    orders: p.orders.map((o) => ({
      id: o.id,
      number: o.number,
      quantity: o.quantity,
      buyingPriceBdt: o.buyingPriceBdt.toString(),
      name: o.name,
      shippingCostBdt: o.shippingCostBdt.toString(),
      weightKg: str(o.weightKg),
      shippingMethod: o.shippingMethod,
      shippingRatePerKgBdt: str(o.shippingRatePerKgBdt),
      sellingPriceBdt: o.sellingPriceBdt.toString(),
      courierChargePct: o.courierChargePct.toString(),
      orderedOn: o.orderedOn.toISOString().slice(0, 10),
      note: o.note,
      createdBy: o.createdBy,
      createdAt: o.createdAt.toISOString(),
    })),
    testOrders: p.testOrders.map((t) => ({
      id: t.id,
      name: t.name,
      quality: t.quality,
      note: t.note,
      expectedOn: t.expectedOn ? t.expectedOn.toISOString().slice(0, 10) : null,
      placedAt: iso(t.placedAt),
      placedBy: nameOf(t.placedById),
      confirmedAt: iso(t.confirmedAt),
      confirmedBy: nameOf(t.confirmedById),
      createdBy: t.createdBy,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    })),
    brands,
    margin,
    marginBand: band,
    thresholds,
    stepper,
    // Only people who may see this brand can be assigned or @mentioned.
    people: people.filter((u) => u.active && canSeeBrand(u, p.brand)).map(({ id, name, avatarColor, avatarAssetId, role }) => ({ id, name, avatarColor, avatarAssetId, role })),
  };
}

export type ProductDetail = NonNullable<Awaited<ReturnType<typeof getProductDetail>>>;
export type TaskDTO = ProductDetail["tasks"][number];
export type OrderDTO = ProductDetail["orders"][number];
export type CampaignDTO = ProductDetail["campaigns"][number];
export type TestOrderDTO = ProductDetail["testOrders"][number];
export type StageKey = ProductStage;

/** Brands, optionally only those a viewer may use (restricted brands need access). */
export async function getBrands(viewer?: BrandViewer) {
  const brands = await db.brand.findMany({ orderBy: [{ order: "asc" }, { name: "asc" }], select: { id: true, name: true, color: true, active: true, restricted: true } });
  return viewer ? brands.filter((b) => canSeeBrand(viewer, b)) : brands;
}
export type BrandDTO = Awaited<ReturnType<typeof getBrands>>[number];
