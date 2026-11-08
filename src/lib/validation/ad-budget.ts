import { z } from "zod";
import { idSchema } from "./common";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date");
const amount = (label: string) =>
  z
    .string()
    .trim()
    .transform((v) => v.replace(/^\./, "0."))
    .refine((v) => /^\d+(\.\d{1,2})?$/.test(v), `${label} must be a number`)
    .refine((v) => Number(v) > 0, `${label} must be more than 0`)
    .refine((v) => Number(v) <= 1_000_000_000, `${label} is too large`);
const optionalId = z.string().trim().max(64).optional().nullable().transform((v) => v || null);

export const providerSchema = z.object({ name: z.string().trim().min(2, "Provider name").max(80) });

export const accountSchema = z.object({
  accountId: optionalId,
  name: z.string().trim().min(2, "Account name").max(80),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Use a 3-letter currency code, e.g. BDT or USD"),
  providerId: optionalId,
  active: z.boolean().default(true),
});

const money0 = (label: string) =>
  z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((v) => (v ? v.replace(/^\./, "0.") : "0"))
    .refine((v) => /^\d+(\.\d{1,2})?$/.test(v), `${label} must be a number`)
    .refine((v) => Number(v) <= 1_000_000_000, `${label} is too large`);

/** "Record Ad Fund": what the provider loaded into our accounts, their bill, and whether we've paid it. */
export const fundSchema = z
  .object({
    fundId: optionalId,
    providerId: idSchema,
    receivedOn: day,
    credits: z.array(z.object({ accountId: idSchema, amount: amount("Amount credited") })).min(1, "Add at least one ad account credited").max(20),
    feeBdt: money0("Fee"),
    usdRate: z
      .string()
      .trim()
      .optional()
      .nullable()
      .transform((v) => v || null)
      .refine((v) => v === null || /^\d+(\.\d{1,4})?$/.test(v), "Enter the dollar rate, e.g. 128.50"),
    paid: z.boolean().default(false),
    paidOn: z.union([day, z.literal("")]).optional().nullable().transform((v) => v || null),
    reference: z.string().trim().max(200).optional().nullable().transform((v) => v || null),
    note: z.string().trim().max(1000).optional().nullable().transform((v) => v || null),
  })
  .superRefine((v, ctx) => {
    if (v.paid && !v.paidOn) ctx.addIssue({ code: "custom", path: ["paidOn"], message: "When was it paid?" });
  });

export const fundPaidSchema = z.object({ fundId: idSchema, paid: z.boolean() });

export const spendSchema = z.object({
  spendId: optionalId,
  accountId: idSchema,
  spentOn: day,
  amount: amount("Spend"),
  note: z.string().trim().max(500).optional().nullable().transform((v) => v || null),
});

export const recordIdSchema = z.object({ id: idSchema });
