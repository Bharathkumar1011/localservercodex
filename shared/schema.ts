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
  uniqueIndex,
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
  partnerId: varchar("manager_id").references((): any => users.id), // For analysts: their partner
  analystId: varchar("analyst_id").references((): any => users.id), // For interns: their analyst

  lastLoginTime: timestamp("last_login_time"), // Tracks last login time for session management and security monitoring

  lastActionTime: timestamp("last_action_time"), // Tracks last action time for inactivity-based auto-logout


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
  channelPartner: varchar("channel_partner", { length: 255 }), // ✅ NEW FIELD
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
   createdBy: varchar("created_by").references(() => users.id).notNull(), // User who created this lead
  assignedTo: varchar("assigned_to").references(() => users.id), // Deprecated: Use assignedInterns instead
  assignedPartnerId: varchar("assigned_partner_id").references(() => users.id), // Partner assigned to this lead
  assignedInterns: text("assigned_interns").array(), // Array of intern user IDs assigned to this lead
  pipelineValue: decimal("pipeline_value", { precision: 15, scale: 2 }),
  probability: decimal("probability", { precision: 5, scale: 2 }).default('0'), // 0-100
  notes: text("notes"),
  leadSource: varchar("lead_source", { length: 50 }),
  cardNextActionText: text("card_next_action_text"), // card-level next action (separate from outreach next actions)
  cardNextActionDate: timestamp("card_next_action_date"),
  chatgptLink: text("chatgpt_link"), // ✅ New field for Drive/ChatGPT URL
  leadTemperature: varchar("lead_temperature", { length: 20 }), // null = Not set, warm, hot
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

// Lead POC outreach status - tracks outreach status for each contact (POC) of a lead, for each channel (LinkedIn, email, WhatsApp)
export const leadPocOutreachStatus = pgTable(
  "lead_poc_outreach_status",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id")
      .references(() => organizations.id)
      .notNull(),
    leadId: integer("lead_id")
      .references(() => leads.id)
      .notNull(),
    contactId: integer("contact_id")
      .references(() => contacts.id)
      .notNull(),

    channel: varchar("channel", { length: 20 }).notNull(), // linkedin, email, whatsapp
    status: varchar("status", { length: 50 }), // initiated, 1st_follow_up, etc.

    initiatedAt: timestamp("initiated_at"),
    lastUpdatedAt: timestamp("last_updated_at").defaultNow().notNull(),

    remarks: text("remarks"),

    nextActionText: text("next_action_text"),
    nextActionAt: timestamp("next_action_at"),

    taskAssignedTo: varchar("task_assigned_to")
     .references(() => users.id),

    taskAssignedBy: varchar("task_assigned_by")
      .references(() => users.id),

    cadenceTriggeredAt: timestamp("cadence_triggered_at"),

    createdBy: varchar("created_by")
      .references(() => users.id)
      .notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("lead_poc_outreach_status_unique_idx").on(
      table.organizationId,
      table.leadId,
      table.contactId,
      table.channel
    ),
    index("lead_poc_outreach_status_lead_idx").on(
      table.organizationId,
      table.leadId
    ),
    index("lead_poc_outreach_status_contact_idx").on(
      table.organizationId,
      table.contactId
    ),
  ]
);


// ✅ Investor Outreach Activities

export const investorOutreachActivities = pgTable("investor_outreach_activities", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull(),
  investorId: integer("investor_id").notNull(),

  activityType: varchar("activity_type", { length: 80 }).notNull(),
  status: varchar("status", { length: 30 }).notNull().default("pending"),

  contactDate: timestamp("contact_date"),
  followUpDate: timestamp("follow_up_date"),
  notes: text("notes"),

  createdAt: timestamp("created_at").defaultNow(),
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
  status: varchar("status", { length: 20 }).notNull().default('pending'), // pending, completed
  createdAt: timestamp("created_at").defaultNow(),
  meetingMode: varchar("meeting_mode", { length: 20 }), // NEW
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

// ==============================
// INVESTOR RELATION (ADMIN ONLY)
// ==============================

// Investors table
export const investors = pgTable("investors", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").references(() => organizations.id).notNull(),

  createdByUserId: varchar("created_by_user_id").references(() => users.id),

  name: varchar("name", { length: 255 }).notNull(),
  // Changed to text to support multiple comma-separated sectors

  // ✅ ADD THIS LINE:
  investorType: varchar("investor_type", { length: 100 }),

  sector: text("sector"),
  location: varchar("location", { length: 255 }),
  website: varchar("website", { length: 255 }),
  description: text("description"),

  // outreach | warm | active | dealmaking
  stage: varchar("stage", { length: 20 }).notNull().default("outreach"),

  // investor-level next action tracking (separate from lead-linked outreach next actions)
  mandateStatus: varchar("mandate_status", { length: 30 }),

  cardNextActionText: text("card_next_action_text"), // card-level next action (separate from linked-investor next actions)
  cardNextActionDate: timestamp("card_next_action_date"),


  // ✅ Soft delete fields
  isDeleted: boolean("is_deleted").notNull().default(false),
  deletedAt: timestamp("deleted_at"),
  deletedBy: varchar("deleted_by").references(() => users.id),


  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Investor Contacts table (Primary POC now, multiple later)
export const investorContacts = pgTable("investor_contacts", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").references(() => organizations.id).notNull(),
  investorId: integer("investor_id").references(() => investors.id).notNull(),

  name: varchar("name", { length: 255 }),
  designation: varchar("designation", { length: 255 }),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  linkedinProfile: varchar("linkedin_profile", { length: 500 }),

  isPrimary: boolean("is_primary").notNull().default(true),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// investor data linked comapnies 
export const investorLeadLinks = pgTable(
  "investor_lead_links",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id")
      .references(() => organizations.id)
      .notNull(),

    investorId: integer("investor_id")
      .references(() => investors.id)
      .notNull(),

    leadId: integer("lead_id")
      .references(() => leads.id) // ✅ uses your existing leads table
      .notNull(),

    // NEW: Status column for the dropdown
    status: varchar("status", { length: 50 }).default('yet_to_contact'),

    selectedContactIds: integer("selected_contact_ids").array(), // ✅ New Column

    remarks: text("remarks"), // For any additional notes on this investor-lead link

    nextActionText: text("next_action_text"),
    nextActionAt: timestamp("next_action_at"),

    taskAssignedTo: varchar("task_assigned_to")
      .references(() => users.id),

    taskAssignedBy: varchar("task_assigned_by")
      .references(() => users.id),

    createdAt: timestamp("created_at").defaultNow(),


  },
  (t) => ({
    uniq: uniqueIndex("uniq_investor_lead_link").on(t.organizationId, t.investorId, t.leadId),
  })
);


// Investor POC outreach status - lead-linked investor outreach matrix
export const investorPocOutreachStatus = pgTable(
  "investor_poc_outreach_status",
  {
    id: serial("id").primaryKey(),

    organizationId: integer("organization_id")
      .references(() => organizations.id)
      .notNull(),

    leadId: integer("lead_id")
      .references(() => leads.id)
      .notNull(),

    investorId: integer("investor_id")
      .references(() => investors.id)
      .notNull(),

    contactId: integer("contact_id")
      .references(() => investorContacts.id)
      .notNull(),

    channel: varchar("channel", { length: 20 }).notNull(), // linkedin, email, whatsapp, call, channel_partner
    status: varchar("status", { length: 50 }), // initiated, 1st_follow_up, etc.

    initiatedAt: timestamp("initiated_at"),
    lastUpdatedAt: timestamp("last_updated_at").defaultNow().notNull(),

    remarks: text("remarks"),

    nextActionText: text("next_action_text"),
    nextActionAt: timestamp("next_action_at"),

    taskAssignedTo: varchar("task_assigned_to")
      .references(() => users.id),

    taskAssignedBy: varchar("task_assigned_by")
      .references(() => users.id),

    cadenceTriggeredAt: timestamp("cadence_triggered_at"),

    createdBy: varchar("created_by")
      .references(() => users.id)
      .notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("investor_poc_outreach_status_unique_idx").on(
      table.organizationId,
      table.leadId,
      table.investorId,
      table.contactId,
      table.channel
    ),
    index("investor_poc_outreach_status_lead_idx").on(
      table.organizationId,
      table.leadId,
      table.investorId
    ),
    index("investor_poc_outreach_status_contact_idx").on(
      table.organizationId,
      table.contactId
    ),
  ]
);

// ✅ NEW: Investor sandbox access
// Condition B support even if investor already existed (dedup merge)
// Any analyst who created OR imported an investor gets access via this table.
export const investorUserAccess = pgTable(
  "investor_user_access",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id")
      .references(() => organizations.id)
      .notNull(),

    investorId: integer("investor_id")
      .references(() => investors.id)
      .notNull(),

    userId: varchar("user_id")
      .references(() => users.id)
      .notNull(),

    // "create" | "import"
    source: varchar("source", { length: 20 }).notNull().default("create"),

    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => ({
    uniq: uniqueIndex("uniq_investor_user_access").on(t.organizationId, t.investorId, t.userId),
  })
);


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
export type LeadPocOutreachStatus = typeof leadPocOutreachStatus.$inferSelect;
export type UpsertLeadPocOutreachStatus = typeof leadPocOutreachStatus.$inferInsert;
export type InvestorPocOutreachStatus = typeof investorPocOutreachStatus.$inferSelect;
export type UpsertInvestorPocOutreachStatus = typeof investorPocOutreachStatus.$inferInsert;
export type Intervention = typeof interventions.$inferSelect;
export type UpsertIntervention = typeof interventions.$inferInsert;
export type ActivityLog = typeof activityLog.$inferSelect;
export type UpsertActivityLog = typeof activityLog.$inferInsert;
export type Invitation = typeof invitations.$inferSelect;
export type UpsertInvitation = typeof invitations.$inferInsert;
export type DealOutcome = typeof dealOutcomes.$inferSelect;
export type UpsertDealOutcome = typeof dealOutcomes.$inferInsert;
// investor schema
export type Investor = typeof investors.$inferSelect;
export type UpsertInvestor = typeof investors.$inferInsert;

export type InvestorContact = typeof investorContacts.$inferSelect;
export type UpsertInvestorContact = typeof investorContacts.$inferInsert;



// News Feed table
export const newsFeed = pgTable("news_feed", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").references(() => organizations.id).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  url: text("url").notNull(),
  source: varchar("source", { length: 100 }), // e.g., "VCCircle", "TechCrunch"
  category: text("category").notNull().default("leads"), // 'leads' or 'investors'
  publishedAt: timestamp("published_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export type NewsFeedItem = typeof newsFeed.$inferSelect;
export type InsertNewsFeedItem = typeof newsFeed.$inferInsert;

export const insertNewsFeedSchema = createInsertSchema(newsFeed).omit({ 
  id: true, 
  organizationId: true, // Server-controlled
  createdAt: true 
});


// Investor Events / Conferences table
export const investorEvents = pgTable(
  "investor_events",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id")
      .references(() => organizations.id)
      .notNull(),

    title: varchar("title", { length: 255 }).notNull(),
    url: text("url").notNull(),
    source: varchar("source", { length: 150 }),
    sourceType: varchar("source_type", { length: 40 }).default("google_news"),

    eventDate: timestamp("event_date"),
    publishedAt: timestamp("published_at").defaultNow(),

    city: varchar("city", { length: 120 }),
    locationText: varchar("location_text", { length: 255 }),
    organizer: varchar("organizer", { length: 255 }),

    priorityScore: integer("priority_score").default(0),
    isHyderabadPriority: boolean("is_hyderabad_priority").notNull().default(false),

    matchedInvestorType: varchar("matched_investor_type", { length: 100 }),
    matchedSectors: jsonb("matched_sectors").$type<string[]>().default(sql`'[]'::jsonb`),
    matchedKeywords: jsonb("matched_keywords").$type<string[]>().default(sql`'[]'::jsonb`),

    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    orgIdx: index("investor_events_org_idx").on(table.organizationId),
    eventDateIdx: index("investor_events_event_date_idx").on(table.eventDate),
    cityIdx: index("investor_events_city_idx").on(table.city),
  })
);

export type InvestorEvent = typeof investorEvents.$inferSelect;
export type InsertInvestorEvent = typeof investorEvents.$inferInsert;

export const insertInvestorEventSchema = createInsertSchema(investorEvents).omit({
  id: true,
  organizationId: true,
  createdAt: true,
  updatedAt: true,
});


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
  stageUpdatedAt: true, 
  createdBy: true, // ⭐ Server will set createdBy = current user
});
export const updateLeadSchema = insertLeadSchema.partial();
export const insertLeadAssignmentSchema = createInsertSchema(leadAssignments).omit({ id: true, assignedAt: true });
export const insertOutreachActivitySchema = createInsertSchema(outreachActivities).omit({ id: true, createdAt: true, updatedAt: true });
// Lead POC outreach status schema - organizationId is server-controlled, never client-provided
export const insertLeadPocOutreachStatusSchema = createInsertSchema(leadPocOutreachStatus).omit({
  id: true,
  organizationId: true,
  createdBy: true,
  createdAt: true,
  updatedAt: true,
  lastUpdatedAt: true,
  cadenceTriggeredAt: true,
});

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
// invetor schema
export const insertInvestorSchema = createInsertSchema(investors).omit({
  id: true,
  organizationId: true,
  createdByUserId: true,
  createdAt: true,
  updatedAt: true,
});




export const updateInvestorSchema = insertInvestorSchema.partial();

export const insertInvestorContactSchema = createInsertSchema(investorContacts).omit({
  id: true,
  organizationId: true,
  createdAt: true,
  updatedAt: true,
});


// Form validation schemas
export const contactFormSchema = insertContactSchema.extend({
  name: z.string().min(1, "Name is required"),
  designation: z.string().min(1, "Designation is required"),

  // ✅ LinkedIn is OPTIONAL now
  linkedinProfile: z
    .string()
    .optional()
    .nullable()
    .transform((v) => {
      const s = (v ?? "").toString().trim();
      return s.length ? s : null; // empty string -> null
    })
    .refine((v) => !v || v.includes("linkedin.com"), {
      message: "Please enter a valid LinkedIn URL",
    }),
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
// For manual form: we keep enum for type
export const interventionFormSchema = insertInterventionSchema.extend({
  type: z.enum(["linkedin_message", "call", "whatsapp", "email", "meeting", "document"]),
  scheduledAt: z.date(),
  notes: z.string().min(1, "Notes are required"),
  status: z.enum(["pending", "completed"]).default("pending"),
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
  partnerId: z.string().optional(), // For analysts: assign to a manager
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
export type InsertLeadPocOutreachStatusData = z.infer<typeof insertLeadPocOutreachStatusSchema>;
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
// investor schema 
export type InsertInvestorData = z.infer<typeof insertInvestorSchema>;
export type UpdateInvestorData = z.infer<typeof updateInvestorSchema>;
export type InsertInvestorContactData = z.infer<typeof insertInvestorContactSchema>;

// ✅ NEW TABLE: Pitching Details
// ✅ NEW TABLE: Pitching Details
export const pitchingDetails = pgTable("pitching_details", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id").notNull().references(() => leads.id),

  // 1. G-Drive
  gdriveLink: text("gdrive_link"),
  gdriveNextActionText: text("gdrive_next_action_text"),
  gdriveNextActionAt: timestamp("gdrive_next_action_at"),
  gdriveRemarks: text("gdrive_remarks"),

  // 2. Solution Note
  solutionNotePath: text("solution_note_path"),
  solutionNoteName: text("solution_note_name"),
  solutionNoteNextActionText: text("solution_note_next_action_text"),
  solutionNoteNextActionAt: timestamp("solution_note_next_action_at"),
  solutionNoteRemarks: text("solution_note_remarks"),

  // 3. PDM
  pdmPath: text("pdm_path"),
  pdmName: text("pdm_name"),
  pdmNextActionText: text("pdm_next_action_text"),
  pdmNextActionAt: timestamp("pdm_next_action_at"),
  pdmTaskAssignedTo: varchar("pdm_task_assigned_to")
    .references(() => users.id),
  pdmTaskAssignedBy: varchar("pdm_task_assigned_by")
    .references(() => users.id),
  pdmRemarks: text("pdm_remarks"),

  // 4. Meeting 1
  meeting1Date: timestamp("meeting1_date"),
  meeting1Notes: text("meeting1_notes"),
  meeting1NextActionText: text("meeting1_next_action_text"),
  meeting1NextActionAt: timestamp("meeting1_next_action_at"),
  meeting1TaskAssignedTo: varchar("meeting1_task_assigned_to")
    .references(() => users.id),
  meeting1TaskAssignedBy: varchar("meeting1_task_assigned_by")
    .references(() => users.id),
  meeting1Remarks: text("meeting1_remarks"),

  // 5. Meeting 2
  meeting2Date: timestamp("meeting2_date"),
  meeting2Notes: text("meeting2_notes"),
  meeting2NextActionText: text("meeting2_next_action_text"),
  meeting2NextActionAt: timestamp("meeting2_next_action_at"),
  meeting2TaskAssignedTo: varchar("meeting2_task_assigned_to")
    .references(() => users.id),
  meeting2TaskAssignedBy: varchar("meeting2_task_assigned_by")
    .references(() => users.id),
  meeting2Remarks: text("meeting2_remarks"),

  // 6. LOE
  loeSigned: boolean("loe_signed").default(false),
  loeNextActionText: text("loe_next_action_text"),
  loeNextActionAt: timestamp("loe_next_action_at"),
  loeTaskAssignedTo: varchar("loe_task_assigned_to")
    .references(() => users.id),
  loeTaskAssignedBy: varchar("loe_task_assigned_by")
    .references(() => users.id),
  loeRemarks: text("loe_remarks"),

  // 7. Mandate
  mandateSigned: boolean("mandate_signed").default(false),
  mandateNextActionText: text("mandate_next_action_text"),
  mandateNextActionAt: timestamp("mandate_next_action_at"),
  mandateTaskAssignedTo: varchar("mandate_task_assigned_to")
    .references(() => users.id),
  mandateTaskAssignedBy: varchar("mandate_task_assigned_by")
    .references(() => users.id),
  mandateRemarks: text("mandate_remarks"),

  // 8. Investor Check
  investorCheckNotes: text("investor_check_notes"),

  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertPitchingDetailsSchema = createInsertSchema(pitchingDetails);
export type PitchingDetail = typeof pitchingDetails.$inferSelect;
export type InsertPitchingDetail = typeof pitchingDetails.$inferInsert;


// ✅ NEW TABLE: Lead Card Solution Notes (separate from Pitching)
export const leadSolutionNotes = pgTable(
  "lead_solution_notes",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id")
      .references(() => organizations.id)
      .notNull(),
    leadId: integer("lead_id")
      .references(() => leads.id)
      .notNull(),

    pdfPath: text("pdf_path"),
    pdfName: text("pdf_name"),

    links: jsonb("links")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),

    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => [
    unique("uq_lead_solution_notes_org_lead").on(t.organizationId, t.leadId),
  ]
);

export const insertLeadSolutionNoteSchema = createInsertSchema(leadSolutionNotes);
export type LeadSolutionNote = typeof leadSolutionNotes.$inferSelect;
export type InsertLeadSolutionNote = typeof leadSolutionNotes.$inferInsert;



// ==========================================
// EPN (EXTERNAL PARTNER NETWORK) SCHEMA
// ==========================================

// 1) EPN Partners Table
export const epnPartners = pgTable("epn_partners", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id")
    .references(() => organizations.id)
    .notNull(),

  // "External Partner" column
  name: text("name").notNull(),

  // Sidebar bucket (maps to your menu structure)
  // Values: 'idfc', 'other_channel_partner', 'other_epn'
  bucket: text("bucket").notNull().default("other_epn"),

  // Category dropdown (user-selected)
  // Values like: 'channel_partner', 'agency', 'sector_expert', 'loan', 'law_firm', 'ca_firm'
  category: text("category"),

  // Stage (workflow)
  // Values: 'outreach', 'active', 'rainmaking'
  stage: text("stage").notNull().default("outreach"),

    // New fields for Add EPN details
  pocName: text("poc_name"),
  designation: text("designation"),
  phoneNumber: text("phone_number"),
  email: text("email"),
  linkedin: text("linkedin"),
  zone: text("zone"),
  city: text("city"),
  state: text("state"),
  cardNextActionText: text("card_next_action_text"), // card-level next action (separate from epn-lead link remarks/status)
  cardNextActionDate: timestamp("card_next_action_date"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// 2) EPN ↔ Lead Links (for "Linked Companies" column later)
export const epnLeadLinks = pgTable(
  "epn_lead_links",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id")
      .references(() => organizations.id)
      .notNull(),

    epnId: integer("epn_id")
      .notNull()
      .references(() => epnPartners.id),

    leadId: integer("lead_id")
      .notNull()
      .references(() => leads.id),

      // ✅ NEW: Added for Investor-Outreach style table
    status: varchar("status", { length: 50 }).default('yet_to_contact'),
    remarks: text("remarks"),

    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => [
    // Prevent duplicates (same lead linked twice to same partner in same org)
    unique("uq_epn_lead_link").on(t.organizationId, t.epnId, t.leadId),
  ]
);

// Zod Schemas for API validation
export const insertEpnPartnerSchema = createInsertSchema(epnPartners).omit({
  id: true,
  organizationId: true, // always set server-side
  createdAt: true,
  updatedAt: true,
});

export const updateEpnStageSchema = z.object({
  stage: z.enum(["outreach", "active", "rainmaking"]),
});

export type EpnPartner = typeof epnPartners.$inferSelect;
export type InsertEpnPartner = z.infer<typeof insertEpnPartnerSchema>;
