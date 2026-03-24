CREATE TABLE "lead_solution_notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"lead_id" integer NOT NULL,
	"pdf_path" text,
	"pdf_name" text,
	"links" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "uq_lead_solution_notes_org_lead" UNIQUE("organization_id","lead_id")
);
--> statement-breakpoint
ALTER TABLE "lead_solution_notes" ADD CONSTRAINT "lead_solution_notes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_solution_notes" ADD CONSTRAINT "lead_solution_notes_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;