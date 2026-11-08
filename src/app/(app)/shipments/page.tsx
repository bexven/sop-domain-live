import type { Metadata } from "next";
import { PageHeader } from "@/components/common/page-header";
import { ShipmentBoard } from "@/components/shipments/shipment-board";
import { can } from "@/lib/domain/permissions";
import { requireCapability } from "@/lib/server/auth/current-user";
import { getShipmentBoard } from "@/lib/server/queries/shipments";

export const metadata: Metadata = { title: "Shipments" };

export default async function ShipmentsPage() {
  const user = await requireCapability("shipments.view");
  const board = await getShipmentBoard(user);
  return (
    <>
      <PageHeader
        title="Shipments"
        description="Purchases on their way to our warehouse: vendor, weight, quantity, shipping cost and arrival. Orders added on a product page appear here automatically."
      />
      <ShipmentBoard board={board} canManage={can(user, "shipments.manage")} />
    </>
  );
}
