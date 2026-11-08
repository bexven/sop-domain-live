"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon, CircleDollarSignIcon, PencilIcon, PlusIcon, ReceiptIcon, SaveIcon, ScaleIcon, WalletIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { Field } from "@/components/common/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CURRENCIES, shiftMonth } from "@/lib/domain/ad-budget";
import { formatBdt, formatDate, formatUsd } from "@/lib/format";
import { addProviderAction, saveAccountAction, setFundPaidAction } from "@/lib/server/actions/ad-budget";
import type { AdBudget } from "@/lib/server/queries/ad-budget";
import { cn } from "@/lib/utils";
import { FundDialog } from "./fund-dialog";

export type Tab = "overview" | "spend" | "accounts";

export function money(amount: string | number, currency: string): string {
  if (currency === "BDT") return formatBdt(amount);
  if (currency === "USD") return formatUsd(amount);
  return `${currency} ${Number(amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
const d = (day: string) => formatDate(new Date(`${day}T00:00:00Z`));
const monthLabel = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

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
        {tab === "overview" ? <MonthSwitcher month={data.month} onChange={(m) => go(tab, m)} /> : null}
      </div>
      {tab === "overview" ? <Overview data={data} canManage={canManage} /> : null}
      {tab === "spend" ? <Spend data={data} /> : null}
      {tab === "accounts" ? <Accounts data={data} canManage={canManage} /> : null}
    </div>
  );
}

/** ‹ November 2026 › — clear on every screen (the browser's month field hid its calendar icon). */
function MonthSwitcher({ month, onChange }: { month: string; onChange: (m: string) => void }) {
  return (
    <div className="surface inline-flex items-center gap-1 rounded-control p-1" role="group" aria-label="Month">
      <Button variant="ghost" size="icon-sm" aria-label="Previous month" onClick={() => onChange(shiftMonth(month, -1))}>
        <ChevronLeftIcon />
      </Button>
      <span className="min-w-36 text-center text-body font-medium text-slate-900">{monthLabel(month)}</span>
      <Button variant="ghost" size="icon-sm" aria-label="Next month" onClick={() => onChange(shiftMonth(month, 1))}>
        <ChevronRightIcon />
      </Button>
    </div>
  );
}

function Tile({ icon: Icon, label, value, sub, tone = "text-slate-500", alert }: { icon: typeof WalletIcon; label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: string; alert?: boolean }) {
  return (
    <div className={cn("surface rounded-panel p-4", alert && "ring-1 ring-rose-200")}>
      <p className="flex items-center gap-2 text-meta text-slate-600">
        <Icon className={cn("size-4", tone)} aria-hidden /> {label}
      </p>
      <div className={cn("num mt-1.5 text-[24px] leading-tight font-semibold tracking-tight", alert ? "text-rose-700" : "text-slate-900")}>{value}</div>
      {sub ? <div className="mt-1 text-meta font-normal text-slate-600">{sub}</div> : null}
    </div>
  );
}

function Overview({ data, canManage }: { data: AdBudget; canManage: boolean }) {
  const o = data.overview;
  const [editing, setEditing] = useState<AdBudget["funds"][number] | "new" | null>(null);
  const funds = data.funds.filter((f) => f.receivedOn.slice(0, 7) === data.month);
  return (
    <>
      <section aria-label="This month" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile icon={ReceiptIcon} tone="text-indigo-600" label="Ad fund cost this month" value={formatBdt(o.monthCostBdt)} sub={Number(o.monthFeeBdt) ? `incl. ${formatBdt(o.monthFeeBdt)} fee` : monthLabel(data.month)} />
        <Tile
          icon={ScaleIcon}
          tone={o.settled ? "text-emerald-600" : "text-rose-600"}
          label="Provider balance"
          alert={!o.settled}
          value={o.settled ? "Settled" : formatBdt(o.owedBdt)}
          sub={o.settled ? "Every bill is paid" : `We owe the provider · ${o.unpaidCount} unpaid bill${o.unpaidCount === 1 ? "" : "s"}`}
        />
        <Tile icon={WalletIcon} tone="text-emerald-600" label="Received · BDT accounts" value={formatBdt(o.monthReceivedByCurrency.BDT ?? 0)} sub={monthLabel(data.month)} />
        <Tile icon={WalletIcon} tone="text-sky-600" label="Received · USD accounts" value={formatUsd(o.monthReceivedByCurrency.USD ?? 0)} sub={monthLabel(data.month)} />
      </section>

      <section aria-labelledby="funds-h" className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="funds-h" className="text-section text-slate-900">
            Ad funds · {monthLabel(data.month)} <span className="num text-meta text-slate-500">{funds.length}</span>
          </h2>
          {canManage ? (
            <Button onClick={() => setEditing("new")} disabled={data.accounts.length === 0}>
              <PlusIcon /> Record Ad Fund
            </Button>
          ) : null}
        </div>
        {data.accounts.length === 0 && canManage ? <p className="text-meta font-normal text-slate-500">Add your ad accounts first (Accounts tab).</p> : null}
        {funds.length === 0 ? (
          <p className="surface rounded-panel px-4 py-6 text-center text-body text-slate-600">No ad funds recorded this month. Use “Record Ad Fund” each time the provider loads an account.</p>
        ) : (
          <ul className="grid gap-2">
            {funds.map((f) => (
              <FundRow key={f.id} f={f} provider={data.providers.find((p) => p.id === f.providerId)?.name ?? "—"} canManage={canManage} onEdit={() => setEditing(f)} />
            ))}
          </ul>
        )}
      </section>

      {data.providerBalances.length > 1 ? (
        <section aria-labelledby="prov-h" className="grid gap-2">
          <h2 id="prov-h" className="text-section text-slate-900">
            By provider
          </h2>
          <ul className="surface divide-y divide-slate-100 rounded-panel">
            {data.providerBalances.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-x-6 gap-y-1 px-4 py-3">
                <span className="min-w-40 font-medium text-slate-900">{p.name}</span>
                <span className="text-meta text-slate-600">
                  Paid <span className="num font-medium text-slate-900">{formatBdt(p.paidBdt)}</span>
                </span>
                <span className={cn("ml-auto text-meta", p.settled ? "text-emerald-700" : "text-rose-700")}>{p.settled ? "Settled" : `We owe ${formatBdt(p.owedBdt)}`}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {editing ? <FundDialog key={editing === "new" ? "new" : editing.id} data={data} fund={editing === "new" ? null : editing} onClose={() => setEditing(null)} /> : null}
    </>
  );
}

function FundRow({ f, provider, canManage, onEdit }: { f: AdBudget["funds"][number]; provider: string; canManage: boolean; onEdit: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <li className={cn("surface grid gap-2 rounded-panel p-4 ring-1 ring-inset", f.paid ? "ring-emerald-200" : "ring-rose-200")}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="num text-meta text-slate-500">#{f.number}</span>
        <span className="num text-body text-slate-700">{d(f.receivedOn)}</span>
        <span className="font-medium text-slate-900">{provider}</span>
        <span className="num text-section text-slate-900">{formatBdt(f.billBdt)}</span>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-meta ring-1 ring-inset",
            f.paid ? "bg-emerald-50 text-emerald-800 ring-emerald-200" : "bg-rose-50 text-rose-700 ring-rose-200",
          )}
        >
          <CircleDollarSignIcon className="size-3.5" aria-hidden /> {f.paid ? `Paid${f.paidOn ? ` ${d(f.paidOn)}` : ""}` : "Not paid"}
        </span>
        {canManage ? (
          <span className="ml-auto flex items-center gap-1">
            <Button
              size="sm"
              variant={f.paid ? "ghost" : "outline"}
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const r = await setFundPaidAction({ fundId: f.id, paid: !f.paid });
                  if (r.ok) {
                    toast.success(r.message);
                    router.refresh();
                  } else toast.error(r.error);
                })
              }
            >
              {f.paid ? <XIcon /> : <CheckIcon />} {f.paid ? "Mark unpaid" : "Mark paid"}
            </Button>
            <Button size="icon-sm" variant="ghost" aria-label={`Edit ad fund ${f.number}`} onClick={onEdit}>
              <PencilIcon />
            </Button>
          </span>
        ) : null}
      </div>
      <ul className="flex flex-wrap gap-1.5">
        {f.credits.map((c) => (
          <li key={c.id} className="rounded-control bg-slate-50 px-2.5 py-1 text-meta text-slate-700 ring-1 ring-slate-900/[0.04] ring-inset">
            {c.accountName}: <span className="num font-semibold text-slate-900">{money(c.amount, c.currency)}</span>
            {c.currency !== "BDT" && f.usdRate ? <span className="num text-slate-500"> × {f.usdRate} = {formatBdt(c.billBdt)}</span> : null}
          </li>
        ))}
        {Number(f.feeBdt) ? (
          <li className="rounded-control bg-slate-50 px-2.5 py-1 text-meta text-slate-700 ring-1 ring-slate-900/[0.04] ring-inset">
            Fee: <span className="num font-semibold text-slate-900">{formatBdt(f.feeBdt)}</span>
          </li>
        ) : null}
      </ul>
      {f.reference || f.note ? (
        <p className="text-meta font-normal text-slate-600">
          {f.reference ? <span className="num">Ref {f.reference}</span> : null}
          {f.reference && f.note ? " · " : ""}
          {f.note}
        </p>
      ) : null}
    </li>
  );
}

/** Ad spend = what the ad funds cost, month by month (automatic from Record Ad Fund). */
function Spend({ data }: { data: AdBudget }) {
  if (data.monthly.length === 0) {
    return <p className="surface rounded-panel px-4 py-8 text-center text-body text-slate-600">Monthly ad spend appears here automatically once ad funds are recorded on the Overview.</p>;
  }
  return (
    <ul className="grid gap-3">
      {data.monthly.map((m) => (
        <li key={m.month} className="surface grid gap-3 rounded-panel p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-section text-slate-900">{monthLabel(m.month)}</h2>
            <span className="num text-[20px] font-semibold text-slate-900">{formatBdt(m.totalBdt)}</span>
          </div>
          <div className="flex flex-wrap gap-2 text-meta">
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-800 ring-1 ring-emerald-200 ring-inset">
              Paid <span className="num">{formatBdt(m.paidBdt)}</span>
            </span>
            {Number(m.unpaidBdt) ? (
              <span className="rounded-full bg-rose-50 px-2 py-0.5 text-rose-700 ring-1 ring-rose-200 ring-inset">
                Unpaid <span className="num">{formatBdt(m.unpaidBdt)}</span>
              </span>
            ) : null}
            {Number(m.feeBdt) ? (
              <span className="rounded-full bg-slate-50 px-2 py-0.5 text-slate-700 ring-1 ring-slate-200 ring-inset">
                Fees <span className="num">{formatBdt(m.feeBdt)}</span>
              </span>
            ) : null}
            {Object.entries(m.receivedByCurrency).map(([cur, amt]) => (
              <span key={cur} className="rounded-full bg-slate-50 px-2 py-0.5 text-slate-700 ring-1 ring-slate-200 ring-inset">
                Loaded {cur} <span className="num">{money(amt, cur)}</span>
              </span>
            ))}
          </div>
          <ul className="grid gap-1 border-t border-slate-100 pt-2">
            {m.byAccount.map((a) => (
              <li key={a.accountId} className="flex items-center justify-between gap-2 text-body">
                <span className="text-slate-700">{a.name}</span>
                <span className="num font-medium text-slate-900">{formatBdt(a.billBdt)}</span>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}

function Accounts({ data, canManage }: { data: AdBudget; canManage: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [acc, setAcc] = useState({ name: "", currency: "BDT", providerId: data.providers[0]?.id ?? "" });
  const [provider, setProvider] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
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
            <AccountFields v={acc} onChange={setAcc} providers={data.providers} idPrefix="new" />
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
      {data.accounts.length === 0 ? (
        <p className="surface rounded-panel px-4 py-6 text-center text-body text-slate-600">No ad accounts yet. Add your BDT and USD ad accounts above.</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {data.accounts.map((a) =>
            editing === a.id ? (
              <AccountEditor key={a.id} account={a} providers={data.providers} onDone={() => setEditing(null)} />
            ) : (
              <li key={a.id} className={cn("surface grid content-start gap-1 rounded-panel p-4", !a.active && "bg-slate-50")}>
                <p className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-900">{a.name}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-meta text-slate-700">{a.currency}</span>
                </p>
                <p className="text-meta font-normal text-slate-600">
                  {a.providerName ?? "No provider"}
                  {a.active ? "" : " · inactive"}
                </p>
                <p className="mt-1 text-meta text-slate-600">
                  Loaded in total <span className="num text-body font-medium text-slate-900">{money(a.credited, a.currency)}</span>
                </p>
                {canManage ? (
                  <Button size="sm" variant="ghost" className="mt-1 w-fit" onClick={() => setEditing(a.id)}>
                    <PencilIcon /> Edit
                  </Button>
                ) : null}
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  );
}

type AccountValues = { name: string; currency: string; providerId: string };

function AccountFields({ v, onChange, providers, idPrefix }: { v: AccountValues; onChange: (v: AccountValues) => void; providers: AdBudget["providers"]; idPrefix: string }) {
  return (
    <div className="grid gap-3 sm:grid-cols-[1.5fr_0.8fr_1.2fr]">
      <Field id={`${idPrefix}-name`} label="Account name">
        <Input id={`${idPrefix}-name`} value={v.name} onChange={(e) => onChange({ ...v, name: e.target.value })} placeholder="e.g. Timtom USD 1" />
      </Field>
      <Field id={`${idPrefix}-cur`} label="Currency">
        <Select value={v.currency} onValueChange={(c) => onChange({ ...v, currency: c })}>
          <SelectTrigger id={`${idPrefix}-cur`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[...new Set([...CURRENCIES, v.currency])].map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field id={`${idPrefix}-prov`} label="Provider">
        <Select value={v.providerId || "none"} onValueChange={(id) => onChange({ ...v, providerId: id === "none" ? "" : id })}>
          <SelectTrigger id={`${idPrefix}-prov`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Not set</SelectItem>
            {providers.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    </div>
  );
}

function AccountEditor({ account, providers, onDone }: { account: AdBudget["accounts"][number]; providers: AdBudget["providers"]; onDone: () => void }) {
  const router = useRouter();
  const [v, setV] = useState<AccountValues>({ name: account.name, currency: account.currency, providerId: account.providerId ?? "" });
  const [active, setActive] = useState(account.active);
  const [pending, startTransition] = useTransition();
  return (
    <li className="surface grid gap-3 rounded-panel p-4 ring-2 ring-indigo-200 sm:col-span-2 lg:col-span-3">
      <AccountFields v={v} onChange={setV} providers={providers} idPrefix={`ed-${account.id}`} />
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex cursor-pointer items-center gap-2 text-body text-slate-800">
          <input type="checkbox" className="size-4 accent-indigo-600" checked={active} onChange={(e) => setActive(e.target.checked)} /> Active
        </label>
        <span className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={onDone} disabled={pending}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={pending || v.name.trim().length < 2}
            onClick={() =>
              startTransition(async () => {
                const r = await saveAccountAction({ accountId: account.id, name: v.name, currency: v.currency, providerId: v.providerId || null, active });
                if (r.ok) {
                  toast.success(r.message ?? "Saved");
                  onDone();
                  router.refresh();
                } else toast.error(r.error);
              })
            }
          >
            <SaveIcon /> Save
          </Button>
        </span>
      </div>
    </li>
  );
}
