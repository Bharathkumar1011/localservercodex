CREATE TABLE "epn_lead_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"epn_id" integer NOT NULL,
	"lead_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "uq_epn_lead_link" UNIQUE("organization_id","epn_id","lead_id")
);
--> statement-breakpoint
CREATE TABLE "epn_partners" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"name" text NOT NULL,
	"bucket" text DEFAULT 'other_epn' NOT NULL,
	"category" text,
	"stage" text DEFAULT 'outreach' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "epn_lead_links" ADD CONSTRAINT "epn_lead_links_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "epn_lead_links" ADD CONSTRAINT "epn_lead_links_epn_id_epn_partners_id_fk" FOREIGN KEY ("epn_id") REFERENCES "public"."epn_partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "epn_lead_links" ADD CONSTRAINT "epn_lead_links_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "epn_partners" ADD CONSTRAINT "epn_partners_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;