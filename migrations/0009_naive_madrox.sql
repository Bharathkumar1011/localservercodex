CREATE TABLE "investor_outreach_activities" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"investor_id" integer NOT NULL,
	"activity_type" varchar(80) NOT NULL,
	"status" varchar(30) DEFAULT 'pending' NOT NULL,
	"contact_date" timestamp,
	"follow_up_date" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
