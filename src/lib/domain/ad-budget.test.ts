import { describe, expect, it } from "vitest";
import { fundBill, monthOf, providerBalance, shiftMonth, sumBy } from "./ad-budget";

describe("ad fund bill", () => {
  it("adds BDT credits, the fee and USD credits at the fund's rate", () => {
    // ৳10,000 + ৳500 fee + $100 × 128 = ৳23,300
    const bill = fundBill({ credits: [{ amount: "10000", currency: "BDT" }, { amount: "100", currency: "USD" }], feeBdt: "500", usdRate: "128" });
    expect(bill).toBe("23300.00");
  });
  it("works with BDT only and no fee", () => {
    expect(fundBill({ credits: [{ amount: "10000", currency: "BDT" }], feeBdt: null, usdRate: null })).toBe("10000.00");
  });
  it("values USD at 0 until a rate is entered", () => {
    expect(fundBill({ credits: [{ amount: "100", currency: "USD" }], feeBdt: "0", usdRate: null })).toBe("0.00");
  });
});

describe("provider balance", () => {
  it("is what's still unpaid", () => {
    expect(providerBalance([{ billBdt: "10500", paid: false }, { billBdt: "20000", paid: true }, { billBdt: "500.50", paid: false }])).toEqual({
      owedBdt: "11000.50",
      paidBdt: "20000.00",
      unpaidCount: 2,
      settled: false,
    });
    expect(providerBalance([{ billBdt: "100", paid: true }]).settled).toBe(true);
  });
});

describe("months", () => {
  it("groups by month and moves between months", () => {
    expect(sumBy([{ d: "2026-10-31", a: "1" }, { d: "2026-11-02", a: "2.5" }], (r) => monthOf(r.d), (r) => r.a)).toEqual({ "2026-10": "1.00", "2026-11": "2.50" });
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
  });
});
