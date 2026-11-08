import { z } from "zod";
import { Priority, ShippingMethod, TaskType } from "@/generated/prisma/enums";
import { idSchema } from "./common";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep it under ${max} characters`)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional()
    .transform((v) => v ?? null);

export const urlSchema = z
  .string()
  .trim()
  .max(2000)
  .refine((v) => {
    try {
      const u = new URL(v);
      return u.protocol === "https:" || u.protocol === "http:";
    } catch {
      return false;
    }
  }, "Enter a full link starting with https://");

const optionalUrl = z
  .union([urlSchema, z.literal("")])
  .nullable()
  .optional()
  .transform((v) => (v ? v : null));

/** Optional money: "" → null; otherwise a non-negative decimal with ≤ 2 places. */
const optionalMoney = (label: string, max: number) =>
  z
    .string()
    .trim()
    .nullable()
    .optional()
    .transform((v) => (v ? v.replace(/^\./, "0.") : null))
    .refine((v) => v === null || /^\d+(\.\d{1,2})?$/.test(v), `${label} must be a number with up to 2 decimals`)
    .refine((v) => v === null || Number(v) <= max, `${label} is too large`);

/** Optional weight in kg: "" → null; otherwise a decimal with ≤ 3 places (grams). */
const optionalWeight = z
  .string()
  .trim()
  .nullable()
  .optional()
  .transform((v) => (v ? v.replace(/^\./, "0.") : null))
  .refine((v) => v === null || /^\d+(\.\d{1,3})?$/.test(v), "Weight must be a number in kg with up to 3 decimals (e.g. 0.350)")
  .refine((v) => v === null || Number(v) <= 10_000, "Weight is too large");

export const researchFieldsSchema = z.object({
  brandId: z.string().trim().max(64).optional().nullable().transform((v) => v || null),
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(120, "Name is too long"),
  supplierUrl: optionalUrl,
  imageUrl: optionalUrl,
  chinaPriceBdt: optionalMoney("China price", 1_000_000),
  weightKg: optionalWeight,
  shippingMethod: z.enum(ShippingMethod).nullable().optional().or(z.literal("")).transform((v) => v || null),
  sellingPriceBdt: optionalMoney("Selling price", 100_000_000),
  problemSolved: optionalText(2000),
  referenceLinks: z.array(urlSchema).max(20, "Up to 20 links").default([]),
  priority: z.enum(Priority).default("MEDIUM"),
  targetLaunchDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date")
    .nullable()
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
});

export type ResearchFieldsInput = z.input<typeof researchFieldsSchema>;

export const createProductSchema = researchFieldsSchema.refine((v) => Boolean(v.brandId), {
  message: "Choose the brand",
  path: ["brandId"],
});
export const updateResearchSchema = researchFieldsSchema.extend({ productId: idSchema });
export const productIdSchema = z.object({ productId: idSchema });
export const toggleChecklistSchema = z.object({ itemId: idSchema, checked: z.boolean() });
export const reviewDecisionSchema = z.object({
  productId: idSchema,
  note: z.string().trim().max(2000).optional().transform((v) => v || null),
});
export const rejectSchema = z.object({
  productId: idSchema,
  note: z.string().trim().min(3, "Say why it isn't approved").max(2000),
});

/** An old product that is already selling: straight to Live, optionally with a new creative batch. */
export const createRunningProductSchema = z
  .object({
    brandId: z.string().trim().min(1, "Choose the brand").max(64),
    name: z.string().trim().min(2, "Name must be at least 2 characters").max(120, "Name is too long"),
    websiteUrl: optionalUrl,
    imageUrl: optionalUrl,
    oldImageAssets: z.array(urlSchema).max(30, "Up to 30 links").default([]),
    oldVideoAssets: z.array(urlSchema).max(30, "Up to 30 links").default([]),
    referenceLinks: z.array(urlSchema).max(20, "Up to 20 links").default([]),
    priority: z.enum(Priority).default("MEDIUM"),
    withBatch: z.boolean().default(false),
    batchName: z.string().trim().max(60, "Keep the name under 60 characters").optional().default(""),
    types: z.array(z.enum(TaskType)).default([]),
    dueDate: z.string().optional().default(""),
  })
  .superRefine((v, ctx) => {
    if (!v.withBatch) return;
    if (v.batchName.length < 2) ctx.addIssue({ code: "custom", path: ["batchName"], message: "Give the creative batch a name" });
    if (v.types.length === 0) ctx.addIssue({ code: "custom", path: ["types"], message: "Pick at least one image or video to make" });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v.dueDate)) ctx.addIssue({ code: "custom", path: ["dueDate"], message: "Pick a due date" });
  });

export const resourceLinkSchema = z.object({
  productId: idSchema,
  lane: z.enum(["images", "videos"]),
  url: urlSchema,
});
