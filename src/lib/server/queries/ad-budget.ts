import "server-only";
import Decimal from "decimal.js";
import { creditBdt, monthOf, providerBalance, sumBy } from "@/lib/domain/ad-budget";
import { db } from "../db";

const day = (d: Date) => d.toISOString().slice(0, 10);

/** Everything the Ad budget page needs; the sums use the pure rules in domain/ad-budget. */
export async function getAdBudget(month: string) {
  const [providers, accounts, rows] = await Promise.all([
    db.adProvider.findMany({ orderBy: { name: "asc" } }),
    db.adAccount.findMany({ orderBy: [{ currency: "asc" }, { name: "asc" }], include: { provider: { select: { name: true } } } }),
    db.adPayment.findMany({ orderBy: [{ paidOn: "desc" }, { number: "desc" }], include: { credits: { include: { account: { select: { name: true, currency: true } } } } } }),
  ]);

  const funds = rows.map((f) => {
    const usdRate = f.usdRate?.toString() ?? null;
    const credits = f.credits.map((c) => ({
      id: c.id,
      accountId: c.accountId,
      accountName: c.account.name,
      currency: c.account.currency,
      amount: c.amount.toString(),
      // Funds recorded before the bill existed have no fund-level rate: use the credit's own rate.
      billBdt: creditBdt({ amount: c.amount.toString(), currency: c.account.currency }, usdRate ?? c.rateToBdt.toString()).toFixed(2),
    }));
    return {
      id: f.id,
      number: f.number,
      providerId: f.providerId,
      receivedOn: day(f.paidOn),
      billBdt: f.amountBdt.toString(),
      feeBdt: f.feeBdt.toString(),
      usdRate,
      paid: f.paid,
      paidOn: f.paidAt ? day(f.paidAt) : null,
      reference: f.reference,
      note: f.note,
      credits,
    };
  });

  const inMonth = funds.filter((f) => monthOf(f.receivedOn) === month);
  const monthCredits = inMonth.flatMap((f) => f.credits);
  const allCredits = funds.flatMap((f) => f.credits);
  const balance = providerBalance(funds);
  const months = [...new Set(funds.map((f) => monthOf(f.receivedOn)))].sort().reverse();

  return {
    month,
    providers: providers.map((p) => ({ id: p.id, name: p.name })),
    accounts: accounts.map((a) => ({
      id: a.id,
      name: a.name,
      currency: a.currency,
      providerId: a.providerId,
      providerName: a.provider?.name ?? null,
      active: a.active,
      credited: sumBy(allCredits.filter((c) => c.accountId === a.id), () => "x", (c) => c.amount).x ?? "0.00",
      monthCredited: sumBy(monthCredits.filter((c) => c.accountId === a.id), () => "x", (c) => c.amount).x ?? "0.00",
      monthBillBdt: sumBy(monthCredits.filter((c) => c.accountId === a.id), () => "x", (c) => c.billBdt).x ?? "0.00",
    })),
    funds,
    overview: {
      monthCostBdt: sumBy(inMonth, () => "x", (f) => f.billBdt).x ?? "0.00",
      monthReceivedByCurrency: sumBy(monthCredits, (c) => c.currency, (c) => c.amount),
      monthFeeBdt: sumBy(inMonth, () => "x", (f) => f.feeBdt).x ?? "0.00",
      ...balance,
    },
    providerBalances: providers.map((p) => ({ id: p.id, name: p.name, ...providerBalance(funds.filter((f) => f.providerId === p.id)) })),
    /** Ad spend = what the ad funds cost, month by month (automatic). */
    monthly: months.map((m) => {
      const fs = funds.filter((f) => monthOf(f.receivedOn) === m);
      const cs = fs.flatMap((f) => f.credits);
      return {
        month: m,
        totalBdt: sumBy(fs, () => "x", (f) => f.billBdt).x ?? "0.00",
        paidBdt: sumBy(fs.filter((f) => f.paid), () => "x", (f) => f.billBdt).x ?? "0.00",
        unpaidBdt: sumBy(fs.filter((f) => !f.paid), () => "x", (f) => f.billBdt).x ?? "0.00",
        feeBdt: sumBy(fs, () => "x", (f) => f.feeBdt).x ?? "0.00",
        receivedByCurrency: sumBy(cs, (c) => c.currency, (c) => c.amount),
        byAccount: Object.entries(sumBy(cs, (c) => c.accountId, (c) => c.billBdt))
          .map(([accountId, bdt]) => ({ accountId, name: cs.find((c) => c.accountId === accountId)!.accountName, billBdt: bdt }))
          .sort((a, b) => new Decimal(b.billBdt).cmp(a.billBdt)),
      };
    }),
  };
}

export type AdBudget = Awaited<ReturnType<typeof getAdBudget>>;
