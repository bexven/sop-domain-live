import "server-only";
import { db } from "../db";

/** Active people for the login avatar grid (pre-auth: expose names only). */
export async function getLoginRoster() {
  return db.user.findMany({
    where: { active: true },
    select: { id: true, name: true, role: true, avatarColor: true, avatarAssetId: true },
    orderBy: [{ name: "asc" }],
  });
}

export async function getTeam() {
  const users = await db.user.findMany({
    where: { removedAt: null },
    select: {
      id: true,
      name: true,
      role: true,
      avatarColor: true, avatarAssetId: true,
      active: true,
      adminAccess: true,
      isMaster: true,
      permissions: true,
      permissionRoleId: true,
      extraPermissions: true,
      brandAccess: true,
      mustChangePin: true,
      pinHash: true,
      lockedUntil: true,
      createdAt: true,
    },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });
  const now = Date.now();
  return users.map(({ pinHash, ...u }) => ({
    ...u,
    // Never send hashes to the client; only whether a PIN exists.
    pinNotSet: pinHash.startsWith("!"),
    locked: u.lockedUntil !== null && u.lockedUntil.getTime() > now,
    createdAt: u.createdAt.toISOString(),
    lockedUntil: u.lockedUntil?.toISOString() ?? null,
  }));
}

export type TeamRow = Awaited<ReturnType<typeof getTeam>>[number];

/** Permission roles with how many people are on each (Roles & permissions page). */
export async function getPermissionRoles() {
  const roles = await db.permissionRole.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { users: { where: { removedAt: null } } } } } });
  return roles.map((r) => ({ id: r.id, name: r.name, description: r.description, permissions: r.permissions, people: r._count.users }));
}
export type PermissionRoleDTO = Awaited<ReturnType<typeof getPermissionRoles>>[number];
