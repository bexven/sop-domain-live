"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon, SaveIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { Field, fieldA11y } from "@/components/common/field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { balanceStatus, paymentDifference } from "@/lib/domain/ad-budget";
import { formatBdt } from "@/lib/format";
import { addProviderAction, savePaymentAction } from "@/lib/server/actions/ad-budget";
import type { AdBudget } from "@/lib/server/queries/ad-budget";
import { cn } from "@/lib/utils";

type Payment = AdBudget["payments"][number];
const NEW_PROVIDER = "__new";
const numeric = (s: string) => s.replace(/[^\d.]/g, "");

export function PaymentDialog({ data, payment, onClose }: { data: AdBudget; payment: Payment | null; onClose: () => void }) {
  const router = useRouter();
  const [providers, setProviders] = useState(data.providers);
  const [providerId, setProviderId] = useState(payment?.providerId ?? data.providers[0]?.id ?? "");
  const [newProvider, setNewProvider] = useState<string | null>(null);
  const [paidOn, setPaidOn] = useState(payment?.paidOn ?? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(new Date()));
  const [amountBdt, setAmountBdt] = useState(payment?.amountBdt ?? "");
  const [reference, setReference] = useState(payment?.reference ?? "");
  const [credits, setCredits] = useState<{ accountId: string; amount: string }[]>(
    payment?.credits.map((c) => ({ accountId: c.accountId, amount: c.amount })) ?? [{ accountId: data.accounts.find((a) => a.active)?.id ?? "", amount: "" }],
  );
  const initialRates: Record<string, string> = {};
  for (const c of payment?.credits ?? []) if (c.currency !== "BDT") initialRates[c.currency] = c.rateToBdt;
  const [rates, setRates] = useState(initialRates);
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [pending, startTransition] = useTransition();
  const accById = new Map(data.accounts.map((a) => [a.id, a]));
  const usedCurrencies = [...new Set(credits.map((c) => accById.get(c.accountId)?.currency).filter((c): c is string => Boolean(c) && c !== "BDT"))];

  // Live check: the BDT value of the credits against what was paid.
  const difference = useMemo(() => {
    if (!/^\d+(\.\d+)?$/.test(amountBdt)) return null;
    const rows = credits
      .filter((c) => c.accountId && /^\d+(\.\d+)?$/.test(c.amount))
      .map((c) => {
        const cur = accById.get(c.accountId)?.currency ?? "BDT";
        return { amount: c.amount, rateToBdt: cur === "BDT" ? "1" : rates[cur] || "0" };
      });
    return paymentDifference({ amountBdt, credits: rows });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amountBdt, credits, rates]);

  function addProvider() {
    const name = newProvider?.trim() ?? "";
    if (name.length < 2) return;
    startTransition(async () => {
      const r = await addProviderAction({ name });
      if (!r.ok) return void toast.error(r.error);
      const p = r.data as { id: string; name: string };
      setProviders((list) => (list.some((x) => x.id === p.id) ? list : [...list, p]));
      setProviderId(p.id);
      setNewProvider(null);
    });
  }

  function save() {
    startTransition(async () => {
      const r = await savePaymentAction({ paymentId: payment?.id ?? null, providerId, paidOn, amountBdt, rates, reference, credits });
      if (!r.ok) {
        setErrors(r.fieldErrors ?? {});
        toast.error(r.error);
        return;
      }
      toast.success(r.message);
      onClose();
      router.refresh();
    });
  }

  const status = difference ? balanceStatus(difference) : null;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{payment ? `Edit payment #${payment.number}` : "Record payment"}</DialogTitle>
          <DialogDescription>What we paid the provider (BDT), and how much they loaded into each ad account.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field id="pay-prov" label="Provider *" error={errors.providerId?.[0]}>
              {newProvider !== null ? (
                <div className="flex gap-2">
                  <Input aria-label="New provider name" value={newProvider} onChange={(e) => setNewProvider(e.target.value)} autoFocus placeholder="Name" />
                  <Button type="button" onClick={addProvider} disabled={pending}>
                    Add
                  </Button>
                </div>
              ) : (
                <Select value={providerId} onValueChange={(id) => (id === NEW_PROVIDER ? setNewProvider("") : setProviderId(id))}>
                  <SelectTrigger id="pay-prov">
                    <SelectValue placeholder="Choose" />
                  </SelectTrigger>
                  <SelectContent>
                    {providers.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                    <SelectItem value={NEW_PROVIDER}>＋ Add a provider…</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </Field>
            <Field id="pay-date" label="Payment date *" error={errors.paidOn?.[0]}>
              <Input {...fieldA11y("pay-date", errors.paidOn?.[0])} type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} className="num" />
            </Field>
            <Field id="pay-amt" label="Amount paid (BDT) *" error={errors.amountBdt?.[0]}>
              <Input {...fieldA11y("pay-amt", errors.amountBdt?.[0])} value={amountBdt} onChange={(e) => setAmountBdt(numeric(e.target.value))} inputMode="decimal" className="num" placeholder="0" />
            </Field>
          </div>

          <fieldset className="grid gap-2">
            <legend className="mb-1 text-meta text-slate-700">Credited to ad accounts *</legend>
            {credits.map((c, i) => {
              const cur = accById.get(c.accountId)?.currency;
              return (
                <div key={i} className="flex gap-2">
                  <Select value={c.accountId} onValueChange={(id) => setCredits(credits.map((x, j) => (j === i ? { ...x, accountId: id } : x)))}>
                    <SelectTrigger aria-label={`Ad account ${i + 1}`} className="flex-1">
                      <SelectValue placeholder="Ad account" />
                    </SelectTrigger>
                    <SelectContent>
                      {data.accounts
                        .filter((a) => a.active || a.id === c.accountId)
                        .map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.name} · {a.currency}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <div className="relative w-40">
                    <Input
                      aria-label={`Amount credited ${i + 1}`}
                      value={c.amount}
                      onChange={(e) => setCredits(credits.map((x, j) => (j === i ? { ...x, amount: numeric(e.target.value) } : x)))}
                      inputMode="decimal"
                      className="num pr-12"
                      placeholder="0"
                    />
                    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-meta text-slate-500">{cur ?? ""}</span>
                  </div>
                  <Button type="button" variant="ghost" size="icon" aria-label="Remove" disabled={credits.length === 1} onClick={() => setCredits(credits.filter((_, j) => j !== i))}>
                    <XIcon />
                  </Button>
                </div>
              );
            })}
            <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => setCredits([...credits, { accountId: "", amount: "" }])}>
              <PlusIcon /> Another account
            </Button>
            {errors.credits?.[0] ? <p className="text-meta text-rose-700">{errors.credits[0]}</p> : null}
          </fieldset>

          {usedCurrencies.length ? (
            <div className="grid gap-3 sm:grid-cols-3">
              {usedCurrencies.map((cur) => (
                <Field key={cur} id={`rate-${cur}`} label={`${cur} rate (BDT per 1 ${cur}) *`}>
                  <Input id={`rate-${cur}`} value={rates[cur] ?? ""} onChange={(e) => setRates({ ...rates, [cur]: numeric(e.target.value) })} inputMode="decimal" className="num" placeholder="e.g. 128.50" />
                </Field>
              ))}
            </div>
          ) : null}

          <Field id="pay-ref" label="Reference / note">
            <Input id="pay-ref" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Transaction ID, bKash ref…" />
          </Field>

          {difference && status ? (
            <p
              className={cn(
                "rounded-control px-3 py-2 text-body ring-1 ring-inset",
                status === "settled" ? "bg-emerald-50 text-emerald-800 ring-emerald-200" : status === "we_owe" ? "bg-rose-50 text-rose-700 ring-rose-200" : "bg-amber-50 text-amber-800 ring-amber-200",
              )}
            >
              {status === "settled"
                ? "Paid and credited match."
                : status === "we_owe"
                  ? `Credited is worth ${formatBdt(Math.abs(Number(difference)))} more than paid: we owe the provider.`
                  : `Paid ${formatBdt(difference)} more than credited: the provider owes us.`}
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={save} disabled={pending || !providerId || !amountBdt || credits.some((c) => !c.accountId || !c.amount)}>
            <SaveIcon /> {payment ? "Save" : "Record payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
