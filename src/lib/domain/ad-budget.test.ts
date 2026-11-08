import { describe, expect, it } from "vitest";
import { balanceStatus, monthOf, paymentDifference, providerBalance, sumBy } from "./ad-budget";

describe("ad budget reconciliation", () => {
  it("values USD credits with the payment's rate", () => {
    // Paid 1,30,000; credited 50,000 BDT + $600 × 130 = 1,28,000 → provider owes us 2,000.
    const p = { amountBdt: "130000", credits: [{ amount: "50000", rateToBdt: "1" }, { amount: "600", rateToBdt: "130" }] };
    expect(paymentDifference(p)).toBe("2000.00");
  });
  it("says who owes whom, or settled", () => {
    expect(balanceStatus("2000.00")).toBe("provider_owes");
    expect(balanceStatus("-500.00")).toBe("we_owe");
    expect(balanceStatus("0.40")).toBe("settled");
  });
  it("adds up all payments to a provider", () => {
    const b = providerBalance([
      { amountBdt: "100000", credits: [{ amount: "100000", rateToBdt: "1" }] },
      { amountBdt: "50000", credits: [{ amount: "400", rateToBdt: "128.5" }] },
    ]);
    expect(b).toEqual({ paidBdt: "150000.00", creditedBdt: "151400.00", difference: "-1400.00", status: "we_owe" });
  });
});

describe("spend summaries", () => {
  it("groups by month and by account", () => {
    const rows = [
      { day: "2026-10-31", acc: "a", amount: "100" },
      { day: "2026-11-01", acc: "a", amount: "50.5" },
      { day: "2026-11-15", acc: "b", amount: "20" },
    ];
    expect(sumBy(rows, (r) => monthOf(r.day), (r) => r.amount)).toEqual({ "2026-10": "100.00", "2026-11": "70.50" });
    expect(sumBy(rows, (r) => r.acc, (r) => r.amount)).toEqual({ a: "150.50", b: "20.00" });
  });
});
