CREATE TABLE "investor_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"title" varchar(255) NOT NULL,
	"url" text NOT NULL,
	"source" varchar(150),
	"source_type" varchar(40) DEFAULT 'google_news',
	"event_date" timestamp,
	"published_at" timestamp DEFAULT now(),
	"city" varchar(120),
	"location_text" varchar(255),
	"organizer" varchar(255),
	"priority_score" integer DEFAULT 0,
	"is_hyderabad_priority" boolean DEFAULT false NOT NULL,
	"matched_investor_type" varchar(100),
	"matched_sectors" jsonb DEFAULT '[]'::jsonb,
	"matched_keywords" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "investor_events" ADD CONSTRAINT "investor_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "investor_events_org_idx" ON "investor_events" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "investor_events_event_date_idx" ON "investor_events" USING btree ("event_date");--> statement-breakpoint
CREATE INDEX "investor_events_city_idx" ON "investor_events" USING btree ("city");