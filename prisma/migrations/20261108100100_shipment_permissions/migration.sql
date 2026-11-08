-- Shipment Management: Supply Chain and Media Buyers can see and manage shipments by default.
UPDATE "User" SET "permissions" = array_append("permissions", 'shipments.view')
WHERE "role" IN ('SUPPLY_CHAIN', 'MEDIA_BUYER') AND NOT ('shipments.view' = ANY("permissions"));
UPDATE "User" SET "permissions" = array_append("permissions", 'shipments.manage')
WHERE "role" IN ('SUPPLY_CHAIN', 'MEDIA_BUYER') AND NOT ('shipments.manage' = ANY("permissions"));
