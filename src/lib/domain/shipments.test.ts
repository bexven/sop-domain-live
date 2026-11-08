import { describe, expect, it } from "vitest";
import { matchesFilter, reorderDraft, shipmentState, shipmentTotals } from "./shipments";

const base = { arrived: false, estimatedDeliveryOn: null as string | null, shippingPaid: false, shippingCostBdt: null as string | null };

describe("shipment state", () => {
  it("is ordered, then on the way, late after the ETA, arrived once ticked", () => {
    expect(shipmentState(base, "2026-11-08")).toBe("ordered");
    expect(shipmentState({ ...base, estimatedDeliveryOn: "2026-11-20" }, "2026-11-08")).toBe("in_transit");
    expect(shipmentState({ ...base, estimatedDeliveryOn: "2026-11-07" }, "2026-11-08")).toBe("late");
    expect(shipmentState({ ...base, estimatedDeliveryOn: "2026-11-07", arrived: true }, "2026-11-08")).toBe("arrived");
  });
});

describe("filters and totals", () => {
  const list = [
    { ...base, shippingCostBdt: "12000.50" },
    { ...base, arrived: true, shippingPaid: true, shippingCostBdt: "5000" },
    { ...base, estimatedDeliveryOn: "2026-11-01", shippingCostBdt: "3000" },
    { ...base, arrived: true, shippingCostBdt: null },
  ];
  it("filters incoming, unpaid and arrived", () => {
    expect(list.filter((s) => matchesFilter(s, "incoming"))).toHaveLength(2);
    expect(list.filter((s) => matchesFilter(s, "unpaid"))).toHaveLength(3);
    expect(list.filter((s) => matchesFilter(s, "arrived"))).toHaveLength(2);
  });
  it("adds up what is still unpaid and what is late", () => {
    expect(shipmentTotals(list, "2026-11-08")).toEqual({ incoming: 2, late: 1, arrived: 2, unpaid: 3, unpaidCostBdt: "15000.50" });
  });
});

describe("reorder", () => {
  it("copies product, vendor, quantity and weight with fresh dates", () => {
    expect(reorderDraft({ productId: "p", vendorId: "v", quantity: 500, totalWeightKg: "75.5" }, "2026-11-08")).toEqual({
      productId: "p",
      vendorId: "v",
      quantity: 500,
      totalWeightKg: "75.5",
      orderedOn: "2026-11-08",
      estimatedDeliveryOn: null,
      shippingCostBdt: null,
      shippingPaid: false,
      arrived: false,
    });
  });
});
