CREATE TABLE "pitching_details" (
	"id" serial PRIMARY KEY NOT NULL,
	"lead_id" integer NOT NULL,
	"gdrive_link" text,
	"solution_note_path" text,
	"solution_note_name" text,
	"pdm_path" text,
	"pdm_name" text,
	"meeting1_date" timestamp,
	"meeting1_notes" text,
	"meeting2_date" timestamp,
	"meeting2_notes" text,
	"loe_signed" boolean DEFAULT false,
	"investor_check_notes" text,
	"mandate_signed" boolean DEFAULT false,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "pitching_details" ADD CONSTRAINT "pitching_details_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;