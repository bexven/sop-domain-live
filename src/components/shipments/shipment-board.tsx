"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheckIcon, CheckIcon, CircleDollarSignIcon, PackageCheckIcon, PencilIcon, PlusIcon, RepeatIcon, SearchIcon, TruckIcon, WarehouseIcon } from "lucide-react";
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

const FILTERS: [ShipmentFilter, string][] = [
  ["all", "All"],
  ["incoming", "On the way"],
  ["unpaid", "Payment pending"],
  ["arrived", "Arrived"],
];

export function ShipmentBoard({ board, canManage }: { board: Board; canManage: boolean }) {
  const [filter, setFilter] = useState<ShipmentFilter>("all");
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
  const rowProps = (s: ShipmentDTO) => ({
    s,
    today,
    canManage,
    onEdit: () => setDialog({ kind: "edit", shipment: s }),
    onReorder: () => setDialog({ kind: "reorder", shipment: s }),
  });

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <section aria-label="Shipment totals" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile
          icon={TruckIcon}
          tone="bg-sky-50 text-sky-700"
          label="On the way"
          value={String(totals.incoming)}
          sub={totals.late ? `${totals.late} late` : "None late"}
          subTone={totals.late ? "text-rose-700" : undefined}
          active={filter === "incoming"}
          onClick={() => setFilter("incoming")}
        />
        <Tile
          icon={CircleDollarSignIcon}
          tone="bg-amber-50 text-amber-700"
          label="Shipping unpaid"
          value={formatBdt(totals.unpaidCostBdt)}
          sub={`${totals.unpaid} shipment${totals.unpaid === 1 ? "" : "s"}`}
          active={filter === "unpaid"}
          onClick={() => setFilter("unpaid")}
        />
        <Tile
          icon={BadgeCheckIcon}
          tone="bg-emerald-50 text-emerald-700"
          label="Shipping paid"
          value={formatBdt(totals.paidCostBdt)}
          sub={`${totals.paid} shipment${totals.paid === 1 ? "" : "s"}`}
        />
        <Tile
          icon={PackageCheckIcon}
          tone="bg-slate-100 text-slate-700"
          label="Active Shipments"
          value={String(totals.total)}
          sub={`${totals.arrived} arrived`}
          active={filter === "all"}
          onClick={() => setFilter("all")}
        />
      </section>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div role="radiogroup" aria-label="Show" className="no-scrollbar relative flex max-w-full gap-1 overflow-x-auto">
            {FILTERS.map(([k, label]) => (
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
        <>
          <div className="surface relative hidden overflow-x-auto rounded-panel lg:block">
            <table className="w-full text-left text-body">
              <thead className="border-b border-slate-900/[0.06] bg-slate-50/70 text-meta text-slate-600">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-medium">Shipment</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Ordered</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">Qty · weight</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Shipping</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Arrival</th>
                  {canManage ? <th scope="col" className="px-4 py-2.5 text-right font-medium"><span className="sr-only">Actions</span></th> : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900/[0.06]">
                {shown.map((s) => (
                  <ShipmentRow key={s.id} {...rowProps(s)} />
                ))}
              </tbody>
            </table>
          </div>
          <ul className="grid gap-3 lg:hidden">
            {shown.map((s) => (
              <ShipmentCard key={s.id} {...rowProps(s)} />
            ))}
          </ul>
        </>
      )}

      {dialog ? <ShipmentDialog key={dialog.kind + (dialog.kind === "new" ? "" : dialog.shipment.id)} mode={dialog} board={board} onClose={() => setDialog(null)} /> : null}
    </div>
  );
}

function Tile({
  icon: Icon,
  tone,
  label,
  value,
  sub,
  subTone,
  active,
  onClick,
}: {
  icon: typeof TruckIcon;
  tone: string;
  label: string;
  value: string;
  sub?: string;
  subTone?: string;
  active?: boolean;
  onClick?: () => void;
}) {
  const body = (
    <>
      <span className="flex items-center gap-2.5 text-meta text-slate-600">
        <span className={cn("grid size-8 place-items-center rounded-control", tone)}>
          <Icon className="size-4" aria-hidden />
        </span>
        {label}
      </span>
      <span className="num mt-3 block text-[22px] leading-none font-semibold tracking-tight text-slate-900">{value}</span>
      {sub ? <span className={cn("mt-1.5 block text-meta font-normal text-slate-500", subTone)}>{sub}</span> : null}
    </>
  );
  const cls = cn("surface rounded-panel p-4 text-left ring-1 ring-inset", active ? "ring-2 ring-slate-900" : "ring-slate-900/[0.04]");
  return onClick ? (
    <button type="button" onClick={onClick} aria-pressed={active} className={cn(cls, "raised cursor-pointer transition-shadow focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none")}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  );
}

type RowProps = { s: ShipmentDTO; today: string; canManage: boolean; onEdit: () => void; onReorder: () => void };

function StatePill({ s, today }: { s: ShipmentDTO; today: string }) {
  const state = shipmentState(s, today);
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-meta whitespace-nowrap ring-1 ring-inset", STATE_PILL[state])}>
      {state === "arrived" ? <CheckIcon className="size-3.5" aria-hidden /> : <TruckIcon className="size-3.5" aria-hidden />}
      {SHIPMENT_STATE_LABELS[state]}
    </span>
  );
}

function PaidPill({ s }: { s: ShipmentDTO }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-meta whitespace-nowrap ring-1 ring-inset",
        s.shippingPaid ? "bg-emerald-50 text-emerald-800 ring-emerald-200" : "bg-amber-50 text-amber-800 ring-amber-200",
      )}
    >
      <CircleDollarSignIcon className="size-3.5" aria-hidden /> {s.shippingPaid ? "Paid" : "Payment pending"}
    </span>
  );
}

/** "Arrived 6 Nov" / "ETA 20 Nov" / "No ETA yet". */
function arrivalLine(s: ShipmentDTO) {
  if (s.arrived) return s.arrivedOn ? `Arrived ${d(s.arrivedOn)}` : "Arrived";
  return s.estimatedDeliveryOn ? `ETA ${d(s.estimatedDeliveryOn)}` : "No ETA yet";
}

function Origin({ s }: { s: ShipmentDTO }) {
  if (!s.productOrder && !s.reorderOf) return null;
  return (
    <span className="text-meta font-normal text-slate-500">
      {s.productOrder ? `From order “${s.productOrder.name ?? `Order #${s.productOrder.number}`}”` : ""}
      {s.productOrder && s.reorderOf ? " · " : ""}
      {s.reorderOf ? `Re-order of ${shipmentRef(s.reorderOf)}` : ""}
    </span>
  );
}

function ProductCell({ s }: { s: ShipmentDTO }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Thumbnail src={s.product.imageUrl} alt="" className="size-11 shrink-0 rounded-control" />
      <div className="min-w-0">
        <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
          <a href={`/products/${s.product.id}?phase=orders`} className="truncate font-semibold text-slate-900 underline-offset-2 hover:underline">
            {s.product.name}
          </a>
          <span className="num text-meta text-slate-500">{shipmentRef(s.number)}</span>
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <BrandPill brand={s.product.brand} />
          <span className="text-meta font-normal text-slate-600">{s.vendor?.name ?? "No vendor"}</span>
        </p>
      </div>
    </div>
  );
}

function RowActions({ s, onEdit, onReorder }: Pick<RowProps, "s" | "onEdit" | "onReorder">) {
  return (
    <span className="flex items-center justify-end gap-1">
      <Button size="icon-sm" variant="ghost" onClick={onEdit} aria-label={`Edit ${shipmentRef(s.number)}`} title="Edit">
        <PencilIcon />
      </Button>
      <Button size="icon-sm" variant="ghost" onClick={onReorder} aria-label={`Request reorder of ${s.product.name}`} title="Request reorder">
        <RepeatIcon />
      </Button>
    </span>
  );
}

function ShipmentRow({ s, today, canManage, onEdit, onReorder }: RowProps) {
  const state = shipmentState(s, today);
  return (
    <tr className={cn("align-top transition-colors", s.arrived ? "bg-emerald-50/70" : state === "late" ? "bg-rose-50/50" : "hover:bg-slate-50/60")}>
      <td className="max-w-[340px] px-4 py-3">
        <ProductCell s={s} />
        {s.note || s.productOrder || s.reorderOf ? (
          <div className="mt-1.5 grid gap-0.5 pl-14">
            <Origin s={s} />
            {s.note ? <span className="text-meta font-normal [overflow-wrap:anywhere] text-slate-600">{s.note}</span> : null}
          </div>
        ) : null}
      </td>
      <td className="px-3 py-3">
        <p className="num whitespace-nowrap text-slate-900">{d(s.orderedOn)}</p>
        <p className="text-meta font-normal text-slate-600">by {s.orderedBy}</p>
      </td>
      <td className="px-3 py-3 text-right">
        <p className="num font-semibold text-slate-900">{s.quantity.toLocaleString("en-IN")}</p>
        <p className="num text-meta font-normal text-slate-600">{s.totalWeightKg ? `${Number(s.totalWeightKg)} kg` : "—"}</p>
      </td>
      <td className="px-3 py-3">
        <p className="num font-semibold text-slate-900">{s.shippingCostBdt ? formatBdt(s.shippingCostBdt) : "—"}</p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {canManage && !s.shippingPaid ? <FlagButton s={s} field="shippingPaid" compact /> : <PaidPill s={s} />}
          {s.shippingPaid && s.shippingPaidOn ? <span className="num text-meta font-normal text-slate-600">{d(s.shippingPaidOn)}</span> : null}
        </div>
      </td>
      <td className="px-3 py-3">
        <StatePill s={s} today={today} />
        <p className={cn("num mt-1 text-meta font-normal", state === "late" ? "text-rose-700" : "text-slate-600")}>{arrivalLine(s)}</p>
        {canManage && !s.arrived ? (
          <div className="mt-1.5">
            <FlagButton s={s} field="arrived" compact />
          </div>
        ) : null}
      </td>
      {canManage ? (
        <td className="px-4 py-3">
          <RowActions s={s} onEdit={onEdit} onReorder={onReorder} />
        </td>
      ) : null}
    </tr>
  );
}

function ShipmentCard({ s, today, canManage, onEdit, onReorder }: RowProps) {
  const state = shipmentState(s, today);
  return (
    <li
      className={cn(
        "grid gap-3 rounded-panel p-4 ring-1 ring-inset",
        s.arrived ? "bg-emerald-50 ring-emerald-300" : state === "late" ? "surface ring-rose-200" : "surface ring-slate-900/[0.04]",
      )}
    >
      <ProductCell s={s} />
      <div className="flex flex-wrap items-center gap-1.5">
        <StatePill s={s} today={today} />
        <PaidPill s={s} />
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-meta sm:grid-cols-4">
        {[
          ["Ordered", `${d(s.orderedOn)} · ${s.orderedBy}`],
          ["Qty · weight", `${s.quantity.toLocaleString("en-IN")}${s.totalWeightKg ? ` · ${Number(s.totalWeightKg)} kg` : ""}`],
          ["Shipping", `${s.shippingCostBdt ? formatBdt(s.shippingCostBdt) : "—"}${s.shippingPaid && s.shippingPaidOn ? ` · paid ${d(s.shippingPaidOn)}` : ""}`],
          ["Arrival", arrivalLine(s)],
        ].map(([k, v]) => (
          <div key={k} className="min-w-0">
            <dt className="text-slate-500">{k}</dt>
            <dd className={cn("num font-semibold text-slate-900", k === "Arrival" && state === "late" && "text-rose-700")}>{v}</dd>
          </div>
        ))}
      </dl>
      <Origin s={s} />
      {s.note ? <p className="text-meta font-normal [overflow-wrap:anywhere] text-slate-600">{s.note}</p> : null}
      {canManage ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-900/[0.06] pt-3">
          {s.shippingPaid ? null : <FlagButton s={s} field="shippingPaid" />}
          {s.arrived ? null : <FlagButton s={s} field="arrived" />}
          <span className="ml-auto">
            <RowActions s={s} onEdit={onEdit} onReorder={onReorder} />
          </span>
        </div>
      ) : null}
    </li>
  );
}

function FlagButton({ s, field, compact }: { s: ShipmentDTO; field: "shippingPaid" | "arrived"; compact?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const on = field === "arrived" ? s.arrived : s.shippingPaid;
  const label = field === "arrived" ? (on ? "Arrived ✓" : "Mark arrived") : on ? "Paid ✓" : compact ? "Mark paid" : "Mark shipping paid";
  return (
    <Button
      size="sm"
      variant={on ? "ghost" : field === "arrived" ? "default" : "outline"}
      className={cn(on && "text-emerald-800 hover:bg-emerald-100", compact && "h-7 px-2 text-meta")}
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
