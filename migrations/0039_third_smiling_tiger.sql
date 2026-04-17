ALTER TABLE "investors" ADD COLUMN "is_deleted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "investors" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "investors" ADD COLUMN "deleted_by" varchar;--> statement-breakpoint
ALTER TABLE "investors" ADD CONSTRAINT "investors_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;