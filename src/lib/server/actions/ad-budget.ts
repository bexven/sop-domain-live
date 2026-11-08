"use server";

import { revalidatePath } from "next/cache";
import { fundBill } from "@/lib/domain/ad-budget";
import { accountSchema, fundPaidSchema, fundSchema, providerSchema, recordIdSchema, spendSchema } from "@/lib/validation/ad-budget";
import { ActionError, defineAction } from "../action";
import { db } from "../db";

function revalidate() {
  revalidatePath("/ad-budget");
}
const dayDate = (d: string) => new Date(`${d}T00:00:00Z`);

export const addProviderAction = defineAction({
  capability: "adbudget.manage",
  schema: providerSchema,
  run: async ({ name }) => {
    const existing = await db.adProvider.findFirst({ where: { name: { equals: name, mode: "insensitive" } } });
    const p = existing ?? (await db.adProvider.create({ data: { name } }));
    revalidate();
    return { ok: true, message: existing ? `${p.name} is already there` : `${p.name} added`, data: { id: p.id, name: p.name } };
  },
});

export const saveAccountAction = defineAction({
  capability: "adbudget.manage",
  schema: accountSchema,
  run: async ({ accountId, name, currency, providerId, active }) => {
    const clash = await db.adAccount.findFirst({ where: { name: { equals: name, mode: "insensitive" }, ...(accountId ? { NOT: { id: accountId } } : {}) } });
    if (clash) return { ok: false, error: "There's already an ad account with that name.", fieldErrors: { name: ["Name already used"] } };
    if (accountId) {
      const acc = await db.adAccount.findUnique({ where: { id: accountId }, include: { _count: { select: { credits: true, spends: true } } } });
      if (!acc) throw new ActionError("That ad account no longer exists.");
      if (acc.currency !== currency && acc._count.credits + acc._count.spends > 0) {
        throw new ActionError("This account already has records, so its currency can't change. Add a new account instead.");
      }
      await db.adAccount.update({ where: { id: accountId }, data: { name, currency, providerId, active } });
    } else {
      await db.adAccount.create({ data: { name, currency, providerId, active } });
    }
    revalidate();
    return { ok: true, message: accountId ? "Ad account saved" : `${name} added` };
  },
});

/** Record Ad Fund: credits per account, the provider's bill (worked out here), paid or not. */
export const saveFundAction = defineAction({
  capability: "adbudget.manage",
  schema: fundSchema,
  run: async ({ fundId, providerId, receivedOn, credits, feeBdt, usdRate, paid, paidOn, reference, note }, { user }) => {
    const number = await db.$transaction(async (tx) => {
      if (!(await tx.adProvider.findUnique({ where: { id: providerId } }))) throw new ActionError("Pick the provider.");
      const accounts = await tx.adAccount.findMany({ where: { id: { in: credits.map((c) => c.accountId) } } });
      const byId = new Map(accounts.map((a) => [a.id, a]));
      const rows = credits.map((c) => {
        const acc = byId.get(c.accountId);
        if (!acc) throw new ActionError("Pick an ad account for every credit.");
        return { accountId: acc.id, amount: c.amount, currency: acc.currency };
      });
      if (rows.some((r) => r.currency !== "BDT") && !usdRate) {
        throw new ActionError("Enter the dollar rate (BDT per 1 USD) for the USD accounts.");
      }
      const bill = fundBill({ credits: rows, feeBdt, usdRate });
      const creditRows = rows.map((r) => ({ accountId: r.accountId, amount: r.amount, rateToBdt: r.currency === "BDT" ? "1" : (usdRate ?? "0") }));
      const data = {
        providerId,
        paidOn: dayDate(receivedOn),
        amountBdt: bill,
        feeBdt,
        usdRate,
        paid,
        paidAt: paid && paidOn ? dayDate(paidOn) : null,
        reference,
        note,
      };
      if (fundId) {
        const existing = await tx.adPayment.findUnique({ where: { id: fundId } });
        if (!existing) throw new ActionError("That ad fund no longer exists.");
        await tx.adCredit.deleteMany({ where: { paymentId: fundId } });
        await tx.adPayment.update({ where: { id: fundId }, data: { ...data, credits: { create: creditRows } } });
        return existing.number;
      }
      return (await tx.adPayment.create({ data: { ...data, createdById: user.id, credits: { create: creditRows } } })).number;
    });
    revalidate();
    return { ok: true, message: fundId ? `Ad fund #${number} saved` : `Ad fund #${number} recorded` };
  },
});

/** One tap: the bill is paid (today) / not paid. */
export const setFundPaidAction = defineAction({
  capability: "adbudget.manage",
  schema: fundPaidSchema,
  run: async ({ fundId, paid }) => {
    const f = await db.adPayment.findUnique({ where: { id: fundId } });
    if (!f) throw new ActionError("That ad fund no longer exists.");
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(new Date());
    const updated = await db.adPayment.updateMany({ where: { id: fundId, paid: !paid }, data: { paid, paidAt: paid ? dayDate(today) : null } });
    if (updated.count !== 1) throw new ActionError("Someone changed this just now. Refresh to see it.");
    revalidate();
    return { ok: true, message: paid ? `Ad fund #${f.number} marked paid` : `Ad fund #${f.number} marked unpaid` };
  },
});

export const deleteFundAction = defineAction({
  capability: "adbudget.manage",
  schema: recordIdSchema,
  run: async ({ id }) => {
    const p = await db.adPayment.findUnique({ where: { id } });
    if (!p) throw new ActionError("That ad fund no longer exists.");
    await db.adPayment.delete({ where: { id } });
    revalidate();
    return { ok: true, message: `Ad fund #${p.number} deleted` };
  },
});

export const saveSpendAction = defineAction({
  capability: "adbudget.manage",
  schema: spendSchema,
  run: async ({ spendId, accountId, spentOn, amount, note }, { user }) => {
    if (!(await db.adAccount.findUnique({ where: { id: accountId } }))) throw new ActionError("Pick an ad account.");
    const data = { accountId, spentOn: dayDate(spentOn), amount, note };
    if (spendId) {
      if (!(await db.adSpend.findUnique({ where: { id: spendId } }))) throw new ActionError("That entry no longer exists.");
      await db.adSpend.update({ where: { id: spendId }, data });
    } else {
      await db.adSpend.create({ data: { ...data, createdById: user.id } });
    }
    revalidate();
    return { ok: true, message: spendId ? "Spend updated" : "Spend added" };
  },
});

export const deleteSpendAction = defineAction({
  capability: "adbudget.manage",
  schema: recordIdSchema,
  run: async ({ id }) => {
    if (!(await db.adSpend.findUnique({ where: { id } }))) throw new ActionError("That entry no longer exists.");
    await db.adSpend.delete({ where: { id } });
    revalidate();
    return { ok: true, message: "Spend entry deleted" };
  },
});
