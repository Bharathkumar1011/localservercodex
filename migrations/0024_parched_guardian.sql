CREATE TABLE "investor_user_access" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"investor_id" integer NOT NULL,
	"user_id" varchar NOT NULL,
	"source" varchar(20) DEFAULT 'create' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "investors" ADD COLUMN "created_by_user_id" varchar;--> statement-breakpoint
ALTER TABLE "investor_user_access" ADD CONSTRAINT "investor_user_access_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investor_user_access" ADD CONSTRAINT "investor_user_access_investor_id_investors_id_fk" FOREIGN KEY ("investor_id") REFERENCES "public"."investors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investor_user_access" ADD CONSTRAINT "investor_user_access_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_investor_user_access" ON "investor_user_access" USING btree ("organization_id","investor_id","user_id");--> statement-breakpoint
ALTER TABLE "investors" ADD CONSTRAINT "investors_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;