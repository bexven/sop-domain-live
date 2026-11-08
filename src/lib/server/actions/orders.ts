"use server";

import { revalidatePath } from "next/cache";
import Decimal from "decimal.js";
import { addOrderError, canPlaceTestOrder, moveToOrderingError, SCALE_VERDICT_LABELS } from "@/lib/domain/orders";
import { can } from "@/lib/domain/permissions";
import { shippingFromWeight, SHIPPING_METHOD_LABELS } from "@/lib/domain/margin";
import { confirmTestOrderSchema, orderSchema, placeTestOrderSchema, productIdSchema, scalingSchema, testOrderIdSchema, testOrderSchema } from "@/lib/validation/orders";
import { ActionError, defineAction } from "../action";
import { db, type Tx } from "../db";
import { logEvents, notify } from "../services/events";
import { settingsRateFor } from "../services/product-helpers";

function revalidate() {
  revalidatePath("/", "layout");
}

/** A live product performing well in its campaign moves to ordering. */
export const moveToOrderingAction = defineAction({
  capability: "orders.manage",
  schema: productIdSchema,
  run: async ({ productId }, { user }) => {
    await db.$transaction(async (tx) => {
      const p = await tx.product.findUnique({ where: { id: productId } });
      if (!p) throw new ActionError("This product no longer exists.");
      const err = moveToOrderingError(p);
      if (err) throw new ActionError(err);
      const updated = await tx.product.updateMany({ where: { id: productId, orderingSince: null, stage: "LIVE" }, data: { orderingSince: new Date() } });
      if (updated.count !== 1) throw new ActionError("This product changed just now. Refresh and try again.");
      await logEvents(tx, [{ type: "MOVED_TO_ORDERING", actorId: user.id, productId }]);
    });
    revalidate();
    return { ok: true, message: "Moved to ordering · add the first order" };
  },
});

/** Add an order, or correct one. Each order keeps its own prices. */
export const saveOrderAction = defineAction({
  capability: "orders.manage",
  schema: orderSchema,
  run: async ({ productId, orderId, ...fields }, { user }) => {
    await db.$transaction(async (tx) => {
      const p = await tx.product.findUnique({ where: { id: productId } });
      if (!p) throw new ActionError("This product no longer exists.");
      const err = addOrderError(p);
      if (err) throw new ActionError(err);
      const existing = orderId ? await tx.productOrder.findUnique({ where: { id: orderId } }) : null;
      if (orderId && (!existing || existing.productId !== productId)) throw new ActionError("That order no longer exists.");
      // Shipping = weight × the method's rate per kg. An order keeps its rate while the method stays the same.
      const settings = await tx.settings.findUnique({ where: { id: 1 } });
      const rate =
        existing?.shippingRatePerKgBdt && existing.shippingMethod === fields.shippingMethod
          ? existing.shippingRatePerKgBdt.toString()
          : settingsRateFor(fields.shippingMethod, settings);
      const shipping = shippingFromWeight(fields.weightKg, rate);
      if (!rate || !shipping) {
        throw new ActionError(`An Admin needs to set the ${SHIPPING_METHOD_LABELS[fields.shippingMethod].toLowerCase()} shipping rate per kg in Settings first.`);
      }
      const data = {
        name: fields.name,
        quantity: fields.quantity,
        buyingPriceBdt: fields.buyingPriceBdt,
        weightKg: fields.weightKg,
        shippingMethod: fields.shippingMethod,
        shippingRatePerKgBdt: rate,
        shippingCostBdt: shipping,
        sellingPriceBdt: fields.sellingPriceBdt,
        orderedOn: new Date(`${fields.orderedOn}T00:00:00Z`),
        note: fields.note,
      };
      if (existing) {
        await tx.productOrder.update({ where: { id: existing.id }, data });
        await logEvents(tx, [{ type: "ORDER_UPDATED", actorId: user.id, productId, data: { number: existing.number } }]);
        return existing.number;
      }
      const last = await tx.productOrder.aggregate({ where: { productId }, _max: { number: true } });
      const next = (last._max.number ?? 0) + 1;
      const createdOrder = await tx.productOrder.create({
        data: { ...data, productId, number: next, createdById: user.id, courierChargePct: settings?.courierChargePct ?? p.courierChargePct },
      });
      await logEvents(tx, [{ type: "ORDER_CREATED", actorId: user.id, productId, data: { number: next, name: fields.name, quantity: fields.quantity } }]);
      // Every new order goes to Shipment Management (owner's rule), with the default vendor; Supply Chain adds the rest.
      const vendor = await tx.shippingVendor.findFirst({ where: { isDefault: true, active: true }, select: { id: true } });
      await tx.shipment.create({
        data: {
          productId,
          productOrderId: createdOrder.id,
          vendorId: vendor?.id ?? null,
          orderedBy: user.name,
          orderedOn: data.orderedOn,
          quantity: fields.quantity,
          totalWeightKg: new Decimal(fields.weightKg).times(fields.quantity).toDecimalPlaces(3).toString(),
          shippingCostBdt: new Decimal(shipping).times(fields.quantity).toDecimalPlaces(2).toString(),
          note: `From order “${fields.name}”`,
          createdById: user.id,
        },
      });
      await notifySupply(tx, user.id, p, `${user.name} added order “${fields.name}” (${fields.quantity.toLocaleString("en-IN")} units) for ${p.name} · it's in Shipments`, true);
      return next;
    });
    revalidate();
    return { ok: true, message: orderId ? `“${fields.name}” updated` : `“${fields.name}” added` };
  },
});

export const saveScalingAction = defineAction({
  capability: "orders.manage",
  schema: scalingSchema,
  run: async ({ productId, scalable, scalePlans, scaleNote }, { user }) => {
    await db.$transaction(async (tx) => {
      const p = await tx.product.findUnique({ where: { id: productId } });
      if (!p) throw new ActionError("This product no longer exists.");
      if (!p.orderingSince) throw new ActionError("Move the product to ordering first.");
      await tx.product.update({ where: { id: productId }, data: { scalable, scalePlans: [...new Set(scalePlans)], scaleNote } });
      await logEvents(tx, [
        { type: "SCALING_UPDATED", actorId: user.id, productId, data: { scalable: scalable ? SCALE_VERDICT_LABELS[scalable] : null, plans: scalePlans } },
      ]);
    });
    revalidate();
    return { ok: true, message: "Scaling plan saved" };
  },
});

/** New orders and test orders tell the product's media buyer and every Admin (plus Supply Chain when asked). */
async function notifySupply(tx: Tx, actorId: string, p: { id: string; mediaBuyerId: string | null }, message: string, withSupplyChain = false) {
  const people = await tx.user.findMany({
    where: {
      active: true,
      removedAt: null,
      OR: [{ role: "ADMIN" }, { adminAccess: true }, { isMaster: true }, ...(withSupplyChain ? [{ role: "SUPPLY_CHAIN" as const }] : [])],
    },
    select: { id: true },
  });
  await notify(tx, actorId, [p.mediaBuyerId, ...people.map((a) => a.id)].map((userId) => ({ userId, type: "FEEDBACK" as const, productId: p.id, message })));
}

/** Ask for a test order (a few units to check quality). Admins / Media Buyers / Supply Chain then place it. */
export const saveTestOrderAction = defineAction({
  capability: "orders.manage",
  schema: testOrderSchema,
  run: async ({ productId, testOrderId, name, expectedOn, quality, note }, { user }) => {
    await db.$transaction(async (tx) => {
      const p = await tx.product.findUnique({ where: { id: productId } });
      if (!p) throw new ActionError("This product no longer exists.");
      if (!p.orderingSince) throw new ActionError("Move the product to ordering first.");
      if (testOrderId) {
        const t = await tx.testOrder.findUnique({ where: { id: testOrderId } });
        if (!t || t.productId !== productId) throw new ActionError("That test order no longer exists.");
        // The arrival date belongs to whoever placed it (Admin / Media Buyer / Supply Chain).
        const dateChange = t.placedAt && expectedOn && canPlaceTestOrder(user) ? { expectedOn: new Date(`${expectedOn}T00:00:00Z`) } : {};
        await tx.testOrder.update({ where: { id: testOrderId }, data: { name, note, quality, ...dateChange } });
      } else {
        await tx.testOrder.create({ data: { name, note, productId, createdById: user.id } });
        await notifySupply(tx, user.id, p, `${user.name} asked for test order “${name}” for ${p.name} · please place it and add the arrival date`, true);
      }
      await logEvents(tx, [{ type: "ORDER_UPDATED", actorId: user.id, productId, data: { test: true, name, quality } }]);
    });
    revalidate();
    return { ok: true, message: testOrderId ? "Test order updated" : "Test order requested · Admins, Media Buyer and Supply Chain notified" };
  },
});

/** "It's ordered": an Admin / Media Buyer / Supply Chain confirms the test order was placed and when it should arrive. */
export const placeTestOrderAction = defineAction({
  schema: placeTestOrderSchema,
  run: async ({ productId, testOrderId, expectedOn }, { user }) => {
    if (!canPlaceTestOrder(user)) throw new ActionError("Only Admins, Media Buyers or Supply Chain can confirm a test order was placed.");
    await db.$transaction(async (tx) => {
      const p = await tx.product.findUnique({ where: { id: productId } });
      const t = await tx.testOrder.findUnique({ where: { id: testOrderId } });
      if (!p || !t || t.productId !== productId) throw new ActionError("That test order no longer exists.");
      const placed = await tx.testOrder.updateMany({
        where: { id: testOrderId, placedAt: null },
        data: { placedAt: new Date(), placedById: user.id, expectedOn: new Date(`${expectedOn}T00:00:00Z`) },
      });
      if (placed.count !== 1) throw new ActionError("Someone already confirmed this. Refresh to see it.");
      await logEvents(tx, [{ type: "ORDER_UPDATED", actorId: user.id, productId, data: { test: true, name: t.name, placed: true, expectedOn } }]);
      await notify(tx, user.id, [t.createdById, p.mediaBuyerId].map((userId) => ({
        userId,
        type: "FEEDBACK" as const,
        productId,
        message: `Test order “${t.name ?? "Test order"}” for ${p.name} is ordered · expected by ${expectedOn}`,
      })));
    });
    revalidate();
    return { ok: true, message: "Marked as ordered" };
  },
});

/** Tick (or untick) that the test units arrived. */
export const confirmTestOrderAction = defineAction({
  schema: confirmTestOrderSchema,
  run: async ({ productId, testOrderId, confirmed }, { user }) => {
    if (!canPlaceTestOrder(user) && !can(user, "orders.manage")) throw new ActionError("You can't change this test order.");
    await db.$transaction(async (tx) => {
      const t = await tx.testOrder.findUnique({ where: { id: testOrderId } });
      if (!t || t.productId !== productId) throw new ActionError("That test order no longer exists.");
      if (!t.placedAt) throw new ActionError("Confirm it was placed first.");
      const updated = await tx.testOrder.updateMany({
        where: { id: testOrderId, confirmedAt: confirmed ? null : { not: null } },
        data: confirmed ? { confirmedAt: new Date(), confirmedById: user.id } : { confirmedAt: null, confirmedById: null },
      });
      if (updated.count !== 1) throw new ActionError("Someone changed this just now. Refresh and try again.");
      await logEvents(tx, [{ type: "ORDER_UPDATED", actorId: user.id, productId, data: { test: true, name: t.name, arrived: confirmed } }]);
    });
    revalidate();
    return { ok: true, message: confirmed ? "Test units arrived" : "Marked as not arrived" };
  },
});

export const deleteTestOrderAction = defineAction({
  capability: "orders.manage",
  schema: testOrderIdSchema,
  run: async ({ productId, testOrderId }) => {
    const t = await db.testOrder.findUnique({ where: { id: testOrderId } });
    if (!t || t.productId !== productId) throw new ActionError("That test order no longer exists.");
    await db.testOrder.delete({ where: { id: testOrderId } });
    revalidate();
    return { ok: true, message: "Test order removed" };
  },
});
