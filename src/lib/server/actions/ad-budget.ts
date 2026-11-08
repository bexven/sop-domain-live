"use server";

import { revalidatePath } from "next/cache";
import { accountSchema, paymentSchema, providerSchema, recordIdSchema, spendSchema } from "@/lib/validation/ad-budget";
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

/** A payment to the provider and how it was credited across ad accounts (one payment, many accounts). */
export const savePaymentAction = defineAction({
  capability: "adbudget.manage",
  schema: paymentSchema,
  run: async ({ paymentId, providerId, paidOn, amountBdt, rates, reference, credits }, { user }) => {
    const number = await db.$transaction(async (tx) => {
      if (!(await tx.adProvider.findUnique({ where: { id: providerId } }))) throw new ActionError("Pick the provider.");
      const accounts = await tx.adAccount.findMany({ where: { id: { in: credits.map((c) => c.accountId) } } });
      const byId = new Map(accounts.map((a) => [a.id, a]));
      const rows = credits.map((c) => {
        const acc = byId.get(c.accountId);
        if (!acc) throw new ActionError("Pick an ad account for every credit.");
        const rate = acc.currency === "BDT" ? "1" : rates[acc.currency];
        if (!rate || Number(rate) <= 0) throw new ActionError(`Enter the ${acc.currency} rate (BDT per 1 ${acc.currency}) for this payment.`);
        return { accountId: acc.id, amount: c.amount, rateToBdt: rate };
      });
      const data = { providerId, paidOn: dayDate(paidOn), amountBdt, reference };
      if (paymentId) {
        const existing = await tx.adPayment.findUnique({ where: { id: paymentId } });
        if (!existing) throw new ActionError("That payment no longer exists.");
        await tx.adCredit.deleteMany({ where: { paymentId } });
        await tx.adPayment.update({ where: { id: paymentId }, data: { ...data, credits: { create: rows } } });
        return existing.number;
      }
      const created = await tx.adPayment.create({ data: { ...data, createdById: user.id, credits: { create: rows } } });
      return created.number;
    });
    revalidate();
    return { ok: true, message: paymentId ? `Payment #${number} saved` : `Payment #${number} recorded` };
  },
});

export const deletePaymentAction = defineAction({
  capability: "adbudget.manage",
  schema: recordIdSchema,
  run: async ({ id }) => {
    const p = await db.adPayment.findUnique({ where: { id } });
    if (!p) throw new ActionError("That payment no longer exists.");
    await db.adPayment.delete({ where: { id } });
    revalidate();
    return { ok: true, message: `Payment #${p.number} deleted` };
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
