import "server-only";
import type { BrandViewer } from "@/lib/domain/permissions";
import { canSeeBrand } from "@/lib/domain/permissions";
import { productRef } from "@/lib/format";
import { db } from "../db";
import { productScope } from "../services/brand-scope";

const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

/** Everything the Shipments page needs (restricted brands stay hidden like their products). */
export async function getShipmentBoard(viewer: BrandViewer) {
  const [rows, vendors, products, brands] = await Promise.all([
    db.shipment.findMany({
      where: { product: productScope(viewer) },
      orderBy: [{ arrived: "asc" }, { estimatedDeliveryOn: { sort: "asc", nulls: "last" } }, { orderedOn: "desc" }],
      take: 500,
      include: {
        product: { select: { id: true, number: true, name: true, imageUrl: true, brand: { select: { name: true, color: true } } } },
        vendor: { select: { id: true, name: true } },
        productOrder: { select: { number: true, name: true } },
        reorderOf: { select: { number: true } },
      },
    }),
    db.shippingVendor.findMany({ where: { active: true }, orderBy: [{ isDefault: "desc" }, { name: "asc" }], select: { id: true, name: true, isDefault: true } }),
    db.product.findMany({
      where: { AND: [productScope(viewer), { stage: { not: "KILLED" } }] },
      orderBy: { name: "asc" },
      take: 500,
      select: { id: true, name: true, number: true },
    }),
    db.brand.findMany({ where: { active: true }, orderBy: [{ order: "asc" }, { name: "asc" }], select: { id: true, name: true, color: true, active: true, restricted: true } }),
  ]);
  return {
    shipments: rows.map((s) => ({
      id: s.id,
      number: s.number,
      product: { ...s.product, ref: productRef(s.product.number) },
      vendor: s.vendor,
      productOrder: s.productOrder,
      reorderOf: s.reorderOf?.number ?? null,
      orderedBy: s.orderedBy,
      orderedOn: day(s.orderedOn)!,
      totalWeightKg: s.totalWeightKg?.toString() ?? null,
      quantity: s.quantity,
      shippingCostBdt: s.shippingCostBdt?.toString() ?? null,
      estimatedDeliveryOn: day(s.estimatedDeliveryOn),
      shippingPaid: s.shippingPaid,
      shippingPaidOn: day(s.shippingPaidOn),
      arrived: s.arrived,
      arrivedOn: day(s.arrivedOn),
      arrivedAt: s.arrivedAt?.toISOString() ?? null,
      note: s.note,
    })),
    vendors,
    products: products.map((p) => ({ id: p.id, name: p.name, ref: productRef(p.number) })),
    brands: brands.filter((b) => canSeeBrand(viewer, b)),
  };
}

export type ShipmentBoard = Awaited<ReturnType<typeof getShipmentBoard>>;
export type ShipmentDTO = ShipmentBoard["shipments"][number];
