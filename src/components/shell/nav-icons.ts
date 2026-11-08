import {
  FlaskConicalIcon,
  ImagesIcon,
  KanbanSquareIcon,
  ListTodoIcon,
  LayoutDashboardIcon,
  type LucideIcon,
  PackageIcon,
  ShieldCheckIcon,
  TruckIcon,
  ShipIcon,
  PieChartIcon,
  UsersIcon,
} from "lucide-react";
import type { NavKey } from "@/lib/domain/nav";

export const NAV_ICONS: Record<NavKey, LucideIcon> = {
  dashboard: LayoutDashboardIcon,
  tasks: ListTodoIcon,
  research: FlaskConicalIcon,
  creative: ImagesIcon,
  pipeline: KanbanSquareIcon,
  products: PackageIcon,
  orders: TruckIcon,
  shipments: ShipIcon,
  overview: PieChartIcon,
  team: UsersIcon,
  roles: ShieldCheckIcon,
};
