import type { Metadata } from "next";
import { PageHeader } from "@/components/common/page-header";
import { RolesManager } from "@/components/team/roles-manager";
import { TeamNav } from "@/components/team/team-nav";
import { requireMaster } from "@/lib/server/auth/current-user";
import { getPermissionRoles, getTeam } from "@/lib/server/queries/team";
import { db } from "@/lib/server/db";

export const metadata: Metadata = { title: "Roles & permissions" };

export default async function RolesPage() {
  await requireMaster();
  const [team, roles, brands] = await Promise.all([
    getTeam(),
    getPermissionRoles(),
    db.brand.findMany({ where: { restricted: true }, orderBy: { name: "asc" }, select: { id: true, name: true, color: true } }),
  ]);
  return (
    <>
      <PageHeader
        title="Roles & permissions"
        description="Roles are sets of permissions grouped by feature. Give each person a role, then tick any extra permissions just for them. Admin access means everything."
      />
      <TeamNav />
      <RolesManager team={team} roles={roles} brands={brands} />
      <p className="mt-3 text-meta font-normal text-slate-500">
        New features add their permissions here automatically (unticked), so you decide who gets them. Restricted brands (🔒) are only
        seen by people ticked for them (and you), even Admins.
      </p>
    </>
  );
}
