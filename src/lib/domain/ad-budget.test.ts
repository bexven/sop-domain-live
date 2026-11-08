import { describe, expect, it } from "vitest";
import { costBreakdown, fundBill, fundHistory, monthOf, providerBalance, shiftMonth, sumBy } from "./ad-budget";

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

describe("cost breakdown and history", () => {
  const funds = [
    {
      id: "f1",
      number: 1,
      provider: "FundPro",
      receivedOn: "2026-11-02",
      feeBdt: "500",
      paid: true,
      paidOn: "2026-11-05",
      billBdt: "72500.00",
      reference: "TX1",
      credits: [
        { id: "c1", accountName: "Timtom BDT", currency: "BDT", amount: "10000", billBdt: "10000.00", rate: "1" },
        { id: "c2", accountName: "Timtom USD", currency: "USD", amount: "500", billBdt: "62000.00", rate: "124" },
      ],
    },
    { id: "f2", number: 2, provider: "FundPro", receivedOn: "2026-11-06", feeBdt: "0", paid: false, paidOn: null, billBdt: "100.00", reference: null, credits: [{ id: "c3", accountName: "Timtom USD", currency: "USD", amount: "1", billBdt: "100.00", rate: "100" }] },
  ];
  it("counts USD at its rate in the month's cost", () => {
    expect(costBreakdown(funds)).toEqual({ bdtBdt: "10000.00", foreignBdt: "62100.00", foreignByCurrency: { USD: "501.00" }, foreignBdtByCurrency: { USD: "62100.00" }, feeBdt: "500.00", totalBdt: "72600.00" });
  });
  it("lists credits, fees and payments newest first", () => {
    expect(fundHistory(funds).map((e) => `${e.date} ${e.kind}`)).toEqual(["2026-11-06 credit", "2026-11-05 paid", "2026-11-02 fee", "2026-11-02 credit", "2026-11-02 credit"]);
  });
});
