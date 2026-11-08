"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon, SaveIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { BrandPicker } from "@/components/common/brand-picker";
import { Field, fieldA11y } from "@/components/common/field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { reorderDraft, shipmentRef } from "@/lib/domain/shipments";
import { addListingAction, addVendorAction, deleteShipmentAction, saveShipmentAction } from "@/lib/server/actions/shipments";
import type { ShipmentBoard, ShipmentDTO } from "@/lib/server/queries/shipments";

export type DialogMode = { kind: "new" } | { kind: "edit"; shipment: ShipmentDTO } | { kind: "reorder"; shipment: ShipmentDTO };

const NEW_VENDOR = "__new_vendor";
const NEW_PRODUCT = "__new_product";

function todayDhaka() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(new Date());
}

export function ShipmentDialog({ mode, board, onClose }: { mode: DialogMode; board: ShipmentBoard; onClose: () => void }) {
  const router = useRouter();
  const src = mode.kind === "new" ? null : mode.shipment;
  const draft = mode.kind === "reorder" ? reorderDraft({ productId: src!.product.id, vendorId: src!.vendor?.id ?? null, quantity: src!.quantity, totalWeightKg: src!.totalWeightKg }, todayDhaka()) : null;
  const defaultVendor = board.vendors.find((v) => v.isDefault)?.id ?? board.vendors[0]?.id ?? "";
  const [products, setProducts] = useState(board.products);
  const [vendors, setVendors] = useState(board.vendors);
  const [v, setV] = useState({
    productId: src?.product.id ?? "",
    vendorId: draft ? (draft.vendorId ?? defaultVendor) : (src?.vendor?.id ?? defaultVendor),
    orderedBy: mode.kind === "edit" ? src!.orderedBy : "",
    orderedOn: mode.kind === "edit" ? src!.orderedOn : todayDhaka(),
    totalWeightKg: (draft ? draft.totalWeightKg : src?.totalWeightKg) ?? "",
    quantity: draft ? String(draft.quantity) : src ? String(src.quantity) : "",
    shippingCostBdt: mode.kind === "edit" ? (src!.shippingCostBdt ?? "") : "",
    estimatedDeliveryOn: mode.kind === "edit" ? (src!.estimatedDeliveryOn ?? "") : "",
    shippingPaid: mode.kind === "edit" ? src!.shippingPaid : false,
    arrived: mode.kind === "edit" ? src!.arrived : false,
    note: mode.kind === "edit" ? (src!.note ?? "") : "",
  });
  const [newVendor, setNewVendor] = useState<string | null>(null);
  const [listing, setListing] = useState<{ name: string; brandId: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [pending, startTransition] = useTransition();
  const err = (k: string) => errors[k]?.[0];
  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => setV((p) => ({ ...p, [k]: val }));
  const num = (k: "totalWeightKg" | "shippingCostBdt" | "quantity") => (e: React.ChangeEvent<HTMLInputElement>) =>
    set(k, k === "quantity" ? e.target.value.replace(/\D/g, "") : e.target.value.replace(/[^\d.]/g, ""));

  function saveVendor() {
    const name = newVendor?.trim() ?? "";
    if (name.length < 2) return;
    startTransition(async () => {
      const r = await addVendorAction({ name });
      if (!r.ok) return void toast.error(r.error);
      const vendor = r.data as { id: string; name: string };
      setVendors((list) => (list.some((x) => x.id === vendor.id) ? list : [...list, { ...vendor, isDefault: false }]));
      set("vendorId", vendor.id);
      setNewVendor(null);
      toast.success(r.message);
    });
  }

  function saveListing() {
    if (!listing || listing.name.trim().length < 2 || !listing.brandId) return;
    startTransition(async () => {
      const r = await addListingAction(listing);
      if (!r.ok) return void toast.error(r.error);
      const p = r.data as { id: string; name: string };
      setProducts((list) => [...list, { id: p.id, name: p.name, ref: "new" }].sort((a, b) => a.name.localeCompare(b.name)));
      set("productId", p.id);
      setListing(null);
      toast.success(r.message);
    });
  }

  function save() {
    startTransition(async () => {
      const r = await saveShipmentAction({
        ...v,
        shipmentId: mode.kind === "edit" ? src!.id : null,
        reorderOfId: mode.kind === "reorder" ? src!.id : null,
      });
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

  const title = mode.kind === "new" ? "New shipment" : mode.kind === "edit" ? `Edit ${shipmentRef(src!.number)}` : `Re-order ${src!.product.name}`;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {mode.kind === "reorder"
              ? `A new shipment for the same product, filled in from ${shipmentRef(src!.number)}. Change what's different.`
              : "A purchase on its way to our warehouse."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <Field id="sh-product" label="Product *" error={err("productId")}>
            {listing ? (
              <div className="grid gap-2 rounded-control bg-slate-50 p-3 ring-1 ring-slate-200 ring-inset">
                <BrandPicker brands={board.brands} value={listing.brandId} onChange={(id) => setListing({ ...listing, brandId: id })} />
                <div className="flex gap-2">
                  <Input aria-label="New product name" value={listing.name} onChange={(e) => setListing({ ...listing, name: e.target.value })} placeholder="Product name" autoFocus className="bg-white" />
                  <Button type="button" onClick={saveListing} disabled={pending || listing.name.trim().length < 2 || !listing.brandId}>
                    Add
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setListing(null)}>
                    Cancel
                  </Button>
                </div>
                <p className="text-meta font-normal text-slate-500">It&apos;s listed as a running product (Live), so you can add its details later.</p>
              </div>
            ) : (
              <Select
                value={v.productId}
                onValueChange={(id) => (id === NEW_PRODUCT ? setListing({ name: "", brandId: board.brands.length === 1 ? board.brands[0]!.id : "" }) : set("productId", id))}
                disabled={mode.kind !== "new"}
              >
                <SelectTrigger {...fieldA11y("sh-product", err("productId"))}>
                  <SelectValue placeholder="Choose a product" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} <span className="text-slate-500">· {p.ref}</span>
                    </SelectItem>
                  ))}
                  <SelectItem value={NEW_PRODUCT}>＋ Add a product for listing…</SelectItem>
                </SelectContent>
              </Select>
            )}
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="sh-vendor" label="Shipping vendor" error={err("vendorId")}>
              {newVendor !== null ? (
                <div className="flex gap-2">
                  <Input aria-label="New vendor name" value={newVendor} onChange={(e) => setNewVendor(e.target.value)} placeholder="Vendor name" autoFocus />
                  <Button type="button" onClick={saveVendor} disabled={pending || newVendor.trim().length < 2}>
                    Add
                  </Button>
                </div>
              ) : (
                <Select value={v.vendorId} onValueChange={(id) => (id === NEW_VENDOR ? setNewVendor("") : set("vendorId", id))}>
                  <SelectTrigger id="sh-vendor">
                    <SelectValue placeholder="Choose a vendor" />
                  </SelectTrigger>
                  <SelectContent>
                    {vendors.map((x) => (
                      <SelectItem key={x.id} value={x.id}>
                        {x.name}
                      </SelectItem>
                    ))}
                    <SelectItem value={NEW_VENDOR}>＋ Add a vendor…</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </Field>
            <Field id="sh-by" label="Ordered by *" error={err("orderedBy")}>
              <Input {...fieldA11y("sh-by", err("orderedBy"))} value={v.orderedBy} onChange={(e) => set("orderedBy", e.target.value)} placeholder="Name" />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Field id="sh-date" label="Order date *" error={err("orderedOn")}>
              <Input {...fieldA11y("sh-date", err("orderedOn"))} type="date" value={v.orderedOn} onChange={(e) => set("orderedOn", e.target.value)} className="num" />
            </Field>
            <Field id="sh-eta" label="Est. delivery" error={err("estimatedDeliveryOn")}>
              <Input {...fieldA11y("sh-eta", err("estimatedDeliveryOn"))} type="date" value={v.estimatedDeliveryOn} onChange={(e) => set("estimatedDeliveryOn", e.target.value)} className="num" />
            </Field>
            <Field id="sh-qty" label="Quantity *" error={err("quantity")}>
              <Input {...fieldA11y("sh-qty", err("quantity"))} value={v.quantity} onChange={num("quantity")} inputMode="numeric" className="num" placeholder="500" />
            </Field>
            <Field id="sh-weight" label="Total weight (kg)" error={err("totalWeightKg")}>
              <Input {...fieldA11y("sh-weight", err("totalWeightKg"))} value={v.totalWeightKg} onChange={num("totalWeightKg")} inputMode="decimal" className="num" placeholder="75.5" />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="sh-cost" label="Shipping cost (BDT)" error={err("shippingCostBdt")}>
              <Input {...fieldA11y("sh-cost", err("shippingCostBdt"))} value={v.shippingCostBdt} onChange={num("shippingCostBdt")} inputMode="decimal" className="num" placeholder="0" />
            </Field>
            <div className="grid content-end gap-2 pb-1">
              <label className="flex cursor-pointer items-center gap-2.5 text-body text-slate-800">
                <Checkbox checked={v.shippingPaid} onCheckedChange={(c) => set("shippingPaid", c === true)} /> Shipping charge paid
              </label>
              <label className="flex cursor-pointer items-center gap-2.5 text-body text-slate-800">
                <Checkbox checked={v.arrived} onCheckedChange={(c) => set("arrived", c === true)} /> Arrived at our warehouse
              </label>
            </div>
          </div>

          <Field id="sh-note" label="Note" error={err("note")}>
            <Textarea {...fieldA11y("sh-note", err("note"))} value={v.note} onChange={(e) => set("note", e.target.value)} rows={2} placeholder="Tracking number, carton count…" />
          </Field>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {mode.kind === "edit" ? (
            <Button
              variant="ghost"
              className="text-rose-700 hover:bg-rose-50 hover:text-rose-800"
              disabled={pending}
              onClick={() => {
                if (!window.confirm(`Delete ${shipmentRef(src!.number)}?`)) return;
                startTransition(async () => {
                  const r = await deleteShipmentAction({ productId: src!.product.id, shipmentId: src!.id });
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
            <Button onClick={save} disabled={pending || !v.productId || v.orderedBy.trim().length < 2 || !v.quantity}>
              {mode.kind === "new" ? <PlusIcon /> : <SaveIcon />} {mode.kind === "edit" ? "Save" : mode.kind === "reorder" ? "Create re-order" : "Add shipment"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
