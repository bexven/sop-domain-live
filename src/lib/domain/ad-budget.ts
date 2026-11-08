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

type CostCredit = { currency: string; amount: string; billBdt: string };

/** What a set of funds cost in BDT, split into BDT loaded, other currencies (at their rates) and fees. */
export function costBreakdown(funds: { feeBdt: string; credits: CostCredit[] }[]) {
  let bdt = new Decimal(0);
  let foreignBdt = new Decimal(0);
  let fee = new Decimal(0);
  const foreign: Record<string, Decimal> = {};
  const foreignValue: Record<string, Decimal> = {};
  for (const f of funds) {
    fee = fee.plus(f.feeBdt || 0);
    for (const c of f.credits) {
      if (c.currency === "BDT") bdt = bdt.plus(c.amount);
      else {
        foreignBdt = foreignBdt.plus(c.billBdt);
        foreign[c.currency] = (foreign[c.currency] ?? new Decimal(0)).plus(c.amount);
        foreignValue[c.currency] = (foreignValue[c.currency] ?? new Decimal(0)).plus(c.billBdt);
      }
    }
  }
  return {
    bdtBdt: bdt.toFixed(2),
    foreignBdt: foreignBdt.toFixed(2),
    foreignByCurrency: Object.fromEntries(Object.entries(foreign).map(([k, v]) => [k, v.toFixed(2)])),
    foreignBdtByCurrency: Object.fromEntries(Object.entries(foreignValue).map(([k, v]) => [k, v.toFixed(2)])),
    feeBdt: fee.toFixed(2),
    totalBdt: bdt.plus(foreignBdt).plus(fee).toFixed(2),
  };
}

export type HistoryEntry =
  | { kind: "credit"; key: string; date: string; fundNumber: number; provider: string; accountName: string; currency: string; amount: string; bdt: string; rate: string | null }
  | { kind: "fee"; key: string; date: string; fundNumber: number; provider: string; bdt: string }
  | { kind: "paid"; key: string; date: string; fundNumber: number; provider: string; accountNames: string[]; bdt: string; reference: string | null };

type HistoryFund = {
  id: string;
  number: number;
  provider: string;
  receivedOn: string;
  feeBdt: string;
  paid: boolean;
  paidOn: string | null;
  billBdt: string;
  reference: string | null;
  credits: (CostCredit & { id: string; accountName: string; rate: string | null })[];
};

/**
 * Every money movement, newest first: each account credit on the fund's receive day, the provider's fee,
 * and the payment to the provider on its paid day (the receive day if no paid day was kept).
 */
export function fundHistory(funds: HistoryFund[]): HistoryEntry[] {
  const out: HistoryEntry[] = [];
  for (const f of funds) {
    for (const c of f.credits) {
      out.push({ kind: "credit", key: `c-${c.id}`, date: f.receivedOn, fundNumber: f.number, provider: f.provider, accountName: c.accountName, currency: c.currency, amount: c.amount, bdt: c.billBdt, rate: c.currency === "BDT" ? null : c.rate });
    }
    if (Number(f.feeBdt)) out.push({ kind: "fee", key: `f-${f.id}`, date: f.receivedOn, fundNumber: f.number, provider: f.provider, bdt: new Decimal(f.feeBdt).toFixed(2) });
    if (f.paid) {
      out.push({ kind: "paid", key: `p-${f.id}`, date: f.paidOn ?? f.receivedOn, fundNumber: f.number, provider: f.provider, accountNames: [...new Set(f.credits.map((c) => c.accountName))], bdt: f.billBdt, reference: f.reference });
    }
  }
  const order = { paid: 0, fee: 1, credit: 2 } as const;
  return out.sort((a, b) => b.date.localeCompare(a.date) || b.fundNumber - a.fundNumber || order[a.kind] - order[b.kind]);
}
