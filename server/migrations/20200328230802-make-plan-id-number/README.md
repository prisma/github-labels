# Migration `20200328230802-make-plan-id-number`

This migration has been generated by maticzav at 3/28/2020, 11:08:02 PM.
You can check out the [state of the schema](./schema.prisma) after the migration.

## Database Steps

```sql
ALTER TABLE "public"."Purchase" DROP COLUMN "planId",
ADD COLUMN "planId" integer  NOT NULL DEFAULT 0;
```

## Changes

```diff
diff --git schema.prisma schema.prisma
migration 20200328230542-make-purchase-owner-unique..20200328230802-make-plan-id-number
--- datamodel.dml
+++ datamodel.dml
@@ -1,7 +1,7 @@
 datasource postgresql {
   provider = "postgresql"
-  url = "***"
+  url      = env("POSTGRESQL_URL")
 }
 generator client {
   provider = "prisma-client-js"
@@ -14,9 +14,9 @@
   // Info
   owner     String           @unique
   type      InstallationType
   // Purchase
-  planId    String
+  planId    Int
   plan      String
   trial     Boolean          @default(false)
 }
```

