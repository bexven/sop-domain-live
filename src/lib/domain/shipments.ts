import Decimal from "decimal.js";

/** Shipment Management (pure rules). Dates are Dhaka days "YYYY-MM-DD". */

export type ShipmentState = "arrived" | "late" | "in_transit" | "ordered";

export const SHIPMENT_STATE_LABELS: Record<ShipmentState, string> = {
  arrived: "Arrived at warehouse",
  late: "Late",
  in_transit: "On the way",
  ordered: "Ordered",
};

type ShipmentLike = { arrived: boolean; estimatedDeliveryOn: string | null; shippingPaid: boolean; shippingCostBdt: string | null };

/** Arrived wins; otherwise late once the estimated day has passed; on the way while an ETA is set; else just ordered. */
export function shipmentState(s: Pick<ShipmentLike, "arrived" | "estimatedDeliveryOn">, todayDhaka: string): ShipmentState {
  if (s.arrived) return "arrived";
  if (s.estimatedDeliveryOn && s.estimatedDeliveryOn < todayDhaka) return "late";
  if (s.estimatedDeliveryOn) return "in_transit";
  return "ordered";
}

export type ShipmentFilter = "all" | "incoming" | "unpaid" | "arrived";

export function matchesFilter(s: ShipmentLike, f: ShipmentFilter): boolean {
  if (f === "incoming") return !s.arrived;
  if (f === "unpaid") return !s.shippingPaid;
  if (f === "arrived") return s.arrived;
  return true;
}

/** Header numbers: on the way (and late), shipping unpaid and paid (count + BDT), arrived, all. */
export function shipmentTotals(list: ShipmentLike[], todayDhaka: string) {
  let unpaidCost = new Decimal(0);
  let paidCost = new Decimal(0);
  let unpaid = 0;
  let paid = 0;
  let incoming = 0;
  let late = 0;
  let arrived = 0;
  for (const s of list) {
    if (s.arrived) arrived++;
    else {
      incoming++;
      if (shipmentState(s, todayDhaka) === "late") late++;
    }
    if (s.shippingPaid) {
      paid++;
      if (s.shippingCostBdt) paidCost = paidCost.plus(s.shippingCostBdt);
    } else {
      unpaid++;
      if (s.shippingCostBdt) unpaidCost = unpaidCost.plus(s.shippingCostBdt);
    }
  }
  return { total: list.length, incoming, late, arrived, unpaid, unpaidCostBdt: unpaidCost.toFixed(2), paid, paidCostBdt: paidCost.toFixed(2) };
}

/**
 * The day a flag was ticked: keep the typed / earlier day while it stays ticked, today when it is ticked now,
 * nothing once it is unticked.
 */
export function flagDay(on: boolean, typed: string | null, earlier: string | null, todayDhaka: string): string | null {
  if (!on) return null;
  return typed ?? earlier ?? todayDhaka;
}

/** A restock starts from the previous shipment: same product, vendor, quantity and weight; new dates, unpaid, not arrived. */
export function reorderDraft(
  prev: { productId: string; vendorId: string | null; quantity: number; totalWeightKg: string | null },
  todayDhaka: string,
) {
  return {
    productId: prev.productId,
    vendorId: prev.vendorId,
    quantity: prev.quantity,
    totalWeightKg: prev.totalWeightKg,
    orderedOn: todayDhaka,
    estimatedDeliveryOn: null as string | null,
    shippingCostBdt: null as string | null,
    shippingPaid: false,
    arrived: false,
  };
}

export function shipmentRef(n: number): string {
  return `S-${n}`;
}
