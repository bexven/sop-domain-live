import { z } from "zod";
import { idSchema } from "./common";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date");
const optionalDay = z.union([day, z.literal("")]).optional().nullable().transform((v) => v || null);
const optionalId = z.string().trim().max(64).optional().nullable().transform((v) => v || null);
const optionalDecimal = (label: string, decimals: number, max: number) =>
  z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((v) => (v ? v.replace(/^\./, "0.") : null))
    .refine((v) => v === null || new RegExp(`^\\d+(\\.\\d{1,${decimals}})?$`).test(v), `${label} must be a number`)
    .refine((v) => v === null || Number(v) <= max, `${label} is too large`);

export const shipmentSchema = z.object({
  shipmentId: optionalId,
  productId: idSchema,
  vendorId: optionalId,
  reorderOfId: optionalId,
  orderedBy: z.string().trim().min(2, "Who ordered it?").max(80),
  orderedOn: day,
  totalWeightKg: optionalDecimal("Total weight", 3, 1_000_000),
  quantity: z.coerce.number({ error: "Enter the quantity" }).int("Whole units only").min(1, "At least 1").max(10_000_000, "That's too many"),
  shippingCostBdt: optionalDecimal("Shipping cost", 2, 100_000_000),
  estimatedDeliveryOn: optionalDay,
  shippingPaid: z.boolean().default(false),
  shippingPaidOn: optionalDay,
  arrived: z.boolean().default(false),
  arrivedOn: optionalDay,
  note: z.string().trim().max(1000).optional().nullable().transform((v) => v || null),
});

export const shipmentFlagSchema = z.object({
  productId: idSchema,
  shipmentId: idSchema,
  field: z.enum(["shippingPaid", "arrived"]),
  value: z.boolean(),
});

export const shipmentIdSchema = z.object({ productId: idSchema, shipmentId: idSchema });

export const vendorSchema = z.object({ name: z.string().trim().min(2, "Vendor name").max(80) });

/** Shipments → "Add a product": lists an existing product (running) to link the shipment to. */
export const listingSchema = z.object({
  brandId: z.string().trim().min(1, "Choose the brand").max(64),
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(120),
});
