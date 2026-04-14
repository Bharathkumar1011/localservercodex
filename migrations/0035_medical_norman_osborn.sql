ALTER TABLE "investor_lead_links" ADD COLUMN "task_assigned_to" varchar;--> statement-breakpoint
ALTER TABLE "investor_poc_outreach_status" ADD COLUMN "task_assigned_to" varchar;--> statement-breakpoint
ALTER TABLE "lead_poc_outreach_status" ADD COLUMN "task_assigned_to" varchar;--> statement-breakpoint
ALTER TABLE "pitching_details" ADD COLUMN "pdm_task_assigned_to" varchar;--> statement-breakpoint
ALTER TABLE "pitching_details" ADD COLUMN "meeting1_task_assigned_to" varchar;--> statement-breakpoint
ALTER TABLE "pitching_details" ADD COLUMN "meeting2_task_assigned_to" varchar;--> statement-breakpoint
ALTER TABLE "pitching_details" ADD COLUMN "loe_task_assigned_to" varchar;--> statement-breakpoint
ALTER TABLE "pitching_details" ADD COLUMN "mandate_task_assigned_to" varchar;--> statement-breakpoint
ALTER TABLE "investor_lead_links" ADD CONSTRAINT "investor_lead_links_task_assigned_to_users_id_fk" FOREIGN KEY ("task_assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investor_poc_outreach_status" ADD CONSTRAINT "investor_poc_outreach_status_task_assigned_to_users_id_fk" FOREIGN KEY ("task_assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_poc_outreach_status" ADD CONSTRAINT "lead_poc_outreach_status_task_assigned_to_users_id_fk" FOREIGN KEY ("task_assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pitching_details" ADD CONSTRAINT "pitching_details_pdm_task_assigned_to_users_id_fk" FOREIGN KEY ("pdm_task_assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pitching_details" ADD CONSTRAINT "pitching_details_meeting1_task_assigned_to_users_id_fk" FOREIGN KEY ("meeting1_task_assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pitching_details" ADD CONSTRAINT "pitching_details_meeting2_task_assigned_to_users_id_fk" FOREIGN KEY ("meeting2_task_assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pitching_details" ADD CONSTRAINT "pitching_details_loe_task_assigned_to_users_id_fk" FOREIGN KEY ("loe_task_assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pitching_details" ADD CONSTRAINT "pitching_details_mandate_task_assigned_to_users_id_fk" FOREIGN KEY ("mandate_task_assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;