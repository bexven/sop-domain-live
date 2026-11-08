"use server";

import { revalidatePath } from "next/cache";
import { shipmentRef } from "@/lib/domain/shipments";
import { listingSchema, shipmentFlagSchema, shipmentIdSchema, shipmentSchema, vendorSchema } from "@/lib/validation/shipments";
import { ActionError, defineAction } from "../action";
import { db } from "../db";
import { logEvents } from "../services/events";
import { createRunningProduct } from "../services/running-product";

function revalidate() {
  revalidatePath("/shipments");
  revalidatePath("/dashboard");
}

const dayDate = (d: string | null) => (d ? new Date(`${d}T00:00:00Z`) : null);

/** Add, edit or re-order a shipment. A re-order is a new record linked to the same product and to the earlier shipment. */
export const saveShipmentAction = defineAction({
  capability: "shipments.manage",
  schema: shipmentSchema,
  run: async ({ shipmentId, productId, vendorId, reorderOfId, arrived, ...f }, { user }) => {
    const number = await db.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id: productId }, select: { id: true } });
      if (!product) throw new ActionError("Pick a product.");
      if (vendorId && !(await tx.shippingVendor.findUnique({ where: { id: vendorId } }))) throw new ActionError("Pick a vendor.");
      const data = {
        productId,
        vendorId,
        orderedBy: f.orderedBy,
        orderedOn: dayDate(f.orderedOn)!,
        totalWeightKg: f.totalWeightKg,
        quantity: f.quantity,
        shippingCostBdt: f.shippingCostBdt,
        estimatedDeliveryOn: dayDate(f.estimatedDeliveryOn),
        shippingPaid: f.shippingPaid,
        note: f.note,
      };
      if (shipmentId) {
        const existing = await tx.shipment.findUnique({ where: { id: shipmentId } });
        // The product is checked against the person's brand access (defineAction), so it must be the shipment's own.
        if (!existing || existing.productId !== productId) throw new ActionError("That shipment no longer exists.");
        await tx.shipment.update({
          where: { id: shipmentId },
          data: { ...data, arrived, arrivedAt: arrived ? (existing.arrivedAt ?? new Date()) : null },
        });
        return existing.number;
      }
      if (reorderOfId) {
        const prev = await tx.shipment.findUnique({ where: { id: reorderOfId } });
        if (!prev || prev.productId !== productId) throw new ActionError("The earlier shipment no longer exists.");
      }
      const created = await tx.shipment.create({
        data: { ...data, reorderOfId, arrived, arrivedAt: arrived ? new Date() : null, createdById: user.id },
      });
      await logEvents(tx, [{ type: "ORDER_UPDATED", actorId: user.id, productId, data: { shipment: created.number, reorder: Boolean(reorderOfId) } }]);
      return created.number;
    });
    revalidate();
    return { ok: true, message: shipmentId ? `${shipmentRef(number)} saved` : reorderOfId ? `Re-order ${shipmentRef(number)} created` : `${shipmentRef(number)} added` };
  },
});

/** One tap: shipping paid / arrived at our warehouse (guarded so two people can't flip it at once). */
export const setShipmentFlagAction = defineAction({
  capability: "shipments.manage",
  schema: shipmentFlagSchema,
  run: async ({ productId, shipmentId, field, value }) => {
    const s = await db.shipment.findUnique({ where: { id: shipmentId } });
    if (!s || s.productId !== productId) throw new ActionError("That shipment no longer exists.");
    const data = field === "arrived" ? { arrived: value, arrivedAt: value ? new Date() : null } : { shippingPaid: value };
    const updated = await db.shipment.updateMany({ where: { id: shipmentId, [field]: !value }, data });
    if (updated.count !== 1) throw new ActionError("Someone changed this just now. Refresh to see it.");
    revalidate();
    const msg = field === "arrived" ? (value ? "Marked as arrived" : "Marked as not arrived") : value ? "Shipping marked as paid" : "Shipping marked as unpaid";
    return { ok: true, message: `${shipmentRef(s.number)}: ${msg}` };
  },
});

export const deleteShipmentAction = defineAction({
  capability: "shipments.manage",
  schema: shipmentIdSchema,
  run: async ({ productId, shipmentId }) => {
    const s = await db.shipment.findUnique({ where: { id: shipmentId } });
    if (!s || s.productId !== productId) throw new ActionError("That shipment no longer exists.");
    await db.shipment.delete({ where: { id: shipmentId } });
    revalidate();
    return { ok: true, message: `${shipmentRef(s.number)} deleted` };
  },
});

export const addVendorAction = defineAction({
  capability: "shipments.manage",
  schema: vendorSchema,
  run: async ({ name }) => {
    const existing = await db.shippingVendor.findFirst({ where: { name: { equals: name, mode: "insensitive" } } });
    const vendor = existing ?? (await db.shippingVendor.create({ data: { name } }));
    revalidate();
    return { ok: true, message: existing ? `${vendor.name} is already on the list` : `${vendor.name} added`, data: { id: vendor.id, name: vendor.name } };
  },
});

/** A product that isn't in the system yet: list it as a running product so the shipment can link to it. */
export const addListingAction = defineAction({
  capability: "shipments.manage",
  schema: listingSchema,
  run: async ({ brandId, name }, { user }) => {
    const id = await db.$transaction((tx) => createRunningProduct(tx, user, { brandId, name }, new Date()));
    revalidatePath("/", "layout");
    return { ok: true, message: `${name} listed as a running product`, data: { id, name } };
  },
});
