import Decimal from "decimal.js";

/**
 * Ad Budget (pure). We pay the fund provider in BDT; they credit our ad accounts in each account's currency.
 * A credit is valued in BDT with its rate (1 for BDT; the provider's dollar rate for USD).
 */

/** Currencies offered for new ad accounts. Add a code here to support another one. */
export const CURRENCIES = ["BDT", "USD"] as const;
export type Currency = (typeof CURRENCIES)[number] | (string & {});

/** Differences under 1 BDT count as settled (rounding). */
export const SETTLED_TOLERANCE_BDT = 1;

type Credit = { amount: string; rateToBdt: string };
type Payment = { amountBdt: string; credits: Credit[] };

export function creditValueBdt(c: Credit): Decimal {
  return new Decimal(c.amount).times(c.rateToBdt);
}

/** Paid minus the BDT value of what was credited. Positive = the provider owes us; negative = we owe them. */
export function paymentDifference(p: Payment): string {
  const credited = p.credits.reduce((sum, c) => sum.plus(creditValueBdt(c)), new Decimal(0));
  return new Decimal(p.amountBdt).minus(credited).toDecimalPlaces(2).toFixed(2);
}

export type BalanceStatus = "settled" | "we_owe" | "provider_owes";

export function balanceStatus(difference: string): BalanceStatus {
  const d = new Decimal(difference);
  if (d.abs().lt(SETTLED_TOLERANCE_BDT)) return "settled";
  return d.gt(0) ? "provider_owes" : "we_owe";
}

/** Everything paid to one provider vs. everything credited, and who owes whom. */
export function providerBalance(payments: Payment[]) {
  let paid = new Decimal(0);
  let credited = new Decimal(0);
  for (const p of payments) {
    paid = paid.plus(p.amountBdt);
    for (const c of p.credits) credited = credited.plus(creditValueBdt(c));
  }
  const difference = paid.minus(credited).toDecimalPlaces(2).toFixed(2);
  return { paidBdt: paid.toFixed(2), creditedBdt: credited.toDecimalPlaces(2).toFixed(2), difference, status: balanceStatus(difference) };
}

/** "YYYY-MM" for a "YYYY-MM-DD" day. */
export function monthOf(day: string): string {
  return day.slice(0, 7);
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
