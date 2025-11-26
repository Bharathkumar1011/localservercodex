// Integration: javascript_log_in_with_replit, javascript_database
import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  decimal,
  boolean,
  serial,
  integer,
  unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// Session storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// Organizations table
export const organizations = pgTable("organizations", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  adminEmail: varchar("admin_email").notNull(), // Email of the user who created the organization
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: integer("organization_id").references(() => organizations.id),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: varchar("role", { length: 20 }).notNull().default('analyst'), // analyst, partner, admin, intern
  isSuspended: boolean("is_suspended").notNull().default(false),
  managerId: varchar("manager_id").references((): any => users.id), // For analysts: their partner
  analystId: varchar("analyst_id").references((): any => users.id), // For interns: their analyst
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Companies table
export const companies = pgTable("companies", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").references(() => organizations.id).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  normalizedName: varchar("normalized_name", { length: 255 }), // For deduplication - temporarily nullable
  
  // Status and workflow fields
  statusNextSteps: text("status_next_steps"),
  remarksFromDinesh: text("remarks_from_dinesh"),
  priority: varchar("priority", { length: 50 }),
  leadStatus: varchar("lead_status", { length: 100 }),
  
  // Sector information
  sector: varchar("sector", { length: 100 }),
  subSector: varchar("sub_sector", { length: 100 }),
  
  // Team assignments
  analystFocSfca: varchar("analyst_foc_sfca", { length: 255 }),
  bdFocSfca: varchar("bd_foc_sfca", { length: 255 }),
  
  // Company details
  location: varchar("location", { length: 255 }),
  foundedYear: integer("founded_year"),
  businessDescription: text("business_description"),
  products: text("products"),
  
  // Financial information
  financialYear: varchar("financial_year", { length: 20 }),
  revenueInrCr: decimal("revenue_inr_cr", { precision: 10, scale: 2 }),
  ebitdaInrCr: decimal("ebitda_inr_cr", { precision: 10, scale: 2 }),
  ebitdaMarginInrCr: decimal("ebitda_margin_inr_cr", { precision: 5, scale: 2 }),
  patInrCr: decimal("pat_inr_cr", { precision: 10, scale: 2 }),
  
  // AI-generated fields
  chatgptSummaryReason: text("chatgpt_summary_reason"),
  chatgptProposedOffering: text("chatgpt_proposed_offering"),
  
  // Document links (accessible based on user permissions)
  driveLink: varchar("drive_link", { length: 500 }),
  collateral: varchar("collateral", { length: 500 }),
  
  // Legacy fields (keeping for backward compatibility)
  industry: varchar("industry", { length: 100 }),
  website: varchar("website", { length: 255 }),
  description: text("description"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
// TODO: Will add unique constraint after handling existing duplicates

// Contacts table
export const contacts = pgTable("contacts", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").references(() => organizations.id).notNull(),
  companyId: serial("company_id").references(() => companies.id).notNull(),
  name: varchar("name", { length: 255 }),
  designation: varchar("designation", { length: 255 }),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  linkedinProfile: varchar("linkedin_profile", { length: 500 }),
  isPrimary: boolean("is_primary").default(false),
  isComplete: boolean("is_complete").default(false), // true when all mandatory fields filled
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Leads table
export const leads = pgTable("leads", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").references(() => organizations.id).notNull(),
  companyId: serial("company_id").references(() => companies.id).notNull(),
  stage: varchar("stage", { length: 20 }).notNull().default('universe'), // universe, qualified, outreach, pitching, mandates, won, lost, rejected
  universeStatus: varchar("universe_status", { length: 20 }).default('open'), // open, assigned - sub-states within universe
  ownerAnalystId: varchar("owner_analyst_id").references(() => users.id), // Analyst who owns/created this lead
  assignedTo: varchar("assigned_to").references(() => users.id), // Deprecated: Use assignedInterns instead
  assignedInterns: text("assigned_interns").array(), // Array of intern user IDs assigned to this lead
  pipelineValue: decimal("pipeline_value", { precision: 15, scale: 2 }),
  probability: decimal("probability", { precision: 5, scale: 2 }).default('0'), // 0-100
  notes: text("notes"),
  // createdBy: varchar("created_by", { length: 50 }).notNull(), // User who created this lead
  // POC summary fields for quick status checking
  pocCount: integer("poc_count").default(0), // Number of contacts for this lead
  pocCompletionStatus: varchar("poc_completion_status", { length: 10 }).default('red'), // red, amber, green
  // POC designations for pitching stage
  defaultPocId: integer("default_poc_id").references(() => contacts.id), // Primary POC for pitching
  backupPocId: integer("backup_poc_id").references(() => contacts.id), // Backup POC for pitching
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  stageUpdatedAt: timestamp("stage_updated_at").defaultNow(),
});

// Lead remarks table for internal comments
export const leadRemarks = pgTable("lead_remarks", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id")
    .notNull()
    .references(() => leads.id),
  organizationId: integer("organization_id").notNull(),
  userId: varchar("user_id").notNull(),
  remark: text("remark").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});


// Lead Actionables table
export const leadActionables = pgTable("lead_actionables", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id")
    .notNull()
    .references(() => leads.id),
  organizationId: integer("organization_id").notNull(),
  userId: varchar("user_id").notNull(),
  text: text("text").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});


// Lead assignments history
export const leadAssignments = pgTable("lead_assignments", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").references(() => organizations.id).notNull(),
  leadId: serial("lead_id").references(() => leads.id).notNull(),
  assignedBy: varchar("assigned_by").references(() => users.id).notNull(),
  assignedTo: varchar("assigned_to").references(() => users.id),
  assignedAt: timestamp("assigned_at").defaultNow(),
  notes: text("notes"),
});

// Outreach activities
export const outreachActivities = pgTable("outreach_activities", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").references(() => organizations.id).notNull(),
  leadId: serial("lead_id").references(() => leads.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  activityType: varchar("activity_type", { length: 50 }).notNull(), // linkedin, email, call, meeting, whatsapp
  status: varchar("status", { length: 20 }).notNull().default('pending'), // pending, completed, scheduled, sent, received, follow_up, invalid
  contactDate: timestamp("contact_date"),
  followUpDate: timestamp("follow_up_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Interventions table for tracking outreach activities during outreach stage
export const interventions = pgTable("interventions", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").references(() => organizations.id).notNull(),
  leadId: serial("lead_id").references(() => leads.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  type: varchar("type", { length: 50 }).notNull(), // linkedin_message, call, whatsapp, email, meeting, document
  scheduledAt: timestamp("scheduled_at").notNull(), // When intervention was scheduled/performed
  notes: text("notes"),
  documentName: varchar("document_name", { length: 100 }), // For document type: PDM, MTS, LOE (Letter of Engagement), Contract
  createdAt: timestamp("created_at").defaultNow(),
});

// Activity log for comprehensive audit trail
export const activityLog = pgTable("activity_log", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").references(() => organizations.id).notNull(),
  leadId: serial("lead_id").references(() => leads.id),
  companyId: serial("company_id").references(() => companies.id),
  userId: varchar("user_id").references(() => users.id).notNull(),
  action: varchar("action", { length: 100 }).notNull(), // company_created, lead_assigned, stage_changed, poc_added, intervention_added, etc.
  entityType: varchar("entity_type", { length: 50 }).notNull(), // company, lead, contact, intervention
  entityId: integer("entity_id"), // ID of the entity being acted upon
  oldValue: text("old_value"), // JSON of previous state
  newValue: text("new_value"), // JSON of new state
  description: text("description"), // Human-readable description of action
  createdAt: timestamp("created_at").defaultNow(),
});

// Invitations table - manages user invitations and onboarding
export const invitations = pgTable("invitations", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull(),
  organizationId: integer("organization_id").references(() => organizations.id).notNull(),
  role: varchar("role", { length: 20 }).notNull(), // analyst, partner, admin, intern
  inviteToken: varchar("invite_token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  invitedBy: varchar("invited_by").references(() => users.id).notNull(),
  status: varchar("status", { length: 20 }).notNull().default('pending'), // pending, accepted, expired
  analystId: varchar("analyst_id").references(() => users.id), // For intern invitations: assigned analyst
  
  // Email delivery tracking
  emailStatus: varchar("email_status", { length: 20 }).default('pending'), // pending, sending, sent, failed
  emailSentAt: timestamp("email_sent_at"), // When email was successfully sent
  emailError: text("email_error"), // Error message if email failed
  retryCount: integer("retry_count").default(0), // Number of send attempts
  lastRetryAt: timestamp("last_retry_at"), // Last retry timestamp
  
  createdAt: timestamp("created_at").defaultNow(),
  acceptedAt: timestamp("accepted_at"),
});

// Deal outcomes for pitching stage
export const dealOutcomes = pgTable("deal_outcomes", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").references(() => organizations.id).notNull(),
  leadId: serial("lead_id").references(() => leads.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  outcome: varchar("outcome", { length: 20 }).notNull(), // won, lost
  caseStudy: text("case_study").notNull(), // Long paragraph case study
  dealValue: decimal("deal_value", { precision: 15, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow(),
});

// Type exports
export type Organization = typeof organizations.$inferSelect;
export type UpsertOrganization = typeof organizations.$inferInsert;
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type Company = typeof companies.$inferSelect;
export type UpsertCompany = typeof companies.$inferInsert;
export type Contact = typeof contacts.$inferSelect;
export type UpsertContact = typeof contacts.$inferInsert;
export type Lead = typeof leads.$inferSelect;
export type UpsertLead = typeof leads.$inferInsert;
export type LeadAssignment = typeof leadAssignments.$inferSelect;
export type UpsertLeadAssignment = typeof leadAssignments.$inferInsert;
export type OutreachActivity = typeof outreachActivities.$inferSelect;
export type UpsertOutreachActivity = typeof outreachActivities.$inferInsert;
export type Intervention = typeof interventions.$inferSelect;
export type UpsertIntervention = typeof interventions.$inferInsert;
export type ActivityLog = typeof activityLog.$inferSelect;
export type UpsertActivityLog = typeof activityLog.$inferInsert;
export type Invitation = typeof invitations.$inferSelect;
export type UpsertInvitation = typeof invitations.$inferInsert;
export type DealOutcome = typeof dealOutcomes.$inferSelect;
export type UpsertDealOutcome = typeof dealOutcomes.$inferInsert;

// Zod schemas for validation
export const insertOrganizationSchema = createInsertSchema(organizations).omit({ id: true, createdAt: true, updatedAt: true });
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, updatedAt: true });
// Company schemas - organizationId is server-controlled, never client-provided
export const insertCompanySchema = createInsertSchema(companies).omit({ 
  id: true, 
  organizationId: true, // Security: Server assigns organizationId, never client-controlled
  createdAt: true, 
  updatedAt: true 
});
export const updateCompanySchema = insertCompanySchema.partial();
// Contact schemas - organizationId is server-controlled, never client-provided
export const insertContactSchema = createInsertSchema(contacts).omit({ 
  id: true, 
  organizationId: true, // Security: Server assigns organizationId, never client-controlled
  createdAt: true, 
  updatedAt: true, 
  isComplete: true 
});
export const updateContactSchema = insertContactSchema.partial();
// Lead schemas - organizationId is server-controlled, never client-provided
export const insertLeadSchema = createInsertSchema(leads).omit({ 
  id: true, 
  organizationId: true, // Security: Server assigns organizationId, never client-controlled
  createdAt: true, 
  updatedAt: true, 
  stageUpdatedAt: true 
});
export const updateLeadSchema = insertLeadSchema.partial();
export const insertLeadAssignmentSchema = createInsertSchema(leadAssignments).omit({ id: true, assignedAt: true });
export const insertOutreachActivitySchema = createInsertSchema(outreachActivities).omit({ id: true, createdAt: true, updatedAt: true });
// New table schemas
export const insertInterventionSchema = createInsertSchema(interventions).omit({ 
  id: true, 
  organizationId: true, 
  createdAt: true 
});
export const insertActivityLogSchema = createInsertSchema(activityLog).omit({ 
  id: true, 
  organizationId: true, 
  createdAt: true 
});
export const insertInvitationSchema = createInsertSchema(invitations).omit({ 
  id: true, 
  organizationId: true, 
  createdAt: true,
  acceptedAt: true 
});
export const insertDealOutcomeSchema = createInsertSchema(dealOutcomes).omit({ 
  id: true, 
  organizationId: true, 
  createdAt: true 
});

// Form validation schemas
export const contactFormSchema = insertContactSchema.extend({
  name: z.string().min(1, "Name is required"),
  designation: z.string().min(1, "Designation is required"),
  linkedinProfile: z.string().url("LinkedIn profile must be a valid URL").min(1, "LinkedIn profile is required")
});

// Individual lead creation form schema
export const individualLeadFormSchema = z.object({
  companyName: z.string().min(1, "Company name is required"),
  sector: z.string().min(1, "Sector is required"),
  assignedTo: z.string().optional(), // Optional team member assignment
  location: z.string().optional(),
  businessDescription: z.string().optional(),
  website: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  // Financial fields
  revenueInrCr: z.number().positive().optional(),
  ebitdaInrCr: z.number().optional(),
  patInrCr: z.number().optional(),
});

// Intervention form schema for outreach stage
export const interventionFormSchema = insertInterventionSchema.extend({
  type: z.enum(["linkedin_message", "call", "whatsapp", "email", "meeting"]),
  scheduledAt: z.date(),
  notes: z.string().min(1, "Notes are required"),
});

// Deal outcome form schema for pitching stage
export const dealOutcomeFormSchema = insertDealOutcomeSchema.extend({
  outcome: z.enum(["won", "lost"]),
  caseStudy: z.string().min(50, "Case study must be at least 50 characters"),
  dealValue: z.number().positive().optional(),
});

// Bulk upload validation schema
export const bulkUploadRowSchema = z.object({
  companyName: z.string().min(1, "Company name is required"),
  sector: z.string().min(1, "Sector is required"),
  assignedTo: z.string().optional(),
  location: z.string().optional(),
  businessDescription: z.string().optional(),
  website: z.string().optional(),
  revenueInrCr: z.string().optional(), // CSV comes as strings
  ebitdaInrCr: z.string().optional(),
  patInrCr: z.string().optional(),
});

// Invitation form validation schema with conditional validation
export const invitationFormSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  role: z.enum(['analyst', 'manager', 'admin', 'intern'], {
    required_error: "Please select a role",
  }),
  managerId: z.string().optional(), // For analysts: assign to a manager
  analystId: z.string().optional(), // For interns: assign to an analyst
}).refine(data => {
  // For interns, analystId is required
  if (data.role === 'intern' && !data.analystId) {
    return false;
  }
  return true;
}, {
  message: "Analyst assignment is required for interns",
  path: ["analystId"],
});

export type ContactFormData = z.infer<typeof contactFormSchema>;
export type InsertOrganizationData = z.infer<typeof insertOrganizationSchema>;
export type InsertUserData = z.infer<typeof insertUserSchema>;
export type InsertCompanyData = z.infer<typeof insertCompanySchema>;
export type UpdateCompanyData = z.infer<typeof updateCompanySchema>;
export type InsertContactData = z.infer<typeof insertContactSchema>;
export type UpdateContactData = z.infer<typeof updateContactSchema>;
export type InsertLeadData = z.infer<typeof insertLeadSchema>;
export type UpdateLeadData = z.infer<typeof updateLeadSchema>;
export type InsertLeadAssignmentData = z.infer<typeof insertLeadAssignmentSchema>;
export type InsertOutreachActivityData = z.infer<typeof insertOutreachActivitySchema>;
// New form data types
export type IndividualLeadFormData = z.infer<typeof individualLeadFormSchema>;
export type InterventionFormData = z.infer<typeof interventionFormSchema>;
export type DealOutcomeFormData = z.infer<typeof dealOutcomeFormSchema>;
export type BulkUploadRowData = z.infer<typeof bulkUploadRowSchema>;
export type InvitationFormData = z.infer<typeof invitationFormSchema>;
export type InsertInterventionData = z.infer<typeof insertInterventionSchema>;
export type InsertActivityLogData = z.infer<typeof insertActivityLogSchema>;
export type InsertInvitationData = z.infer<typeof insertInvitationSchema>;
export type InsertDealOutcomeData = z.infer<typeof insertDealOutcomeSchema>;
