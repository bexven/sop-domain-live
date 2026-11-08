import Decimal from "decimal.js";

/**
 * Ad Budget (pure). The provider loads our ad accounts ("ad fund") and bills us in BDT (owner's rule):
 *   bill = BDT credited + the provider's fee (a BDT amount) + USD credited × that fund's dollar rate.
 * Other currencies, if added, are valued with their own rate the same way as USD.
 * We owe the provider whatever is still unpaid.
 */

/** Currencies offered for ad accounts. Add a code here to support another one. */
export const CURRENCIES = ["BDT", "USD"] as const;
export type Currency = (typeof CURRENCIES)[number] | (string & {});

type Credit = { amount: string; currency: string };
type FundInput = { credits: Credit[]; feeBdt: string | null; usdRate: string | null };

/** BDT value of one credit: BDT as is; other currencies × the fund's rate (0 until a rate is entered). */
export function creditBdt(c: Credit, usdRate: string | null): Decimal {
  if (c.currency === "BDT") return new Decimal(c.amount);
  return new Decimal(c.amount).times(usdRate && Number(usdRate) > 0 ? usdRate : 0);
}

/** The provider's bill for one ad fund, in BDT. */
export function fundBill(f: FundInput): string {
  const credits = f.credits.reduce((sum, c) => sum.plus(creditBdt(c, f.usdRate)), new Decimal(0));
  return credits.plus(f.feeBdt || 0).toDecimalPlaces(2).toFixed(2);
}

type Fund = { billBdt: string; paid: boolean };

/** What we still owe the provider (unpaid bills) and what's already paid. */
export function providerBalance(funds: Fund[]) {
  let owed = new Decimal(0);
  let paid = new Decimal(0);
  let unpaidCount = 0;
  for (const f of funds) {
    if (f.paid) paid = paid.plus(f.billBdt);
    else {
      owed = owed.plus(f.billBdt);
      unpaidCount++;
    }
  }
  return { owedBdt: owed.toFixed(2), paidBdt: paid.toFixed(2), unpaidCount, settled: owed.lte(0) };
}

/** "YYYY-MM" for a "YYYY-MM-DD" day. */
export function monthOf(day: string): string {
  return day.slice(0, 7);
}

/** The month before / after "YYYY-MM". */
export function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Sums amounts by key (e.g. account id, currency or month). */
export function sumBy<T>(rows: T[], key: (r: T) => string, amount: (r: T) => string): Record<string, string> {
  const out: Record<string, Decimal> = {};
  for (const r of rows) {
    const k = key(r);
    out[k] = (out[k] ?? new Decimal(0)).plus(amount(r));
  }
  return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.toFixed(2)]));
}
