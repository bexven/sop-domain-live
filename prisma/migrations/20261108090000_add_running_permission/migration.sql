-- New permission "Add running products": Media Buyers have it by default; Shakil adds both kinds of products.
UPDATE "User" SET "permissions" = array_append("permissions", 'product.addRunning')
WHERE "role" = 'MEDIA_BUYER' AND NOT ('product.addRunning' = ANY("permissions"));

UPDATE "User" SET "permissions" = array_append("permissions", 'product.create')
WHERE "name" = 'Shakil' AND NOT ('product.create' = ANY("permissions"));
UPDATE "User" SET "permissions" = array_append("permissions", 'product.addRunning')
WHERE "name" = 'Shakil' AND NOT ('product.addRunning' = ANY("permissions"));
