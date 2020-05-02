# Migration `20200502153017-remove-installation`

This migration has been generated by maticzav at 5/2/2020, 3:30:17 PM.
You can check out the [state of the schema](./schema.prisma) after the migration.

## Database Steps

```sql
ALTER TABLE "public"."Purchase" DROP COLUMN "type";

DROP TYPE "InstallationType"
```

## Changes

```diff
diff --git schema.prisma schema.prisma
migration 20200502151826-bills..20200502153017-remove-installation
--- datamodel.dml
+++ datamodel.dml
@@ -1,23 +1,22 @@
 datasource postgresql {
   provider = "postgresql"
-  url = "***"
+  url      = env("POSTGRESQL_URL")
 }
 generator client {
   provider = "prisma-client-js"
 }
 model Purchase {
-  id        String           @default(cuid()) @id
-  createdAt DateTime         @default(now())
-  updatedAt DateTime         @updatedAt
+  id        String   @default(cuid()) @id
+  createdAt DateTime @default(now())
+  updatedAt DateTime @updatedAt
   // Installation Info
-  ghAccount String           @unique
+  ghAccount String   @unique
   name      String
   company   String?
   email     String
-  type      InstallationType
   // Billing
   bills     Bill[]
 }
@@ -37,13 +36,8 @@
   ANNUALLY
   MONTHLY
 }
-enum InstallationType {
-  ORGANIZATION
-  USER
-}
-
 model StripeBill {
   id        String   @default(cuid()) @id
   createdAt DateTime @default(now())
   updatedAt DateTime @updatedAt
```