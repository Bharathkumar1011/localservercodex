CREATE TABLE "investor_poc_outreach_status" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"lead_id" integer NOT NULL,
	"investor_id" integer NOT NULL,
	"contact_id" integer NOT NULL,
	"channel" varchar(20) NOT NULL,
	"status" varchar(50),
	"initiated_at" timestamp,
	"last_updated_at" timestamp DEFAULT now() NOT NULL,
	"remarks" text,
	"cadence_triggered_at" timestamp,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "investor_poc_outreach_status" ADD CONSTRAINT "investor_poc_outreach_status_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investor_poc_outreach_status" ADD CONSTRAINT "investor_poc_outreach_status_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investor_poc_outreach_status" ADD CONSTRAINT "investor_poc_outreach_status_investor_id_investors_id_fk" FOREIGN KEY ("investor_id") REFERENCES "public"."investors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investor_poc_outreach_status" ADD CONSTRAINT "investor_poc_outreach_status_contact_id_investor_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."investor_contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investor_poc_outreach_status" ADD CONSTRAINT "investor_poc_outreach_status_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "investor_poc_outreach_status_unique_idx" ON "investor_poc_outreach_status" USING btree ("organization_id","lead_id","investor_id","contact_id","channel");--> statement-breakpoint
CREATE INDEX "investor_poc_outreach_status_lead_idx" ON "investor_poc_outreach_status" USING btree ("organization_id","lead_id","investor_id");--> statement-breakpoint
CREATE INDEX "investor_poc_outreach_status_contact_idx" ON "investor_poc_outreach_status" USING btree ("organization_id","contact_id");