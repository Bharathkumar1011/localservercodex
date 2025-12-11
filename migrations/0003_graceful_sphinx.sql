-- 1) Add the column as NULLABLE (no NOT NULL)
ALTER TABLE "leads"
ADD COLUMN "created_by" varchar;

-- 2) TEMPORARY: Fill existing rows with your admin user id
UPDATE "leads"
SET "created_by" = '32cb1c96-aa1e-4392-9b35-6efbe444b38c';

-- 3) NOW enforce NOT NULL and add the FK
ALTER TABLE "leads"
ALTER COLUMN "created_by" SET NOT NULL;

ALTER TABLE "leads"
ADD CONSTRAINT "leads_created_by_users_id_fk"
FOREIGN KEY ("created_by") REFERENCES "public"."users"("id")
ON DELETE no action ON UPDATE no action;
