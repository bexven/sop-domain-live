"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon, SaveIcon, Trash2Icon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { Field, fieldA11y } from "@/components/common/field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { fundBill } from "@/lib/domain/ad-budget";
import { formatBdt } from "@/lib/format";
import { addProviderAction, deleteFundAction, saveFundAction } from "@/lib/server/actions/ad-budget";
import type { AdBudget } from "@/lib/server/queries/ad-budget";
import { cn } from "@/lib/utils";

type Fund = AdBudget["funds"][number];
const NEW_PROVIDER = "__new";
const numeric = (s: string) => s.replace(/[^\d.]/g, "");
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(new Date());

/** Record Ad Fund: provider, receive date, credited accounts (BDT / USD), the provider's bill, paid?, reference and note. */
export function FundDialog({ data, fund, onClose }: { data: AdBudget; fund: Fund | null; onClose: () => void }) {
  const router = useRouter();
  const [providers, setProviders] = useState(data.providers);
  const [providerId, setProviderId] = useState(fund?.providerId ?? data.providers[0]?.id ?? "");
  const [newProvider, setNewProvider] = useState<string | null>(null);
  const [receivedOn, setReceivedOn] = useState(fund?.receivedOn ?? today());
  const [credits, setCredits] = useState<{ accountId: string; amount: string }[]>(
    fund?.credits.map((c) => ({ accountId: c.accountId, amount: c.amount })) ?? [{ accountId: data.accounts.find((a) => a.active)?.id ?? "", amount: "" }],
  );
  const [feeBdt, setFeeBdt] = useState(fund && Number(fund.feeBdt) > 0 ? fund.feeBdt : "");
  const [usdRate, setUsdRate] = useState(fund?.usdRate ?? "");
  const [paid, setPaid] = useState(fund?.paid ?? false);
  const [paidOn, setPaidOn] = useState(fund?.paidOn ?? today());
  const [reference, setReference] = useState(fund?.reference ?? "");
  const [note, setNote] = useState(fund?.note ?? "");
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [pending, startTransition] = useTransition();
  const accById = new Map(data.accounts.map((a) => [a.id, a]));
  const rows = credits.filter((c) => c.accountId && /^\d+(\.\d+)?$/.test(c.amount)).map((c) => ({ amount: c.amount, currency: accById.get(c.accountId)?.currency ?? "BDT" }));
  const bdtCredited = rows.filter((r) => r.currency === "BDT").reduce((s, r) => s + Number(r.amount), 0);
  const usdCredited = rows.filter((r) => r.currency !== "BDT").reduce((s, r) => s + Number(r.amount), 0);
  const hasUsd = credits.some((c) => accById.get(c.accountId)?.currency && accById.get(c.accountId)!.currency !== "BDT");
  const bill = fundBill({ credits: rows, feeBdt: feeBdt || "0", usdRate: usdRate || null });

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
      const r = await saveFundAction({ fundId: fund?.id ?? null, providerId, receivedOn, credits, feeBdt, usdRate, paid, paidOn: paid ? paidOn : null, reference, note });
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

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{fund ? `Edit ad fund #${fund.number}` : "Record Ad Fund"}</DialogTitle>
          <DialogDescription>What the provider loaded into our ad accounts, their bill, and whether it&apos;s paid.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="fd-prov" label="Provider *" error={errors.providerId?.[0]}>
              {newProvider !== null ? (
                <div className="flex gap-2">
                  <Input aria-label="New provider name" value={newProvider} onChange={(e) => setNewProvider(e.target.value)} autoFocus placeholder="Name" />
                  <Button type="button" onClick={addProvider} disabled={pending}>
                    Add
                  </Button>
                </div>
              ) : (
                <Select value={providerId} onValueChange={(id) => (id === NEW_PROVIDER ? setNewProvider("") : setProviderId(id))}>
                  <SelectTrigger id="fd-prov">
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
            <Field id="fd-date" label="Fund receive date *" error={errors.receivedOn?.[0]}>
              <Input {...fieldA11y("fd-date", errors.receivedOn?.[0])} type="date" value={receivedOn} onChange={(e) => setReceivedOn(e.target.value)} className="num" />
            </Field>
          </div>

          <fieldset className="grid gap-2">
            <legend className="mb-1 text-meta text-slate-700">Credited accounts *</legend>
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
                  <Button type="button" variant="ghost" size="icon" aria-label="Remove account" disabled={credits.length === 1} onClick={() => setCredits(credits.filter((_, j) => j !== i))}>
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

          <section aria-labelledby="fd-bill-h" className="grid gap-3 rounded-panel bg-slate-50 p-3 ring-1 ring-slate-200 ring-inset">
            <h3 id="fd-bill-h" className="text-section text-slate-900">
              Provider bill
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field id="fd-fee" label="Fee on BDT accounts (৳)" hint={bdtCredited ? `${formatBdt(bdtCredited)} credited + fee` : undefined} error={errors.feeBdt?.[0]}>
                <Input {...fieldA11y("fd-fee", errors.feeBdt?.[0], Boolean(bdtCredited))} value={feeBdt} onChange={(e) => setFeeBdt(numeric(e.target.value))} inputMode="decimal" className="num bg-white" placeholder="0" />
              </Field>
              {hasUsd ? (
                <Field id="fd-rate" label="USD rate (৳ per $1) *" hint={usdCredited ? `$${usdCredited.toLocaleString("en-US")} × rate` : undefined} error={errors.usdRate?.[0]}>
                  <Input {...fieldA11y("fd-rate", errors.usdRate?.[0], Boolean(usdCredited))} value={usdRate} onChange={(e) => setUsdRate(numeric(e.target.value))} inputMode="decimal" className="num bg-white" placeholder="e.g. 128.50" />
                </Field>
              ) : null}
            </div>
            <p className="flex items-baseline justify-between gap-2 border-t border-slate-200 pt-2 text-body text-slate-700">
              Bill total <span className="num text-section text-slate-900">{formatBdt(bill)}</span>
            </p>
          </section>

          <fieldset className="grid gap-2">
            <legend className="mb-1 text-meta text-slate-700">Is it paid?</legend>
            <div className="flex flex-wrap items-center gap-2">
              <div role="radiogroup" aria-label="Is it paid?" className="inline-flex rounded-control bg-slate-900/[0.05] p-0.5">
                {(
                  [
                    [true, "Yes"],
                    [false, "No"],
                  ] as const
                ).map(([v, label]) => (
                  <button
                    key={label}
                    type="button"
                    role="radio"
                    aria-checked={paid === v}
                    onClick={() => setPaid(v)}
                    className={cn(
                      "cursor-pointer rounded-[8px] px-4 py-1.5 text-body transition-colors",
                      paid === v ? (v ? "bg-emerald-600 text-white shadow-sm" : "bg-white text-slate-900 shadow-sm") : "text-slate-600 hover:text-slate-900",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {paid ? (
                <label className="flex items-center gap-2 text-meta text-slate-700">
                  Paid on
                  <Input type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} className="num h-9 w-44" aria-label="Paid on" />
                </label>
              ) : null}
            </div>
          </fieldset>

          <div className="grid gap-3 sm:grid-cols-[1fr_1.4fr]">
            <Field id="fd-ref" label="Reference">
              <Input id="fd-ref" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Transaction ID, bKash ref…" />
            </Field>
            <Field id="fd-note" label="Note">
              <Textarea id="fd-note" value={note} onChange={(e) => setNote(e.target.value)} rows={1} placeholder="Optional" />
            </Field>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          {fund ? (
            <Button
              variant="ghost"
              className="text-rose-700 hover:bg-rose-50 hover:text-rose-800"
              disabled={pending}
              onClick={() => {
                if (!window.confirm(`Delete ad fund #${fund.number}?`)) return;
                startTransition(async () => {
                  const r = await deleteFundAction({ id: fund.id });
                  if (r.ok) {
                    toast.success(r.message);
                    onClose();
                    router.refresh();
                  } else toast.error(r.error);
                });
              }}
            >
              <Trash2Icon /> Delete
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={save} disabled={pending || !providerId || credits.some((c) => !c.accountId || !c.amount) || (hasUsd && !usdRate)}>
              <SaveIcon /> {fund ? "Save" : "Record Ad Fund"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
