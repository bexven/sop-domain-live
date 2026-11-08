import { z } from "zod";
import { Role } from "@/generated/prisma/enums";
import { AVATAR_COLORS } from "@/lib/domain/labels";
import { idSchema, pinSchema } from "./common";

const name = z.string().trim().min(2, "Name must be at least 2 characters").max(40, "Name is too long");
const role = z.enum(Role);
const avatarColor = z.enum(AVATAR_COLORS);

export const createMemberSchema = z.object({ name, role, avatarColor, pin: pinSchema, adminAccess: z.boolean().default(false) });
export const updateMemberSchema = z.object({ id: idSchema, name, role, avatarColor, adminAccess: z.boolean().default(false) });
export const setActiveSchema = z.object({ id: idSchema, active: z.boolean() });
export const resetPinSchema = z.object({ id: idSchema, pin: pinSchema, requireChange: z.boolean().default(false) });
export const unlockSchema = z.object({ id: idSchema });
export const removeMemberSchema = z.object({ id: idSchema });
/** One temporary PIN for everyone except the Master Admin; each person picks their own at next sign-in. */
export const teamPinSchema = z.object({ pin: pinSchema });
/** Roles page: job role, admin access and individual permissions for one person. */
export const accessSchema = z.object({
  id: idSchema,
  role,
  adminAccess: z.boolean(),
  /** The permission role (template); extras are ticked just for this person on top of it. */
  permissionRoleId: z.string().max(64).optional().nullable().transform((v) => v || null),
  extraPermissions: z.array(z.string().max(40)).max(80).default([]),
  brandAccess: z.array(idSchema).max(50).default([]),
});

/** A named permission role (Roles tab). */
export const permissionRoleSchema = z.object({
  roleId: z.string().max(64).optional().nullable().transform((v) => v || null),
  name: z.string().trim().min(2, "Name the role").max(40, "Keep the name under 40 characters"),
  description: z.string().trim().max(200).optional().nullable().transform((v) => v || null),
  permissions: z.array(z.string().max(40)).max(80).default([]),
});
export const permissionRoleIdSchema = z.object({ roleId: idSchema });

export type CreateMemberInput = z.infer<typeof createMemberSchema>;
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;
