-- AlterTable
ALTER TABLE "User" ADD COLUMN     "extraPermissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "permissionRoleId" TEXT;

-- CreateTable
CREATE TABLE "PermissionRole" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PermissionRole_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PermissionRole_name_key" ON "PermissionRole"("name");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_permissionRoleId_fkey" FOREIGN KEY ("permissionRoleId") REFERENCES "PermissionRole"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- One role per job role, starting from that job role's default permissions.
INSERT INTO "PermissionRole" ("id", "name", "permissions", "updatedAt")
SELECT 'role-' || lower(v.code), v.name, v.perms, NOW()
FROM (VALUES
('RESEARCHER', 'Researcher', ARRAY['research.view', 'product.create']::TEXT[]),
('IMAGE_DESIGNER', 'Image Designer', ARRAY[]::TEXT[]),
('VIDEO_EDITOR', 'Video Editor', ARRAY[]::TEXT[]),
('MEDIA_BUYER', 'Media Buyer', ARRAY['research.view', 'product.addRunning', 'task.review', 'brief.edit', 'campaign.manage', 'batch.request', 'orders.manage', 'shipments.view', 'shipments.manage', 'product.sendBack', 'product.kill']::TEXT[]),
('REVIEWER', 'Reviewer', ARRAY['research.view', 'product.approve', 'task.review', 'product.sendBack']::TEXT[]),
('CUSTOMER_SUPPORT', 'Customer Support', ARRAY[]::TEXT[]),
('OFFICE_SECRETARY', 'Office Boy', ARRAY[]::TEXT[]),
('SUPPLY_CHAIN', 'Supply Chain', ARRAY['orders.manage', 'shipments.view', 'shipments.manage']::TEXT[])
) AS v(code, name, perms)
WHERE NOT EXISTS (SELECT 1 FROM "PermissionRole" r WHERE r."name" = v.name);

-- Everyone keeps exactly what they have today: they get their job role's role only when it doesn't add anything
-- they didn't already have, and whatever else they had becomes their extras.
UPDATE "User" u SET "permissionRoleId" = r."id"
FROM "PermissionRole" r
WHERE r."id" = 'role-' || lower(u."role"::text) AND u."permissionRoleId" IS NULL AND r."permissions" <@ u."permissions";

UPDATE "User" u SET "extraPermissions" = ARRAY(
  SELECT p FROM unnest(u."permissions") AS p
  WHERE NOT (p = ANY(COALESCE((SELECT r."permissions" FROM "PermissionRole" r WHERE r."id" = u."permissionRoleId"), ARRAY[]::TEXT[])))
);
