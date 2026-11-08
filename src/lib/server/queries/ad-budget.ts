import "server-only";
import Decimal from "decimal.js";
import { creditValueBdt, monthOf, paymentDifference, providerBalance, sumBy } from "@/lib/domain/ad-budget";
import { db } from "../db";

const day = (d: Date) => d.toISOString().slice(0, 10);

/** Everything the Ad Budget page needs; summaries are worked out with the pure rules in domain/ad-budget. */
export async function getAdBudget(month: string) {
  const [providers, accounts, paymentRows, spendRows] = await Promise.all([
    db.adProvider.findMany({ orderBy: { name: "asc" } }),
    db.adAccount.findMany({ orderBy: [{ currency: "asc" }, { name: "asc" }], include: { provider: { select: { name: true } } } }),
    db.adPayment.findMany({ orderBy: [{ paidOn: "desc" }, { number: "desc" }], include: { credits: { include: { account: { select: { name: true, currency: true } } } } } }),
    db.adSpend.findMany({ orderBy: [{ spentOn: "desc" }, { createdAt: "desc" }], include: { account: { select: { name: true, currency: true } } } }),
  ]);

  const payments = paymentRows.map((p) => {
    const credits = p.credits.map((c) => ({
      id: c.id,
      accountId: c.accountId,
      accountName: c.account.name,
      currency: c.account.currency,
      amount: c.amount.toString(),
      rateToBdt: c.rateToBdt.toString(),
      valueBdt: creditValueBdt({ amount: c.amount.toString(), rateToBdt: c.rateToBdt.toString() }).toFixed(2),
    }));
    return {
      id: p.id,
      number: p.number,
      providerId: p.providerId,
      paidOn: day(p.paidOn),
      amountBdt: p.amountBdt.toString(),
      reference: p.reference,
      credits,
      difference: paymentDifference({ amountBdt: p.amountBdt.toString(), credits }),
    };
  });

  const spends = spendRows.map((s) => ({
    id: s.id,
    accountId: s.accountId,
    accountName: s.account.name,
    currency: s.account.currency,
    spentOn: day(s.spentOn),
    amount: s.amount.toString(),
    note: s.note,
  }));

  const creditsAll = payments.flatMap((p) => p.credits);
  const creditedByAccount = sumBy(creditsAll, (c) => c.accountId, (c) => c.amount);
  const creditedByCurrency = sumBy(creditsAll, (c) => c.currency, (c) => c.amount);
  const spentByAccount = sumBy(spends, (s) => s.accountId, (s) => s.amount);
  const monthSpends = spends.filter((s) => monthOf(s.spentOn) === month);
  const monthByAccount = sumBy(monthSpends, (s) => s.accountId, (s) => s.amount);
  const monthByCurrency = sumBy(monthSpends, (s) => s.currency, (s) => s.amount);
  const months = [...new Set(spends.map((s) => monthOf(s.spentOn)))].sort().reverse();
  const monthly = months.map((m) => ({ month: m, byCurrency: sumBy(spends.filter((s) => monthOf(s.spentOn) === m), (s) => s.currency, (s) => s.amount) }));

  const providerBalances = providers.map((pr) => ({
    id: pr.id,
    name: pr.name,
    ...providerBalance(payments.filter((p) => p.providerId === pr.id)),
  }));
  const overall = providerBalance(payments);

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
      credited: creditedByAccount[a.id] ?? "0.00",
      spent: spentByAccount[a.id] ?? "0.00",
      remaining: new Decimal(creditedByAccount[a.id] ?? 0).minus(spentByAccount[a.id] ?? 0).toFixed(2),
      monthSpent: monthByAccount[a.id] ?? "0.00",
    })),
    payments,
    spends,
    monthSpends,
    overview: {
      paidBdt: overall.paidBdt,
      creditedByCurrency,
      difference: overall.difference,
      status: overall.status,
      monthByCurrency,
    },
    providerBalances,
    monthly,
  };
}

export type AdBudget = Awaited<ReturnType<typeof getAdBudget>>;
