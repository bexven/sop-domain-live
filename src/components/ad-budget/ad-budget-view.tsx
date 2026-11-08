"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BanknoteIcon, PencilIcon, PlusIcon, ReceiptIcon, ScaleIcon, Trash2Icon, WalletIcon } from "lucide-react";
import { toast } from "sonner";
import { Field } from "@/components/common/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { balanceStatus, CURRENCIES, type BalanceStatus } from "@/lib/domain/ad-budget";
import { formatBdt, formatDate, formatUsd } from "@/lib/format";
import { addProviderAction, deletePaymentAction, deleteSpendAction, saveAccountAction, saveSpendAction } from "@/lib/server/actions/ad-budget";
import type { AdBudget } from "@/lib/server/queries/ad-budget";
import { cn } from "@/lib/utils";
import { PaymentDialog } from "./payment-dialog";

export type Tab = "overview" | "payments" | "spend" | "accounts";

export function money(amount: string | number, currency: string): string {
  if (currency === "BDT") return formatBdt(amount);
  if (currency === "USD") return formatUsd(amount);
  return `${currency} ${Number(amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
const d = (day: string) => formatDate(new Date(`${day}T00:00:00Z`));
const monthLabel = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

const STATUS: Record<BalanceStatus, { label: string; cls: string }> = {
  settled: { label: "Fully settled", cls: "bg-emerald-50 text-emerald-800 ring-emerald-200" },
  we_owe: { label: "We owe the provider", cls: "bg-rose-50 text-rose-700 ring-rose-200" },
  provider_owes: { label: "Provider owes us", cls: "bg-amber-50 text-amber-800 ring-amber-200" },
};

function StatusPill({ difference }: { difference: string }) {
  const s = balanceStatus(difference);
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-meta ring-1 ring-inset", STATUS[s].cls)}>
      {STATUS[s].label}
      {s !== "settled" ? <span className="num">· {formatBdt(Math.abs(Number(difference)))}</span> : null}
    </span>
  );
}

export function AdBudgetView({ data, tab, canManage }: { data: AdBudget; tab: Tab; canManage: boolean }) {
  const router = useRouter();
  const go = (t: Tab, month = data.month) => router.push(`/ad-budget?tab=${t}&month=${month}`, { scroll: false });
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Ad budget" className="no-scrollbar relative flex max-w-full gap-1 overflow-x-auto rounded-control bg-slate-900/[0.04] p-1">
          {(
            [
              ["overview", "Overview"],
              ["payments", "Payments"],
              ["spend", "Ad spend"],
              ["accounts", "Accounts"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              role="tab"
              aria-selected={tab === k}
              onClick={() => go(k)}
              className={cn(
                "cursor-pointer rounded-[8px] px-3.5 py-1.5 text-body whitespace-nowrap transition-colors duration-150",
                tab === k ? "bg-white font-medium text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {tab === "overview" || tab === "spend" ? (
          <label className="flex items-center gap-2 text-meta text-slate-700">
            Month
            <Input type="month" value={data.month} onChange={(e) => e.target.value && go(tab, e.target.value)} className="num h-9 w-40" />
          </label>
        ) : null}
      </div>
      {tab === "overview" ? <Overview data={data} /> : null}
      {tab === "payments" ? <Payments data={data} canManage={canManage} /> : null}
      {tab === "spend" ? <Spend data={data} canManage={canManage} /> : null}
      {tab === "accounts" ? <Accounts data={data} canManage={canManage} /> : null}
    </div>
  );
}

function Tile({ icon: Icon, label, value, sub, tone = "text-slate-500" }: { icon: typeof WalletIcon; label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: string }) {
  return (
    <div className="surface rounded-panel p-4">
      <p className="flex items-center gap-2 text-meta text-slate-600">
        <Icon className={cn("size-4", tone)} aria-hidden /> {label}
      </p>
      <div className="num mt-1.5 text-[22px] leading-tight font-semibold tracking-tight text-slate-900">{value}</div>
      {sub ? <div className="mt-1 text-meta font-normal text-slate-600">{sub}</div> : null}
    </div>
  );
}

function Overview({ data }: { data: AdBudget }) {
  const o = data.overview;
  const otherCurrencies = Object.keys(o.creditedByCurrency).filter((c) => c !== "BDT" && c !== "USD");
  return (
    <>
      <section aria-label="Totals" className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <Tile icon={BanknoteIcon} tone="text-indigo-600" label="Paid to provider" value={formatBdt(o.paidBdt)} />
        <Tile icon={WalletIcon} tone="text-emerald-600" label="Received · BDT accounts" value={formatBdt(o.creditedByCurrency.BDT ?? 0)} />
        <Tile icon={WalletIcon} tone="text-sky-600" label="Received · USD accounts" value={formatUsd(o.creditedByCurrency.USD ?? 0)} sub={otherCurrencies.map((c) => money(o.creditedByCurrency[c]!, c)).join(" · ") || undefined} />
        <Tile icon={ScaleIcon} tone="text-amber-600" label="Provider balance" value={formatBdt(Math.abs(Number(o.difference)))} sub={<StatusPill difference={o.difference} />} />
        <Tile icon={ReceiptIcon} tone="text-rose-600" label={`Spend · ${monthLabel(data.month)}`} value={formatBdt(o.monthByCurrency.BDT ?? 0)} sub={`${formatUsd(o.monthByCurrency.USD ?? 0)} in USD accounts`} />
        <Tile icon={ReceiptIcon} tone="text-slate-500" label="Ad accounts" value={String(data.accounts.filter((a) => a.active).length)} sub={`${data.providers.length} provider${data.providers.length === 1 ? "" : "s"}`} />
      </section>

      {data.providerBalances.length ? (
        <section aria-labelledby="prov-h" className="grid gap-2">
          <h2 id="prov-h" className="text-section text-slate-900">
            Provider balances
          </h2>
          <ul className="surface divide-y divide-slate-100 rounded-panel">
            {data.providerBalances.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-x-6 gap-y-1 px-4 py-3">
                <span className="min-w-40 font-medium text-slate-900">{p.name}</span>
                <span className="text-meta text-slate-600">
                  Paid <span className="num font-medium text-slate-900">{formatBdt(p.paidBdt)}</span>
                </span>
                <span className="text-meta text-slate-600">
                  Credited (BDT value) <span className="num font-medium text-slate-900">{formatBdt(p.creditedBdt)}</span>
                </span>
                <span className="ml-auto">
                  <StatusPill difference={p.difference} />
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="acc-h" className="grid gap-2">
        <h2 id="acc-h" className="text-section text-slate-900">
          Accounts · {monthLabel(data.month)}
        </h2>
        {data.accounts.length === 0 ? (
          <p className="surface rounded-panel px-4 py-6 text-center text-body text-slate-600">No ad accounts yet. Add them on the Accounts tab.</p>
        ) : (
          <div className="surface relative overflow-x-auto rounded-panel">
            <table className="w-full min-w-[40rem] text-left text-body">
              <thead className="border-b border-slate-100 text-meta text-slate-500">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Account</th>
                  <th className="px-3 py-2.5 text-right font-medium">Spent this month</th>
                  <th className="px-3 py-2.5 text-right font-medium">Total credited</th>
                  <th className="px-3 py-2.5 text-right font-medium">Total spent</th>
                  <th className="px-4 py-2.5 text-right font-medium">Left in account</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.accounts.map((a) => (
                  <tr key={a.id}>
                    <td className="px-4 py-2.5">
                      <span className="font-medium text-slate-900">{a.name}</span> <span className="text-meta text-slate-500">{a.currency}</span>
                    </td>
                    <td className="num px-3 py-2.5 text-right font-medium">{money(a.monthSpent, a.currency)}</td>
                    <td className="num px-3 py-2.5 text-right">{money(a.credited, a.currency)}</td>
                    <td className="num px-3 py-2.5 text-right">{money(a.spent, a.currency)}</td>
                    <td className={cn("num px-4 py-2.5 text-right", Number(a.remaining) < 0 && "text-rose-700")}>{money(a.remaining, a.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

function Payments({ data, canManage }: { data: AdBudget; canManage: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState<AdBudget["payments"][number] | "new" | null>(null);
  const [pending, startTransition] = useTransition();
  const providerName = (id: string) => data.providers.find((p) => p.id === id)?.name ?? "—";
  return (
    <section className="grid gap-3" aria-label="Payments">
      {canManage ? (
        <div>
          <Button onClick={() => setEditing("new")} disabled={data.accounts.length === 0}>
            <PlusIcon /> Record payment
          </Button>
          {data.accounts.length === 0 ? <p className="mt-1 text-meta font-normal text-slate-500">Add an ad account first (Accounts tab).</p> : null}
        </div>
      ) : null}
      {data.payments.length === 0 ? (
        <p className="surface rounded-panel px-4 py-6 text-center text-body text-slate-600">No payments yet. Record each payment to the provider and which ad accounts it loaded.</p>
      ) : (
        <ul className="grid gap-2">
          {data.payments.map((p) => (
            <li key={p.id} className="surface grid gap-2 rounded-panel p-4">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="num text-meta text-slate-500">#{p.number}</span>
                <span className="num text-body text-slate-700">{d(p.paidOn)}</span>
                <span className="font-medium text-slate-900">{providerName(p.providerId)}</span>
                <span className="num text-section text-slate-900">{formatBdt(p.amountBdt)}</span>
                <span className="ml-auto flex items-center gap-1">
                  <StatusPill difference={p.difference} />
                  {canManage ? (
                    <>
                      <Button size="icon-sm" variant="ghost" aria-label={`Edit payment ${p.number}`} onClick={() => setEditing(p)}>
                        <PencilIcon />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Delete payment ${p.number}`}
                        disabled={pending}
                        onClick={() => {
                          if (!window.confirm(`Delete payment #${p.number}?`)) return;
                          startTransition(async () => {
                            const r = await deletePaymentAction({ id: p.id });
                            if (r.ok) {
                              toast.success(r.message);
                              router.refresh();
                            } else toast.error(r.error);
                          });
                        }}
                      >
                        <Trash2Icon />
                      </Button>
                    </>
                  ) : null}
                </span>
              </div>
              <ul className="flex flex-wrap gap-1.5">
                {p.credits.map((c) => (
                  <li key={c.id} className="rounded-control bg-slate-50 px-2.5 py-1 text-meta text-slate-700 ring-1 ring-slate-900/[0.04] ring-inset">
                    {c.accountName}: <span className="num font-semibold text-slate-900">{money(c.amount, c.currency)}</span>
                    {c.currency !== "BDT" ? <span className="num text-slate-500"> @ {c.rateToBdt} = {formatBdt(c.valueBdt)}</span> : null}
                  </li>
                ))}
              </ul>
              {p.reference ? <p className="text-meta font-normal text-slate-600">{p.reference}</p> : null}
            </li>
          ))}
        </ul>
      )}
      {editing ? <PaymentDialog key={editing === "new" ? "new" : editing.id} data={data} payment={editing === "new" ? null : editing} onClose={() => setEditing(null)} /> : null}
    </section>
  );
}

function Spend({ data, canManage }: { data: AdBudget; canManage: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const active = data.accounts.filter((a) => a.active);
  const [v, setV] = useState({ accountId: active[0]?.id ?? "", spentOn: new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(new Date()), amount: "", note: "" });
  const acc = data.accounts.find((a) => a.id === v.accountId);
  const run = (fn: () => Promise<{ ok: boolean; message?: string; error?: string }>, after?: () => void) =>
    startTransition(async () => {
      const r = await fn();
      if (r.ok) {
        toast.success(r.message ?? "Saved");
        after?.();
        router.refresh();
      } else toast.error(r.error);
    });
  return (
    <div className="grid gap-5">
      {canManage && active.length ? (
        <section aria-label="Add spend" className="surface grid gap-3 rounded-panel p-4 sm:grid-cols-[1.4fr_1fr_1fr_1.6fr_auto] sm:items-end">
          <Field id="sp-acc" label="Ad account">
            <Select value={v.accountId} onValueChange={(id) => setV({ ...v, accountId: id })}>
              <SelectTrigger id="sp-acc">
                <SelectValue placeholder="Choose" />
              </SelectTrigger>
              <SelectContent>
                {active.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name} · {a.currency}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field id="sp-date" label="Date">
            <Input id="sp-date" type="date" value={v.spentOn} onChange={(e) => setV({ ...v, spentOn: e.target.value })} className="num" />
          </Field>
          <Field id="sp-amt" label={`Spend${acc ? ` (${acc.currency})` : ""}`}>
            <Input id="sp-amt" value={v.amount} onChange={(e) => setV({ ...v, amount: e.target.value.replace(/[^\d.]/g, "") })} inputMode="decimal" className="num" placeholder="0" />
          </Field>
          <Field id="sp-note" label="Note">
            <Input id="sp-note" value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} placeholder="Optional" />
          </Field>
          <Button disabled={pending || !v.accountId || !v.amount} onClick={() => run(() => saveSpendAction(v), () => setV({ ...v, amount: "", note: "" }))}>
            <PlusIcon /> Add
          </Button>
        </section>
      ) : null}

      <section aria-labelledby="spend-h" className="grid gap-2">
        <h2 id="spend-h" className="text-section text-slate-900">
          {monthLabel(data.month)} <span className="num text-meta text-slate-500">{data.monthSpends.length} entries</span>
        </h2>
        {data.monthSpends.length === 0 ? (
          <p className="surface rounded-panel px-4 py-6 text-center text-body text-slate-600">No spend recorded for this month yet.</p>
        ) : (
          <ul className="surface divide-y divide-slate-100 rounded-panel">
            {data.monthSpends.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5">
                <span className="num text-meta text-slate-600">{d(s.spentOn)}</span>
                <span className="font-medium text-slate-900">{s.accountName}</span>
                {s.note ? <span className="text-meta font-normal text-slate-500">{s.note}</span> : null}
                <span className="num ml-auto font-semibold text-slate-900">{money(s.amount, s.currency)}</span>
                {canManage ? (
                  <Button size="icon-sm" variant="ghost" aria-label="Delete entry" disabled={pending} onClick={() => window.confirm("Delete this spend entry?") && run(() => deleteSpendAction({ id: s.id }))}>
                    <Trash2Icon />
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="monthly-h" className="grid gap-2">
        <h2 id="monthly-h" className="text-section text-slate-900">
          Monthly totals
        </h2>
        {data.monthly.length === 0 ? (
          <p className="text-meta font-normal text-slate-500">Monthly totals appear once spend is recorded.</p>
        ) : (
          <ul className="surface divide-y divide-slate-100 rounded-panel">
            {data.monthly.map((m) => (
              <li key={m.month} className="flex flex-wrap items-center gap-x-6 gap-y-1 px-4 py-2.5">
                <span className="min-w-36 font-medium text-slate-900">{monthLabel(m.month)}</span>
                {Object.entries(m.byCurrency).map(([cur, amt]) => (
                  <span key={cur} className="num text-body text-slate-800">
                    {money(amt, cur)}
                  </span>
                ))}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Accounts({ data, canManage }: { data: AdBudget; canManage: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [acc, setAcc] = useState({ name: "", currency: "BDT", providerId: data.providers[0]?.id ?? "" });
  const [provider, setProvider] = useState("");
  const run = (fn: () => Promise<{ ok: boolean; message?: string; error?: string }>, after?: () => void) =>
    startTransition(async () => {
      const r = await fn();
      if (r.ok) {
        toast.success(r.message ?? "Saved");
        after?.();
        router.refresh();
      } else toast.error(r.error);
    });
  return (
    <div className="grid gap-5">
      {canManage ? (
        <div className="grid gap-3 lg:grid-cols-2">
          <section aria-label="Add ad account" className="surface grid gap-3 rounded-panel p-4">
            <h2 className="text-section text-slate-900">Add ad account</h2>
            <div className="grid gap-3 sm:grid-cols-[1.5fr_0.8fr_1.2fr]">
              <Field id="ac-name" label="Account name">
                <Input id="ac-name" value={acc.name} onChange={(e) => setAcc({ ...acc, name: e.target.value })} placeholder="e.g. Timtom USD 1" />
              </Field>
              <Field id="ac-cur" label="Currency">
                <Select value={acc.currency} onValueChange={(c) => setAcc({ ...acc, currency: c })}>
                  <SelectTrigger id="ac-cur">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field id="ac-prov" label="Provider">
                <Select value={acc.providerId || "none"} onValueChange={(id) => setAcc({ ...acc, providerId: id === "none" ? "" : id })}>
                  <SelectTrigger id="ac-prov">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not set</SelectItem>
                    {data.providers.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Button className="w-fit" disabled={pending || acc.name.trim().length < 2} onClick={() => run(() => saveAccountAction({ ...acc, providerId: acc.providerId || null }), () => setAcc({ ...acc, name: "" }))}>
              <PlusIcon /> Add account
            </Button>
          </section>
          <section aria-label="Add provider" className="surface grid content-start gap-3 rounded-panel p-4">
            <h2 className="text-section text-slate-900">Add fund provider</h2>
            <div className="flex gap-2">
              <Input aria-label="Provider name" value={provider} onChange={(e) => setProvider(e.target.value)} placeholder="Third-party provider name" />
              <Button disabled={pending || provider.trim().length < 2} onClick={() => run(() => addProviderAction({ name: provider }), () => setProvider(""))}>
                <PlusIcon /> Add
              </Button>
            </div>
            {data.providers.length ? <p className="text-meta font-normal text-slate-600">{data.providers.map((p) => p.name).join(" · ")}</p> : null}
          </section>
        </div>
      ) : null}
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {data.accounts.map((a) => (
          <li key={a.id} className={cn("surface grid gap-1 rounded-panel p-4", !a.active && "bg-slate-50")}>
            <p className="flex items-center justify-between gap-2">
              <span className="font-semibold text-slate-900">{a.name}</span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-meta text-slate-700">{a.currency}</span>
            </p>
            <p className="text-meta font-normal text-slate-600">{a.providerName ?? "No provider"}{a.active ? "" : " · inactive"}</p>
            <dl className="mt-1 grid grid-cols-3 gap-2 text-meta">
              {[
                ["Credited", a.credited],
                ["Spent", a.spent],
                ["Left", a.remaining],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-slate-500">{k}</dt>
                  <dd className="num text-body font-medium text-slate-900">{money(v, a.currency)}</dd>
                </div>
              ))}
            </dl>
            {canManage ? (
              <Button
                size="sm"
                variant="ghost"
                className="mt-1 w-fit"
                disabled={pending}
                onClick={() => run(() => saveAccountAction({ accountId: a.id, name: a.name, currency: a.currency, providerId: a.providerId, active: !a.active }))}
              >
                {a.active ? "Mark inactive" : "Mark active"}
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
