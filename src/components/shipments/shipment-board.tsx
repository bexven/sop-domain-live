"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckIcon, CircleDollarSignIcon, PackageCheckIcon, PencilIcon, PlusIcon, RepeatIcon, SearchIcon, TruckIcon, WarehouseIcon } from "lucide-react";
import { toast } from "sonner";
import { BrandPill } from "@/components/common/pills";
import { Thumbnail } from "@/components/common/thumbnail";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { matchesFilter, SHIPMENT_STATE_LABELS, shipmentRef, shipmentState, shipmentTotals, type ShipmentFilter, type ShipmentState } from "@/lib/domain/shipments";
import { formatBdt, formatDate } from "@/lib/format";
import { setShipmentFlagAction } from "@/lib/server/actions/shipments";
import type { ShipmentBoard as Board, ShipmentDTO } from "@/lib/server/queries/shipments";
import { cn } from "@/lib/utils";
import { ShipmentDialog, type DialogMode } from "./shipment-dialog";

function todayDhaka() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(new Date());
}
const d = (day: string) => formatDate(new Date(`${day}T00:00:00Z`));

const STATE_PILL: Record<ShipmentState, string> = {
  arrived: "bg-emerald-600 text-white ring-emerald-600",
  late: "bg-rose-50 text-rose-700 ring-rose-200",
  in_transit: "bg-sky-50 text-sky-800 ring-sky-200",
  ordered: "bg-slate-50 text-slate-700 ring-slate-200",
};

export function ShipmentBoard({ board, canManage }: { board: Board; canManage: boolean }) {
  const [filter, setFilter] = useState<ShipmentFilter>("incoming");
  const [q, setQ] = useState("");
  const [dialog, setDialog] = useState<DialogMode | null>(null);
  const today = todayDhaka();
  const totals = shipmentTotals(board.shipments, today);
  const counts: Record<ShipmentFilter, number> = {
    incoming: board.shipments.filter((s) => matchesFilter(s, "incoming")).length,
    unpaid: board.shipments.filter((s) => matchesFilter(s, "unpaid")).length,
    arrived: board.shipments.filter((s) => matchesFilter(s, "arrived")).length,
    all: board.shipments.length,
  };
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return board.shipments.filter(
      (s) =>
        matchesFilter(s, filter) &&
        (!needle || `${shipmentRef(s.number)} ${s.product.name} ${s.product.ref} ${s.vendor?.name ?? ""} ${s.orderedBy}`.toLowerCase().includes(needle)),
    );
  }, [board.shipments, filter, q]);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <section aria-label="Shipment totals" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile icon={TruckIcon} tone="text-sky-600" label="On the way" value={String(totals.incoming)} sub={totals.late ? `${totals.late} late` : undefined} subTone="text-rose-700" />
        <Tile icon={CircleDollarSignIcon} tone="text-amber-600" label="Shipping unpaid" value={formatBdt(totals.unpaidCostBdt)} sub={`${totals.unpaid} shipment${totals.unpaid === 1 ? "" : "s"}`} />
        <Tile icon={WarehouseIcon} tone="text-emerald-600" label="Arrived" value={String(totals.arrived)} />
        <Tile icon={PackageCheckIcon} tone="text-slate-500" label="All shipments" value={String(board.shipments.length)} />
      </section>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div role="radiogroup" aria-label="Show" className="no-scrollbar relative flex max-w-full gap-1 overflow-x-auto">
            {(
              [
                ["incoming", "On the way"],
                ["unpaid", "Payment pending"],
                ["arrived", "Arrived"],
                ["all", "All"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={filter === k}
                onClick={() => setFilter(k)}
                className={cn(
                  "inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-meta whitespace-nowrap ring-1 transition-colors ring-inset focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  filter === k ? "bg-slate-900 text-white ring-slate-900" : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50",
                )}
              >
                {label} <span className="num">{counts[k]}</span>
              </button>
            ))}
          </div>
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search product, vendor…" aria-label="Search shipments" className="h-9 w-56 pl-8" />
          </div>
        </div>
        {canManage ? (
          <Button onClick={() => setDialog({ kind: "new" })}>
            <PlusIcon /> New shipment
          </Button>
        ) : null}
      </div>

      {shown.length === 0 ? (
        <p className="surface rounded-panel px-4 py-8 text-center text-body text-slate-600">
          {board.shipments.length === 0
            ? "No shipments yet. Add one for each purchase on its way. Orders added on a product page show up here automatically."
            : "Nothing matches this filter."}
        </p>
      ) : (
        <ul className="grid gap-3">
          {shown.map((s) => (
            <ShipmentCard key={s.id} s={s} today={today} canManage={canManage} onEdit={() => setDialog({ kind: "edit", shipment: s })} onReorder={() => setDialog({ kind: "reorder", shipment: s })} />
          ))}
        </ul>
      )}

      {dialog ? <ShipmentDialog key={dialog.kind + (dialog.kind === "new" ? "" : dialog.shipment.id)} mode={dialog} board={board} onClose={() => setDialog(null)} /> : null}
    </div>
  );
}

function Tile({ icon: Icon, tone, label, value, sub, subTone }: { icon: typeof TruckIcon; tone: string; label: string; value: string; sub?: string; subTone?: string }) {
  return (
    <div className="surface rounded-panel p-4">
      <p className="flex items-center gap-2 text-meta text-slate-600">
        <Icon className={cn("size-4", tone)} aria-hidden /> {label}
      </p>
      <p className="num mt-1.5 text-[22px] leading-none font-semibold tracking-tight text-slate-900">{value}</p>
      {sub ? <p className={cn("mt-1 text-meta font-normal text-slate-500", subTone)}>{sub}</p> : null}
    </div>
  );
}

function ShipmentCard({ s, today, canManage, onEdit, onReorder }: { s: ShipmentDTO; today: string; canManage: boolean; onEdit: () => void; onReorder: () => void }) {
  const state = shipmentState(s, today);
  return (
    <li
      className={cn(
        "grid gap-3 rounded-panel p-4 ring-1 transition-colors duration-200 ring-inset",
        s.arrived ? "bg-emerald-50 ring-emerald-300" : state === "late" ? "surface ring-rose-200" : "surface ring-slate-900/[0.04]",
      )}
    >
      <div className="flex flex-wrap items-start gap-3">
        <Thumbnail src={s.product.imageUrl} alt="" className="size-14 rounded-control" />
        <div className="min-w-0 flex-1">
          <p className="flex min-w-0 flex-wrap items-center gap-2">
            <BrandPill brand={s.product.brand} />
            <a href={`/products/${s.product.id}?phase=orders`} className="truncate text-body font-semibold text-slate-900 underline-offset-2 hover:underline">
              {s.product.name}
            </a>
            <span className="num text-meta text-slate-500">{shipmentRef(s.number)}</span>
          </p>
          <p className="mt-0.5 text-meta font-normal text-slate-600">
            {s.vendor?.name ?? "No vendor"} · ordered by {s.orderedBy} on <span className="num">{d(s.orderedOn)}</span>
            {s.productOrder ? ` · from order “${s.productOrder.name ?? `Order #${s.productOrder.number}`}”` : ""}
            {s.reorderOf ? ` · re-order of ${shipmentRef(s.reorderOf)}` : ""}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-meta ring-1 ring-inset", STATE_PILL[state])}>
              {state === "arrived" ? <CheckIcon className="size-3.5" aria-hidden /> : <TruckIcon className="size-3.5" aria-hidden />}
              {SHIPMENT_STATE_LABELS[state]}
              {state !== "arrived" && s.estimatedDeliveryOn ? <span className="num"> · ETA {d(s.estimatedDeliveryOn)}</span> : null}
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-meta ring-1 ring-inset",
                s.shippingPaid ? "bg-emerald-50 text-emerald-800 ring-emerald-200" : "bg-amber-50 text-amber-800 ring-amber-200",
              )}
            >
              <CircleDollarSignIcon className="size-3.5" aria-hidden /> {s.shippingPaid ? "Shipping paid" : "Payment pending"}
            </span>
          </div>
        </div>
        <dl className="grid grid-cols-3 gap-x-5 gap-y-1 text-right">
          {[
            ["Qty", s.quantity.toLocaleString("en-IN")],
            ["Weight", s.totalWeightKg ? `${Number(s.totalWeightKg)} kg` : "—"],
            ["Shipping", s.shippingCostBdt ? formatBdt(s.shippingCostBdt) : "—"],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-meta text-slate-500">{k}</dt>
              <dd className="num text-body font-semibold text-slate-900">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
      {s.note ? <p className="text-meta font-normal [overflow-wrap:anywhere] text-slate-600">{s.note}</p> : null}
      {canManage ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-900/[0.06] pt-3">
          <FlagButton s={s} field="shippingPaid" />
          <FlagButton s={s} field="arrived" />
          <span className="ml-auto flex gap-1">
            <Button size="sm" variant="ghost" onClick={onEdit}>
              <PencilIcon /> Edit
            </Button>
            <Button size="sm" variant="outline" onClick={onReorder}>
              <RepeatIcon /> Request reorder
            </Button>
          </span>
        </div>
      ) : null}
    </li>
  );
}

function FlagButton({ s, field }: { s: ShipmentDTO; field: "shippingPaid" | "arrived" }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const on = field === "arrived" ? s.arrived : s.shippingPaid;
  const label = field === "arrived" ? (on ? "Arrived ✓" : "Mark arrived") : on ? "Paid ✓" : "Mark shipping paid";
  return (
    <Button
      size="sm"
      variant={on ? "ghost" : field === "arrived" ? "default" : "outline"}
      className={cn(on && "text-emerald-800 hover:bg-emerald-100")}
      disabled={pending}
      aria-pressed={on}
      title={on ? "Click to undo" : undefined}
      onClick={() =>
        startTransition(async () => {
          const r = await setShipmentFlagAction({ productId: s.product.id, shipmentId: s.id, field, value: !on });
          if (r.ok) {
            toast.success(r.message);
            router.refresh();
          } else toast.error(r.error);
        })
      }
    >
      {field === "arrived" ? <WarehouseIcon /> : <CircleDollarSignIcon />} {label}
    </Button>
  );
}
