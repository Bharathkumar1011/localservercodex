// Integration: javascript_log_in_with_replit, javascript_database
import {
  users,
  organizations,
  companies,
  leads,
  contacts,
  leadAssignments,
  outreachActivities,
  leadPocOutreachStatus,
  investorPocOutreachStatus,
  interventions,
  activityLog,
  dealOutcomes,
  invitations,
  leadRemarks,
  investors,
  investorContacts,
  investorOutreachActivities,
  investorLeadLinks,
  epnPartners,
  epnLeadLinks,
  investorUserAccess,
  type User,
  type UpsertUser,
  type Organization,
  type UpsertOrganization,
  type Company,
  type UpsertCompany,
  type InsertCompanyData,
  type Lead,
  type UpsertLead,
  type Contact,
  type UpsertContact,
  type LeadAssignment,
  type UpsertLeadAssignment,
  type OutreachActivity,
  type UpsertOutreachActivity,
  type LeadPocOutreachStatus,
  type UpsertLeadPocOutreachStatus,
  type InvestorPocOutreachStatus,
  type UpsertInvestorPocOutreachStatus,
  type Intervention,
  type UpsertIntervention,
  type ActivityLog,
  type UpsertActivityLog,
  type DealOutcome,
  type UpsertDealOutcome,
  type InsertInvitationData,
  type Investor,
  type UpsertInvestor,
  type InvestorContact,
  type UpsertInvestorContact,
  type InsertInvestorData,
  pitchingDetails,
  type PitchingDetail,
  type InsertPitchingDetail,
  leadSolutionNotes,
  type LeadSolutionNote,
  type InsertLeadSolutionNote,
  EpnPartner,
} from "./shared/schema.js";
import { leadActionables } from "./shared/schema.js";
import { db } from "./db.js";
import { eq, and, desc,asc, sql, ilike, or, gte, lte, count, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { randomUUID } from 'crypto';
import {  gt } from "drizzle-orm";
import { newsFeed, type NewsFeedItem, type InsertNewsFeedItem } from "./shared/schema.js";

// Interface for storage operations
export interface IStorage {
  // Organization operations
  createOrganization(organization: UpsertOrganization): Promise<Organization>;
  getOrganization(id: number): Promise<Organization | undefined>;
  getOrganizationByAdminEmail(email: string): Promise<Organization | undefined>;
  
  // User operations
  // (IMPORTANT) these user operations are mandatory for Replit Auth.
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  getUsers(organizationId: number): Promise<User[]>;
  updateUserRole(userId: string, role: string): Promise<User | undefined>;
  deleteUser(userId: string): Promise<void>;
  getUserAnalytics(organizationId: number): Promise<{
    totalUsers: number;
    usersByRole: { [role: string]: number };
    userLeadCounts: Array<{
      userId: string;
      firstName: string;
      lastName: string;
      role: string;
      assignedLeads: number;
      leadsByStage: { [stage: string]: number };
    }>;
  }>;
  bulkAssignLeads(leadIds: number[], assignedTo: string | null): Promise<Lead[]>;

  // Team hierarchy operations
  getTeamTree(organizationId: number, userId?: string): Promise<any>;
  getAnalystsByPartner(partnerId: string, organizationId: number): Promise<User[]>;
  getInternsByAnalyst(analystId: string, organizationId: number): Promise<User[]>;
  validatePartnerOf(partnerId: string, analystId: string, organizationId: number): Promise<boolean>;
  validateAnalystOf(analystId: string, internId: string, organizationId: number): Promise<boolean>;
  assignLeadToIntern(leadId: number, internId: string, assignedBy: string, organizationId: number, notes?: string): Promise<void>;
  reassignLeadToIntern(leadId: number, fromInternId: string, toInternId: string, reassignedBy: string, organizationId: number, notes?: string): Promise<void>;
  reassignAnalyst(fromAnalystId: string, toAnalystId: string, partnerId: string, organizationId: number, moveInterns: boolean): Promise<{ leadsTransferred: number; internsTransferred: number }>;
  
  // Company operations
  createCompany(company: UpsertCompany): Promise<Company>;
  createCompanyWithDeduplication(company: InsertCompanyData, organizationId: number): Promise<{ company: Company; isExisting: boolean }>;
  getCompany(id: number, organizationId: number): Promise<Company | undefined>;
  getCompanyByNormalizedName(normalizedName: string, organizationId: number): Promise<Company | undefined>;
  updateCompany(id: number, organizationId: number, updates: Partial<UpsertCompany>): Promise<Company | undefined>;
  getCompanies(organizationId: number): Promise<Company[]>;
  bulkCreateCompaniesWithDeduplication(companies: InsertCompanyData[], organizationId: number): Promise<Array<{ company: Company; isExisting: boolean; originalIndex: number }>>;
  
  // Contact operations
  createContact(contact: UpsertContact): Promise<Contact>;
  getContact(id: number, organizationId: number): Promise<Contact | undefined>;
  getContactsByCompany(companyId: number, organizationId: number): Promise<Contact[]>;
  updateContact(id: number, organizationId: number, updates: Partial<UpsertContact>): Promise<Contact | undefined>;
  deleteContact(id: number, organizationId: number): Promise<Contact | undefined>;
  getContactManagementMetrics(
    organizationId: number,
    companyIds: number[]
  ): Promise<{
    total: number;
    rows: Array<{
      source: string;
      poc1: number;
      poc1Pct: number;
      poc2: number;
      poc2Pct: number;
      poc3: number;
      poc3Pct: number;
    }>;
  }>;

  // Lead operations
  createLead(lead: UpsertLead & { createdBy: string }): Promise<Lead>;
  // ✅ Updated to include Company and User
  getLead(id: number, organizationId: number): Promise<(Lead & { company: Company; createdByUser?: User }) | undefined>;
  getLeadsByStage(stage: string, organizationId: number): Promise<(Lead & { company: Company; contact?: Contact; assignedToUser?: User; ownerAnalystUser?: User })[]>;
  getAllLeads(organizationId: number): Promise<(Lead & { company: Company; contact?: Contact; assignedToUser?: User; ownerAnalystUser?: User })[]>;
  getLeadsByAssignee(userId: string, organizationId: number): Promise<(Lead & { company: Company; contact?: Contact; assignedToUser?: User })[]>;
  getLeadsByPartner(partnerId: string, organizationId: number): Promise<(Lead & {
  company: Company;
  contact?: Contact;
  assignedToUser?: User;
  assignedInternUsers?: User[];
  ownerAnalystUser?: User;
  createdByUser?: User;
  })[]>;
  getLeadsByCompany(companyId: number, organizationId: number): Promise<Lead[]>;
  updateLead(id: number, organizationId: number, updates: Partial<UpsertLead>): Promise<Lead | undefined>;
  updateLeadCardNextAction(
    id: number,
    organizationId: number,
    cardNextActionText: string | null,
    cardNextActionDate: Date | null
  ): Promise<Lead | undefined>;
  assignLead(
    leadId: number,
    organizationId: number,
    assignedTo: string | null | undefined,
    assignedPartnerId: string | null | undefined,
    assignedBy: string,
    notes?: string
  ): Promise<void>;
  assignInternsToLead(leadId: number, organizationId: number, internIds: string[], assignedBy: string, notes?: string): Promise<void>;
  transferLeadOwnership(organizationId: number, fromUserId: string, toUserId: string): Promise<{ transferredCount: number }>;

  // Assignment operations
  getLeadAssignments(leadId: number, organizationId: number): Promise<(LeadAssignment & { assignedByUser: User; assignedToUser: User })[]>;
  
  // Outreach operations
  createOutreachActivity(activity: UpsertOutreachActivity): Promise<OutreachActivity>;
  getOutreachActivities(leadId: number, organizationId: number): Promise<OutreachActivity[]>;
  updateOutreachActivity(id: number, organizationId: number, updates: Partial<UpsertOutreachActivity>): Promise<OutreachActivity | undefined>;
  
  // Lead-POC outreach status operations
    getLeadPocOutreachStatuses(
    leadId: number,
    organizationId: number
  ): Promise<LeadPocOutreachStatus[]>;

  getLeadPocOutreachStatusRecord(
    leadId: number,
    contactId: number,
    channel: string,
    organizationId: number
  ): Promise<LeadPocOutreachStatus | undefined>;

  upsertLeadPocOutreachStatus(
    data: UpsertLeadPocOutreachStatus
  ): Promise<LeadPocOutreachStatus>;


    getInvestorPocOutreachStatuses(
    leadId: number,
    investorId: number,
    organizationId: number
  ): Promise<InvestorPocOutreachStatus[]>;

  getInvestorPocOutreachStatusRecord(
    leadId: number,
    investorId: number,
    contactId: number,
    channel: string,
    organizationId: number
  ): Promise<InvestorPocOutreachStatus | undefined>;

  upsertInvestorPocOutreachStatus(
    data: UpsertInvestorPocOutreachStatus
  ): Promise<InvestorPocOutreachStatus>;


  // Intervention operations
  createIntervention(intervention: UpsertIntervention): Promise<Intervention>;
  getInterventions(leadId: number, organizationId: number): Promise<(Intervention & { user: User })[]>;
  getScheduledInterventions(user: User): Promise<any[]>;

  updateIntervention(id: number, organizationId: number, updates: Partial<UpsertIntervention>): Promise<Intervention | undefined>;
  deleteIntervention(id: number, organizationId: number): Promise<Intervention | undefined>;
  
  // Activity logging operations
  createActivityLog(activity: UpsertActivityLog): Promise<ActivityLog>;
  getActivityLog(organizationId: number, leadId?: number, companyId?: number, limit?: number): Promise<(ActivityLog & { user: User })[]>;
  getActivityLogsForAudit(organizationId: number, filters: {
    search?: string;
    userId?: string;
    companyId?: number;
    action?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
  }): Promise<{ data: (ActivityLog & { user: User, companyName?: string })[], total: number }>;
  
  // Challenge token operations for secure reassignments
  createChallengeToken(userId: string, organizationId: number, leadId: number, purpose: string): Promise<string>;
  validateChallengeToken(token: string, userId: string, organizationId: number, leadId: number, purpose: string): Promise<boolean>;
  cleanupExpiredTokens(): Promise<void>;
  
  // Invitation operations
  createInvitation(invitationData: InsertInvitationData & { organizationId: number }): Promise<any>;
  getInvitation(token: string): Promise<any>;
  getInvitationsByOrganization(organizationId: number): Promise<(any & { invitedByUser: User })[]>;
  getInvitationByEmail(email: string): Promise<any>;
  updateInvitationStatus(token: string, status: string, acceptedAt?: Date): Promise<any>;
  updateInvitationEmailStatus(id: number, emailStatus: string, emailSentAt?: Date, emailError?: string): Promise<any>;
  incrementInvitationRetryCount(id: number): Promise<any>;
  deleteInvitation(id: number, organizationId: number): Promise<void>;
  


    // investor poc deatils
  getInvestorContacts(investorId: number): Promise<InvestorContact[]>;
  replaceInvestorContacts(investorId: number, contacts: any[]): Promise<void>;


  // Dashboard/Analytics operations
  getDashboardMetrics(organizationId: number, userId?: string): Promise<{
    totalLeads: number;
    qualified: number;
    inOutreach: number;
    inPitching: number;
    pipelineValue: number;
    leadsCountByStage: { [stage: string]: number };
  }>;
  // ✅ Analytics Feed Methods
  getRecentStageMovements(organizationId: number, entityType: string, since: Date): Promise<any[]>;
  getRecentNotes(organizationId: number, entityType: string, since: Date): Promise<any[]>;

  getPipelineAgingStats(organizationId: number): Promise<any>; // ✅ New analytics method

 // ✅ NEW METHOD for updating investor stage
  updateInvestorStage(organizationId: number, investorId: number, stage: string): Promise<any>;

  getUniqueInvestorLocations(organizationId: number): Promise<string[]>;


  // Investor operations (Admin-only module)
  // Investor operations (Admin-only module)
  createInvestor(
    organizationId: number,
    data: InsertInvestorData,
    contactsList?: Array<any> // ✅ Changed to accept generic list from CSV
  ): Promise<{ investor: Investor; contacts: InvestorContact[] }>;

  getInvestorsByStage(
    organizationId: number,
    stage: string
  ): Promise<Array<Investor & { contacts: InvestorContact[]; linkedLeads: any[] }>>;

  getInvestorById(
    organizationId: number, 
    investorId: number
  ): Promise<(Investor & { contacts: InvestorContact[] }) | undefined>; // ✅ Return type now includes contacts

  bulkLinkInvestorsToLead(
    organizationId: number,
    leadId: number,
    selections: { investorId: number; contactIds: number[] }[] // ✅ Changed from investorIds: number[]
  ): Promise<{ count: number }>;
     // investor lead linkage 
  getInvestorLinkedLeads(
    organizationId: number,
    investorId: number
  ): Promise<Array<{ leadId: number; companyName: string; stage: string }>>;

   // Update investor details (e.g. sector)
  updateInvestor(
    organizationId: number,
    investorId: number,
    updates: Partial<Investor>
  ): Promise<Investor | undefined>;

  updateInvestorCardNextAction(
    organizationId: number,
    investorId: number,
    cardNextActionText: string | null,
    cardNextActionDate: Date | null
  ): Promise<Investor | undefined>;

  addInvestorLeadLink(
    organizationId: number,
    investorId: number,
    leadId: number
  ): Promise<{ ok: true }>;

  removeInvestorLeadLink(
    organizationId: number,
    investorId: number,
    leadId: number
  ): Promise<{ ok: true }>;

    updateInvestorLeadNextAction(
    organizationId: number,
    leadId: number,
    investorId: number,
    nextActionText: string | null,
    nextActionAt: Date | null,
    taskAssignedTo: string | null,
    taskAssignedBy: string | null
  ): Promise<any>;


    // News Feed Operations - Only declarations ✅
  getNewsFeed(organizationId: number): Promise<NewsFeedItem[]>;
  createNewsItem(data: InsertNewsFeedItem): Promise<NewsFeedItem>;

  // Dashboard table: stage counts by selected sources (analysts/partners)
  getDashboardSourceStageTable(
    organizationId: number,
    options: { includeAll: boolean; viewerUserId: string; viewerRole: string }
  ): Promise<{
    scope: 'organization' | 'personal';
    total: { qualified: number; outreach: number; pitching: number; mandates: number; universeActive: number };
    analysts: Array<{ name: string; userId?: string; qualified: number; outreach: number; pitching: number; mandates: number; universeActive: number }>;
    partners: Array<{ name: string; userId?: string; qualified: number; outreach: number; pitching: number; mandates: number; universeActive: number }>;
  }>;

    // ✅ ADD THESE TWO LINES:
  getPitchingDetails(leadId: number): Promise<PitchingDetail | undefined>;
  upsertPitchingDetails(leadId: number, data: Partial<InsertPitchingDetail>): Promise<PitchingDetail>;

  getLeadSolutionNote(organizationId: number, leadId: number): Promise<LeadSolutionNote | undefined>;
  upsertLeadSolutionNote(
    organizationId: number,
    leadId: number,
    data: Partial<InsertLeadSolutionNote>
  ): Promise<LeadSolutionNote>;

  getInvestorMetrics(organizationId: number): Promise<{
    totalInvestors: number;
    outreach: number;
    active: number;
    warm: number;
    dealmaking: number;
  }>;

  getLinkageMetrics(organizationId: number): Promise<{
    totalActiveLeads: number;
    linkedActiveLeads: number;
    totalInvestors: number;
    linkedInvestors: number;
    totalLinks: number;
  }>;



  // ✅ NEW METHOD for Investor Other Fields
  getInvestorsForOtherFields(
  organizationId: number,
  user?: any,
  selectedStages?: string[]
): Promise<Investor[]>;



    // EPN operations
  getEpnUniverse(organizationId: number): Promise<any[]>;
  getEpnByBucket(organizationId: number, bucket: string): Promise<any[]>;
  getEpnByBucketStage(organizationId: number, bucket: string, stage: string): Promise<any[]>;
  getEpnBucketMetrics(organizationId: number, bucket: string): Promise<{ total: number, outreach: number, active: number, rainmaking: number }>;
  getIdfcLeadTrackerReport(
    organizationId: number,
    options?: {
      filters?: {
        serialNumber?: string;
        rmName?: string;
        designation?: string;
        rmCity?: string;
        rmStage?: string;
        bucket?: string;
        leadName?: string;
        leadCity?: string;
        leadStage?: string;
        relationshipStatus?: string;
        linkRemarks?: string;
        linkedAt?: string;
      };
      selectedRows?: Array<{
        epnId: number;
        leadId: number;
      }>;
    }
  ): Promise<any[]>;

  getIdfcRmSummaryReport(organizationId: number): Promise<any[]>;
  getEpnLevelReport(organizationId: number, bucket?: string): Promise<any[]>;
  createEpnPartner(organizationId: number, data: any): Promise<any>;
  updateEpnStage(organizationId: number, epnId: number, stage: string): Promise<any>;
  createEpnPartnersBulk(organizationId: number, partners: any[]): Promise<any[]>;

  // --- EPN Linkage Methods ---
// --- EPN Linkage Methods ---
  getLinkedEpnsForLead(orgId: number, leadId: number): Promise<any[]>; // ✅ Changed to any[] to include link data
  linkEpnToLead(orgId: number, epnId: number, leadId: number): Promise<any>;
  updateEpnLinkStatus(orgId: number, epnId: number, leadId: number, status: string): Promise<any>; // ✅ NEW
  updateEpnLinkRemarks(orgId: number, epnId: number, leadId: number, remarks: string): Promise<any>; // ✅ NEW

  getEpnLinksForLeadStage(orgId: number, leadStage: string): Promise<Array<{ leadId: number; epns: EpnPartner[] }>>;
  unlinkEpnFromLead(orgId: number, epnId: number, leadId: number): Promise<void>;
  syncEpnPartnerStage(orgId: number, epnId: number): Promise<void>; // ✅ ADD THIS LINE

  // --- Investor Linkage Method (Unlink) ---
  unlinkInvestorFromLead(orgId: number, investorId: number, leadId: number): Promise<void>;

  // User management operations
  updateEpnCategory(orgId: number, epnId: number, category: string | null): Promise<any>;

  // Additional method to fetch EPN details by ID (used in lead details view)
  getEpnById(organizationId: number, epnId: number): Promise<EpnPartner | undefined>;
  getLinkedLeadsForEpn(organizationId: number, epnId: number): Promise<any[]>;

  updateEpnPartnerDetails(orgId: number, epnId: number, data: any): Promise<any>;

  updateEpnCardNextAction(
    orgId: number,
    epnId: number,
    cardNextActionText: string | null,
    cardNextActionDate: Date | null
  ): Promise<any>;

  // ✅ NEW: Dashboard Activity & Momentum Methods
  getUserActivitySummary(organizationId: number): Promise<any[]>;
  getWeeklyMomentum(organizationId: number): Promise<any>;

  // ✅ NEW: Audit Analytics Methods
  getAuditOverviewMetrics(organizationId: number): Promise<any>;
  getAuditUserSummaries(organizationId: number): Promise<any[]>;
  getAuditUserProfile(organizationId: number, userId: string, window: string): Promise<any | null>;
  getAuditUserLeadDetails(organizationId: number, userId: string, window: string): Promise<any>;
  getAuditUserInvestorDetails(organizationId: number, userId: string, window: string): Promise<any>;
  getAuditUserEpnDetails(organizationId: number, userId: string, window: string): Promise<any>;
  getAuditUserTimeline(
    organizationId: number,
    userId: string,
    window: string,
    limit?: number
  ): Promise<any[]>;
}


// In-memory challenge token storage
interface ChallengeToken {
  token: string;
  userId: string;
  organizationId: number;
  leadId: number;
  purpose: string;
  expiresAt: Date;
  createdAt: Date;
}

// Rate limiting storage
interface RateLimit {
  count: number;
  resetTime: Date;
}

export class DatabaseStorage implements IStorage {
  // In-memory storage for challenge tokens and rate limiting
  private challengeTokens = new Map<string, ChallengeToken>();
  private rateLimits = new Map<string, RateLimit>();
  
  // Challenge token configuration
  private readonly TOKEN_EXPIRY_MINUTES = 5; // Tokens expire in 5 minutes
  private readonly RATE_LIMIT_PER_HOUR = 10; // Max 10 token requests per user per hour

    private getAuditWindowStart(window: string): Date {
    const now = new Date();

    if (window === "30d") {
      const start = new Date(now);
      start.setDate(start.getDate() - 30);
      return start;
    }

    if (window === "15d") {
      const start = new Date(now);
      start.setDate(start.getDate() - 15);
      return start;
    }

    return new Date(now.getTime() - 24 * 60 * 60 * 1000);
  }

  private getStartOfToday(): Date {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return start;
  }

  private isAuditStageChangeAction(action?: string | null): boolean {
    return /stage/i.test(action || "");
  }

  private isAuditLeadCreatedAction(action?: string | null): boolean {
    return /(lead.*created|lead.*added|lead.*import|bulk.*lead|created.*lead|added.*lead)/i.test(action || "");
  }

  private isAuditInvestorCreatedAction(action?: string | null): boolean {
    return /(investor.*created|investor.*added|investor.*import|bulk.*investor|created.*investor|added.*investor)/i.test(action || "");
  }

  private isAuditEpnCreatedAction(action?: string | null): boolean {
    return /(epn.*created|epn.*added|epn.*import|bulk.*epn|created.*epn|added.*epn|epn_partner.*created)/i.test(action || "");
  }

  private detectAuditAddSource(action?: string | null, description?: string | null): "single_add" | "csv_upload" | "bulk_import" | "other" {
    const combined = `${action || ""} ${description || ""}`.toLowerCase();

    if (combined.includes("csv")) return "csv_upload";
    if (combined.includes("bulk")) return "bulk_import";
    if (
      combined.includes("create") ||
      combined.includes("created") ||
      combined.includes("add") ||
      combined.includes("added") ||
      combined.includes("import")
    ) {
      return "single_add";
    }

    return "other";
  }

  private buildAuditSourceBreakdown(logs: any[]) {
    const summary = {
      singleAdd: 0,
      csvUpload: 0,
      bulkImport: 0,
      other: 0,
    };

    for (const log of logs) {
      const source = this.detectAuditAddSource(log.action, log.description);
      if (source === "single_add") summary.singleAdd += 1;
      else if (source === "csv_upload") summary.csvUpload += 1;
      else if (source === "bulk_import") summary.bulkImport += 1;
      else summary.other += 1;
    }

    return summary;
  }

  // Organization operations
  async createOrganization(organizationData: UpsertOrganization): Promise<Organization> {
    const [organization] = await db.insert(organizations).values(organizationData).returning();
    return organization;
  }

  async getOrganization(id: number): Promise<Organization | undefined> {
    const [organization] = await db.select().from(organizations).where(eq(organizations.id, id));
    return organization;
  }

  async getOrganizationByAdminEmail(email: string): Promise<Organization | undefined> {
    const [organization] = await db.select().from(organizations).where(eq(organizations.adminEmail, email));
    return organization;
  }
  
    async getLeadRemarks(leadId: number, organizationId: number) {
    return db
      .select()
      .from(leadRemarks)
      .where(and(
        eq(leadRemarks.leadId, leadId),
        eq(leadRemarks.organizationId, organizationId)
      ))
      .orderBy(desc(leadRemarks.createdAt));
  }

  async addLeadRemark(leadId: number, organizationId: number, userId: string, remark: string) {
    const [inserted] = await db.insert(leadRemarks).values({
      leadId,
      organizationId,
      userId,
      remark,
    }).returning();

    return inserted;
  }

  async deleteLeadRemark(id: number, organizationId: number) {
    return db
      .delete(leadRemarks)
      .where(
        and(
          eq(leadRemarks.id, id),
          eq(leadRemarks.organizationId, organizationId)
        )
      );
  }




// ---- ACTIONABLES ----
async getLeadActionables(leadId: number, organizationId: number) {
  return db
    .select()
    .from(leadActionables)
    .where(
      and(
        eq(leadActionables.leadId, leadId),
        eq(leadActionables.organizationId, organizationId)
      )
    )
    .orderBy(desc(leadActionables.createdAt));
}

// --------------------------------------------
// UPCOMING TASKS for a specific lead
// --------------------------------------------
async getUpcomingTasksForLead(leadId: number, organizationId: number) {
  return db
    .select()
    .from(interventions)
    .where(
      and(
        eq(interventions.leadId, leadId),
        eq(interventions.organizationId, organizationId),
        eq(interventions.status, "pending"),
        gt(interventions.scheduledAt, new Date()) // only future tasks
      )
    )
    .orderBy(interventions.scheduledAt);
}


async addLeadActionable(leadId: number, organizationId: number, userId: string, text: string) {
  const [inserted] = await db
    .insert(leadActionables)
    .values({
      leadId,
      organizationId,
      userId,
      text,
    })
    .returning();
  return inserted;
}

async deleteLeadActionable(id: number, organizationId: number) {
  return db
    .delete(leadActionables)
    .where(
      and(
        eq(leadActionables.id, id),
        eq(leadActionables.organizationId, organizationId)
      )
    );
}
// Return ALL actionables for a lead (used in leadRoutes)
async getActionablesByLead(leadId: number, organizationId: number) {
  return db
    .select()
    .from(leadActionables)
    .where(
      and(
        eq(leadActionables.leadId, leadId),
        eq(leadActionables.organizationId, organizationId)
      )
    )
    .orderBy(desc(leadActionables.createdAt));
}





  // News Feed Operations - Implementations ✅
  async getNewsFeed(organizationId: number, category: string = 'leads'): Promise<NewsFeedItem[]> {
    return db
      .select()
      .from(newsFeed)
      .where(and(
        eq(newsFeed.organizationId, organizationId),
        eq(newsFeed.category, category) // ✅ Filter by category
      ))
      
      .orderBy(desc(newsFeed.publishedAt))
      .limit(15);
  }

  // Inside your DatabaseStorage class
async clearNewsFeed(organizationId: number, category: string): Promise<void> {
  await db
    .delete(newsFeed)
    .where(and(
      eq(newsFeed.organizationId, organizationId),
      eq(newsFeed.category, category)
    ));
}

  // Ensure there is a COLON (:) after 'data', not an equals sign
    async createNewsItem(data: InsertNewsFeedItem): Promise<NewsFeedItem> {
      // Ensure you are inserting into 'newsFeed' (the table), NOT 'InsertNewsFeedItem' (the type)
      const [item] = await db.insert(newsFeed).values(data).returning();
      return item;
    }
  


  // User operations
  // (IMPORTANT) these user operations are mandatory for Replit Auth.

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async getUsers(organizationId: number): Promise<User[]> {
    return db.select().from(users).where(eq(users.organizationId, organizationId)).orderBy(desc(users.createdAt));
  }

  async deleteUser(userId: string): Promise<void> {
    await db.delete(users).where(eq(users.id, userId));
  }

  // Company operations
  async createCompany(companyData: UpsertCompany): Promise<Company> {
    // SECURITY: Always normalize and check for duplicates, even in direct calls
    if (!companyData.name) {
      throw new Error("Company name is required");
    }

    // Ensure organizationId is present
    if (!companyData.organizationId) {
      throw new Error("Organization ID is required");
    }

    const normalizedName = companyData.name.toLowerCase().trim();
    
    // Check for existing company with same normalized name
    const existingCompany = await this.getCompanyByNormalizedName(normalizedName, companyData.organizationId);
    if (existingCompany) {
      throw new Error(`Company with name "${companyData.name}" already exists in this organization`);
    }

    // Add normalized name to company data
    const finalCompanyData = {
      ...companyData,
      normalizedName,
    };

    const [company] = await db.insert(companies).values(finalCompanyData).returning();
    return company;
  }

  async getCompany(id: number, organizationId: number): Promise<Company | undefined> {
    const [company] = await db.select().from(companies).where(and(eq(companies.id, id), eq(companies.organizationId, organizationId)));
    return company;
  }

  async updateCompany(id: number, organizationId: number, updates: Partial<UpsertCompany>): Promise<Company | undefined> {
    // If name is being updated, also update normalizedName and check for duplicates
    let finalUpdates = { ...updates, updatedAt: new Date() };
    
    if (updates.name) {
      const normalizedName = updates.name.toLowerCase().trim();
      
      // Check if this normalized name already exists (excluding current company)
      const existingCompany = await db
        .select()
        .from(companies)
        .where(and(
          eq(companies.normalizedName, normalizedName),
          eq(companies.organizationId, organizationId),
          sql`${companies.id} != ${id}` // Exclude current company
        ));
      
      if (existingCompany.length > 0) {
        throw new Error(`Company with name "${updates.name}" already exists in this organization`);
      }
      
      finalUpdates.normalizedName = normalizedName;
    }

    const [company] = await db
      .update(companies)
      .set(finalUpdates)
      .where(and(eq(companies.id, id), eq(companies.organizationId, organizationId)))
      .returning();
    return company;
  }

  async getCompanies(organizationId: number): Promise<Company[]> {
    return db.select().from(companies).where(eq(companies.organizationId, organizationId)).orderBy(desc(companies.createdAt));
  }

  async getCompanyByNormalizedName(normalizedName: string, organizationId: number): Promise<Company | undefined> {
    const [company] = await db
      .select()
      .from(companies)
      .where(and(
        eq(companies.normalizedName, normalizedName),
        eq(companies.organizationId, organizationId)
      ));
    return company;
  }

  // async createCompanyWithDeduplication(companyData: InsertCompanyData, organizationId: number): Promise<{ company: Company; isExisting: boolean }> {
  //   // Normalize company name for deduplication check
  //   const normalizedName = companyData.name?.toLowerCase().trim();
  //   if (!normalizedName) {
  //     throw new Error("Company name is required");
  //   }

  //   // Check if company already exists
  //   const existingCompany = await this.getCompanyByNormalizedName(normalizedName, organizationId);
    
  //   if (existingCompany) {
  //     return { company: existingCompany, isExisting: true };
  //   }

  //   // Create new company with normalized name
  //   const newCompanyData = {
  //     ...companyData,
  //     organizationId,
  //     normalizedName,
  //   };

  //   const company = await this.createCompany(newCompanyData);
  //   return { company, isExisting: false };
  // }


    // ==============================
  // INVESTOR RELATION (ADMIN ONLY)
  // ==============================

// Updated to accept multiple contacts
  // 3. Updated Create: Loops through the list and saves ALL contacts
  async createInvestor(organizationId: number, data: InsertInvestorData, contactsList: Array<any> = [], createdByUserId?: string, accessSource: "create" | "import" = "create") {
    // Insert Investor
    const [investor] = await db
      .insert(investors)
      .values({
        organizationId,
        name: data.name,
        createdByUserId: createdByUserId || null,
        // ✅ ADD THIS LINE to save the data:
        investorType: (data as any).investorType ?? null,
        sector: data.sector ?? null,
        location: data.location ?? null,
        website: data.website ?? null,
        description: data.description ?? null,
        stage: (data as any).stage ?? "outreach",
      })
      .returning();

        await db
          .insert(investorUserAccess)
          .values({
            organizationId,
            investorId: investor.id,
            userId: createdByUserId,
            source: accessSource,
          })
          .onConflictDoNothing({
            target: [investorUserAccess.organizationId, investorUserAccess.investorId, investorUserAccess.userId],
          });

    const createdContacts: InvestorContact[] = [];

    // Filter valid contacts
    const validContacts = contactsList.filter((c) => {
      const name = String(c?.name || "").trim();
      const email = String(c?.email || "").trim();
      const phone = String(c?.phone || "").trim();
      const linkedin = String(c?.linkedinProfile || c?.linkedin || "").trim();
      // keep if any useful field exists
      return !!(name || email || phone || linkedin);
    });

    if (validContacts.length > 0) {
      const toInsert = validContacts.map((contact, index) => ({
        organizationId,
        investorId: investor.id,
        name: contact.name,
        designation: contact.designation || "Investor",
        email: contact.email || null,
        phone: contact.phone || null,
        linkedinProfile: contact.linkedinProfile || contact.linkedin || null, // Handle variations
        isPrimary: index === 0, // First one is primary
      }));

      // Batch insert contacts
      const inserted = await db
        .insert(investorContacts)
        .values(toInsert)
        .returning();
      
      createdContacts.push(...inserted);
    }

    return { investor, contacts: createdContacts };
  }


// ✅ UPDATED: Fallback to legacy data if no new contacts exist
  async getInvestorContacts(investorId: number): Promise<InvestorContact[]> {
    // 1. Try to get contacts from the new table
    const contacts = await db
      .select()
      .from(investorContacts)
      .where(eq(investorContacts.investorId, investorId))
      .orderBy(desc(investorContacts.isPrimary), asc(investorContacts.id));

    // 2. If contacts exist, return them
    if (contacts.length > 0) {
      return contacts;
    }

    // 3. FALLBACK: Check if legacy data exists in the 'investors' table
    const [investor] = await db
      .select()
      .from(investors)
      .where(eq(investors.id, investorId));

    // If we have legacy data (e.g. a pocName exists), format it as a contact
    if (investor && (investor as any).name) { // Logic: If investor exists, try to extract POC info
       const legacyName = (investor as any).pocName || (investor as any).name; // Fallback logic
       
       // Only return if there is actually a POC name stored in the old columns
       // Note: You might need to check your exact column names in schema.ts if they differ
       // Assuming specific columns weren't in schema but passed in "data" previously, 
       // standard practice is to just return empty if the new table is empty unless you migrate data.
       // However, based on your previous 'createInvestor' inputs, you likely have data.
       
       // If you really want to see the old data, we return a "Virtual" contact:
       return [{
        id: -1, // Dummy ID
        organizationId: investor.organizationId,
        investorId: investor.id,
        name: "Primary Contact", // Or fetch from legacy column if it exists in schema
        designation: "Unknown",
        email: null,
        phone: null,
        linkedinProfile: null,
        isPrimary: true,
        isComplete: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }];
    }

    return [];
  }


  
 async replaceInvestorContacts(investorId: number, contactsList: any[]): Promise<void> {
  // ✅ Always derive orgId from the investor row (source of truth)
  const [inv] = await db
    .select({ organizationId: investors.organizationId })
    .from(investors)
    .where(eq(investors.id, investorId));

  if (!inv?.organizationId) {
    throw new Error("Investor not found");
  }
  const orgId = inv.organizationId;

  // ✅ Do NOT use getInvestorContacts() here (it has fallback/virtual behavior)
  const existing = await db
    .select()
    .from(investorContacts)
    .where(eq(investorContacts.investorId, investorId));

  const existingIds = new Set(existing.map((c) => c.id));

  const incomingIds = new Set(
    (contactsList || [])
      .map((c: any) => c?.id)
      .filter((id: any) => Number.isFinite(id) && Number(id) > 0)
      .map((id: any) => Number(id))
  );

  // 1) Delete removed contacts
  const toDelete = existing.filter((c) => !incomingIds.has(c.id));
  if (toDelete.length > 0) {
    await db
      .delete(investorContacts)
      .where(inArray(investorContacts.id, toDelete.map((c) => c.id)));
  }

  // 2) Update / Insert
  for (let index = 0; index < (contactsList || []).length; index++) {
    const contact = contactsList[index];
    const isPrimary = index === 0;

    // Skip completely empty rows
    if (!contact?.name || !String(contact.name).trim()) continue;

    const payload = {
      name: String(contact.name).trim(),
      designation: contact.designation || "Investor",
      email: contact.email || null,
      phone: contact.phone || null,
      // ✅ FIX: accept linkedinProfile (client) and linkedin (legacy)
      linkedinProfile: contact.linkedinProfile || contact.linkedin || null,
      isPrimary,
    };

    if (contact.id && existingIds.has(contact.id)) {
      await db
        .update(investorContacts)
        .set(payload)
        .where(eq(investorContacts.id, contact.id));
    } else {
      await db.insert(investorContacts).values({
        organizationId: orgId,
        investorId,
        ...payload,
      });
    }
  }
}



  private leadSandboxSql(userId: string) {
    // A lead is "in analyst sandbox" if analyst owns it / assigned / created / intern list contains them
    // Note: assignedInterns is text[] in schema, so we use ANY() check.
    return or(
      eq(leads.ownerAnalystId, userId),
      eq(leads.assignedTo, userId),
      eq(leads.createdBy, userId),
      sql`${userId} = ANY(${leads.assignedInterns})`
    );
  }

  private async canUserSeeInvestor(organizationId: number, user: any, investorId: number): Promise<boolean> {
    // Admin/Partner see everything
    if (user?.role === "admin" || user?.role === "partner") return true;

    const userId = String(user?.id || "");
    if (!userId) return false;

    // Condition B: createdBy OR access record exists
    const [b] = await db
      .select({ id: investors.id })
      .from(investors)
      .leftJoin(
        investorUserAccess,
        and(
          eq(investorUserAccess.organizationId, organizationId),
          eq(investorUserAccess.investorId, investors.id),
          eq(investorUserAccess.userId, userId)
        )
      )
      .where(
        and(
          eq(investors.organizationId, organizationId),
          eq(investors.id, investorId),
          or(eq(investors.createdByUserId, userId), sql`${investorUserAccess.id} IS NOT NULL`)
        )
      );

    if (b) return true;

    // Condition A: linked to a lead in analyst sandbox
    const [a] = await db
      .select({ id: investorLeadLinks.id })
      .from(investorLeadLinks)
      .innerJoin(leads, eq(investorLeadLinks.leadId, leads.id))
      .where(
        and(
          eq(investorLeadLinks.organizationId, organizationId),
          eq(investorLeadLinks.investorId, investorId),
          eq(leads.organizationId, organizationId),
          this.leadSandboxSql(userId)
        )
      );

    return !!a;
  }


  
  // ==========================================
  // INVESTOR METHODS (CORRECTED)
  // ==========================================

  // 1. Updated Fetch: Efficiently fetches investors AND their contacts
  // async getInvestorsByStage(organizationId: number, stage: string, user?: any) {
  //   // A. Filter Investors by Organization and Stage
  //   const conditions: any[] = [eq(investors.organizationId, organizationId)];
  //   if (stage !== "all") conditions.push(eq(investors.stage, stage));

    // ✅ Analyst sandbox filter
    // if (user && user.role === "analyst") {
    //   const userId = String(user.id);

    //   conditions.push(
    //     or(
    //       // Condition B: created by user
    //       eq(investors.createdByUserId, userId),

    //       // Condition B: access record (import/create)
    //       sql`EXISTS (
    //         SELECT 1 FROM investor_user_access iua
    //         WHERE iua.organization_id = ${organizationId}
    //           AND iua.investor_id = ${investors.id}
    //           AND iua.user_id = ${userId}
    //       )`,

    //       // Condition A: linked to lead where analyst is assigned
    //       sql`EXISTS (
    //         SELECT 1
    //         FROM investor_lead_links ill
    //         JOIN leads l ON l.id = ill.lead_id
    //         WHERE ill.organization_id = ${organizationId}
    //           AND ill.investor_id = ${investors.id}
    //           AND l.organization_id = ${organizationId}
    //           AND (
    //             l.owner_analyst_id = ${userId}
    //             OR l.assigned_to = ${userId}
    //             OR l.created_by = ${userId}
    //             OR ${userId} = ANY(l.assigned_interns)
    //           )
    //       )`
    //     )
    //   );
    // }

    // const investorsList = await db
    //   .select()
    //   .from(investors)
    //   .where(and(...conditions))
    //   .orderBy(asc(investors.name)); // ✅ NEW: Sorts Alphabetically (A-Z)
    // if (investorsList.length === 0) return [];

    // const investorIds = investorsList.map((i) => i.id);
async getInvestorsByStage(organizationId: number, stage: string, user?: any) {
  const perfStart = Date.now();
  console.log(`[PERF][STORAGE] getInvestorsByStage start stage=${stage}`);
    // A. Filter Investors by Organization and Stage
    const conditions: any[] = [eq(investors.organizationId, organizationId)];
    if (stage !== "all") conditions.push(eq(investors.stage, stage));

    // ✅ HYBRID ANALYST VISIBILITY
    // If analyst is viewing later stages (active, warm, dealmaking), 
    // ONLY show investors they created OR have linked to their leads.
    // "all" and "outreach" stages bypass this to show the master org-wide list.
    if (user && user.role === "analyst" && stage !== "all" && stage !== "outreach") {
      const userId = String(user.id);

      conditions.push(
        or(
          // Condition 1: created by user
          eq(investors.createdByUserId, userId),

          // Condition 2: access record exists (from importing)
          sql`EXISTS (
            SELECT 1 FROM investor_user_access iua
            WHERE iua.organization_id = ${organizationId}
              AND iua.investor_id = ${investors.id}
              AND iua.user_id = ${userId}
          )`,

          // Condition 3: linked to a lead where analyst is assigned/owner
          sql`EXISTS (
            SELECT 1
            FROM investor_lead_links ill
            JOIN leads l ON l.id = ill.lead_id
            WHERE ill.organization_id = ${organizationId}
              AND ill.investor_id = ${investors.id}
              AND l.organization_id = ${organizationId}
              AND (
                l.owner_analyst_id = ${userId}
                OR l.assigned_to = ${userId}
                OR l.created_by = ${userId}
                OR ${userId} = ANY(l.assigned_interns)
              )
          )`
        )
      );
    }

    const investorsQueryStart = Date.now();

    const investorsList = await db
      .select()
      .from(investors)
      .where(and(...conditions))
      .orderBy(asc(investors.name));

    console.log(
      `[PERF][STORAGE] investors base query stage=${stage} rows=${investorsList.length} ms=${Date.now() - investorsQueryStart}`
    );
      
    if (investorsList.length === 0) return [];
    
    const investorIds = investorsList.map((i) => i.id);
    
    // ... leave the rest of the method exactly as it is (Contacts mapping, etc)
    // B. ✅ Bulk Fetch ALL Contacts for these investors
    // Sorting by Primary first ensures they appear correctly in the UI cards
    const contactsQueryStart = Date.now();

    const contactsList = await db
      .select()
      .from(investorContacts)
      .where(inArray(investorContacts.investorId, investorIds))
      .orderBy(desc(investorContacts.isPrimary), desc(investorContacts.id));

    console.log(
      `[PERF][STORAGE] investor contacts query stage=${stage} rows=${contactsList.length} ms=${Date.now() - contactsQueryStart}`
    );

    // C. Bulk Fetch Linked Leads
const linksQueryStart = Date.now();

const links = await db
  .select({
    investorId: investorLeadLinks.investorId,
    leadId: leads.id,
    companyName: companies.name,
  })
  .from(investorLeadLinks)
  .innerJoin(leads, eq(investorLeadLinks.leadId, leads.id))
  .innerJoin(companies, eq(leads.companyId, companies.id))
  .where(inArray(investorLeadLinks.investorId, investorIds));

console.log(
  `[PERF][STORAGE] investor linked leads query stage=${stage} rows=${links.length} ms=${Date.now() - linksQueryStart}`
);

    // D. Map data efficiently
    const contactsMap = new Map<number, InvestorContact[]>();
    contactsList.forEach((c) => {
      if (!contactsMap.has(c.investorId)) contactsMap.set(c.investorId, []);
      contactsMap.get(c.investorId)!.push(c);
    });

    const linksMap = new Map<number, any[]>();
    links.forEach((l) => {
      if (!linksMap.has(l.investorId)) linksMap.set(l.investorId, []);
      linksMap.get(l.investorId)!.push({
        leadId: l.leadId,
        companyName: l.companyName,
      });
    });

    // E. Return combined object
const mappingStart = Date.now();

const finalRows = investorsList.map((inv) => {
  const contacts = contactsMap.get(inv.id) || [];
  return {
    ...inv,
    contacts: contacts,
    primaryPoc: contacts.find(c => c.isPrimary) || contacts[0],
    linkedLeads: linksMap.get(inv.id) || [],
  };
});

console.log(
  `[PERF][STORAGE] mapping stage=${stage} rows=${finalRows.length} ms=${Date.now() - mappingStart}`
);

console.log(
  `[PERF][STORAGE] getInvestorsByStage end stage=${stage} total_ms=${Date.now() - perfStart}`
);

return finalRows;
  }

 // 2. Updated Single Fetch: ✅ NOW INCLUDES CONTACTS
  // This fixes the "Edit Investor" page showing empty contacts
  async getInvestorById(organizationId: number, investorId: number, user?: any) {
    // A. Get Investor
    const [investor] = await db
      .select()
      .from(investors)
      .where(
        and(
          eq(investors.organizationId, organizationId),
          eq(investors.id, investorId)
        )
      );

    if (!investor) return undefined;

      // if (user && user.role === "analyst") {
      //   const ok = await this.canUserSeeInvestor(organizationId, user, investorId);
      //   if (!ok) return undefined;
      // }
     // ✅ Analyst restriction removed so they can view the details of any investor

    // B. Get Contacts
const contactsList = await db
  .select()
  .from(investorContacts)
  .where(eq(investorContacts.investorId, investorId))
  .orderBy(desc(investorContacts.isPrimary), asc(investorContacts.id)); // Primary first


    // C. Return combined
    return { ...investor, contacts: contactsList };
  }



async createCompanyWithDeduplication(companyData: any, organizationId: number) {
  const normalizedName = companyData.name?.toLowerCase().trim();
  if (!normalizedName) throw new Error("Company name is required");

  const [existingCompany] = await db
    .select()
    .from(companies)
    .where(
      and(
        eq(companies.organizationId, organizationId),
        sql`LOWER(TRIM(${companies.name})) = ${normalizedName}`
      )
    );

  const buildPatch = (incoming: any, existing?: any) => {
    const patch: any = {};

    const fields = [
      "sector",
      "subSector",
      "location",
      "financialYear",
      "revenueInrCr",
      "ebitdaInrCr",
      "patInrCr",
      "foundedYear",
      "businessDescription",
      "products",
      "website",
      "industry",
      "statusNextSteps",
      "remarksFromDinesh",
      "priority",
      "leadStatus",
      "analystFocSfca",
      "bdFocSfca",
      "chatgptSummaryReason",
      "chatgptProposedOffering",
      "driveLink",
      "collateral",
      "description",
      "channelPartner",
    ];

    for (const field of fields) {
      const incomingValue = incoming[field];

      if (
        incomingValue !== undefined &&
        incomingValue !== null &&
        String(incomingValue).trim?.() !== ""
      ) {
        const existingValue = existing?.[field];

        const existingBlank =
          existingValue === undefined ||
          existingValue === null ||
          String(existingValue).trim?.() === "";

        if (existingBlank || String(existingValue) !== String(incomingValue)) {
          patch[field] = incomingValue;
        }
      }
    }

    return patch;
  };

  if (existingCompany) {
    const patch = buildPatch(companyData, existingCompany);

    if (Object.keys(patch).length === 0) {
      return {
        company: existingCompany,
        isExisting: true,
        wasUpdated: false,
        updatedFields: [],
      };
    }

    const [updatedCompany] = await db
      .update(companies)
      .set({
        ...patch,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(companies.id, existingCompany.id),
          eq(companies.organizationId, organizationId)
        )
      )
      .returning();

    return {
      company: updatedCompany,
      isExisting: true,
      wasUpdated: true,
      updatedFields: Object.keys(patch),
    };
  }

  const [company] = await db
    .insert(companies)
    .values({
      ...companyData,
      organizationId,
      normalizedName,
    })
    .returning();

  return {
    company,
    isExisting: false,
    wasUpdated: false,
    updatedFields: [],
  };
}

  async bulkCreateCompaniesWithDeduplication(companiesData: InsertCompanyData[], organizationId: number): Promise<Array<{ company: Company; isExisting: boolean; originalIndex: number }>> {
    const results: Array<{ company: Company; isExisting: boolean; originalIndex: number }> = [];

    for (let i = 0; i < companiesData.length; i++) {
      const companyData = companiesData[i];
      try {
        const result = await this.createCompanyWithDeduplication(companyData, organizationId);
        results.push({
          ...result,
          originalIndex: i,
        });
      } catch (error) {
        console.error(`Failed to create company at index ${i}:`, error);
        // Continue with next company instead of failing entire batch
      }
    }

    return results;
  }

  // Contact operations
  async createContact(contactData: UpsertContact): Promise<Contact> {
    // Check if all mandatory fields are present to set isComplete
    const isComplete = !!(
      contactData.name && contactData.name.trim() &&
      contactData.designation && contactData.designation.trim()
    );
    const [contact] = await db
      .insert(contacts)
      .values({ ...contactData, isComplete })
      .returning();
    return contact;
  }

  async getContact(id: number, organizationId: number): Promise<Contact | undefined> {
    const [contact] = await db.select().from(contacts).where(and(eq(contacts.id, id), eq(contacts.organizationId, organizationId)));
    return contact;
  }

  async getContactsByCompany(companyId: number, organizationId: number): Promise<Contact[]> {
    return db.select().from(contacts).where(and(eq(contacts.companyId, companyId), eq(contacts.organizationId, organizationId)));
  }

  async updateContact(id: number, organizationId: number, updates: Partial<UpsertContact>): Promise<Contact | undefined> {
    // Check if all mandatory fields are present after update
    const current = await this.getContact(id, organizationId);
    if (!current) return undefined;
    
    const updatedData = { ...current, ...updates };
    const isComplete = !!(
      updatedData.name && String(updatedData.name).trim() &&
      updatedData.designation && String(updatedData.designation).trim()
    );
    
    const [contact] = await db
      .update(contacts)
      .set({ ...updates, isComplete, updatedAt: new Date() })
      .where(and(eq(contacts.id, id), eq(contacts.organizationId, organizationId)))
      .returning();
    return contact;
  }

  async deleteContact(id: number, organizationId: number): Promise<Contact | undefined> {
    const [contact] = await db
      .delete(contacts)
      .where(and(eq(contacts.id, id), eq(contacts.organizationId, organizationId)))
      .returning();
    return contact;
  }

    async getContactManagementMetrics(organizationId: number, companyIds: number[]) {
    const uniqueCompanyIds = Array.from(new Set(companyIds.filter((id) => typeof id === "number")));

    const empty = {
      total: 0,
      rows: [
        { source: "Name", poc1: 0, poc1Pct: 0, poc2: 0, poc2Pct: 0, poc3: 0, poc3Pct: 0 },
        { source: "Linkedin", poc1: 0, poc1Pct: 0, poc2: 0, poc2Pct: 0, poc3: 0, poc3Pct: 0 },
        { source: "Email", poc1: 0, poc1Pct: 0, poc2: 0, poc2Pct: 0, poc3: 0, poc3Pct: 0 },
        { source: "Mobile", poc1: 0, poc1Pct: 0, poc2: 0, poc2Pct: 0, poc3: 0, poc3Pct: 0 },
      ],
    };

    if (uniqueCompanyIds.length === 0) return empty;

    const contactRows = await db
      .select({
        companyId: contacts.companyId,
        name: contacts.name,
        email: contacts.email,
        phone: contacts.phone,
        linkedinProfile: contacts.linkedinProfile,
      })
      .from(contacts)
      .where(and(eq(contacts.organizationId, organizationId), inArray(contacts.companyId, uniqueCompanyIds)));

    const byCompany = new Map<number, typeof contactRows>();
    for (const c of contactRows) {
      const cid = c.companyId as unknown as number;
      if (!byCompany.has(cid)) byCompany.set(cid, []);
      byCompany.get(cid)!.push(c);
    }

    const isPresent = (v: unknown) => typeof v === "string" && v.trim().length > 0;

    const bucket = {
      name: { poc1: 0, poc2: 0, poc3: 0 },
      linkedin: { poc1: 0, poc2: 0, poc3: 0 },
      email: { poc1: 0, poc2: 0, poc3: 0 },
      mobile: { poc1: 0, poc2: 0, poc3: 0 },
    };

    for (const companyId of uniqueCompanyIds) {
      const list = byCompany.get(companyId) || [];

      const nameCnt = list.filter((x) => isPresent(x.name)).length;
      const linkedinCnt = list.filter((x) => isPresent(x.linkedinProfile)).length;
      const emailCnt = list.filter((x) => isPresent(x.email)).length;
      const mobileCnt = list.filter((x) => isPresent(x.phone)).length;

      if (nameCnt >= 1) bucket.name.poc1++;
      if (nameCnt >= 2) bucket.name.poc2++;
      if (nameCnt >= 3) bucket.name.poc3++;

      if (linkedinCnt >= 1) bucket.linkedin.poc1++;
      if (linkedinCnt >= 2) bucket.linkedin.poc2++;
      if (linkedinCnt >= 3) bucket.linkedin.poc3++;

      if (emailCnt >= 1) bucket.email.poc1++;
      if (emailCnt >= 2) bucket.email.poc2++;
      if (emailCnt >= 3) bucket.email.poc3++;

      if (mobileCnt >= 1) bucket.mobile.poc1++;
      if (mobileCnt >= 2) bucket.mobile.poc2++;
      if (mobileCnt >= 3) bucket.mobile.poc3++;
    }

    const total = bucket.name.poc1;
    const pct = (n: number) => (total > 0 ? Number(((n / total) * 100).toFixed(2)) : 0);

    return {
      total,
      rows: [
        {
          source: "Name",
          poc1: total,
          poc1Pct: total > 0 ? 100 : 0,
          poc2: bucket.name.poc2,
          poc2Pct: pct(bucket.name.poc2),
          poc3: bucket.name.poc3,
          poc3Pct: pct(bucket.name.poc3),
        },
        {
          source: "Linkedin",
          poc1: bucket.linkedin.poc1,
          poc1Pct: pct(bucket.linkedin.poc1),
          poc2: bucket.linkedin.poc2,
          poc2Pct: pct(bucket.linkedin.poc2),
          poc3: bucket.linkedin.poc3,
          poc3Pct: pct(bucket.linkedin.poc3),
        },
        {
          source: "Email",
          poc1: bucket.email.poc1,
          poc1Pct: pct(bucket.email.poc1),
          poc2: bucket.email.poc2,
          poc2Pct: pct(bucket.email.poc2),
          poc3: bucket.email.poc3,
          poc3Pct: pct(bucket.email.poc3),
        },
        {
          source: "Mobile",
          poc1: bucket.mobile.poc1,
          poc1Pct: pct(bucket.mobile.poc1),
          poc2: bucket.mobile.poc2,
          poc2Pct: pct(bucket.mobile.poc2),
          poc3: bucket.mobile.poc3,
          poc3Pct: pct(bucket.mobile.poc3),
        },
      ],
    };
  }


  // // Lead operations
  // async createLead(leadData: UpsertLead): Promise<Lead> {
  //   const [lead] = await db.insert(leads).values(leadData).returning();
  //   return lead;
  // }
  
  // Lead operations
  async createLead(leadData: UpsertLead & { createdBy: string }): Promise<Lead> {
    const [lead] = await db
      .insert(leads)
      .values({
        ...leadData,
        createdBy: leadData.createdBy,   // Guarantees DB always gets the creator
      })
      .returning();

    return lead;
  }


async getLead(
    id: number,
    organizationId: number
  ): Promise<(Lead & { company: Company; createdByUser?: User }) | undefined> {

    const creator = alias(users, "creator");

    const [row] = await db
      .select({
        lead: leads,
        company: companies, // ✅ Select company data
        createdByUser: creator
      })
      .from(leads)
      .innerJoin(companies, eq(leads.companyId, companies.id)) // ✅ Join companies table
      .leftJoin(creator, eq(leads.createdBy, creator.id))
      .where(and(eq(leads.id, id), eq(leads.organizationId, organizationId)));

    if (!row) return undefined;

    return {
      ...row.lead,
      company: row.company, // ✅ Return company object
      createdByUser: row.createdByUser || undefined
    };
  }

async getLeadsByStage(
  stage: string,
  organizationId: number
): Promise<(Lead & {
  company: Company;
  contact?: Contact;
  contacts: Contact[];
  assignedToUser?: User;
  ownerAnalystUser?: User;
  createdByUser?: User;
})[]> {
  const stageCondition =
    stage === "universe"
      ? or(eq(leads.stage, "universe"), eq(leads.stage, "qualified"))
      : eq(leads.stage, stage);

  const assignedToUsers = alias(users, "assignedToUser");
  const ownerAnalystUsers = alias(users, "ownerAnalystUser");
  const creator = alias(users, "creator");

  const result = await db
    .select({
      lead: leads,
      company: companies,
      contact: contacts,
      assignedToUser: assignedToUsers,
      ownerAnalystUser: ownerAnalystUsers,
      createdByUser: creator,
    })
    .from(leads)
    .innerJoin(companies, eq(leads.companyId, companies.id))
    .leftJoin(contacts, eq(contacts.companyId, companies.id)) // <- remove isPrimary-only filter
    .leftJoin(assignedToUsers, eq(leads.assignedTo, assignedToUsers.id))
    .leftJoin(ownerAnalystUsers, eq(leads.ownerAnalystId, ownerAnalystUsers.id))
    .leftJoin(creator, eq(leads.createdBy, creator.id))
    .where(and(stageCondition, eq(leads.organizationId, organizationId)))
    .orderBy(desc(leads.updatedAt));

  const leadMap = new Map<number, Lead & {
    company: Company;
    contact?: Contact;
    contacts: Contact[];
    assignedToUser?: User;
    ownerAnalystUser?: User;
    createdByUser?: User;
  }>();

  for (const r of result) {
    if (!leadMap.has(r.lead.id)) {
      leadMap.set(r.lead.id, {
        ...r.lead,
        company: r.company,
        contact: undefined,
        contacts: [],
        assignedToUser: r.assignedToUser || undefined,
        ownerAnalystUser: r.ownerAnalystUser || undefined,
        createdByUser: r.createdByUser || undefined,
      });
    }

    const entry = leadMap.get(r.lead.id)!;

    if (r.contact) {
      if (!entry.contacts.some(c => c.id === r.contact!.id)) {
        entry.contacts.push(r.contact);
      }
      if (r.contact.isPrimary || !entry.contact) {
        entry.contact = r.contact;
      }
    }
  }

  return Array.from(leadMap.values()).map((lead) => ({
    ...lead,
    contacts: [...lead.contacts].sort(
      (a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.id - b.id
    ),
    contact:
      lead.contact ||
      [...lead.contacts].sort(
        (a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.id - b.id
      )[0],
  }));
}

  async getAllLeads(organizationId: number): Promise<(Lead & { company: Company; contact?: Contact; assignedToUser?: User; assignedInternUsers?: User[]; ownerAnalystUser?: User; createdByUser?: User })[]> {
    const assignedToUsers = alias(users, 'assignedToUser');
    const ownerAnalystUsers = alias(users, 'ownerAnalystUser');
    const creator = alias(users, "creator");

    const result = await db
      .select({
        lead: leads,
        company: companies,
        contact: contacts,
        assignedToUser: assignedToUsers,
        ownerAnalystUser: ownerAnalystUsers,
        createdByUser: creator
      })
      .from(leads)
      .innerJoin(companies, eq(leads.companyId, companies.id))
      .leftJoin(contacts, eq(contacts.companyId, companies.id))
      .leftJoin(assignedToUsers, eq(leads.assignedTo, assignedToUsers.id))
      .leftJoin(ownerAnalystUsers, eq(leads.ownerAnalystId, ownerAnalystUsers.id))
      .leftJoin(creator, eq(leads.createdBy, creator.id))
      .where(eq(leads.organizationId, organizationId))
      .orderBy(desc(leads.updatedAt));

      console.log(
        "🔥 [BACKEND] getLeadsByStage() FIRST ROW:",
        JSON.stringify(result[0], null, 2)
      );

    
    // De-duplicate leads by ID (in case multiple primary contacts exist)
// De-duplicate leads by ID and aggregate contacts
    const leadMap = new Map<number, Lead & { 
      company: Company; 
      contact?: Contact; 
      contacts: Contact[]; 
      assignedToUser?: User; 
      assignedInternUsers?: User[]; 
      ownerAnalystUser?: User; 
      createdByUser?: User 
    }>();
    
    for (const r of result) {
      if (!leadMap.has(r.lead.id)) {
        leadMap.set(r.lead.id, {
          ...r.lead,
          company: r.company,
          contact: undefined,
          contacts: [],
          assignedToUser: r.assignedToUser || undefined,
          assignedInternUsers: [],
          ownerAnalystUser: r.ownerAnalystUser || undefined,
          createdByUser: r.createdByUser || undefined
        });
      }

      const entry = leadMap.get(r.lead.id)!;

      if (r.contact) {
        if (!entry.contacts.some(c => c.id === r.contact!.id)) {
          entry.contacts.push(r.contact);
        }
        // Set primary if marked, or if it's the first one found
        if (r.contact.isPrimary || !entry.contact) {
          entry.contact = r.contact;
        }
      }
    }


    type LeadRow = Lead & {
      company: Company;
      contact?: Contact;
      assignedToUser?: User;
      assignedInternUsers?: User[];
      createdByUser?: User;
    };

    const leadsArray: LeadRow[] = Array.from(leadMap.values());
    
    // Fetch assigned interns for all leads
    const leadIds = leadsArray.map(l => l.id);
    if (leadIds.length > 0) {
      // Get all intern user IDs from assignedInterns arrays
      const allInternIds: string[] = [];
      for (const lead of leadsArray) {
        if (lead.assignedInterns && Array.isArray(lead.assignedInterns)) {
          allInternIds.push(...lead.assignedInterns);
        }
      }
      
      // Fetch all interns in one query
      if (allInternIds.length > 0) {
        const uniqueInternIds = [...new Set(allInternIds)];
        const assignedInterns = await db
          .select()
          .from(users)
          .where(inArray(users.id, uniqueInternIds));
        
        // Map interns to leads
        const internsMap = new Map(assignedInterns.map(u => [u.id, u]));
        for (const lead of leadsArray) {
          if (lead.assignedInterns && Array.isArray(lead.assignedInterns)) {
            lead.assignedInternUsers = lead.assignedInterns
              .map(id => internsMap.get(id))
              .filter((u): u is User => u !== undefined);
          }
       }
      }
    }
    
    return leadsArray;
  }
async getLeadsByPartner(partnerId: string, organizationId: number): Promise<(Lead & {
  company: Company;
  contact?: Contact;
  assignedToUser?: User;
  assignedInternUsers?: User[];
  ownerAnalystUser?: User;
  createdByUser?: User;
})[]> {
  const assignedToUsers = alias(users, 'assignedToUser');
  const ownerAnalystUsers = alias(users, 'ownerAnalystUser');
  const creator = alias(users, "creator");

  const result = await db
    .select({
      lead: leads,
      company: companies,
      contact: contacts,
      assignedToUser: assignedToUsers,
      ownerAnalystUser: ownerAnalystUsers,
      createdByUser: creator
    })
    .from(leads)
    .innerJoin(companies, eq(leads.companyId, companies.id))
    .leftJoin(contacts, eq(contacts.companyId, companies.id))
    .leftJoin(assignedToUsers, eq(leads.assignedTo, assignedToUsers.id))
    .leftJoin(ownerAnalystUsers, eq(leads.ownerAnalystId, ownerAnalystUsers.id))
    .leftJoin(creator, eq(leads.createdBy, creator.id))
    .where(and(
      eq(leads.organizationId, organizationId),
      eq(leads.assignedPartnerId, partnerId)
    ))
    .orderBy(desc(leads.updatedAt));

const leadMap = new Map<number, Lead & {
    company: Company;
    contact?: Contact;
    contacts: Contact[];
    assignedToUser?: User;
    assignedInternUsers?: User[];
    ownerAnalystUser?: User;
    createdByUser?: User;
  }>();

  for (const r of result) {
    if (!leadMap.has(r.lead.id)) {
      leadMap.set(r.lead.id, {
        ...r.lead,
        company: r.company,
        contact: undefined,
        contacts: [],
        assignedToUser: r.assignedToUser || undefined,
        assignedInternUsers: [],
        ownerAnalystUser: r.ownerAnalystUser || undefined,
        createdByUser: r.createdByUser || undefined
      });
    }

    const entry = leadMap.get(r.lead.id)!;

    if (r.contact) {
      if (!entry.contacts.some(c => c.id === r.contact!.id)) {
        entry.contacts.push(r.contact);
      }
      if (r.contact.isPrimary || !entry.contact) {
        entry.contact = r.contact;
      }
    }
  }

  const leadsArray = Array.from(leadMap.values());

  // same intern mapping block you already use in getAllLeads
  const allInternIds: string[] = [];
  for (const lead of leadsArray) {
    if (lead.assignedInterns && Array.isArray(lead.assignedInterns)) {
      allInternIds.push(...lead.assignedInterns);
    }
  }

  if (allInternIds.length > 0) {
    const uniqueInternIds = [...new Set(allInternIds)];
    const assignedInterns = await db.select().from(users).where(inArray(users.id, uniqueInternIds));
    const internsMap = new Map(assignedInterns.map(u => [u.id, u]));

    for (const lead of leadsArray) {
      if (lead.assignedInterns && Array.isArray(lead.assignedInterns)) {
        lead.assignedInternUsers = lead.assignedInterns
          .map(id => internsMap.get(id))
          .filter((u): u is User => u !== undefined);
        }
      }
    }
    
    return leadsArray;
  }

  // In storage.ts

  async getLeadsByAssignee(userId: string, organizationId: number): Promise<(Lead & { company: Company; contact?: Contact; assignedToUser?: User; assignedInternUsers?: User[]; createdByUser?: User })[]> {
    // 1. DEFINE THE ALIAS
    const creator = alias(users, "creator"); 

    const result = await db
      .select({
        lead: leads,
        company: companies,
        contact: contacts,
        assignedToUser: users,
        createdByUser: creator // 2. SELECT THE CREATOR
      })
      .from(leads)
      .innerJoin(companies, eq(leads.companyId, companies.id))
      .leftJoin(contacts, eq(contacts.companyId, companies.id))
      .leftJoin(users, eq(leads.assignedTo, users.id))
      .leftJoin(creator, eq(leads.createdBy, creator.id)) // 3. JOIN THE CREATOR TABLE
      .where(and(
        or(
          eq(leads.ownerAnalystId, userId),
          eq(leads.assignedTo, userId),
          eq(leads.createdBy, userId),
          sql`${userId} = ANY(${leads.assignedInterns})`
        ),
        eq(leads.organizationId, organizationId)
      ))
      .orderBy(desc(leads.updatedAt));

    // De-duplicate leads by ID (in case multiple primary contacts exist)
// De-duplicate leads by ID and aggregate contacts
    const leadMap = new Map<number, Lead & { company: Company; contact?: Contact; contacts: Contact[]; assignedToUser?: User; assignedInternUsers?: User[]; createdByUser?: User }>();

    for (const r of result) {
      if (!leadMap.has(r.lead.id)) {
        leadMap.set(r.lead.id, {
          ...r.lead,
          company: r.company,
          contact: undefined,
          contacts: [],
          assignedToUser: r.assignedToUser || undefined,
          assignedInternUsers: [],
          createdByUser: r.createdByUser || undefined
        });
      }

      const entry = leadMap.get(r.lead.id)!;

      if (r.contact) {
        if (!entry.contacts.some(c => c.id === r.contact!.id)) {
          entry.contacts.push(r.contact);
        }
        if (r.contact.isPrimary || !entry.contact) {
          entry.contact = r.contact;
        }
      }
    }

    const leadsArray = Array.from(leadMap.values());

    // Fetch assigned interns for all leads
    const leadIds = leadsArray.map(l => l.id);
    if (leadIds.length > 0) {
      // Get all intern user IDs from assignedInterns arrays
      const allInternIds: string[] = [];
      for (const lead of leadsArray) {
        if (lead.assignedInterns && Array.isArray(lead.assignedInterns)) {
          allInternIds.push(...lead.assignedInterns);
        }
      }

      // Fetch all interns in one query
      if (allInternIds.length > 0) {
        const uniqueInternIds = [...new Set(allInternIds)];
        const assignedInterns = await db
          .select()
          .from(users)
          .where(inArray(users.id, uniqueInternIds));

        // Map interns to leads
        const internsMap = new Map(assignedInterns.map(u => [u.id, u]));

        for (const lead of leadsArray) {
          if (lead.assignedInterns && Array.isArray(lead.assignedInterns)) {
            lead.assignedInternUsers = lead.assignedInterns
              .map(id => internsMap.get(id))
              .filter((u): u is User => u !== undefined);
          }
        }
      }
    }

    return leadsArray;
  }

  async getLeadsByCompany(companyId: number, organizationId: number): Promise<Lead[]> {
    const result = await db
      .select()
      .from(leads)
      .where(and(eq(leads.companyId, companyId), eq(leads.organizationId, organizationId)))
      .orderBy(desc(leads.updatedAt));
    
    return result;
  }

  async updateLead(id: number, organizationId: number, updates: Partial<UpsertLead>): Promise<Lead | undefined> {
    const updateData = { ...updates, updatedAt: new Date() };
    if (updates.stage) {
      updateData.stageUpdatedAt = new Date();
    }
    
    const [lead] = await db
      .update(leads)
      .set(updateData)
      .where(and(eq(leads.id, id), eq(leads.organizationId, organizationId)))
      .returning();
    return lead;
  }

  async updateLeadCardNextAction(
    id: number,
    organizationId: number,
    cardNextActionText: string | null,
    cardNextActionDate: Date | null
  ): Promise<Lead | undefined> {
    const [lead] = await db
      .update(leads)
      .set({
        cardNextActionText,
        cardNextActionDate,
        updatedAt: new Date(),
      })
      .where(and(eq(leads.id, id), eq(leads.organizationId, organizationId)))
      .returning();

    return lead;
  }


  async assignLead(
    leadId: number,
    organizationId: number,
    assignedTo: string | null | undefined,
    assignedPartnerId: string | null | undefined,
    assignedBy: string,
    notes?: string
  ): Promise<void> {
    const [currentLead] = await db
      .select()
      .from(leads)
      .where(and(eq(leads.id, leadId), eq(leads.organizationId, organizationId)));

    if (!currentLead) throw new Error("Lead not found");

    // Compute final values (PATCH semantics)
    const nextAssignedTo = assignedTo === undefined ? currentLead.assignedTo : assignedTo;
    const nextAssignedPartnerId =
      assignedPartnerId === undefined ? (currentLead as any).assignedPartnerId : assignedPartnerId;

    const updateData: any = { updatedAt: new Date() };

    if (assignedTo !== undefined) updateData.assignedTo = assignedTo;
    if (assignedPartnerId !== undefined) updateData.assignedPartnerId = assignedPartnerId;

    // Universe status should reflect either assignment
    if (currentLead.stage === "universe") {
      updateData.universeStatus = nextAssignedTo || nextAssignedPartnerId ? "assigned" : "open";
    }

    // If partner assigned (explicit), validate partner
    if (assignedPartnerId !== undefined && assignedPartnerId) {
      const [pUser] = await db.select().from(users).where(eq(users.id, assignedPartnerId));
      if (!pUser) throw new Error("Assigned partner not found");
      if (pUser.role !== "partner") throw new Error("Assigned user must be a partner");
    }


    // If analyst assigned (not null), set owner + auto move from universe
    if (assignedTo !== undefined && assignedTo) {
      const [user] = await db.select().from(users).where(eq(users.id, assignedTo));
      if (!user) throw new Error("Assigned user not found");
      if (user.role !== "analyst") throw new Error("Assigned user must be an analyst");

      updateData.ownerAnalystId = assignedTo;

      if (currentLead.stage === "universe") {
        updateData.stage = "qualified";
      }
    }

    await db.update(leads).set(updateData).where(eq(leads.id, leadId));

    // ✅ Only write assignment history when analyst assignment is explicitly part of the request
    if (assignedTo !== undefined && assignedTo !== null) {
      await db.insert(leadAssignments).values({
        leadId,
        organizationId,
        assignedTo,
        assignedBy,
        notes: notes || null,
      });
    }
  }


  async assignInternsToLead(leadId: number, organizationId: number, internIds: string[], assignedBy: string, notes?: string): Promise<void> {
    // Get the current lead to check its stage for universe status logic
    const [currentLead] = await db
      .select()
      .from(leads)
      .where(and(eq(leads.id, leadId), eq(leads.organizationId, organizationId)));
    
    if (!currentLead) {
      throw new Error('Lead not found');
    }
    
    // Validate all interns exist and belong to the same organization
    if (internIds.length > 0) {
      const interns = await db
        .select()
        .from(users)
        .where(and(
          inArray(users.id, internIds),
          eq(users.organizationId, organizationId),
          eq(users.role, 'intern')
        ));
      
      if (interns.length !== internIds.length) {
        throw new Error('One or more interns not found or not in the same organization');
      }
    }
    
    // Determine universe status based on assignment (only for universe stage leads)
    let updateData: any = { assignedInterns: internIds, updatedAt: new Date() };
    if (currentLead.stage === 'universe') {
      updateData.universeStatus = internIds.length > 0 ? 'assigned' : 'open';
    }
    
    // Update the lead with assigned interns
    await db
      .update(leads)
      .set(updateData)
      .where(and(eq(leads.id, leadId), eq(leads.organizationId, organizationId)));
    
    // Record the assignment history for each intern
    for (const internId of internIds) {
      await db.insert(leadAssignments).values({
        organizationId,
        leadId,
        assignedBy,
        assignedTo: internId,
        notes,
      });
    }
  }

  // Assignment operations
  async getLeadAssignments(leadId: number, organizationId: number): Promise<(LeadAssignment & { assignedByUser: User; assignedToUser: User })[]> {
    const result = await db
      .select({
        assignment: leadAssignments,
        assignedByUser: users,
        assignedToUser: users,
      })
      .from(leadAssignments)
      .innerJoin(users, eq(leadAssignments.assignedBy, users.id))
      .innerJoin(users, eq(leadAssignments.assignedTo, users.id))
      .where(and(eq(leadAssignments.leadId, leadId), eq(leadAssignments.organizationId, organizationId)))
      .orderBy(desc(leadAssignments.assignedAt));
    
    return result.map(r => ({ ...r.assignment, assignedByUser: r.assignedByUser, assignedToUser: r.assignedToUser }));
  }

  // Outreach operations
  async createOutreachActivity(activityData: UpsertOutreachActivity): Promise<OutreachActivity> {
    const [activity] = await db.insert(outreachActivities).values(activityData).returning();
    return activity;
  }

  async getOutreachActivities(leadId: number, organizationId: number): Promise<OutreachActivity[]> {
    return db
      .select()
      .from(outreachActivities)
      .where(and(eq(outreachActivities.leadId, leadId), eq(outreachActivities.organizationId, organizationId)))
      .orderBy(desc(outreachActivities.createdAt));
  }

  async updateOutreachActivity(id: number, organizationId: number, updates: Partial<UpsertOutreachActivity>): Promise<OutreachActivity | undefined> {
    const [activity] = await db
      .update(outreachActivities)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(outreachActivities.id, id), eq(outreachActivities.organizationId, organizationId)))
      .returning();
    return activity;
  }

// Lead POC Outreach Status operations  
    async getLeadPocOutreachStatuses(
    leadId: number,
    organizationId: number
  ): Promise<LeadPocOutreachStatus[]> {
    return db
      .select()
      .from(leadPocOutreachStatus)
      .where(
        and(
          eq(leadPocOutreachStatus.leadId, leadId),
          eq(leadPocOutreachStatus.organizationId, organizationId)
        )
      )
      .orderBy(
        asc(leadPocOutreachStatus.contactId),
        asc(leadPocOutreachStatus.channel)
      );
  }

  async getLeadPocOutreachStatusRecord(
    leadId: number,
    contactId: number,
    channel: string,
    organizationId: number
  ): Promise<LeadPocOutreachStatus | undefined> {
    const [record] = await db
      .select()
      .from(leadPocOutreachStatus)
      .where(
        and(
          eq(leadPocOutreachStatus.leadId, leadId),
          eq(leadPocOutreachStatus.contactId, contactId),
          eq(leadPocOutreachStatus.channel, channel),
          eq(leadPocOutreachStatus.organizationId, organizationId)
        )
      )
      .limit(1);

    return record;
  }

async upsertLeadPocOutreachStatus(
  data: UpsertLeadPocOutreachStatus
): Promise<LeadPocOutreachStatus> {
  const existing = await this.getLeadPocOutreachStatusRecord(
    data.leadId,
    data.contactId,
    data.channel,
    data.organizationId
  );

  if (existing) {
    const [updated] = await db
      .update(leadPocOutreachStatus)
      .set({
        status: data.status ?? existing.status ?? null,
        initiatedAt: data.initiatedAt ?? existing.initiatedAt ?? null,
        lastUpdatedAt: data.lastUpdatedAt ?? new Date(),
        remarks: data.remarks !== undefined ? data.remarks : existing.remarks,
        nextActionText:
          data.nextActionText !== undefined
            ? data.nextActionText
            : existing.nextActionText,
        nextActionAt:
          data.nextActionAt !== undefined
            ? data.nextActionAt
            : existing.nextActionAt,
        taskAssignedTo:
          (data as any).taskAssignedTo !== undefined
            ? (data as any).taskAssignedTo
            : (existing as any).taskAssignedTo ?? null,
        taskAssignedBy:
          (data as any).taskAssignedBy !== undefined
            ? (data as any).taskAssignedBy
            : (existing as any).taskAssignedBy ?? null,
        cadenceTriggeredAt:
          data.cadenceTriggeredAt ?? existing.cadenceTriggeredAt ?? null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(leadPocOutreachStatus.id, existing.id),
          eq(leadPocOutreachStatus.organizationId, data.organizationId)
        )
      )
      .returning();

    return updated;
  }

  const [created] = await db
    .insert(leadPocOutreachStatus)
    .values({
      organizationId: data.organizationId,
      leadId: data.leadId,
      contactId: data.contactId,
      channel: data.channel,
      status: data.status ?? null,
      initiatedAt: data.initiatedAt ?? null,
      lastUpdatedAt: data.lastUpdatedAt ?? new Date(),
      remarks: data.remarks ?? null,
      nextActionText: data.nextActionText ?? null,
      nextActionAt: data.nextActionAt ?? null,
      taskAssignedTo: (data as any).taskAssignedTo ?? null,
      taskAssignedBy: (data as any).taskAssignedBy ?? null,
      cadenceTriggeredAt: data.cadenceTriggeredAt ?? null,
      createdBy: data.createdBy,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  return created;
}

    async getInvestorPocOutreachStatuses(
    leadId: number,
    investorId: number,
    organizationId: number
  ): Promise<InvestorPocOutreachStatus[]> {
    return db
      .select()
      .from(investorPocOutreachStatus)
      .where(
        and(
          eq(investorPocOutreachStatus.leadId, leadId),
          eq(investorPocOutreachStatus.investorId, investorId),
          eq(investorPocOutreachStatus.organizationId, organizationId)
        )
      )
      .orderBy(
        asc(investorPocOutreachStatus.contactId),
        asc(investorPocOutreachStatus.channel)
      );
  }

  async getInvestorPocOutreachStatusRecord(
    leadId: number,
    investorId: number,
    contactId: number,
    channel: string,
    organizationId: number
  ): Promise<InvestorPocOutreachStatus | undefined> {
    const [record] = await db
      .select()
      .from(investorPocOutreachStatus)
      .where(
        and(
          eq(investorPocOutreachStatus.leadId, leadId),
          eq(investorPocOutreachStatus.investorId, investorId),
          eq(investorPocOutreachStatus.contactId, contactId),
          eq(investorPocOutreachStatus.channel, channel),
          eq(investorPocOutreachStatus.organizationId, organizationId)
        )
      )
      .limit(1);

    return record;
  }

async upsertInvestorPocOutreachStatus(
  data: UpsertInvestorPocOutreachStatus
): Promise<InvestorPocOutreachStatus> {
  const existing = await this.getInvestorPocOutreachStatusRecord(
    data.leadId,
    data.investorId,
    data.contactId,
    data.channel,
    data.organizationId
  );

  if (existing) {
    const [updated] = await db
      .update(investorPocOutreachStatus)
      .set({
        status: data.status ?? existing.status ?? null,
        initiatedAt: data.initiatedAt ?? existing.initiatedAt ?? null,
        lastUpdatedAt: data.lastUpdatedAt ?? new Date(),
        remarks: data.remarks !== undefined ? data.remarks : existing.remarks,
        nextActionText:
          data.nextActionText !== undefined
            ? data.nextActionText
            : existing.nextActionText,
        nextActionAt:
          data.nextActionAt !== undefined
            ? data.nextActionAt
            : existing.nextActionAt,
        taskAssignedTo:
          (data as any).taskAssignedTo !== undefined
            ? (data as any).taskAssignedTo
            : (existing as any).taskAssignedTo ?? null,

        taskAssignedBy:
          (data as any).taskAssignedBy !== undefined
            ? (data as any).taskAssignedBy
            : (existing as any).taskAssignedBy ?? null,
        cadenceTriggeredAt:
          data.cadenceTriggeredAt ?? existing.cadenceTriggeredAt ?? null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(investorPocOutreachStatus.id, existing.id),
          eq(investorPocOutreachStatus.organizationId, data.organizationId)
        )
      )
      .returning();

    return updated;
  }

  const [created] = await db
    .insert(investorPocOutreachStatus)
    .values({
      organizationId: data.organizationId,
      leadId: data.leadId,
      investorId: data.investorId,
      contactId: data.contactId,
      channel: data.channel,
      status: data.status ?? null,
      initiatedAt: data.initiatedAt ?? null,
      lastUpdatedAt: data.lastUpdatedAt ?? new Date(),
      remarks: data.remarks ?? null,
      nextActionText: data.nextActionText ?? null,
      nextActionAt: data.nextActionAt ?? null,
      taskAssignedTo: (data as any).taskAssignedTo ?? null,
      taskAssignedBy: (data as any).taskAssignedBy ?? null,
      cadenceTriggeredAt: data.cadenceTriggeredAt ?? null,
      createdBy: data.createdBy,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  return created;
}


  // investor data
  async getInvestorOutreachActivities(organizationId: number, investorId: number) {
    return db
      .select()
      .from(investorOutreachActivities)
      .where(
        and(
          eq(investorOutreachActivities.organizationId, organizationId),
          eq(investorOutreachActivities.investorId, investorId)
        )
      )
      .orderBy(desc(investorOutreachActivities.createdAt));
  }

  async createInvestorOutreachActivity(
    organizationId: number,
    investorId: number,
    payload: {
      userId: string;
      activityType: string;
      status: string;
      contactDate?: Date | null;
      followUpDate?: Date | null;
      notes?: string | null;
    }
  ) {
    const [row] = await db
      .insert(investorOutreachActivities)
      .values({
        organizationId,
        investorId,
        activityType: payload.activityType,
        status: payload.status,
        contactDate: payload.contactDate ?? null,
        followUpDate: payload.followUpDate ?? null,
        notes: payload.notes ?? null,
        // if you want, add createdBy column too; optional
      })
      .returning();

    return row;
  }



    // ==============================
  // INVESTOR ↔ LEAD LINKS (Linked Companies)
  // ==============================

  // Returns: [{ leadId, companyName, stage }]
  async getInvestorLinkedLeads(organizationId: number, investorId: number) {
    const rows = await db
      .select({
        leadId: leads.id,
        companyName: companies.name,
        stage: leads.stage,
      })
      .from(investorLeadLinks)
      .innerJoin(leads, eq(investorLeadLinks.leadId, leads.id))
      .innerJoin(companies, eq(leads.companyId, companies.id))
      .where(
        and(
          eq(investorLeadLinks.organizationId, organizationId),
          eq(investorLeadLinks.investorId, investorId)
        )
      )
      .orderBy(desc(investorLeadLinks.createdAt));

    return rows;
  }


  // Update investor details
  async updateInvestor(organizationId: number, investorId: number, updates: Partial<Investor>) {
    const [updated] = await db
      .update(investors)
      .set({ ...updates, updatedAt: new Date() })
      .where(
        and(
          eq(investors.id, investorId),
          eq(investors.organizationId, organizationId)
        )
      )
      .returning();
    return updated;
  }

  // ✅ NEW: Fetch all unique investor locations for the dropdown
// ✅ NEW: Fetch all unique investor locations for the dropdown
  async getUniqueInvestorLocations(organizationId: number): Promise<string[]> {
    // Safely query using only 'eq' which is already imported in your file
    const rows = await db
      .selectDistinct({ location: investors.location })
      .from(investors)
      .where(eq(investors.organizationId, organizationId));
    
    // Filter out nulls and empty strings in JavaScript, and sort alphabetically
    return rows
      .map(r => r.location as string)
      .filter(loc => loc && loc.trim().length > 0)
      .sort();
  }


  // ✅ NEW: Move investor to a new stage
  async updateInvestorStage(organizationId: number, investorId: number, stage: string) {
    const [updated] = await db
      .update(investors)
      .set({ stage })
      .where(
        and(
          eq(investors.id, investorId),
          eq(investors.organizationId, organizationId)
        )
      )
      .returning();
      
    return updated;
  }

  async updateInvestorCardNextAction(
    organizationId: number,
    investorId: number,
    cardNextActionText: string | null,
    cardNextActionDate: Date | null
  ): Promise<Investor | undefined> {
    const [updated] = await db
      .update(investors)
      .set({
        cardNextActionText,
        cardNextActionDate,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(investors.id, investorId),
          eq(investors.organizationId, organizationId)
        )
      )
      .returning();

    return updated;
  }

  // NEW: Get all investors linked to a specific lead
async getInvestorsByLead(organizationId: number, leadId: number) {
    const rows = await db
      .select({
        investor: investors,
        link: investorLeadLinks,
        primaryPoc: investorContacts, 
      })
      .from(investorLeadLinks)
      .innerJoin(investors, eq(investorLeadLinks.investorId, investors.id))
      .leftJoin(
        investorContacts,
        and(
          eq(investorContacts.investorId, investors.id),
          eq(investorContacts.isPrimary, true)
        )
      )
      .where(
        and(
          eq(investorLeadLinks.organizationId, organizationId),
          eq(investorLeadLinks.leadId, leadId)
        )
      )
      .orderBy(desc(investorLeadLinks.createdAt));

    // 1. Collect all contact IDs that need fetching
    const allSelectedContactIds = rows.flatMap(row => row.link.selectedContactIds || []);

    // 2. Fetch all those contacts in one go
    let selectedContactsMap = new Map<number, any>();
    if (allSelectedContactIds.length > 0) {
      const contactsList = await db
        .select()
        .from(investorContacts)
        .where(inArray(investorContacts.id, allSelectedContactIds));
      
      contactsList.forEach(c => selectedContactsMap.set(c.id, c));
    }

    // 3. Attach the full contact objects to the response
    return rows.map((row) => {
      const selectedIds = row.link.selectedContactIds || [];
      
      // Map IDs to actual objects
      const selectedContacts = selectedIds
        .map(id => selectedContactsMap.get(id))
        .filter(Boolean); 

      // ✅ CHANGE 1: Create a unified 'contacts' list
      // If no specific contacts were selected, fallback to the Primary POC
      const finalContacts = selectedContacts.length > 0 
        ? selectedContacts 
        : (row.primaryPoc ? [row.primaryPoc] : []);

      return {
        ...row.investor,

        status: row.link.status,
        remarks: row.link.remarks,

        nextActionText: row.link.nextActionText,
        nextActionAt: row.link.nextActionAt,
        taskAssignedTo: (row.link as any).taskAssignedTo ?? null,

        linkedAt: row.link.createdAt,
        contacts: finalContacts,
      };
    });
}

// ✅ CHANGE 5: Add this NEW method immediately after the function above
  async updateInvestorLeadNextAction(
    organizationId: number,
    leadId: number,
    investorId: number,
    nextActionText: string | null,
    nextActionAt: Date | null,
    taskAssignedTo: string | null,
    taskAssignedBy: string | null
  ) {
    const [updated] = await db
      .update(investorLeadLinks)
      .set({
        nextActionText,
        nextActionAt,
        taskAssignedTo,
        taskAssignedBy,
      })
      .where(
        and(
          eq(investorLeadLinks.organizationId, organizationId),
          eq(investorLeadLinks.leadId, leadId),
          eq(investorLeadLinks.investorId, investorId)
        )
      )
      .returning();

    return updated;
  }



  // invester lead likage through the lead card
// ==========================================
  // LINK INVESTORS TO LEAD (With Auto-Move Logic)
  // ==========================================
// ==========================================
  // LINK INVESTORS TO LEAD (With Auto-Move & POC Merging Logic)
  // ==========================================
  async bulkLinkInvestorsToLead(
    organizationId: number,
    leadId: number,
    selections: { investorId: number; contactIds: number[] }[]
  ) {
    return await db.transaction(async (tx) => {
      // 1. Fetch the Lead to check its current stage
      const [lead] = await tx
        .select()
        .from(leads)
        .where(and(eq(leads.id, leadId), eq(leads.organizationId, organizationId)));

      const investorIds = selections.map((s) => s.investorId);

      // 2. Process Links
      for (const selection of selections) {
        // A. Check if link already exists
        const [existingLink] = await tx
          .select()
          .from(investorLeadLinks)
          .where(
            and(
              eq(investorLeadLinks.leadId, leadId),
              eq(investorLeadLinks.investorId, selection.investorId)
            )
          );

        // B. UPDATE or INSERT logic
        if (existingLink) {
          // If already linked, MERGE the new contact IDs with the existing ones
          const currentContacts = existingLink.selectedContactIds || [];
          const updatedContacts = Array.from(new Set([...currentContacts, ...selection.contactIds])); // Removes duplicates

          await tx
            .update(investorLeadLinks)
            .set({ 
              selectedContactIds: updatedContacts,
            })
            .where(eq(investorLeadLinks.id, existingLink.id));
            
        } else {
          // Insert Link if it doesn't exist, WITH the contact IDs
          await tx.insert(investorLeadLinks).values({
            organizationId,
            leadId,
            investorId: selection.investorId,
            status: "active",
            selectedContactIds: selection.contactIds // <-- Now correctly saving the selected POCs
          });
        }

      }

      // 3. AUTO-MOVE LOGIC:
      // If the Lead is in 'mandates' stage, force these Investors to 'dealmaking' stage
      if (lead && lead.stage === "mandates") {
        if (investorIds.length > 0) {
          await tx
            .update(investors)
            .set({ 
              stage: "dealmaking",
              updatedAt: new Date() 
            })
            .where(
              and(
                eq(investors.organizationId, organizationId),
                inArray(investors.id, investorIds)
              )
            );
          
          console.log(`[Auto-Move] Promoted ${investorIds.length} investors to 'dealmaking' because Lead is in Mandates.`);
        }
      }

      return { success: true, count: selections.length };
    });
  }

  // storage.ts
async getLinkedInvestorsForLead(organizationId: number, leadId: number) {
  const links = await db
    .select()
    .from(investorLeadLinks)
    .where(
      and(
        eq(investorLeadLinks.organizationId, organizationId),
        eq(investorLeadLinks.leadId, leadId)
      )
    );

  if (links.length === 0) return [];

  const investorIds = links.map((l) => l.investorId);

  const investorsData = await db
    .select()
    .from(investors)
    .where(
      and(
        eq(investors.organizationId, organizationId),
        inArray(investors.id, investorIds)
      )
    );

  const contactsData = await db
    .select()
    .from(investorContacts)
    .where(
      and(
        eq(investorContacts.organizationId, organizationId),
        inArray(investorContacts.investorId, investorIds)
      )
    );

  const out = links.map((link) => {
    const inv = investorsData.find((i) => i.id === link.investorId);
    if (!inv) return null;

    const allContacts = contactsData.filter((c) => c.investorId === link.investorId);
    const selectedContacts = link.selectedContactIds?.length
      ? allContacts.filter((c) => link.selectedContactIds!.includes(c.id))
      : [];

    return {
      ...inv,
      linkId: link.id,
      linkStatus: link.status,          // ✅ matches InvestorOutreachPage
      selectedContacts,                 // ✅ matches InvestorOutreachPage
      selectedContactIds: link.selectedContactIds ?? [],
      linkedAt: link.createdAt,
    };
  });

  return out.filter(Boolean);
}


  // Creates link; moves investor → active
  async addInvestorLeadLink(organizationId: number, investorId: number, leadId: number) {
    await db
      .insert(investorLeadLinks)
      .values({ organizationId, investorId, leadId })
      .onConflictDoNothing();

    // auto move investor to active once linked to ≥1 company
    await db
      .update(investors)
      .set({ stage: "active", updatedAt: new Date() as any })
      .where(
        and(
          eq(investors.organizationId, organizationId),
          eq(investors.id, investorId)
        )
      );

    return { ok: true } as const;
  }

  async removeInvestorLeadLink(organizationId: number, investorId: number, leadId: number) {
    await db
      .delete(investorLeadLinks)
      .where(
        and(
          eq(investorLeadLinks.organizationId, organizationId),
          eq(investorLeadLinks.investorId, investorId),
          eq(investorLeadLinks.leadId, leadId)
        )
      );

    return { ok: true } as const;
  }


  // NEW: Update status of investor-lead link
  async updateInvestorLeadLinkStatus(
    organizationId: number,
    investorId: number,
    leadId: number,
    status: string
  ) {
    const [updated] = await db
      .update(investorLeadLinks)
      .set({ status })
      .where(
        and(
          eq(investorLeadLinks.organizationId, organizationId),
          eq(investorLeadLinks.investorId, investorId),
          eq(investorLeadLinks.leadId, leadId)
        )
      )
      .returning();
    return updated;
  }


  // Intervention operations
  async createIntervention(interventionData: UpsertIntervention): Promise<Intervention> {
    const [intervention] = await db.insert(interventions).values(interventionData).returning();
    return intervention;
  }

  async getInterventions(leadId: number, organizationId: number): Promise<(Intervention & { user: User })[]> {
    const result = await db
      .select({
        intervention: interventions,
        user: users,
      })
      .from(interventions)
      .leftJoin(users, eq(interventions.userId, users.id))
      .where(and(eq(interventions.leadId, leadId), eq(interventions.organizationId, organizationId)))
      .orderBy(desc(interventions.scheduledAt));
    
    return result.map(r => ({ ...r.intervention, user: r.user! }));
  }

  async updateIntervention(id: number, organizationId: number, updates: Partial<UpsertIntervention>): Promise<Intervention | undefined> {
    const [intervention] = await db
      .update(interventions)
      .set(updates)
      .where(and(eq(interventions.id, id), eq(interventions.organizationId, organizationId)))
      .returning();
    return intervention;
  }

  async deleteIntervention(id: number, organizationId: number): Promise<Intervention | undefined> {
    const [intervention] = await db
      .delete(interventions)
      .where(and(eq(interventions.id, id), eq(interventions.organizationId, organizationId)))
      .returning();
    return intervention;
  }



  async getScheduledInterventions(user: User): Promise<any[]> {
    if (!user.organizationId) {
      throw new Error("User organization not found");
    }

    const orgId = Number(user.organizationId);
    const userId = String(user.id);

    let visibleLeads: any[] = [];

    if (user.role === "analyst") {
      visibleLeads = await this.getLeadsByAssignee(userId, orgId);
    } else if (user.role === "partner") {
      visibleLeads = await this.getLeadsByPartner(userId, orgId);
    } else {
      visibleLeads = await this.getAllLeads(orgId);
    }

    const allowedStages = new Set(["outreach", "pitching", "mandates"]);

    const visibleEligibleLeads = (visibleLeads || []).filter((lead: any) =>
      allowedStages.has(String(lead?.stage || "").toLowerCase())
    );

    const allLeads = await this.getAllLeads(orgId);
    const allEligibleLeads = (allLeads || []).filter((lead: any) =>
      allowedStages.has(String(lead?.stage || "").toLowerCase())
    );

    const assignedOutreachLeadRows = await db
      .select({ leadId: leadPocOutreachStatus.leadId })
      .from(leadPocOutreachStatus)
      .where(
        and(
          eq(leadPocOutreachStatus.organizationId, orgId),
          eq((leadPocOutreachStatus as any).taskAssignedTo, userId),
          sql`${leadPocOutreachStatus.nextActionAt} IS NOT NULL`
        )
      );

    const assignedPitchingLeadRows = await db
      .select({ leadId: pitchingDetails.leadId })
      .from(pitchingDetails)
      .where(
        and(
          sql`${pitchingDetails.pdmTaskAssignedTo} = ${userId}
              OR ${pitchingDetails.meeting1TaskAssignedTo} = ${userId}
              OR ${pitchingDetails.meeting2TaskAssignedTo} = ${userId}
              OR ${pitchingDetails.loeTaskAssignedTo} = ${userId}
              OR ${pitchingDetails.mandateTaskAssignedTo} = ${userId}`,
          sql`(
              ${pitchingDetails.pdmNextActionAt} IS NOT NULL
              OR ${pitchingDetails.meeting1NextActionAt} IS NOT NULL
              OR ${pitchingDetails.meeting2NextActionAt} IS NOT NULL
              OR ${pitchingDetails.loeNextActionAt} IS NOT NULL
              OR ${pitchingDetails.mandateNextActionAt} IS NOT NULL
          )`
        )
      );

    const assignedInvestorLinkLeadRows = await db
      .select({ leadId: investorLeadLinks.leadId })
      .from(investorLeadLinks)
      .where(
        and(
          eq(investorLeadLinks.organizationId, orgId),
          eq((investorLeadLinks as any).taskAssignedTo, userId),
          sql`${investorLeadLinks.nextActionAt} IS NOT NULL`
        )
      );

    const assignedInvestorPocLeadRows = await db
      .select({ leadId: investorPocOutreachStatus.leadId })
      .from(investorPocOutreachStatus)
      .where(
        and(
          eq(investorPocOutreachStatus.organizationId, orgId),
          eq((investorPocOutreachStatus as any).taskAssignedTo, userId),
          sql`${investorPocOutreachStatus.nextActionAt} IS NOT NULL`
        )
      );

    const assignedLeadIds = new Set<number>([
      ...assignedOutreachLeadRows.map((r) => Number(r.leadId)),
      ...assignedPitchingLeadRows.map((r) => Number(r.leadId)),
      ...assignedInvestorLinkLeadRows.map((r) => Number(r.leadId)),
      ...assignedInvestorPocLeadRows.map((r) => Number(r.leadId)),
    ]);

    const finalLeadMap = new Map<number, any>();

    for (const lead of visibleEligibleLeads) {
      finalLeadMap.set(Number(lead.id), lead);
    }

    for (const lead of allEligibleLeads) {
      if (assignedLeadIds.has(Number(lead.id))) {
        finalLeadMap.set(Number(lead.id), lead);
      }
    }

    const eligibleLeads = Array.from(finalLeadMap.values());

    if (eligibleLeads.length === 0) {
      return [];
    }

    const leadMap = new Map<number, any>(
      eligibleLeads.map((lead: any) => [Number(lead.id), lead])
    );

    const outreachLeadIds = eligibleLeads
      .filter((lead: any) => String(lead.stage || "").toLowerCase() === "outreach")
      .map((lead: any) => Number(lead.id));

    const pitchingLeadIds = eligibleLeads
      .filter((lead: any) => String(lead.stage || "").toLowerCase() === "pitching")
      .map((lead: any) => Number(lead.id));

    const mandateLeadIds = eligibleLeads
      .filter((lead: any) => String(lead.stage || "").toLowerCase() === "mandates")
      .map((lead: any) => Number(lead.id));

    const tasks: any[] = [];

    const formatUserName = (user?: any) => {
      if (!user) return null;
      const first = String(user.firstName || "").trim();
      const last = String(user.lastName || "").trim();
      const full = `${first} ${last}`.trim();
      return full || user.email || null;
    };

    const getTaskOwnerName = (leadBase: any) => {
      return (
        formatUserName(leadBase?.assignedToUser) ||
        formatUserName(leadBase?.ownerAnalystUser) ||
        formatUserName(leadBase?.createdByUser) ||
        null
      );
    };

    const getTaskCreatedByName = (leadBase: any) => {
      return formatUserName(leadBase?.createdByUser) || null;
    };

    const channelLabelMap: Record<string, string> = {
      linkedin: "LinkedIn",
      email: "Email",
      whatsapp: "WhatsApp",
      call: "Call",
      channel_partner: "Channel Partner",
      other: "Other Action",
    };

    const pushTask = (task: any) => {
      const existingIndex = tasks.findIndex((t) => t.id === task.id);
      if (existingIndex >= 0) {
        tasks[existingIndex] = task;
      } else {
        tasks.push(task);
      }
    };

    if (outreachLeadIds.length > 0) {
      const assignedToUserAlias = alias(users, "outreachAssignedToUser");
      const assignedByUserAlias = alias(users, "outreachAssignedByUser");

      const outreachRows = await db
        .select({
          status: leadPocOutreachStatus,
          contact: contacts,
          assignedToUser: assignedToUserAlias,
          assignedByUser: assignedByUserAlias,
        })
        .from(leadPocOutreachStatus)
        .leftJoin(contacts, eq(leadPocOutreachStatus.contactId, contacts.id))
        .leftJoin(
          assignedToUserAlias,
          eq((leadPocOutreachStatus as any).taskAssignedTo, assignedToUserAlias.id)
        )
        .leftJoin(
          assignedByUserAlias,
          eq((leadPocOutreachStatus as any).taskAssignedBy, assignedByUserAlias.id)
        )
        .where(
          and(
            eq(leadPocOutreachStatus.organizationId, orgId),
            inArray(leadPocOutreachStatus.leadId, outreachLeadIds),
            sql`${leadPocOutreachStatus.nextActionAt} IS NOT NULL`,
            sql`${leadPocOutreachStatus.status} IS DISTINCT FROM 'completed'`
          )
        );

      for (const row of outreachRows) {
        const leadBase = leadMap.get(Number(row.status.leadId));
        if (!leadBase) continue;

        pushTask({
          id: `lead-poc-${row.status.id}`,
          stage: "outreach",
          source: "lead_poc_outreach",
          taskType: row.status.channel,
          title: `${channelLabelMap[row.status.channel] || row.status.channel} outreach action`,
          scheduledAt: row.status.nextActionAt,
          nextActionText: row.status.nextActionText ?? null,
          notes: row.status.remarks ?? null,
          taskAssignedTo: (row.status as any).taskAssignedTo ?? null,
          taskAssignedToName: formatUserName(row.assignedToUser),
          taskAssignedBy: (row.status as any).taskAssignedBy ?? null,
          taskAssignedByName: formatUserName(row.assignedByUser),
          relatedName: row.contact?.name ?? null,
          ownerName: getTaskOwnerName(leadBase),
          createdByName: getTaskCreatedByName(leadBase),
          lead: {
            ...leadBase,
            contact: row.contact || leadBase.contact || undefined,
          },
        });
      }
    }

    if (pitchingLeadIds.length > 0) {
      const pitchingRows = await db
        .select()
        .from(pitchingDetails)
        .where(inArray(pitchingDetails.leadId, pitchingLeadIds));

      const milestoneConfigs = [
        {
          taskType: "pdm",
          title: "PDM next action",
          atKey: "pdmNextActionAt",
          textKey: "pdmNextActionText",
          remarksKey: "pdmRemarks",
          assigneeKey: "pdmTaskAssignedTo",
          assignedByKey: "pdmTaskAssignedBy",
        },
        {
          taskType: "meeting1",
          title: "Meeting 1 next action",
          atKey: "meeting1NextActionAt",
          textKey: "meeting1NextActionText",
          remarksKey: "meeting1Remarks",
          assigneeKey: "meeting1TaskAssignedTo",
          assignedByKey: "meeting1TaskAssignedBy",
        },
        {
          taskType: "meeting2",
          title: "Meeting 2 next action",
          atKey: "meeting2NextActionAt",
          textKey: "meeting2NextActionText",
          remarksKey: "meeting2Remarks",
          assigneeKey: "meeting2TaskAssignedTo",
          assignedByKey: "meeting2TaskAssignedBy",
        },
        {
          taskType: "loe",
          title: "LOE next action",
          atKey: "loeNextActionAt",
          textKey: "loeNextActionText",
          remarksKey: "loeRemarks",
          assigneeKey: "loeTaskAssignedTo",
          assignedByKey: "loeTaskAssignedBy",
        },
        {
          taskType: "mandate",
          title: "Mandate next action",
          atKey: "mandateNextActionAt",
          textKey: "mandateNextActionText",
          remarksKey: "mandateRemarks",
          assigneeKey: "mandateTaskAssignedTo",
          assignedByKey: "mandateTaskAssignedBy",
        },
      ] as const;

      const allUserIds = new Set<string>();
      for (const row of pitchingRows as any[]) {
        for (const milestone of milestoneConfigs) {
          const assignedTo = row[milestone.assigneeKey];
          const assignedBy = row[milestone.assignedByKey];
          if (assignedTo) allUserIds.add(String(assignedTo));
          if (assignedBy) allUserIds.add(String(assignedBy));
        }
      }

      const userMap = new Map<string, any>();
      if (allUserIds.size > 0) {
        const relatedUsers = await db
          .select()
          .from(users)
          .where(inArray(users.id, Array.from(allUserIds)));
        for (const u of relatedUsers) {
          userMap.set(String(u.id), u);
        }
      }

      for (const row of pitchingRows) {
        const leadBase = leadMap.get(Number((row as any).leadId));
        if (!leadBase) continue;

        const rowAny = row as any;

        for (const milestone of milestoneConfigs) {
          const scheduledAt = rowAny[milestone.atKey];
          if (!scheduledAt) continue;

          const taskAssignedTo = rowAny[milestone.assigneeKey] ?? null;
          const taskAssignedBy = rowAny[milestone.assignedByKey] ?? null;

          pushTask({
            id: `pitching-${rowAny.leadId}-${milestone.taskType}`,
            stage: "pitching",
            source: "pitching",
            taskType: milestone.taskType,
            title: milestone.title,
            scheduledAt,
            nextActionText: rowAny[milestone.textKey] ?? null,
            notes: rowAny[milestone.remarksKey] ?? null,
            taskAssignedTo,
            taskAssignedToName: formatUserName(
              taskAssignedTo ? userMap.get(String(taskAssignedTo)) : null
            ),
            taskAssignedBy,
            taskAssignedByName: formatUserName(
              taskAssignedBy ? userMap.get(String(taskAssignedBy)) : null
            ),
            relatedName: leadBase.contact?.name ?? null,
            ownerName: getTaskOwnerName(leadBase),
            createdByName: getTaskCreatedByName(leadBase),
            lead: leadBase,
          });
        }
      }
    }

    if (mandateLeadIds.length > 0) {
      const investorAssignedToUserAlias = alias(users, "investorAssignedToUser");
      const investorAssignedByUserAlias = alias(users, "investorAssignedByUser");

      const investorLinkRows = await db
        .select({
          link: investorLeadLinks,
          investor: investors,
          assignedToUser: investorAssignedToUserAlias,
          assignedByUser: investorAssignedByUserAlias,
        })
        .from(investorLeadLinks)
        .innerJoin(investors, eq(investorLeadLinks.investorId, investors.id))
        .leftJoin(
          investorAssignedToUserAlias,
          eq((investorLeadLinks as any).taskAssignedTo, investorAssignedToUserAlias.id)
        )
        .leftJoin(
          investorAssignedByUserAlias,
          eq((investorLeadLinks as any).taskAssignedBy, investorAssignedByUserAlias.id)
        )
        .where(
          and(
            eq(investorLeadLinks.organizationId, orgId),
            inArray(investorLeadLinks.leadId, mandateLeadIds),
            sql`${investorLeadLinks.nextActionAt} IS NOT NULL`,
            sql`${investorLeadLinks.status} IS DISTINCT FROM 'completed'`
          )
        );

      for (const row of investorLinkRows) {
        const leadBase = leadMap.get(Number(row.link.leadId));
        if (!leadBase) continue;

      pushTask({
        id: `investor-link-${row.link.id}`,
        stage: "mandates",
        source: "investor_link",
        taskType: "investor",
        title: "Investor level next action",
        scheduledAt: row.link.nextActionAt,
        nextActionText: row.link.nextActionText ?? null,
        notes: row.link.remarks ?? null,
        investorId: Number(row.link.investorId),
        taskAssignedTo: (row.link as any).taskAssignedTo ?? null,
        taskAssignedToName: formatUserName(row.assignedToUser),
        taskAssignedBy: (row.link as any).taskAssignedBy ?? null,
        taskAssignedByName: formatUserName(row.assignedByUser),
        relatedName: row.investor?.name ?? null,
        ownerName: getTaskOwnerName(leadBase),
        createdByName: getTaskCreatedByName(leadBase),
        lead: leadBase,
      });
      }

      const investorPocAssignedToUserAlias = alias(users, "investorPocAssignedToUser");
      const investorPocAssignedByUserAlias = alias(users, "investorPocAssignedByUser");

      const investorPocRows = await db
        .select({
          status: investorPocOutreachStatus,
          investor: investors,
          contact: investorContacts,
          assignedToUser: investorPocAssignedToUserAlias,
          assignedByUser: investorPocAssignedByUserAlias,
        })
        .from(investorPocOutreachStatus)
        .innerJoin(investors, eq(investorPocOutreachStatus.investorId, investors.id))
        .leftJoin(investorContacts, eq(investorPocOutreachStatus.contactId, investorContacts.id))
        .leftJoin(
          investorPocAssignedToUserAlias,
          eq((investorPocOutreachStatus as any).taskAssignedTo, investorPocAssignedToUserAlias.id)
        )
        .leftJoin(
          investorPocAssignedByUserAlias,
          eq((investorPocOutreachStatus as any).taskAssignedBy, investorPocAssignedByUserAlias.id)
        )
        .where(
          and(
            eq(investorPocOutreachStatus.organizationId, orgId),
            inArray(investorPocOutreachStatus.leadId, mandateLeadIds),
            sql`${investorPocOutreachStatus.nextActionAt} IS NOT NULL`,
            sql`${investorPocOutreachStatus.status} IS DISTINCT FROM 'completed'`
          )
        );

      for (const row of investorPocRows) {
        const leadBase = leadMap.get(Number(row.status.leadId));
        if (!leadBase) continue;

        const channelLabel =
          channelLabelMap[row.status.channel] || row.status.channel || "Action";

        pushTask({
          id: `investor-poc-${row.status.id}`,
          stage: "mandates",
          source: "investor_poc_outreach",
          taskType: row.status.channel,
          title: `${channelLabel} investor outreach action`,
          scheduledAt: row.status.nextActionAt,
          nextActionText: row.status.nextActionText ?? null,
          notes: row.status.remarks ?? null,
          taskAssignedTo: (row.status as any).taskAssignedTo ?? null,
          taskAssignedToName: formatUserName(row.assignedToUser),
          taskAssignedBy: (row.status as any).taskAssignedBy ?? null,
          taskAssignedByName: formatUserName(row.assignedByUser),
          relatedName: row.contact?.name
            ? `${row.investor?.name || "Investor"} • ${row.contact.name}`
            : row.investor?.name || null,
          ownerName: getTaskOwnerName(leadBase),
          createdByName: getTaskCreatedByName(leadBase),
          lead: leadBase,
        });
      }
    }

    return tasks.sort((a, b) => {
      const aTime = a?.scheduledAt ? new Date(a.scheduledAt).getTime() : 0;
      const bTime = b?.scheduledAt ? new Date(b.scheduledAt).getTime() : 0;
      return aTime - bTime;
    });
  }
  
  // Activity logging operations
  async createActivityLog(activityData: UpsertActivityLog): Promise<ActivityLog> {
    const [activity] = await db.insert(activityLog).values(activityData).returning();
    return activity;
  }

  async getActivityLog(organizationId: number, leadId?: number, companyId?: number, limit: number = 50): Promise<(ActivityLog & { user: User })[]> {
    // Build where conditions
    let whereConditions = [eq(activityLog.organizationId, organizationId)];
    
    if (leadId) {
      whereConditions.push(eq(activityLog.leadId, leadId));
    }
    if (companyId) {
      whereConditions.push(eq(activityLog.companyId, companyId));
    }

    const results = await db
      .select()
      .from(activityLog)
      .leftJoin(users, eq(activityLog.userId, users.id))
      .where(and(...whereConditions))
      .orderBy(desc(activityLog.createdAt))
      .limit(limit);

    return results.map(result => ({
      ...result.activity_log,
      user: result.users!
    }));
  }

  async getActivityLogsForAudit(organizationId: number, filters: {
    search?: string;
    userId?: string;
    companyId?: number;
    action?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
  }): Promise<{ data: (ActivityLog & { user: User, companyName?: string })[], total: number }> {
    // Build where conditions
    let whereConditions = [eq(activityLog.organizationId, organizationId)];
    
    // User filter
    if (filters.userId) {
      whereConditions.push(eq(activityLog.userId, filters.userId));
    }
    
    // Company filter
    if (filters.companyId) {
      whereConditions.push(eq(activityLog.companyId, filters.companyId));
    }
    
    // Action filter
    if (filters.action) {
      whereConditions.push(eq(activityLog.action, filters.action));
    }
    
    // Date range filters
    if (filters.startDate) {
      whereConditions.push(gte(activityLog.createdAt, filters.startDate));
    }
    
    if (filters.endDate) {
      whereConditions.push(lte(activityLog.createdAt, filters.endDate));
    }
    
    // Search filter - search across multiple fields
    if (filters.search && filters.search.trim()) {
      const searchTerm = `%${filters.search.trim()}%`;
      whereConditions.push(
        or(
          ilike(activityLog.entityName, searchTerm),
          ilike(activityLog.details, searchTerm),
          ilike(users.firstName, searchTerm),
          ilike(users.lastName, searchTerm),
          ilike(users.email, searchTerm),
          ilike(companies.name, searchTerm)
        )
      );
    }
    
    // Pagination parameters
    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const offset = (page - 1) * limit;
    
    // Get total count for pagination
    const totalCountQuery = await db
      .select({ count: count() })
      .from(activityLog)
      .leftJoin(users, eq(activityLog.userId, users.id))
      .leftJoin(companies, eq(activityLog.companyId, companies.id))
      .where(and(...whereConditions));
    
    const totalCount = totalCountQuery[0]?.count || 0;
    
    // Get paginated results with all joins
    const results = await db
      .select({
        activityLog: activityLog,
        user: users,
        company: companies
      })
      .from(activityLog)
      .leftJoin(users, eq(activityLog.userId, users.id))
      .leftJoin(companies, eq(activityLog.companyId, companies.id))
      .where(and(...whereConditions))
      .orderBy(desc(activityLog.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      data: results.map(result => ({
        ...result.activityLog,
        user: result.user!,
        companyName: result.company?.name
      })),
      total: totalCount
    };
  }

  // Invitation operations
  async createInvitation(invitationData: InsertInvitationData & { organizationId: number }): Promise<any> {
    const [invitation] = await db.insert(invitations).values(invitationData).returning();
    return invitation;
  }

  async getInvitation(token: string): Promise<any> {
    const [invitation] = await db
      .select()
      .from(invitations)
      .where(eq(invitations.inviteToken, token));
    return invitation;
  }

  async getInvitationsByOrganization(organizationId: number): Promise<(any & { invitedByUser: User })[]> {
    const results = await db
      .select()
      .from(invitations)
      .leftJoin(users, eq(invitations.invitedBy, users.id))
      .where(eq(invitations.organizationId, organizationId))
      .orderBy(desc(invitations.createdAt));

    return results.map(result => ({
      ...result.invitations,
      invitedByUser: result.users!
    }));
  }

  async getInvitationByEmail(email: string): Promise<any> {
    const [invitation] = await db
      .select()
      .from(invitations)
      .where(and(
        eq(invitations.email, email),
        eq(invitations.status, 'pending')
      ))
      .orderBy(desc(invitations.createdAt))
      .limit(1);
    return invitation;
  }

  async updateInvitationStatus(token: string, status: string, acceptedAt?: Date): Promise<any> {
    const updates: any = { status };
    if (acceptedAt) {
      updates.acceptedAt = acceptedAt;
    }

    const [invitation] = await db
      .update(invitations)
      .set(updates)
      .where(eq(invitations.inviteToken, token))
      .returning();
    return invitation;
  }

  async deleteInvitation(id: number, organizationId: number): Promise<void> {
    await db
      .delete(invitations)
      .where(and(
        eq(invitations.id, id),
        eq(invitations.organizationId, organizationId)
      ));
  }

  async updateInvitationEmailStatus(id: number, emailStatus: string, emailSentAt?: Date, emailError?: string): Promise<any> {
    const updates: any = { 
      emailStatus
    };
    
    // Only set lastRetryAt when actually retrying (sending or failed states)
    if (emailStatus === 'sending' || emailStatus === 'failed') {
      updates.lastRetryAt = new Date();
    }
    
    if (emailSentAt) {
      updates.emailSentAt = emailSentAt;
    }
    
    if (emailError !== undefined) {
      updates.emailError = emailError;
    }

    const [invitation] = await db
      .update(invitations)
      .set(updates)
      .where(eq(invitations.id, id))
      .returning();
    
    return invitation;
  }

  async incrementInvitationRetryCount(id: number): Promise<any> {
    const [invitation] = await db
      .select()
      .from(invitations)
      .where(eq(invitations.id, id))
      .limit(1);
    
    if (!invitation) return null;

    const newRetryCount = (invitation.retryCount || 0) + 1;
    
    const [updated] = await db
      .update(invitations)
      .set({ 
        retryCount: newRetryCount
        // lastRetryAt is set by updateInvitationEmailStatus when status changes to 'sending' or 'failed'
      })
      .where(eq(invitations.id, id))
      .returning();
    
    return updated;
  }

  // Dashboard/Analytics operations
  async getDashboardMetrics(organizationId: number, userId?: string): Promise<{
    totalLeads: number;
    qualified: number;
    inOutreach: number;
    inPitching: number;
    pipelineValue: number;
    leadsCountByStage: { [stage: string]: number };
  }> {
    const orgWhereClause = eq(leads.organizationId, organizationId);
    // const whereClause = userId ? and(orgWhereClause, eq(leads.assignedTo, userId)) : orgWhereClause;
    const whereClause = userId
  ? and(
      orgWhereClause,
      or(
        eq(leads.assignedTo, userId),
        eq(leads.ownerAnalystId, userId),
        eq(leads.assignedPartnerId, userId)
      )
    )
  : orgWhereClause;

    const [totalResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(leads)
      .where(whereClause);
    
    const [qualifiedResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(leads)
      .where(and(whereClause, eq(leads.stage, 'qualified')));
    
    const [outreachResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(leads)
      .where(and(whereClause, eq(leads.stage, 'outreach')));
    
    const [pitchingResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(leads)
      .where(and(whereClause, eq(leads.stage, 'pitching')));
    
    const [pipelineResult] = await db
      .select({ sum: sql<number>`sum(pipeline_value)` })
      .from(leads)
      .where(whereClause);
    
    const stageCountsResult = await db
      .select({
        stage: leads.stage,
        count: sql<number>`count(*)`
      })
      .from(leads)
      .where(whereClause)
      .groupBy(leads.stage);
    
    const leadsCountByStage = stageCountsResult.reduce((acc, item) => {
      acc[item.stage] = item.count;
      return acc;
    }, {} as { [stage: string]: number });
    
    // Universe is a superset showing ALL leads regardless of their actual stage
    leadsCountByStage['universe'] = totalResult.count;
    
    return {
      totalLeads: totalResult.count,
      qualified: qualifiedResult.count,
      inOutreach: outreachResult.count,
      inPitching: pitchingResult.count,
      pipelineValue: pipelineResult.sum || 0,
      leadsCountByStage,
    };
  }



  async getPipelineAgingStats(organizationId: number) {
    const allLeads = await db
      .select({
        leadId: leads.id,
        ownerId: leads.ownerAnalystId,
        stage: leads.stage,
        stageUpdatedAt: leads.stageUpdatedAt,
      })
      .from(leads)
      .where(and(
        eq(leads.organizationId, organizationId),
        // Focus only on active deal stages
        inArray(leads.stage, ['qualified', 'outreach', 'pitching', 'mandates'])
      ));

    const usersList = await this.getUsers(organizationId);
    const now = new Date();
    const stats: Record<string, { name: string, warning: number; stagnant: number }> = {};

    allLeads.forEach((lead) => {
      if (!lead.ownerId || !lead.stageUpdatedAt) return;

      const days = Math.floor((now.getTime() - new Date(lead.stageUpdatedAt).getTime()) / (1000 * 60 * 60 * 24));
      
      if (!stats[lead.ownerId]) {
        const u = usersList.find(x => x.id === lead.ownerId);
        stats[lead.ownerId] = { 
          name: u ? `${u.firstName} ${u.lastName}` : "Unknown Analyst", 
          warning: 0, 
          stagnant: 0 
        };
      }

      if (days >= 30) {
        stats[lead.ownerId].stagnant += 1;
      } else if (days >= 14) {
        stats[lead.ownerId].warning += 1;
      }
    });

    return Object.values(stats);
  }



//   // ✅ ADD THIS METHOD
// async getInvestorMetrics(
//   organizationId: number,
//   user?: any
// ): Promise<{
//   totalInvestors: number;
//   outreach: number;
//   active: number;
//   warm: number;
//   dealmaking: number;
// }> {
//   // ✅ Analyst sandbox: only visible investors
//   let list: any[] = [];

//   if (user && user.role === "analyst") {
//     list = await this.getInvestorsByStage(organizationId, "all", user);
//   } else {
//     list = await db
//       .select()
//       .from(investors)
//       .where(eq(investors.organizationId, organizationId));
//   }

//   const counts = {
//     totalInvestors: list.length,
//     outreach: 0,
//     active: 0,
//     warm: 0,
//     dealmaking: 0,
//   };

//   for (const inv of list) {
//     const stage = (inv.stage || "outreach").toLowerCase().trim();
//     if (stage === "outreach") counts.outreach++;
//     else if (stage === "active") counts.active++;
//     else if (stage === "warm") counts.warm++;
//     else if (stage === "dealmaking") counts.dealmaking++;
//   }

//   return counts;
// }


async getInvestorMetrics(
    organizationId: number,
    user?: any
  ): Promise<{
    totalInvestors: number;
    outreach: number;
    active: number;
    warm: number;
    dealmaking: number;
  }> {
    const conditions: any[] = [eq(investors.organizationId, organizationId)];

    // ✅ SANDBOXED METRICS FOR ANALYSTS
    // Metrics ONLY count investors they added or are linked to their leads
    if (user && user.role === "analyst") {
      const userId = String(user.id);
      
      conditions.push(
        or(
          eq(investors.createdByUserId, userId),
          sql`EXISTS (
            SELECT 1 FROM investor_user_access iua
            WHERE iua.organization_id = ${organizationId}
              AND iua.investor_id = ${investors.id}
              AND iua.user_id = ${userId}
          )`,
          sql`EXISTS (
            SELECT 1
            FROM investor_lead_links ill
            JOIN leads l ON l.id = ill.lead_id
            WHERE ill.organization_id = ${organizationId}
              AND ill.investor_id = ${investors.id}
              AND l.organization_id = ${organizationId}
              AND (
                l.owner_analyst_id = ${userId}
                OR l.assigned_to = ${userId}
                OR l.created_by = ${userId}
                OR ${userId} = ANY(l.assigned_interns)
              )
          )`
        )
      );
    }

    const list = await db
      .select()
      .from(investors)
      .where(and(...conditions));

    const counts = {
      totalInvestors: list.length, // Analyst only sees their personal count
      outreach: 0,
      active: 0,
      warm: 0,
      dealmaking: 0,
    };

    for (const inv of list) {
      const stage = (inv.stage || "outreach").toLowerCase().trim();
      if (stage === "outreach") counts.outreach++;
      else if (stage === "active") counts.active++;
      else if (stage === "warm") counts.warm++;
      else if (stage === "dealmaking") counts.dealmaking++;
    }

    return counts;
  }


  // Dashboard source/stage table
  async getDashboardSourceStageTable(
    organizationId: number,
    options: { includeAll: boolean; viewerUserId: string; viewerRole: string }
  ): Promise<{
    scope: 'organization' | 'personal';
    total: { qualified: number; outreach: number; pitching: number; mandates: number; universeActive: number };
    analysts: Array<{ name: string; userId?: string; qualified: number; outreach: number; pitching: number; mandates: number; universeActive: number }>;
    partners: Array<{ name: string; userId?: string; qualified: number; outreach: number; pitching: number; mandates: number; universeActive: number }>;
  }> {
    const activeStages = ['qualified', 'outreach', 'pitching', 'mandates'] as const;

    const mkCounts = (stageRows: Array<{ stage: string; count: any }>) => {
      const out = { qualified: 0, outreach: 0, pitching: 0, mandates: 0, universeActive: 0 };

      for (const r of stageRows) {
        const c = Number((r as any).count ?? 0); // ✅ IMPORTANT (prevents "5"+"133"="5133")
        if (r.stage === 'qualified') out.qualified = c;
        if (r.stage === 'outreach') out.outreach = c;
        if (r.stage === 'pitching') out.pitching = c;
        if (r.stage === 'mandates') out.mandates = c;
      }

      // ✅ Universe = Active leads only
      out.universeActive = out.qualified + out.outreach + out.pitching + out.mandates;
      return out;
    };

    const normalize = (s: string | null | undefined) =>
      (s || '').trim().replace(/\s+/g, ' ').toLowerCase();

    // ✅ Exact rows you want (order preserved)
    const analystTargets = ['Kiran Kashyap', 'Dipeesha Pal', 'Siddharth Mittal', 'Rithwik Ravipati'];
    const partnerTargets = ['Vikash Kumar', 'Dinesh Thakur', 'Charan Damaraju'];

    // --- Personal scope: show only viewer row + totals (if includeAll=false) ---
    if (!options.includeAll) {
      const viewer = await this.getUser(options.viewerUserId);
      const viewerName =
        `${viewer?.firstName || ''} ${viewer?.lastName || ''}`.trim() || 'Me';

      const fieldWhere =
        options.viewerRole === 'partner'
          ? eq(leads.assignedPartnerId, options.viewerUserId)
          : eq(leads.ownerAnalystId, options.viewerUserId);

      const stageRows = await db
        .select({
          stage: leads.stage,
          count: sql<number>`count(*)::int`,
        })
        .from(leads)
        .where(
          and(
            eq(leads.organizationId, organizationId),
            inArray(leads.stage, activeStages as any),
            fieldWhere
          )
        )
        .groupBy(leads.stage);

      const counts = mkCounts(stageRows as any);

      return {
        scope: 'personal',
        total: counts,
        analysts: options.viewerRole === 'partner'
          ? []
          : [{ name: viewerName, userId: options.viewerUserId, ...counts }],
        partners: options.viewerRole === 'partner'
          ? [{ name: viewerName, userId: options.viewerUserId, ...counts }]
          : [],
      };
    }

    // --- Org scope: show whitelisted rows ---
    const orgUsers = await this.getUsers(organizationId);

    const findUserId = (fullName: string, role: 'analyst' | 'partner') => {
      const target = normalize(fullName);
      const u = orgUsers.find(
        (x) =>
          normalize(`${x.firstName || ''} ${x.lastName || ''}`) === target &&
          x.role === role
      );
      return u?.id;
    };

    const analystIds = analystTargets.map((n) => findUserId(n, 'analyst')).filter(Boolean) as string[];
    const partnerIds = partnerTargets.map((n) => findUserId(n, 'partner')).filter(Boolean) as string[];

    // Totals across org (active stages only)
    const totalStageRows = await db
      .select({
        stage: leads.stage,
        count: sql<number>`count(*)::int`,
      })
      .from(leads)
      .where(and(eq(leads.organizationId, organizationId), inArray(leads.stage, activeStages as any)))
      .groupBy(leads.stage);

    const total = mkCounts(totalStageRows as any);

    // Analysts breakdown (ownerAnalystId)
    let analystStageRows: Array<{ ownerId: string | null; stage: string; count: any }> = [];
    if (analystIds.length) {
      analystStageRows = await db
        .select({
          ownerId: leads.ownerAnalystId,
          stage: leads.stage,
          count: sql<number>`count(*)::int`,
        })
        .from(leads)
        .where(
          and(
            eq(leads.organizationId, organizationId),
            inArray(leads.stage, activeStages as any),
            inArray(leads.ownerAnalystId, analystIds as any)
          )
        )
        .groupBy(leads.ownerAnalystId, leads.stage);
    }

    // Partners breakdown (assignedPartnerId)
    let partnerStageRows: Array<{ partnerId: string | null; stage: string; count: any }> = [];
    if (partnerIds.length) {
      partnerStageRows = await db
        .select({
          partnerId: leads.assignedPartnerId,
          stage: leads.stage,
          count: sql<number>`count(*)::int`,
        })
        .from(leads)
        .where(
          and(
            eq(leads.organizationId, organizationId),
            inArray(leads.stage, activeStages as any),
            inArray(leads.assignedPartnerId, partnerIds as any)
          )
        )
        .groupBy(leads.assignedPartnerId, leads.stage);
    }

    const buildRow = (name: string, userId: string | undefined, rows: any[], idKey: string) => {
      const filtered = userId ? rows.filter((r) => r[idKey] === userId) : [];
      const counts = mkCounts(filtered.map((r: any) => ({ stage: r.stage, count: r.count })));
      return { name, userId, ...counts };
    };

    const analysts = analystTargets.map((n) =>
      buildRow(n, findUserId(n, 'analyst'), analystStageRows as any, 'ownerId')
    );

    const partners = partnerTargets.map((n) =>
      buildRow(n, findUserId(n, 'partner'), partnerStageRows as any, 'partnerId')
    );

    return {
      scope: 'organization',
      total,
      analysts,
      partners,
    };
  }


  // User Management operations
  async getUserAnalytics(organizationId: number): Promise<{
    totalUsers: number;
    usersByRole: { [role: string]: number };
    userLeadCounts: Array<{
      userId: string;
      firstName: string;
      lastName: string;
      role: string;
      assignedLeads: number;
      leadsByStage: { [stage: string]: number };
    }>;
  }> {
    const orgWhereClause = eq(users.organizationId, organizationId);

    // Get total users count
    const [totalUsersResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(orgWhereClause);

    // Get users by role
    const userRoleCountsResult = await db
      .select({
        role: users.role,
        count: sql<number>`count(*)`
      })
      .from(users)
      .where(orgWhereClause)
      .groupBy(users.role);

    const usersByRole = userRoleCountsResult.reduce((acc, item) => {
      acc[item.role] = item.count;
      return acc;
    }, {} as { [role: string]: number });

    // Get detailed user lead statistics
    const userLeadStats = await db
      .select({
        userId: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        role: users.role,
        leadId: leads.id,
        leadStage: leads.stage,
      })
      .from(users)
      .leftJoin(leads, eq(leads.assignedTo, users.id))
      .where(orgWhereClause);

    // Group by user and calculate stats
    const userStatsMap = new Map<string, {
      userId: string;
      firstName: string;
      lastName: string;
      role: string;
      assignedLeads: number;
      leadsByStage: { [stage: string]: number };
    }>();

    userLeadStats.forEach(row => {
      if (!userStatsMap.has(row.userId)) {
        userStatsMap.set(row.userId, {
          userId: row.userId,
          firstName: row.firstName || '',
          lastName: row.lastName || '',
          role: row.role,
          assignedLeads: 0,
          leadsByStage: {}
        });
      }

      const userStats = userStatsMap.get(row.userId)!;
      
      if (row.leadId && row.leadStage) {
        userStats.assignedLeads++;
        userStats.leadsByStage[row.leadStage] = (userStats.leadsByStage[row.leadStage] || 0) + 1;
      }
    });

    return {
      totalUsers: totalUsersResult.count,
      usersByRole,
      userLeadCounts: Array.from(userStatsMap.values())
    };
  }

  async updateUserRole(userId: string, newRole: string): Promise<User | undefined> {
    const [updatedUser] = await db
      .update(users)
      .set({ role: newRole as 'analyst' | 'partner' | 'admin' })
      .where(eq(users.id, userId))
      .returning();
    return updatedUser;
  }

  async bulkAssignLeads(leadIds: number[], assignedTo: string | null): Promise<Lead[]> {
    // Update all leads with assignment and universe status logic
    const updatedLeads = await db
      .update(leads)
      .set({ 
        assignedTo,
        universeStatus: sql`CASE 
          WHEN stage = 'universe' THEN ${assignedTo ? 'assigned' : 'open'}
          ELSE universe_status 
        END`,
        updatedAt: new Date()
      })
      .where(sql`${leads.id} = ANY(${leadIds})`)
      .returning();
    return updatedLeads;
  }

  // Team hierarchy operations
  async getTeamTree(organizationId: number, userId?: string): Promise<any> {
    // Get all users in the organization
    const allUsers: User[]  = await db.select().from(users).where(eq(users.organizationId, organizationId));    
    // Build hierarchy
    const partners = allUsers.filter(u => u.role === 'partner');
    const analysts = allUsers.filter(u => u.role === 'analyst');
    const interns = allUsers.filter(u => u.role === 'intern');
    
    return {
      partners: partners.map(partner => ({
        ...partner,
        analysts: analysts.filter(a => a.partnerId === partner.id).map(analyst => ({
          ...analyst,
          interns: interns.filter(i => i.analystId === analyst.id)
        }))
      })),
      unassignedAnalysts: analysts.filter(a => !a.partnerId),
      unassignedInterns: interns.filter(i => !i.analystId)
    };
  }

  async getAnalystsByPartner(partnerId: string, organizationId: number): Promise<User[]> {
    return await db.select().from(users).where(
      and(
        eq(users.organizationId, organizationId),
        eq(users.partnerId, partnerId),
        eq(users.role, 'analyst')
      )
    );
  }

  async getInternsByAnalyst(analystId: string, organizationId: number): Promise<User[]> {
    return await db.select().from(users).where(
      and(
        eq(users.organizationId, organizationId),
        eq(users.analystId, analystId),
        eq(users.role, 'intern')
      )
    );
  }

  async validatePartnerOf(partnerId: string, analystId: string, organizationId: number): Promise<boolean> {
    const [analyst] = await db.select().from(users).where(
      and(
        eq(users.id, analystId),
        eq(users.organizationId, organizationId),
        eq(users.role, 'analyst')
      )
    );
    return analyst?.partnerId === partnerId;
  }

  async validateAnalystOf(analystId: string, internId: string, organizationId: number): Promise<boolean> {
    const [intern] = await db.select().from(users).where(
      and(
        eq(users.id, internId),
        eq(users.organizationId, organizationId),
        eq(users.role, 'intern')
      )
    );
    return intern?.analystId === analystId;
  }

  async assignLeadToIntern(leadId: number, internId: string, assignedBy: string, organizationId: number, notes?: string): Promise<void> {
    // Validate intern exists, has intern role, and is in same organization
    const [intern] = await db.select().from(users).where(
      and(
        eq(users.id, internId),
        eq(users.organizationId, organizationId),
        eq(users.role, 'intern')
      )
    );
    
    if (!intern) {
      throw new Error('Invalid intern: Intern not found or not in the same organization');
    }

    // Get lead to validate and check ownership
    const [lead] = await db.select().from(leads).where(
      and(
        eq(leads.id, leadId),
        eq(leads.organizationId, organizationId)
      )
    );
    
    if (!lead) {
      throw new Error('Lead not found or not in the same organization');
    }

    // Validate intern belongs to the lead's owner analyst (if owner is set)
    if (lead.ownerAnalystId && intern.analystId !== lead.ownerAnalystId) {
      throw new Error('Intern does not report to the lead owner analyst');
    }

    // Update lead's assignedTo field and universeStatus for universe stage
    await db.update(leads)
      .set({ 
        assignedTo: internId,
        universeStatus: lead.stage === 'universe' ? 'assigned' : lead.universeStatus,
        updatedAt: new Date()
      })
      .where(
        and(
          eq(leads.id, leadId),
          eq(leads.organizationId, organizationId)
        )
      );

    // Log assignment in lead_assignments table
    await db.insert(leadAssignments).values({
      organizationId,
      leadId,
      assignedBy,
      assignedTo: internId,
      notes: notes || 'Lead assigned to intern',
      assignedAt: new Date()
    });
  }

  async reassignLeadToIntern(leadId: number, fromInternId: string, toInternId: string, reassignedBy: string, organizationId: number, notes?: string): Promise<void> {
    // Get lead and validate current assignment
    const [lead] = await db.select().from(leads).where(
      and(
        eq(leads.id, leadId),
        eq(leads.organizationId, organizationId)
      )
    );
    
    if (!lead) {
      throw new Error('Lead not found or not in the same organization');
    }

    if (lead.assignedTo !== fromInternId) {
      throw new Error('Lead is not currently assigned to the specified intern');
    }

    // Validate both interns exist, have intern role, and are in same organization
    const [fromIntern] = await db.select().from(users).where(
      and(
        eq(users.id, fromInternId),
        eq(users.organizationId, organizationId),
        eq(users.role, 'intern')
      )
    );

    const [toIntern] = await db.select().from(users).where(
      and(
        eq(users.id, toInternId),
        eq(users.organizationId, organizationId),
        eq(users.role, 'intern')
      )
    );
    
    if (!fromIntern || !toIntern) {
      throw new Error('Invalid intern: One or both interns not found or not in the same organization');
    }

    // Validate both interns belong to the same analyst (lead owner)
    if (lead.ownerAnalystId) {
      if (fromIntern.analystId !== lead.ownerAnalystId || toIntern.analystId !== lead.ownerAnalystId) {
        throw new Error('Both interns must report to the lead owner analyst');
      }
    }

    // Update lead's assignedTo field
    await db.update(leads)
      .set({ 
        assignedTo: toInternId,
        updatedAt: new Date()
      })
      .where(
        and(
          eq(leads.id, leadId),
          eq(leads.organizationId, organizationId)
        )
      );

    // Log reassignment in lead_assignments table
    await db.insert(leadAssignments).values({
      organizationId,
      leadId,
      assignedBy: reassignedBy,
      assignedTo: toInternId,
      notes: notes || `Lead reassigned from intern ${fromInternId} to intern ${toInternId}`,
      assignedAt: new Date()
    });
  }

  async reassignAnalyst(fromAnalystId: string, toAnalystId: string, partnerId: string, organizationId: number, moveInterns: boolean): Promise<{ leadsTransferred: number; internsTransferred: number }> {
    // Validate partner exists and has partner role
    const [partner] = await db.select().from(users).where(
      and(
        eq(users.id, partnerId),
        eq(users.organizationId, organizationId),
        eq(users.role, 'partner')
      )
    );
    
    if (!partner) {
      throw new Error('Invalid partner: Partner not found or does not have partner role');
    }

    // Validate both analysts exist, have analyst role, and are in same organization
    const [fromAnalyst] = await db.select().from(users).where(
      and(
        eq(users.id, fromAnalystId),
        eq(users.organizationId, organizationId),
        eq(users.role, 'analyst')
      )
    );

    const [toAnalyst] = await db.select().from(users).where(
      and(
        eq(users.id, toAnalystId),
        eq(users.organizationId, organizationId),
        eq(users.role, 'analyst')
      )
    );
    
    if (!fromAnalyst || !toAnalyst) {
      throw new Error('Invalid analyst: One or both analysts not found or not in the same organization');
    }

    // Validate partner relationship with fromAnalyst
    if (fromAnalyst.partnerId !== partnerId) {
      throw new Error('From analyst does not report to the specified partner');
    }

    // Transfer all leads owned by the fromAnalyst to toAnalyst
    const leadsToTransfer = await db.update(leads)
      .set({ 
        ownerAnalystId: toAnalystId,
        updatedAt: new Date()
      })
      .where(
        and(
          eq(leads.organizationId, organizationId),
          eq(leads.ownerAnalystId, fromAnalystId)
        )
      )
      .returning();

    let internsTransferred = 0;
    if (moveInterns) {
      // Transfer all interns reporting to the fromAnalyst to toAnalyst
      const internsToTransfer = await db.update(users)
        .set({ 
          analystId: toAnalystId,
          updatedAt: new Date()
        })
        .where(
          and(
            eq(users.organizationId, organizationId),
            eq(users.analystId, fromAnalystId),
            eq(users.role, 'intern')
          )
        )
        .returning();
      internsTransferred = internsToTransfer.length;
      
      // Note: Leads remain assigned to their current intern (assignedTo unchanged)
      // The intern now reports to the new analyst (toAnalystId)
    } else {
      // If not moving interns, clear assignedTo for leads that were assigned to interns
      // of the fromAnalyst to avoid orphaned assignments
      await db.update(leads)
        .set({ 
          assignedTo: null,
          universeStatus: sql`CASE 
            WHEN stage = 'universe' THEN 'open'
            ELSE universe_status 
          END`,
          updatedAt: new Date()
        })
        .where(
          and(
            eq(leads.organizationId, organizationId),
            eq(leads.ownerAnalystId, toAnalystId), // Now owned by toAnalyst
            sql`${leads.assignedTo} IN (
              SELECT id FROM ${users} 
              WHERE analyst_id = ${fromAnalystId} 
              AND role = 'intern'
              AND organization_id = ${organizationId}
            )`
          )
        );
    }

    return {
      leadsTransferred: leadsToTransfer.length,
      internsTransferred
    };
  }

    async transferLeadOwnership(
    organizationId: number,
    fromUserId: string,
    toUserId: string
  ): Promise<{ transferredCount: number }> {
    // Update ONLY ownerAnalystId (ownership)
    const updated = await db
      .update(leads)
      .set({
        ownerAnalystId: toUserId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(leads.organizationId, organizationId),
          eq(leads.ownerAnalystId, fromUserId)
        )
      )
      .returning({ id: leads.id });

    return { transferredCount: updated.length };
  }


  // Challenge token operations for secure reassignments
  async createChallengeToken(userId: string, organizationId: number, leadId: number, purpose: string): Promise<string> {
    // Rate limiting check
    const rateLimitKey = `${userId}:${organizationId}`;
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    
    let rateLimit = this.rateLimits.get(rateLimitKey);
    if (!rateLimit || rateLimit.resetTime < now) {
      // Reset rate limit
      rateLimit = { count: 0, resetTime: new Date(now.getTime() + 60 * 60 * 1000) };
      this.rateLimits.set(rateLimitKey, rateLimit);
    }
    
    if (rateLimit.count >= this.RATE_LIMIT_PER_HOUR) {
      throw new Error('Rate limit exceeded. Too many token requests in the last hour.');
    }
    
    // Clean up expired tokens before creating new ones
    await this.cleanupExpiredTokens();
    
    // Generate unique token
    const token = randomUUID();
    const expiresAt = new Date(now.getTime() + this.TOKEN_EXPIRY_MINUTES * 60 * 1000);
    
    // Store token
    const challengeToken: ChallengeToken = {
      token,
      userId,
      organizationId,
      leadId,
      purpose,
      expiresAt,
      createdAt: now
    };
    
    this.challengeTokens.set(token, challengeToken);
    
    // Increment rate limit counter
    rateLimit.count += 1;
    
    console.log(`Challenge token created for user ${userId}, lead ${leadId}, purpose: ${purpose}, expires: ${expiresAt}`);
    
    return token;
  }

  async validateChallengeToken(token: string, userId: string, organizationId: number, leadId: number, purpose: string): Promise<boolean> {
    const challengeToken = this.challengeTokens.get(token);
    
    if (!challengeToken) {
      console.log(`Challenge token validation failed: Token not found - ${token}`);
      return false;
    }
    
    const now = new Date();
    
    // Check if token is expired
    if (challengeToken.expiresAt < now) {
      console.log(`Challenge token validation failed: Token expired - ${token}`);
      this.challengeTokens.delete(token); // Clean up expired token
      return false;
    }
    
    // Validate token properties
    const isValid = (
      challengeToken.userId === userId &&
      challengeToken.organizationId === organizationId &&
      challengeToken.leadId === leadId &&
      challengeToken.purpose === purpose
    );
    
    if (!isValid) {
      console.log(`Challenge token validation failed: Token properties mismatch - ${token}`);
      return false;
    }
    
    // Token is valid - consume it (one-time use)
    this.challengeTokens.delete(token);
    console.log(`Challenge token validated and consumed for user ${userId}, lead ${leadId}, purpose: ${purpose}`);
    
    return true;
  }

  async cleanupExpiredTokens(): Promise<void> {
    const now = new Date();
    const tokensToDelete: string[] = [];
    
    // Find expired tokens
    for (const [token, challengeToken] of this.challengeTokens.entries()) {
      if (challengeToken.expiresAt < now) {
        tokensToDelete.push(token);
      }
    }
    
    // Delete expired tokens
    tokensToDelete.forEach(token => {
      this.challengeTokens.delete(token);
    });
    
    // Clean up expired rate limits
    const rateKeysToDelete: string[] = [];
    for (const [key, rateLimit] of this.rateLimits.entries()) {
      if (rateLimit.resetTime < now) {
        rateKeysToDelete.push(key);
      }
    }
    
    rateKeysToDelete.forEach(key => {
      this.rateLimits.delete(key);
    });
    
    if (tokensToDelete.length > 0) {
      console.log(`Cleaned up ${tokensToDelete.length} expired challenge tokens`);
    }
  }

  // ==========================================
  // INVESTOR METRICS
  // ==========================================





  // ===========================================
  // NETWORK HEALTH / LINKAGE METRICS
  // ===========================================

// ✅ NEW: Network Health / Linkage Metrics
  async getLinkageMetrics(organizationId: number) {
    const activeStages = ['qualified', 'outreach', 'pitching', 'mandates'];

    // 1. Total Active Leads
    const [totalActiveLeadsRes] = await db
      .select({ count: count() })
      .from(leads)
      .where(and(
        eq(leads.organizationId, organizationId),
        inArray(leads.stage, activeStages)
      ));
    const totalActiveLeads = totalActiveLeadsRes?.count || 0;

    // 2. Linked Active Leads (Leads in active stages that have at least one investor)
    const linkedLeadsRes = await db
      .select({ id: leads.id })
      .from(leads)
      .innerJoin(investorLeadLinks, eq(leads.id, investorLeadLinks.leadId))
      .where(and(
        eq(leads.organizationId, organizationId),
        inArray(leads.stage, activeStages)
      ))
      .groupBy(leads.id);
    const linkedActiveLeads = linkedLeadsRes.length;

    // 3. Total Investors
    const [totalInvestorsRes] = await db
      .select({ count: count() })
      .from(investors)
      .where(eq(investors.organizationId, organizationId));
    const totalInvestors = totalInvestorsRes?.count || 0;

    // 4. Linked Investors (Investors connected to at least one active deal)
    const linkedInvestorsRes = await db
      .select({ id: investors.id })
      .from(investors)
      .innerJoin(investorLeadLinks, eq(investors.id, investorLeadLinks.investorId))
      .innerJoin(leads, eq(investorLeadLinks.leadId, leads.id))
      .where(and(
        eq(investors.organizationId, organizationId),
        inArray(leads.stage, activeStages)
      ))
      .groupBy(investors.id);
    const linkedInvestors = linkedInvestorsRes.length;

    // 5. Total Connection Count (for Density Ratio)
    const [totalLinksRes] = await db
      .select({ count: count() })
      .from(investorLeadLinks)
      .innerJoin(leads, eq(investorLeadLinks.leadId, leads.id))
      .where(and(
        eq(investorLeadLinks.organizationId, organizationId),
        inArray(leads.stage, activeStages)
      ));
    
    return {
      totalActiveLeads,
      linkedActiveLeads,
      totalInvestors,
      linkedInvestors,
      totalLinks: totalLinksRes?.count || 0
    };
  }


  //==========================================
  // INVESTOR OPERATIONS
  //==========================================

  // ✅ NEW IMPLEMENTATION
//=========================================
// INVESTOR LISTING
// ==========================================
// async getInvestorsForOtherFields(organizationId: number, user?: any): Promise<Investor[]> {
//   // ✅ Analyst sandbox: only visible investors
//   if (user && user.role === "analyst") {
//     const list = await this.getInvestorsByStage(organizationId, "all", user);

//     // Order by updatedAt DESC without needing drizzle `desc()`
//     return (list as any[]).sort((a, b) => {
//       const ad = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
//       const bd = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
//       return bd - ad;
//     }) as any;
//   }

//   // ✅ Non-analysts: normal org-wide list
//   const rows = await db
//     .select()
//     .from(investors)
//     .where(eq(investors.organizationId, organizationId));

//   // Same ordering for consistency
//   return (rows as any[]).sort((a, b) => {
//     const ad = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
//     const bd = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
//     return bd - ad;
//   }) as any;
// }


async getInvestorsForOtherFields(
  organizationId: number,
  user?: any,
  selectedStages: string[] = ["outreach", "warm", "active", "dealmaking"]
): Promise<Investor[]> {
  const normalizedStages =
    Array.isArray(selectedStages) && selectedStages.length > 0
      ? selectedStages
      : ["outreach", "warm", "active", "dealmaking"];

  const rows = await db
    .select()
    .from(investors)
    .where(
      and(
        eq(investors.organizationId, organizationId),
        inArray(investors.stage, normalizedStages as any)
      )
    );

  return (rows as any[]).sort((a, b) => {
    const ad = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
    const bd = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    return bd - ad;
  }) as any;
}
   // ==========================================
  // INVESTOR DEDUPLICATION & BULK IMPORT
  // ==========================================

  // Check if investor exists by Name (Case Insensitive). 
  // If yes, return it. If no, create it along with contacts.
// ==========================================
  // INVESTOR DEDUPLICATION & BULK IMPORT (MERGE STRATEGY)
  // ==========================================

  // Check if investor exists. 
  // If YES: Check for new contacts in the list and ADD them (Merge).
  // If NO: Create new investor with all contacts.
  // ==========================================
  // INVESTOR DEDUPLICATION & BULK IMPORT (ENRICH + MERGE STRATEGY)
  // ==========================================
  async createInvestorWithDeduplication(organizationId: number, data: InsertInvestorData, contactsList: Array<any> = [], createdByUserId?: string) {
    // 1. Normalize name for check
    const normalizedName = data.name.toLowerCase().trim();

    // 2. Check for existence
    const [existing] = await db
      .select()
      .from(investors)
      .where(
        and(
          eq(investors.organizationId, organizationId),
          sql`LOWER(TRIM(${investors.name})) = ${normalizedName}`
        )
      );

    if (existing) {
      // ✅ 1. UPDATE INVESTOR DETAILS (If missing)
      const investorUpdates: any = {};
      if (!existing.investorType && (data as any).investorType) investorUpdates.investorType = (data as any).investorType;
      if (!existing.sector && data.sector) investorUpdates.sector = data.sector;
      if (!existing.location && data.location) investorUpdates.location = data.location;
      if (!existing.website && data.website) investorUpdates.website = data.website;
      if (!existing.description && data.description) investorUpdates.description = data.description;

      if (Object.keys(investorUpdates).length > 0) {
        await db
          .update(investors)
          .set({ ...investorUpdates, updatedAt: new Date() })
          .where(eq(investors.id, existing.id));
        console.log(`[Import] Updated details for existing investor: ${existing.name}`);
      }

      // --- CONTACTS LOGIC START ---
      const currentContacts = await db
        .select()
        .from(investorContacts)
        .where(eq(investorContacts.investorId, existing.id));

      const newContactsToInsert: any[] = [];

      for (const incoming of contactsList) {
        // Skip empty names
       const hasAny = !!(
          String(incoming?.name || "").trim() ||
          String(incoming?.email || "").trim() ||
          String(incoming?.phone || "").trim() ||
          String(incoming?.linkedinProfile || incoming?.linkedin || "").trim()
        );
        if (!hasAny) continue;

        // Check if contact exists (Match by Name OR Email)
        const match = currentContacts.find((existingContact: any) => {
            const nameMatch = existingContact.name?.toLowerCase().trim() === String(incoming.name).toLowerCase().trim();
            const emailMatch = incoming.email && existingContact.email && existingContact.email.toLowerCase().trim() === String(incoming.email).toLowerCase().trim();
            return nameMatch || emailMatch;
        });

        if (match) {
            // ✅ 2. ENRICH LOGIC: Update existing contact if fields are missing
            const contactUpdates: any = {};
            
            if (!match.email && incoming.email) contactUpdates.email = incoming.email;
            if (!match.phone && incoming.phone) contactUpdates.phone = incoming.phone;
            
            const incomingLinkedin = incoming.linkedinProfile || incoming.linkedin;
            if (!match.linkedinProfile && incomingLinkedin) contactUpdates.linkedinProfile = incomingLinkedin;

            if ((!match.designation || match.designation === "Investor") && incoming.designation && incoming.designation !== "Investor") {
                contactUpdates.designation = incoming.designation;
            }

            if (Object.keys(contactUpdates).length > 0) {
                await db
                    .update(investorContacts)
                    .set(contactUpdates)
                    .where(eq(investorContacts.id, match.id));
            }
        } else {
            // ✅ 3. MERGE LOGIC: If no match found, prepare for INSERT
            newContactsToInsert.push({
                organizationId,
                investorId: existing.id,
                name: String(incoming.name || "").trim() || "Unknown",
                designation: incoming.designation || "Investor",
                email: incoming.email || null,
                phone: incoming.phone || null,
                linkedinProfile: incoming.linkedinProfile || incoming.linkedin || null,
                isPrimary: false, // Merged contacts are secondary
            });
        }
      }

      // ✅ 4. EXECUTE MERGE: Batch Insert New Contacts
      if (newContactsToInsert.length > 0) {
        await db.insert(investorContacts).values(newContactsToInsert);
        console.log(`[Import] Merged ${newContactsToInsert.length} new contacts into existing investor: ${existing.name}`);
      }
      // --- CONTACTS LOGIC END ---

            // ✅ Condition B: even if investor already exists, importer gets access
        if (createdByUserId) {
          await db
            .insert(investorUserAccess)
            .values({
              organizationId,
              investorId: existing.id,
              userId: createdByUserId,
              source: "import",
            })
            .onConflictDoNothing({
              target: [
                investorUserAccess.organizationId,
                investorUserAccess.investorId,
                investorUserAccess.userId,
              ],
            });
        }

      return { investor: existing, isExisting: true };
    }



    // ✅ 5. CREATE NEW LOGIC: If investor doesn't exist, create it (Standard logic)
    const result = await this.createInvestor(
      organizationId,
      data,
      contactsList,
      createdByUserId,
      "import"
    );
    return { investor: result.investor, isExisting: false };
  }

   // ✅ PITCHING MANAGEMENT METHODS
  async getPitchingDetails(leadId: number): Promise<PitchingDetail | undefined> {
    const [details] = await db
      .select()
      .from(pitchingDetails)
      .where(eq(pitchingDetails.leadId, leadId));
    return details;
  }

  async upsertPitchingDetails(leadId: number, data: Partial<InsertPitchingDetail>): Promise<PitchingDetail> {
    const existing = await this.getPitchingDetails(leadId);

    if (existing) {
      // Update
      const [updated] = await db
        .update(pitchingDetails)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(pitchingDetails.leadId, leadId))
        .returning();
      return updated;
    } else {
      // Insert
      const [created] = await db
        .insert(pitchingDetails)
        .values({ ...data, leadId })
        .returning();
      return created;
    }
  }


    async getLeadSolutionNote(
    organizationId: number,
    leadId: number
  ): Promise<LeadSolutionNote | undefined> {
    const [note] = await db
      .select()
      .from(leadSolutionNotes)
      .where(
        and(
          eq(leadSolutionNotes.organizationId, organizationId),
          eq(leadSolutionNotes.leadId, leadId)
        )
      );

    return note;
  }

  async upsertLeadSolutionNote(
    organizationId: number,
    leadId: number,
    data: Partial<InsertLeadSolutionNote>
  ): Promise<LeadSolutionNote> {
    const existing = await this.getLeadSolutionNote(organizationId, leadId);

    if (existing) {
      const [updated] = await db
        .update(leadSolutionNotes)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(leadSolutionNotes.organizationId, organizationId),
            eq(leadSolutionNotes.leadId, leadId)
          )
        )
        .returning();

      return updated;
    }

    const [created] = await db
      .insert(leadSolutionNotes)
      .values({
        organizationId,
        leadId,
        ...data,
      })
      .returning();

    return created;
  }





    // ==========================================
  // INVESTOR POC COVERAGE (POC 1, 2, 3 Pages)
  // ==========================================

  // Get data for the specific POC slot (0=Primary/1st, 1=2nd, 2=3rd)
async getInvestorPocCoverage(
  organizationId: number,
  slotIndex: number,
  user?: any,
  selectedStages: string[] = ["outreach", "warm", "active", "dealmaking"]
) {
  const normalizedStages =
    Array.isArray(selectedStages) && selectedStages.length > 0
      ? selectedStages
      : ["outreach", "warm", "active", "dealmaking"];

  const investorWhere = [
    eq(investors.organizationId, organizationId),
    inArray(investors.stage, normalizedStages as any),
  ];

  const allInvestors = await db
    .select()
    .from(investors)
    .where(and(...investorWhere))
    .orderBy(asc(investors.name));

  const investorIds = allInvestors.map((i) => i.id);
  if (investorIds.length === 0) return [];

  const allContacts = await db
    .select()
    .from(investorContacts)
    .where(inArray(investorContacts.investorId, investorIds));

  const rows = allInvestors.map((inv) => {
    const myContacts = allContacts
      .filter((c) => c.investorId === inv.id)
      .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.id - b.id);

    const targetContact = myContacts[slotIndex];

    return {
      investorId: inv.id,
      investorName: inv.name,
      investorType: inv.investorType || "",
      contactId: targetContact?.id || null,
      name: targetContact?.name || "",
      designation: targetContact?.designation || "",
      phone: targetContact?.phone || "",
      email: targetContact?.email || "",
      linkedinProfile: targetContact?.linkedinProfile || "",
    };
  });

  return rows;
}
  // Save data for a specific slot
  async saveInvestorPocSlot(organizationId: number, data: any, slotIndex: number) {
    const { investorId, name, designation, phone, email, linkedinProfile } = data;

    // 1. Get existing contacts to find the correct slot or append
    const existingContacts = await db
      .select()
      .from(investorContacts)
      .where(eq(investorContacts.investorId, investorId));

    // Sort: Primary first
    const sorted = existingContacts.sort((a, b) => (b.isPrimary === a.isPrimary ? 0 : b.isPrimary ? 1 : -1));
    
    const targetContact = sorted[slotIndex];

    if (targetContact) {
      // UPDATE existing contact at this slot
      await db
        .update(investorContacts)
        .set({ name, designation, phone, email, linkedinProfile })
        .where(eq(investorContacts.id, targetContact.id));
    } else {
      // CREATE new contact (This slot is empty)
      // If saving to Slot 0 (POC 1), mark as primary. Otherwise false.
      const isPrimary = slotIndex === 0; 
      
      await db.insert(investorContacts).values({
        organizationId,
        investorId,
        name,
        designation,
        phone,
        email,
        linkedinProfile,
        isPrimary
      });
    }

    return { success: true };
  }


  


  // ========================================== 
// INVESTOR CONTACT METRICS
// -----------------------------------------
// This method calculates various metrics related to investor contacts for a given organization.
// It fetches all investors and their associated contacts, then computes metrics such as:
// - Ghost Investors (active/warm/dealmaking investors with 0 contacts)
// - Incomplete Primary Contacts (primary contact missing email or phone)
// - Coverage Buckets (0, 1, 2, 3, 4+ contacts)
// - Top 3 POC Stats (for the first three contacts of each investor)
// - A fix list of investors that need attention based on the above criteria.
 async getInvestorContactMetrics(organizationId: number, user?: any) {
    // 1. Get all investors (Manual Fetch)
    const allInvestors =
      user && user.role === "analyst"
        ? await this.getInvestorsByStage(organizationId, "all", user)
        : await db
            .select()
            .from(investors)
            .where(eq(investors.organizationId, organizationId));

    if (allInvestors.length === 0) {
       return { 
          cards: { ghostInvestors: 0, incompletePrimary: 0, databaseHealth: 0, totalInvestors: 0 }, 
          coverage: { 0: { total: 0 }, 1: { total: 0 }, 2: { total: 0 }, 3: { total: 0 }, 4: { total: 0 } }, 
          top3: { poc1: { total: 0 }, poc2: { total: 0 }, poc3: { total: 0 } }, 
          fixList: [] 
       };
    }

    // 2. Get all contacts for these investors 
    // ✅ FIX: Use 'investorContacts' instead of 'contacts'
    const investorIds = allInvestors.map(inv => inv.id);
    const allContacts = await db
        .select()
        .from(investorContacts) // <--- CHANGED THIS
        .where(inArray(investorContacts.investorId, investorIds)); // <--- AND THIS

    // 3. Map contacts to investors in memory
    const investorsWithContacts = allInvestors.map(inv => {
        return {
            ...inv,
            // ✅ FIX: Filter the correct list
            contacts: allContacts.filter(c => c.investorId === inv.id)
        };
    });

    // ------------------------------------------
    // 4. Calculate Metrics (Same logic as before)
    // ------------------------------------------
    let ghostInvestors = 0;
    let incompletePrimary = 0;
    let totalContacts = 0;
    let validEmailCount = 0;
    
    const coverageMap = {
      0: { total: 0, complete: 0, partial: 0 },
      1: { total: 0, complete: 0, partial: 0 },
      2: { total: 0, complete: 0, partial: 0 },
      3: { total: 0, complete: 0, partial: 0 },
      4: { total: 0, complete: 0, partial: 0 }, 
    };

    const top3Stats = {
        poc1: { total: 0, phone: 0, email: 0, linkedin: 0 },
        poc2: { total: 0, phone: 0, email: 0, linkedin: 0 },
        poc3: { total: 0, phone: 0, email: 0, linkedin: 0 },
    };

    const fixList: any[] = [];

    for (const inv of investorsWithContacts) {
      const contacts = inv.contacts || [];
      const count = contacts.length;
      totalContacts += count;

      // A. Coverage Bucket
      let bucketKey = count >= 4 ? 4 : count;
      // @ts-ignore
      if (!coverageMap[bucketKey]) bucketKey = 4;
      
      const isInvestorComplete = contacts.every(c => 
        c.email && c.email.length > 0 && 
        c.phone && c.phone.length > 0 &&
        c.linkedinProfile && c.linkedinProfile.length > 0
      );

      // @ts-ignore
      coverageMap[bucketKey].total++;
      if (count > 0) {
          // @ts-ignore
          if (isInvestorComplete) coverageMap[bucketKey].complete++;
          // @ts-ignore
          else coverageMap[bucketKey].partial++;
      }

      // Sort: Primary first
      const sorted = [...contacts].sort((a, b) => (b.isPrimary === a.isPrimary ? 0 : b.isPrimary ? 1 : -1));
      const primary = sorted[0];

      // B. Ghost & Primary Health
      if (count === 0 && (inv.stage === 'active' || inv.stage === 'dealmaking' || inv.stage === 'warm')) {
         ghostInvestors++;
         fixList.push({ id: inv.id, name: inv.name, stage: inv.stage, issue: "🔴 0 Contacts (Ghost)", type: "ghost" });
      } else if (primary) {
         if (!primary.email || !primary.phone) {
             incompletePrimary++;
             fixList.push({ id: inv.id, name: inv.name, stage: inv.stage, issue: "⚠️ Primary Missing Info", type: "incomplete" });
         }
      }

      // C. Top 3 Stats
      const has = (val: string | null | undefined) => val && String(val).trim().length > 0;

      [0, 1, 2].forEach(idx => {
          if (sorted[idx]) {
             const c = sorted[idx];
             const key = idx === 0 ? 'poc1' : idx === 1 ? 'poc2' : 'poc3';
             
             // @ts-ignore
             top3Stats[key].total++;
             if (has(c.email)) {
                 validEmailCount++; 
                 // @ts-ignore
                 top3Stats[key].email++;
             }
             // @ts-ignore
             if (has(c.phone)) top3Stats[key].phone++;
             // @ts-ignore
             if (has(c.linkedinProfile)) top3Stats[key].linkedin++;
          }
      });
    }

    return {
       cards: {
         ghostInvestors,
         incompletePrimary,
         databaseHealth: totalContacts > 0 ? Math.round((validEmailCount / totalContacts) * 100) : 0,
         totalInvestors: allInvestors.length
       },
       coverage: coverageMap,
       top3: top3Stats,
       fixList: fixList.slice(0, 50) 
    };
  }



  // ==========================================
  // ADMIN UTILITY: SYNC STAGES (Fixed Types)
  // ==========================================
  async syncInvestorStages(organizationId: number) {
    // 1. Find all investors currently linked to leads in 'mandates' stage
    const results = await db
      .select({ investorId: investorLeadLinks.investorId })
      .from(investorLeadLinks)
      .innerJoin(leads, eq(investorLeadLinks.leadId, leads.id))
      .where(
        and(
          eq(leads.organizationId, organizationId),
          eq(leads.stage, "mandates")
        )
      );

    // ✅ FIX: Force cast the result to 'number[]' to resolve the TS error
    const investorIdsToPromote = [...new Set(results.map((r) => Number(r.investorId)))] as number[];

    if (investorIdsToPromote.length === 0) {
      return { message: "No investors needed updating.", count: 0 };
    }

    // 2. Bulk Update
    await db
      .update(investors)
      .set({ 
        stage: "dealmaking",
        updatedAt: new Date()
      })
      .where(
        and(
          eq(investors.organizationId, organizationId),
          inArray(investors.id, investorIdsToPromote) 
        )
      );

    return { 
      message: "Sync complete.", 
      count: investorIdsToPromote.length, 
      updatedIds: investorIdsToPromote 
    };
  }



    // ============================
  // EPN (External Partner Network)
  // ============================

  async getEpnUniverse(organizationId: number) {
    const partners = await db
      .select()
      .from(epnPartners)
      .where(eq(epnPartners.organizationId, organizationId));

    // Fetch all linkages and company names for this org
    const links = await db
      .select({
        epnId: epnLeadLinks.epnId,
        leadId: leads.id,
        companyName: companies.name,
      })
      .from(epnLeadLinks)
      .innerJoin(leads, eq(epnLeadLinks.leadId, leads.id))
      .innerJoin(companies, eq(leads.companyId, companies.id))
      .where(eq(epnLeadLinks.organizationId, organizationId));

    // Map links into the partners array
    return partners.map(p => ({
      ...p,
      linkedCompanies: links.filter(l => l.epnId === p.id).map(l => ({ id: l.leadId, name: l.companyName }))
    }));
  }

  async getEpnByBucket(organizationId: number, bucket: string) {
    const partners = await db
      .select()
      .from(epnPartners)
      .where(and(eq(epnPartners.organizationId, organizationId), eq(epnPartners.bucket, bucket)));

    const links = await db
      .select({ epnId: epnLeadLinks.epnId, leadId: leads.id, companyName: companies.name })
      .from(epnLeadLinks)
      .innerJoin(leads, eq(epnLeadLinks.leadId, leads.id))
      .innerJoin(companies, eq(leads.companyId, companies.id))
      .where(eq(epnLeadLinks.organizationId, organizationId));

    return partners.map(p => ({
      ...p,
      linkedCompanies: links.filter(l => l.epnId === p.id).map(l => ({ id: l.leadId, name: l.companyName }))
    }));
  }

  async getEpnByBucketStage(organizationId: number, bucket: string, stage: string) {
    const partners = await db
      .select()
      .from(epnPartners)
      .where(and(
        eq(epnPartners.organizationId, organizationId), 
        eq(epnPartners.bucket, bucket), 
        eq(epnPartners.stage, stage)
      ));

    const links = await db
      .select({ epnId: epnLeadLinks.epnId, leadId: leads.id, companyName: companies.name })
      .from(epnLeadLinks)
      .innerJoin(leads, eq(epnLeadLinks.leadId, leads.id))
      .innerJoin(companies, eq(leads.companyId, companies.id))
      .where(eq(epnLeadLinks.organizationId, organizationId));

    return partners.map(p => ({
      ...p,
      linkedCompanies: links.filter(l => l.epnId === p.id).map(l => ({ id: l.leadId, name: l.companyName }))
    }));
  }

  // Get metrics for the dashboard
// Get comprehensive metrics for the EPN bucket dashboards
  async getEpnBucketMetrics(organizationId: number, bucket: string) {
    // 1. Fetch all partners in this bucket
    const partners = await db
      .select()
      .from(epnPartners)
      .where(and(eq(epnPartners.organizationId, organizationId), eq(epnPartners.bucket, bucket)));

    // 2. Fetch all linked companies for these partners to calculate ROI
    const partnerIds = partners.map(p => p.id);
    let links: any[] = [];
    if (partnerIds.length > 0) {
      links = await db
        .select()
        .from(epnLeadLinks)
        .where(and(
           eq(epnLeadLinks.organizationId, organizationId),
           inArray(epnLeadLinks.epnId, partnerIds)
        ));
    }

    // 3. Initialize counters
    const counts = { total: partners.length, outreach: 0, active: 0, rainmaking: 0 };
    const categoryCount: Record<string, number> = {};
    const zoneCount: Record<string, number> = {};
    const stateCount: Record<string, number> = {};
    const linkedCountByPartner: Record<number, number> = {};

    // 4. Count Links per partner
    links.forEach(link => {
      linkedCountByPartner[link.epnId] = (linkedCountByPartner[link.epnId] || 0) + 1;
    });

    const totalLinkedCompanies = links.length;

    // 5. Aggregate Partner Data
    for (const p of partners) {
      // Stage Counts
      if (p.stage === 'outreach') counts.outreach++;
      if (p.stage === 'active') counts.active++;
      if (p.stage === 'rainmaking') counts.rainmaking++;

      // Category Counts
      const cat = p.category || 'Uncategorized';
      categoryCount[cat] = (categoryCount[cat] || 0) + 1;

      // Zone Counts
      const zone = p.zone || 'Unassigned';
      zoneCount[zone] = (zoneCount[zone] || 0) + 1;

      // State Counts
      const state = p.state || 'Unknown';
      stateCount[state] = (stateCount[state] || 0) + 1;
    }

    // Helper to format data for Recharts (e.g., [{name: 'North', value: 45}])
    const formatChartData = (obj: Record<string, number>) => 
      Object.entries(obj)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value); // Sort highest to lowest

    // 6. Calculate Top 5 Performers
    const topPerformers = partners
      .map(p => ({
        id: p.id,
        name: p.name,
        category: p.category || 'Uncategorized',
        stage: p.stage,
        links: linkedCountByPartner[p.id] || 0
      }))
      .filter(p => p.links > 0) // Only show partners who actually have links
      .sort((a, b) => b.links - a.links)
      .slice(0, 5);

    return {
      ...counts,
      totalLinkedCompanies,
      categoryData: formatChartData(categoryCount),
      zoneData: formatChartData(zoneCount),
      stateData: formatChartData(stateCount).slice(0, 10), // Only send top 10 states so charts don't crowd
      topPerformers
    };
  }


  async getIdfcLeadTrackerReport(
    organizationId: number,
    options?: {
      filters?: {
        serialNumber?: string;
        rmName?: string;
        designation?: string;
        rmCity?: string;
        rmStage?: string;
        bucket?: string;
        leadName?: string;
        leadCity?: string;
        leadStage?: string;
        relationshipStatus?: string;
        linkRemarks?: string;
        linkedAt?: string;
      };
      selectedRows?: Array<{
        epnId: number;
        leadId: number;
      }>;
    }
  ) {
    const rows = await db
      .select({
        epnId: epnPartners.id,
        rmName: epnPartners.name,
        designation: epnPartners.designation,
        rmCity: epnPartners.city,
        rmStage: epnPartners.stage,
        bucket: epnPartners.bucket,
        leadId: leads.id,
        leadStage: leads.stage,
        leadName: companies.name,
        leadCity: companies.location,
        relationshipStatus: epnLeadLinks.status,
        linkRemarks: epnLeadLinks.remarks,
        linkedAt: epnLeadLinks.createdAt,
      })
      .from(epnLeadLinks)
      .innerJoin(epnPartners, eq(epnLeadLinks.epnId, epnPartners.id))
      .innerJoin(leads, eq(epnLeadLinks.leadId, leads.id))
      .innerJoin(companies, eq(leads.companyId, companies.id))
      .where(
        and(
          eq(epnLeadLinks.organizationId, organizationId),
          eq(epnPartners.bucket, "idfc")
        )
      )
      .orderBy(asc(epnPartners.name), asc(companies.name));

    const normalizedRows = rows.map((row, index) => ({
      serialNumber: index + 1,
      ...row,
      relationshipStatus: row.relationshipStatus || "yet_to_contact",
      linkRemarks: row.linkRemarks || "",
      linkedAt: row.linkedAt || null,
    }));

    const filters = options?.filters || {};
    const selectedRows = options?.selectedRows || [];

    const normalizedFilters = {
      serialNumber: (filters.serialNumber || "").trim().toLowerCase(),
      rmName: (filters.rmName || "").trim().toLowerCase(),
      designation: (filters.designation || "").trim().toLowerCase(),
      rmCity: (filters.rmCity || "").trim().toLowerCase(),
      rmStage: (filters.rmStage || "").trim().toLowerCase(),
      bucket: (filters.bucket || "").trim().toLowerCase(),
      leadName: (filters.leadName || "").trim().toLowerCase(),
      leadCity: (filters.leadCity || "").trim().toLowerCase(),
      leadStage: (filters.leadStage || "").trim().toLowerCase(),
      relationshipStatus: (filters.relationshipStatus || "").trim().toLowerCase(),
      linkRemarks: (filters.linkRemarks || "").trim().toLowerCase(),
      linkedAt: (filters.linkedAt || "").trim().toLowerCase(),
    };

    const selectedKeySet = new Set(
      selectedRows.map((row) => `${row.epnId}::${row.leadId}`)
    );

    const hasSelectedRows = selectedKeySet.size > 0;

    const filteredRows = normalizedRows.filter((row) => {
      const rowLinkedAt = row.linkedAt
        ? new Date(row.linkedAt).toISOString().slice(0, 10).toLowerCase()
        : "";

      const matchesFilters =
        (!normalizedFilters.serialNumber ||
          String(row.serialNumber).toLowerCase().includes(normalizedFilters.serialNumber)) &&
        (!normalizedFilters.rmName ||
          (row.rmName || "").toLowerCase().includes(normalizedFilters.rmName)) &&
        (!normalizedFilters.designation ||
          (row.designation || "").toLowerCase().includes(normalizedFilters.designation)) &&
        (!normalizedFilters.rmCity ||
          (row.rmCity || "").toLowerCase().includes(normalizedFilters.rmCity)) &&
        (!normalizedFilters.rmStage ||
          (row.rmStage || "").toLowerCase() === normalizedFilters.rmStage) &&
        (!normalizedFilters.bucket ||
          (row.bucket || "").toLowerCase() === normalizedFilters.bucket) &&
        (!normalizedFilters.leadName ||
          (row.leadName || "").toLowerCase().includes(normalizedFilters.leadName)) &&
        (!normalizedFilters.leadCity ||
          (row.leadCity || "").toLowerCase().includes(normalizedFilters.leadCity)) &&
        (!normalizedFilters.leadStage ||
          (row.leadStage || "").toLowerCase() === normalizedFilters.leadStage) &&
        (!normalizedFilters.relationshipStatus ||
          (row.relationshipStatus || "").toLowerCase() === normalizedFilters.relationshipStatus) &&
        (!normalizedFilters.linkRemarks ||
          (row.linkRemarks || "").toLowerCase().includes(normalizedFilters.linkRemarks)) &&
        (!normalizedFilters.linkedAt ||
          rowLinkedAt.includes(normalizedFilters.linkedAt));

      if (!matchesFilters) return false;

      if (!hasSelectedRows) return true;

      return selectedKeySet.has(`${row.epnId}::${row.leadId}`);
    });

    return filteredRows.map((row, index) => ({
      ...row,
      serialNumber: index + 1,
    }));
  }

  async getIdfcRmSummaryReport(organizationId: number) {
    const partners = await db
      .select({
        epnId: epnPartners.id,
        rmName: epnPartners.name,
        designation: epnPartners.designation,
        city: epnPartners.city,
        rmStage: epnPartners.stage,
      })
      .from(epnPartners)
      .where(
        and(
          eq(epnPartners.organizationId, organizationId),
          eq(epnPartners.bucket, "idfc")
        )
      )
      .orderBy(asc(epnPartners.name));

    if (partners.length === 0) return [];

    const partnerIds = partners.map((partner) => partner.epnId);

    const linkedRows = await db
      .select({
        epnId: epnLeadLinks.epnId,
        leadId: epnLeadLinks.leadId,
        leadStage: leads.stage,
      })
      .from(epnLeadLinks)
      .innerJoin(leads, eq(epnLeadLinks.leadId, leads.id))
      .where(
        and(
          eq(epnLeadLinks.organizationId, organizationId),
          inArray(epnLeadLinks.epnId, partnerIds)
        )
      );

    const summaryMap = new Map<
      number,
      {
        totalLinkedLeads: number;
        activeLinkedLeads: number;
        outreachCount: number;
        pitchingCount: number;
        mandateCount: number;
      }
    >();

    for (const row of linkedRows) {
      const current = summaryMap.get(row.epnId) ?? {
        totalLinkedLeads: 0,
        activeLinkedLeads: 0,
        outreachCount: 0,
        pitchingCount: 0,
        mandateCount: 0,
      };

      current.totalLinkedLeads += 1;

      if (row.leadStage === "outreach") {
        current.outreachCount += 1;
        current.activeLinkedLeads += 1;
      }

      if (row.leadStage === "pitching") {
        current.pitchingCount += 1;
        current.activeLinkedLeads += 1;
      }

      if (row.leadStage === "mandates") {
        current.mandateCount += 1;
        current.activeLinkedLeads += 1;
      }

      summaryMap.set(row.epnId, current);
    }

    return partners
      .map((partner) => {
        const counts = summaryMap.get(partner.epnId) ?? {
          totalLinkedLeads: 0,
          activeLinkedLeads: 0,
          outreachCount: 0,
          pitchingCount: 0,
          mandateCount: 0,
        };

        return {
          epnId: partner.epnId,
          rmName: partner.rmName,
          designation: partner.designation,
          city: partner.city,
          rmStage: partner.rmStage,
          ...counts,
        };
      })
      .sort(
        (a, b) =>
          b.totalLinkedLeads - a.totalLinkedLeads ||
          a.rmName.localeCompare(b.rmName)
      )
      .map((row, index) => ({
        serialNumber: index + 1,
        ...row,
      }));
  }

  async getEpnLevelReport(organizationId: number, bucket?: string) {
    const filters = [eq(epnLeadLinks.organizationId, organizationId)];

    if (bucket && bucket !== "all") {
      filters.push(eq(epnPartners.bucket, bucket));
    }

    const rows = await db
      .select({
        epnId: epnPartners.id,
        rmName: epnPartners.name,
        bucket: epnPartners.bucket,
        rmStage: epnPartners.stage,
        rmDesignation: epnPartners.designation,
        rmCity: epnPartners.city,
        rmPocName: epnPartners.pocName,
        rmEmail: epnPartners.email,
        rmPhone: epnPartners.phoneNumber,
        leadId: leads.id,
        leadStage: leads.stage,
        companyId: companies.id,
        leadName: companies.name,
        leadCity: companies.location,
        relationshipStatus: epnLeadLinks.status,
        linkRemarks: epnLeadLinks.remarks,
        linkedAt: epnLeadLinks.createdAt,
      })
      .from(epnLeadLinks)
      .innerJoin(epnPartners, eq(epnLeadLinks.epnId, epnPartners.id))
      .innerJoin(leads, eq(epnLeadLinks.leadId, leads.id))
      .innerJoin(companies, eq(leads.companyId, companies.id))
      .where(and(...filters))
      .orderBy(asc(companies.name), asc(epnPartners.name));

    const companyIds = [...new Set(rows.map((row) => row.companyId))];
    const leadPocMap = new Map<
      number,
      {
        name: string | null;
        designation: string | null;
        email: string | null;
        phone: string | null;
        isPrimary: boolean | null;
      }
    >();

    if (companyIds.length > 0) {
      const pocRows = await db
        .select({
          companyId: contacts.companyId,
          name: contacts.name,
          designation: contacts.designation,
          email: contacts.email,
          phone: contacts.phone,
          isPrimary: contacts.isPrimary,
        })
        .from(contacts)
        .where(
          and(
            eq(contacts.organizationId, organizationId),
            inArray(contacts.companyId, companyIds)
          )
        );

      for (const poc of pocRows) {
        const existing = leadPocMap.get(Number(poc.companyId));

        if (!existing) {
          leadPocMap.set(Number(poc.companyId), {
            name: poc.name ?? null,
            designation: poc.designation ?? null,
            email: poc.email ?? null,
            phone: poc.phone ?? null,
            isPrimary: poc.isPrimary ?? null,
          });
          continue;
        }

        if (!existing.isPrimary && poc.isPrimary) {
          leadPocMap.set(Number(poc.companyId), {
            name: poc.name ?? null,
            designation: poc.designation ?? null,
            email: poc.email ?? null,
            phone: poc.phone ?? null,
            isPrimary: poc.isPrimary ?? null,
          });
        }
      }
    }

    return rows.map((row, index) => {
      const leadPoc = leadPocMap.get(row.companyId);

      return {
        serialNumber: index + 1,
        epnId: row.epnId,
        rmName: row.rmName,
        bucket: row.bucket,
        rmStage: row.rmStage,
        rmDesignation: row.rmDesignation,
        rmCity: row.rmCity,
        rmPocName: row.rmPocName,
        rmEmail: row.rmEmail,
        rmPhone: row.rmPhone,
        leadId: row.leadId,
        leadStage: row.leadStage,
        leadName: row.leadName,
        leadCity: row.leadCity,
        leadPocName: leadPoc?.name ?? null,
        leadPocDesignation: leadPoc?.designation ?? null,
        leadPocEmail: leadPoc?.email ?? null,
        leadPocPhone: leadPoc?.phone ?? null,
        relationshipStatus: row.relationshipStatus || "yet_to_contact",
        linkRemarks: row.linkRemarks || "",
        linkedAt: row.linkedAt,
      };
    });
  }

  async createEpnPartner(organizationId: number, data: any) {
    const [created] = await db
      .insert(epnPartners)
      .values({
        organizationId,
        ...data,
        updatedAt: new Date(),
      })
      .returning();

    return created;
  }

async createEpnPartnersBulk(organizationId: number, partners: any[]) {
    const results = [];
    
    for (const partner of partners) {
      let existingPartner;

      // 1. Try to find an existing partner by Email (most reliable)
      if (partner.email) {
        const [foundByEmail] = await db
          .select()
          .from(epnPartners)
          .where(
            and(
              eq(epnPartners.organizationId, organizationId),
              ilike(epnPartners.email, partner.email) // Case-insensitive match
            )
          );
        existingPartner = foundByEmail;
      }

      // 2. If no email match, try to find by Exact Name inside the same bucket
      if (!existingPartner && partner.name) {
        const [foundByName] = await db
          .select()
          .from(epnPartners)
          .where(
            and(
              eq(epnPartners.organizationId, organizationId),
              ilike(epnPartners.name, partner.name),
              eq(epnPartners.bucket, partner.bucket)
            )
          );
        existingPartner = foundByName;
      }

      // 3. UPSERT LOGIC: Update if found, Insert if new
      if (existingPartner) {
        // UPDATE existing record with new values (only overwriting if new values exist)
        const [updated] = await db
          .update(epnPartners)
          .set({
            designation: partner.designation || existingPartner.designation,
            phoneNumber: partner.phoneNumber || existingPartner.phoneNumber,
            email: partner.email || existingPartner.email,
            linkedin: partner.linkedin || existingPartner.linkedin,
            zone: partner.zone || existingPartner.zone,
            city: partner.city || existingPartner.city,
            state: partner.state || existingPartner.state,
            updatedAt: new Date(),
          })
          .where(eq(epnPartners.id, existingPartner.id))
          .returning();
          
        results.push(updated);
      } else {
        // INSERT completely new record
        const [inserted] = await db
          .insert(epnPartners)
          .values({ ...partner, organizationId })
          .returning();
          
        results.push(inserted);
      }
    }

    return results;
  }




  async updateEpnStage(organizationId: number, epnId: number, stage: string) {
    const [updated] = await db
      .update(epnPartners)
      .set({ stage, updatedAt: new Date() })
      .where(and(
        eq(epnPartners.organizationId, organizationId),
        eq(epnPartners.id, epnId)
      ))
      .returning();

    return updated;
  }

  async linkEpnToLead(organizationId: number, epnId: number, leadId: number) {
    // Insert, but don't duplicate (unique constraint in schema)
    const inserted = await db
      .insert(epnLeadLinks)
      .values({ organizationId, epnId, leadId })
      // @ts-ignore - drizzle supports this for pg even if TS typing complains in some setups
      .onConflictDoNothing()
      .returning();

    if (inserted && inserted.length > 0) return inserted[0];

    // If already exists, fetch it
    const [existing] = await db
      .select()
      .from(epnLeadLinks)
      .where(and(
        eq(epnLeadLinks.organizationId, organizationId),
        eq(epnLeadLinks.epnId, epnId),
        eq(epnLeadLinks.leadId, leadId)
      ));

    return existing;
  }


    async getEpnLinksForLeadStage(
    orgId: number,
    leadStage: string
  ): Promise<Array<{ leadId: number; epns: EpnPartner[] }>> {
    const rows = await db
      .select({
        leadId: epnLeadLinks.leadId,
        partner: epnPartners,
      })
      .from(epnLeadLinks)
      .innerJoin(epnPartners, eq(epnLeadLinks.epnId, epnPartners.id))
      .innerJoin(leads, eq(epnLeadLinks.leadId, leads.id))
      .where(
        and(
          eq(epnLeadLinks.organizationId, orgId),
          eq(leads.stage, leadStage)
        )
      );

    const map = new Map<number, EpnPartner[]>();
    for (const r of rows) {
      const arr = map.get(r.leadId) ?? [];
      arr.push(r.partner);
      map.set(r.leadId, arr);
    }

    return Array.from(map.entries()).map(([leadId, epns]) => ({ leadId, epns }));
  }


  // ==========================================
  // EPN & INVESTOR LINKAGE LOGIC
  // ==========================================

// ==========================================
  // EPN & INVESTOR LINKAGE LOGIC
  // ==========================================

  async getLinkedEpnsForLead(orgId: number, leadId: number): Promise<any[]> {
    const linked = await db
      .select({
        partner: epnPartners,
        link: epnLeadLinks, // ✅ Include the link table data
      })
      .from(epnLeadLinks)
      .innerJoin(epnPartners, eq(epnLeadLinks.epnId, epnPartners.id))
      .where(
        and(
          eq(epnLeadLinks.organizationId, orgId),
          eq(epnLeadLinks.leadId, leadId)
        )
      );
    
    // ✅ Map it to include status and remarks for the frontend table
    return linked.map((l) => ({
      ...l.partner,
      linkId: l.link.id,
      status: l.link.status,
      remarks: l.link.remarks,
      linkedAt: l.link.createdAt
    }));
  }

  // ✅ NEW: Update EPN Link Status
  async updateEpnLinkStatus(orgId: number, epnId: number, leadId: number, status: string) {
    const [updated] = await db
      .update(epnLeadLinks)
      .set({ status })
      .where(
        and(
          eq(epnLeadLinks.organizationId, orgId),
          eq(epnLeadLinks.epnId, epnId),
          eq(epnLeadLinks.leadId, leadId)
        )
      )
      .returning();
    return updated;
  }

  // ✅ NEW: Update EPN Link Remarks
  async updateEpnLinkRemarks(orgId: number, epnId: number, leadId: number, remarks: string) {
    const [updated] = await db
      .update(epnLeadLinks)
      .set({ remarks })
      .where(
        and(
          eq(epnLeadLinks.organizationId, orgId),
          eq(epnLeadLinks.epnId, epnId),
          eq(epnLeadLinks.leadId, leadId)
        )
      )
      .returning();
    return updated;
  }


  // ==========================================
  // EPN "HIGH-WATER MARK" STAGE SYNC
  // ==========================================
  async syncEpnPartnerStage(orgId: number, epnId: number): Promise<void> {
    // 1. Fetch all leads currently linked to this partner
    const links = await db
      .select({ stage: leads.stage })
      .from(epnLeadLinks)
      .innerJoin(leads, eq(epnLeadLinks.leadId, leads.id))
      .where(
        and(
          eq(epnLeadLinks.organizationId, orgId),
          eq(epnLeadLinks.epnId, epnId)
        )
      );

    // 2. Default stage is outreach
    let targetStage = "outreach";

    // 3. Determine the "High-Water Mark"
    // If any lead is in mandates or won -> Rainmaking
    const hasMandates = links.some((l) => ["mandates", "won"].includes(l.stage || ""));
    // If no mandates, but at least one pitching -> Active
    const hasPitching = links.some((l) => l.stage === "pitching");

    if (hasMandates) {
      targetStage = "rainmaking";
    } else if (hasPitching) {
      targetStage = "active";
    }

    // 4. Update the partner's stage automatically
    await db
      .update(epnPartners)
      .set({ stage: targetStage, updatedAt: new Date() })
      .where(
        and(
          eq(epnPartners.organizationId, orgId),
          eq(epnPartners.id, epnId)
        )
      );
      
    console.log(`[EPN Sync] Partner ${epnId} auto-synced to stage: ${targetStage}`);
  }

 

  async unlinkEpnFromLead(orgId: number, epnId: number, leadId: number): Promise<void> {
    await db
      .delete(epnLeadLinks)
      .where(
        and(
          eq(epnLeadLinks.organizationId, orgId),
          eq(epnLeadLinks.epnId, epnId),
          eq(epnLeadLinks.leadId, leadId)
        )
      );
  }

  async unlinkInvestorFromLead(orgId: number, investorId: number, leadId: number): Promise<void> {
    await db
      .delete(investorLeadLinks)
      .where(
        and(
          eq(investorLeadLinks.organizationId, orgId),
          eq(investorLeadLinks.investorId, investorId),
          eq(investorLeadLinks.leadId, leadId)
        )
      );
  }

  // For cases where an EPN partner might also be an investor, we want to allow them to be linked independently to the same lead without conflicts. This method checks if a link already exists between the given EPN partner and lead, and if not, creates it. If it already exists, it simply returns the existing link without throwing an error.
  async updateEpnCategory(orgId: number, epnId: number, category: string | null) {
    const [updated] = await db
      .update(epnPartners)
      .set({ category, updatedAt: new Date() })
      .where(and(
        eq(epnPartners.organizationId, orgId),
        eq(epnPartners.id, epnId)
      ))
      .returning();
    return updated;
  }

  async getEpnById(organizationId: number, epnId: number) {
  const [partner] = await db
    .select()
    .from(epnPartners)
    .where(and(eq(epnPartners.organizationId, organizationId), eq(epnPartners.id, epnId)));
  return partner;
}

async getLinkedLeadsForEpn(organizationId: number, epnId: number) {
  const links = await db
    .select({
      leadId: leads.id,
      companyName: companies.name,
      stage: leads.stage
    })
    .from(epnLeadLinks)
    .innerJoin(leads, eq(epnLeadLinks.leadId, leads.id))
    .innerJoin(companies, eq(leads.companyId, companies.id))
    .where(
      and(
        eq(epnLeadLinks.organizationId, organizationId),
        eq(epnLeadLinks.epnId, epnId)
      )
    );
  return links;
}

// This method allows updating multiple details of an EPN partner in one go. It takes care of normalizing the input data and ensures that the 'updatedAt' timestamp is refreshed. This is useful for maintaining accurate records and allowing users to keep their EPN partner information up to date.
async updateEpnPartnerDetails(orgId: number, epnId: number, data: any) {
    const [updated] = await db
      .update(epnPartners)
      .set({
        name: data.name,
        bucket: data.bucket,
        category: data.category || null,
        pocName: data.name, // Auto-syncing POC with Name like we did on Add
        designation: data.designation || null,
        phoneNumber: data.phoneNumber || null,
        email: data.email || null,
        linkedin: data.linkedin || null,
        zone: data.zone || null,
        city: data.city || null,
        state: data.state || null,
        updatedAt: new Date(),
      })
      .where(and(eq(epnPartners.organizationId, orgId), eq(epnPartners.id, epnId)))
      .returning();
    return updated;
  }


  async updateEpnCardNextAction(
    orgId: number,
    epnId: number,
    cardNextActionText: string | null,
    cardNextActionDate: Date | null
  ) {
    const [updated] = await db
      .update(epnPartners)
      .set({
        cardNextActionText,
        cardNextActionDate,
        updatedAt: new Date(),
      })
      .where(and(eq(epnPartners.organizationId, orgId), eq(epnPartners.id, epnId)))
      .returning();

    return updated;
  }



    // ==========================================
  // AUDIT ANALYTICS OVERVIEW
  // ==========================================

  async getAuditOverviewMetrics(organizationId: number): Promise<any> {
    const now = new Date();

    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last30d = new Date(now);
    last30d.setDate(last30d.getDate() - 30);

    const [
      activeUsersResult,
      activeLeadsResult,
      activeMandatesResult,
      leadsCreated30dResult,
      converted30dResult,
      investorTouched30dResult,
      investorResponded30dResult,
      idfcPartnersResult,
      idfcLeadLinksResult,
      userRoleRows,
      channelRows,
      actionMixRows,
      epnBucketRows,
      stageChanges30dResult,
    ] = await Promise.all([
      db
        .select({
          count: sql<number>`count(distinct ${activityLog.userId})`,
        })
        .from(activityLog)
        .where(
          and(
            eq(activityLog.organizationId, organizationId),
            gte(activityLog.createdAt, last24h)
          )
        ),

      db
        .select({ count: count() })
        .from(leads)
        .where(
          and(
            eq(leads.organizationId, organizationId),
            sql`${leads.stage} not in ('won', 'lost', 'dropped', 'rejected')`
          )
        ),

      db
        .select({ count: count() })
        .from(leads)
        .where(
          and(
            eq(leads.organizationId, organizationId),
            eq(leads.stage, "mandates")
          )
        ),

      db
        .select({ count: count() })
        .from(leads)
        .where(
          and(
            eq(leads.organizationId, organizationId),
            gte(leads.createdAt, last30d)
          )
        ),

      db
        .select({ count: count() })
        .from(activityLog)
        .where(
          and(
            eq(activityLog.organizationId, organizationId),
            eq(activityLog.entityType, "lead"),
            gte(activityLog.createdAt, last30d),
            or(
              eq(activityLog.action, "lead_stage_changed"),
              eq(activityLog.action, "stage_changed")
            ),
            sql`(
              ${activityLog.newValue} ilike '%mandates%'
              or ${activityLog.newValue} ilike '%won%'
            )`
          )
        ),

      db
        .select({
          count: sql<number>`count(distinct ${investorOutreachActivities.investorId})`,
        })
        .from(investorOutreachActivities)
        .where(
          and(
            eq(investorOutreachActivities.organizationId, organizationId),
            gte(investorOutreachActivities.createdAt, last30d)
          )
        ),

      db
        .select({
          count: sql<number>`count(distinct ${activityLog.entityId})`,
        })
        .from(activityLog)
        .where(
          and(
            eq(activityLog.organizationId, organizationId),
            eq(activityLog.entityType, "investor"),
            gte(activityLog.createdAt, last30d),
            or(
              eq(activityLog.action, "investor_stage_changed"),
              eq(activityLog.action, "stage_changed"),
              sql`${activityLog.action} ilike 'investor%stage%'`
            ),
            sql`(
              ${activityLog.newValue} ilike '%warm%'
              or ${activityLog.newValue} ilike '%active%'
              or ${activityLog.newValue} ilike '%dealmaking%'
            )`
          )
        ),

      db
        .select({ count: count() })
        .from(epnPartners)
        .where(
          and(
            eq(epnPartners.organizationId, organizationId),
            eq(epnPartners.bucket, "idfc")
          )
        ),

      db
        .select({ count: count() })
        .from(epnLeadLinks)
        .innerJoin(epnPartners, eq(epnLeadLinks.epnId, epnPartners.id))
        .where(
          and(
            eq(epnLeadLinks.organizationId, organizationId),
            eq(epnPartners.bucket, "idfc")
          )
        ),

      db
        .select({
          role: users.role,
          count: count(),
        })
        .from(users)
        .where(eq(users.organizationId, organizationId))
        .groupBy(users.role),

      db
        .select({
          source: leads.leadSource,
          count: count(),
        })
        .from(leads)
        .where(
          and(
            eq(leads.organizationId, organizationId),
            gte(leads.createdAt, last30d)
          )
        )
        .groupBy(leads.leadSource),

      db
        .select({
          entityType: activityLog.entityType,
          count: count(),
        })
        .from(activityLog)
        .where(
          and(
            eq(activityLog.organizationId, organizationId),
            gte(activityLog.createdAt, last30d)
          )
        )
        .groupBy(activityLog.entityType),

      db
        .select({
          bucket: epnPartners.bucket,
          count: count(),
        })
        .from(epnPartners)
        .where(eq(epnPartners.organizationId, organizationId))
        .groupBy(epnPartners.bucket),

      db
        .select({ count: count() })
        .from(activityLog)
        .where(
          and(
            eq(activityLog.organizationId, organizationId),
            gte(activityLog.createdAt, last30d),
            or(
              eq(activityLog.action, "lead_stage_changed"),
              eq(activityLog.action, "investor_stage_changed"),
              eq(activityLog.action, "epn_stage_changed"),
              eq(activityLog.action, "stage_changed"),
              sql`${activityLog.action} ilike '%stage%'`
            )
          )
        ),
    ]);

    const activeUsers24h = Number(activeUsersResult[0]?.count || 0);
    const totalActiveLeads = Number(activeLeadsResult[0]?.count || 0);
    const activeMandates = Number(activeMandatesResult[0]?.count || 0);
    const leadsCreated30d = Number(leadsCreated30dResult[0]?.count || 0);
    const converted30d = Number(converted30dResult[0]?.count || 0);
    const investorsTouched30d = Number(investorTouched30dResult[0]?.count || 0);
    const investorsResponded30d = Number(investorResponded30dResult[0]?.count || 0);
    const idfcPartners = Number(idfcPartnersResult[0]?.count || 0);
    const idfcLeadLinks = Number(idfcLeadLinksResult[0]?.count || 0);
    const stageChanges30d = Number(stageChanges30dResult[0]?.count || 0);

    const conversionPct =
      leadsCreated30d > 0
        ? Number(((converted30d / leadsCreated30d) * 100).toFixed(1))
        : 0;

    const investorResponseRate =
      investorsTouched30d > 0
        ? Number(((investorsResponded30d / investorsTouched30d) * 100).toFixed(1))
        : 0;

    const userRoleMix = userRoleRows.map((row: any) => ({
      role: row.role || "unknown",
      count: Number(row.count || 0),
    }));

    const channelContribution = channelRows
      .map((row: any) => {
        const rowCount = Number(row.count || 0);
        return {
          source: row.source || "unknown",
          count: rowCount,
          percentage:
            leadsCreated30d > 0
              ? Number(((rowCount / leadsCreated30d) * 100).toFixed(1))
              : 0,
        };
      })
      .sort((a: any, b: any) => b.count - a.count);

    const actionMix = actionMixRows
      .map((row: any) => ({
        entityType: row.entityType || "unknown",
        count: Number(row.count || 0),
      }))
      .sort((a: any, b: any) => b.count - a.count);

    const epnBucketMix = epnBucketRows
      .map((row: any) => ({
        bucket: row.bucket || "unknown",
        count: Number(row.count || 0),
      }))
      .sort((a: any, b: any) => b.count - a.count);

    return {
      generatedAt: now.toISOString(),
      summaryCards: {
        activeUsers24h,
        totalActiveLeads,
        activeMandates,
        conversionPct,
        investorResponseRate,
        stageChanges30d,
      },
      monthlyReport: {
        period: "last_30_days",
        totalActiveLeads,
        activeMandates,
        conversionPct,
        investorResponseRate,
        channelContribution,
      },
      charts: {
        userRoleMix,
        channelContribution,
        actionMix,
        epnBucketMix,
      },
      idfcFocus: {
        idfcPartners,
        idfcLeadLinks,
      },
    };
  }

  async getAuditUserSummaries(organizationId: number): Promise<any[]> {
    const now = new Date();

    const startToday = new Date();
    startToday.setHours(0, 0, 0, 0);

    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last15d = new Date(now);
    last15d.setDate(last15d.getDate() - 15);

    const last30d = new Date(now);
    last30d.setDate(last30d.getDate() - 30);

    const orgUsers = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        role: users.role,
        lastLoginTime: users.lastLoginTime,
        lastActionTime: users.lastActionTime,
      })
      .from(users)
      .where(eq(users.organizationId, organizationId))
      .orderBy(asc(users.firstName), asc(users.lastName));

    const recentLogs = await db
      .select({
        userId: activityLog.userId,
        action: activityLog.action,
        entityType: activityLog.entityType,
        createdAt: activityLog.createdAt,
      })
      .from(activityLog)
      .where(
        and(
          eq(activityLog.organizationId, organizationId),
          gte(activityLog.createdAt, last30d)
        )
      );

    const isWithin = (value: Date | null | undefined, start: Date) => {
      if (!value) return false;
      return new Date(value) >= start;
    };

    const isLeadCreated = (log: any) =>
      log.entityType === "lead" && /(created|added|import|bulk)/i.test(log.action || "");

    const isInvestorCreated = (log: any) =>
      log.entityType === "investor" && /(created|added|import|bulk)/i.test(log.action || "");

    const isEpnCreated = (log: any) =>
      (log.entityType === "epn" || log.entityType === "epn_partner") &&
      /(created|added|import|bulk)/i.test(log.action || "");

    const isStageChange = (log: any) =>
      /stage/i.test(log.action || "");

    return orgUsers.map((user: any) => {
      const userLogs = recentLogs.filter((log: any) => log.userId === user.id);
      const todaysLogs = userLogs
        .filter((log: any) => isWithin(log.createdAt, startToday))
        .sort(
          (a: any, b: any) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );

      const firstActivityToday = todaysLogs[0]?.createdAt || null;
      const lastActivityToday =
        todaysLogs.length > 0 ? todaysLogs[todaysLogs.length - 1].createdAt : null;

      let roughHoursToday = 0;
      if (firstActivityToday && lastActivityToday) {
        const diffMs =
          new Date(lastActivityToday).getTime() - new Date(firstActivityToday).getTime();
        const diffHours = diffMs > 0 ? diffMs / (1000 * 60 * 60) : 0;
        roughHoursToday = Number(Math.min(diffHours, 12).toFixed(1));
      }

      const actions24h = userLogs.filter((log: any) => isWithin(log.createdAt, last24h));
      const actions15d = userLogs.filter((log: any) => isWithin(log.createdAt, last15d));
      const actions30d = userLogs;

      return {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        lastLoginTime: user.lastLoginTime,
        lastActionTime: user.lastActionTime,
        firstActivityToday,
        roughHoursToday,

        actions24h: actions24h.length,
        actions15d: actions15d.length,
        actions30d: actions30d.length,

        stageChanges24h: actions24h.filter(isStageChange).length,
        stageChanges15d: actions15d.filter(isStageChange).length,
        stageChanges30d: actions30d.filter(isStageChange).length,

        leadsAdded24h: actions24h.filter(isLeadCreated).length,
        leadsAdded15d: actions15d.filter(isLeadCreated).length,
        leadsAdded30d: actions30d.filter(isLeadCreated).length,

        investorsAdded24h: actions24h.filter(isInvestorCreated).length,
        investorsAdded15d: actions15d.filter(isInvestorCreated).length,
        investorsAdded30d: actions30d.filter(isInvestorCreated).length,

        epnAdded24h: actions24h.filter(isEpnCreated).length,
        epnAdded15d: actions15d.filter(isEpnCreated).length,
        epnAdded30d: actions30d.filter(isEpnCreated).length,
      };
    });
  }

  // ==========================================
  // AUDIT USER DRILLDOWN
  // ==========================================

  async getAuditUserProfile(organizationId: number, userId: string, window: string): Promise<any | null> {
    const [targetUser] = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        role: users.role,
        lastLoginTime: users.lastLoginTime,
        lastActionTime: users.lastActionTime,
      })
      .from(users)
      .where(and(eq(users.organizationId, organizationId), eq(users.id, userId)))
      .limit(1);

    if (!targetUser) {
      return null;
    }

    const windowStart = this.getAuditWindowStart(window);
    const last30dStart = this.getAuditWindowStart("30d");
    const startToday = this.getStartOfToday();

    const logs = await db
      .select({
        id: activityLog.id,
        leadId: activityLog.leadId,
        companyId: activityLog.companyId,
        action: activityLog.action,
        entityType: activityLog.entityType,
        entityId: activityLog.entityId,
        oldValue: activityLog.oldValue,
        newValue: activityLog.newValue,
        description: activityLog.description,
        createdAt: activityLog.createdAt,
      })
      .from(activityLog)
      .where(
        and(
          eq(activityLog.organizationId, organizationId),
          eq(activityLog.userId, userId),
          gte(activityLog.createdAt, last30dStart)
        )
      )
      .orderBy(desc(activityLog.createdAt));

    const windowLogs = logs.filter((log: any) => log.createdAt && new Date(log.createdAt) >= windowStart);

    const todayLogs = logs
      .filter((log: any) => log.createdAt && new Date(log.createdAt) >= startToday)
      .sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    const firstActivityToday = todayLogs[0]?.createdAt || null;
    const lastActivityToday = todayLogs.length > 0 ? todayLogs[todayLogs.length - 1].createdAt : null;

    let roughHoursToday = 0;
    if (firstActivityToday && lastActivityToday) {
      const diffMs = new Date(lastActivityToday).getTime() - new Date(firstActivityToday).getTime();
      const diffHours = diffMs > 0 ? diffMs / (1000 * 60 * 60) : 0;
      roughHoursToday = Number(Math.min(diffHours, 12).toFixed(1));
    }

    const actionMixMap = new Map<string, number>();
    for (const log of windowLogs) {
      const key =
        log.entityType === "epn" || log.entityType === "epn_partner"
          ? "epn"
          : log.entityType || "other";

      actionMixMap.set(key, (actionMixMap.get(key) || 0) + 1);
    }

    const actionMix = Array.from(actionMixMap.entries())
      .map(([entityType, count]) => ({ entityType, count }))
      .sort((a, b) => b.count - a.count);

    return {
      user: targetUser,
      window,
      metrics: {
        firstActivityToday,
        lastActivityToday,
        roughHoursToday,
        actions: windowLogs.length,
        stageChanges: windowLogs.filter((log: any) => this.isAuditStageChangeAction(log.action)).length,
        leadsAdded: windowLogs.filter((log: any) => log.entityType === "lead" && this.isAuditLeadCreatedAction(log.action)).length,
        investorsAdded: windowLogs.filter((log: any) => log.entityType === "investor" && this.isAuditInvestorCreatedAction(log.action)).length,
        epnAdded: windowLogs.filter((log: any) => (log.entityType === "epn" || log.entityType === "epn_partner") && this.isAuditEpnCreatedAction(log.action)).length,
      },
      charts: {
        actionMix,
      },
      recentTimeline: logs.slice(0, 10),
    };
  }

  async getAuditUserLeadDetails(organizationId: number, userId: string, window: string): Promise<any> {
    const windowStart = this.getAuditWindowStart(window);

    const logs = await db
      .select({
        id: activityLog.id,
        leadId: activityLog.leadId,
        companyId: activityLog.companyId,
        action: activityLog.action,
        entityType: activityLog.entityType,
        entityId: activityLog.entityId,
        oldValue: activityLog.oldValue,
        newValue: activityLog.newValue,
        description: activityLog.description,
        createdAt: activityLog.createdAt,
      })
      .from(activityLog)
      .where(
        and(
          eq(activityLog.organizationId, organizationId),
          eq(activityLog.userId, userId),
          eq(activityLog.entityType, "lead"),
          gte(activityLog.createdAt, windowStart)
        )
      )
      .orderBy(desc(activityLog.createdAt));

    const leadIds = Array.from(
      new Set(
        logs
          .map((log: any) => Number(log.leadId ?? log.entityId))
          .filter((value: number) => Number.isFinite(value) && value > 0)
      )
    );

    let leadRows: any[] = [];
    if (leadIds.length > 0) {
      leadRows = await db
        .select({
          id: leads.id,
          companyId: leads.companyId,
          stage: leads.stage,
          leadSource: leads.leadSource,
          createdAt: leads.createdAt,
          companyName: companies.name,
        })
        .from(leads)
        .leftJoin(companies, eq(leads.companyId, companies.id))
        .where(and(eq(leads.organizationId, organizationId), inArray(leads.id, leadIds)));
    }

    const leadMap = new Map<number, any>();
    for (const row of leadRows) {
      leadMap.set(Number(row.id), row);
    }

    const addedLogs = logs.filter((log: any) => this.isAuditLeadCreatedAction(log.action));
    const stageChangeLogs = logs.filter((log: any) => this.isAuditStageChangeAction(log.action));

    return {
      window,
      summary: {
        totalActions: logs.length,
        addedCount: addedLogs.length,
        stageChangeCount: stageChangeLogs.length,
        sourceBreakdown: this.buildAuditSourceBreakdown(addedLogs),
      },
      items: logs.map((log: any) => {
        const leadId = Number(log.leadId ?? log.entityId);
        const lead = leadMap.get(leadId);

        return {
          logId: log.id,
          createdAt: log.createdAt,
          action: log.action,
          description: log.description,
          oldValue: log.oldValue,
          newValue: log.newValue,
          leadId,
          companyId: lead?.companyId ?? log.companyId ?? null,
          companyName: lead?.companyName ?? null,
          currentStage: lead?.stage ?? null,
          leadSource: lead?.leadSource ?? null,
        };
      }),
    };
  }

  async getAuditUserInvestorDetails(organizationId: number, userId: string, window: string): Promise<any> {
    const windowStart = this.getAuditWindowStart(window);

    const logs = await db
      .select({
        id: activityLog.id,
        action: activityLog.action,
        entityType: activityLog.entityType,
        entityId: activityLog.entityId,
        oldValue: activityLog.oldValue,
        newValue: activityLog.newValue,
        description: activityLog.description,
        createdAt: activityLog.createdAt,
      })
      .from(activityLog)
      .where(
        and(
          eq(activityLog.organizationId, organizationId),
          eq(activityLog.userId, userId),
          eq(activityLog.entityType, "investor"),
          gte(activityLog.createdAt, windowStart)
        )
      )
      .orderBy(desc(activityLog.createdAt));

    const investorIds = Array.from(
      new Set(
        logs
          .map((log: any) => Number(log.entityId))
          .filter((value: number) => Number.isFinite(value) && value > 0)
      )
    );

    let investorRows: any[] = [];
    if (investorIds.length > 0) {
      investorRows = await db
        .select({
          id: investors.id,
          name: investors.name,
          stage: investors.stage,
          investorType: investors.investorType,
          location: investors.location,
          createdAt: investors.createdAt,
        })
        .from(investors)
        .where(and(eq(investors.organizationId, organizationId), inArray(investors.id, investorIds)));
    }

    let investorLinkRows: any[] = [];
    if (investorIds.length > 0) {
      investorLinkRows = await db
        .select({
          investorId: investorLeadLinks.investorId,
          count: count(),
        })
        .from(investorLeadLinks)
        .where(
          and(
            eq(investorLeadLinks.organizationId, organizationId),
            inArray(investorLeadLinks.investorId, investorIds)
          )
        )
        .groupBy(investorLeadLinks.investorId);
    }

    const investorMap = new Map<number, any>();
    for (const row of investorRows) {
      investorMap.set(Number(row.id), row);
    }

    const linkCountMap = new Map<number, number>();
    for (const row of investorLinkRows) {
      linkCountMap.set(Number(row.investorId), Number(row.count || 0));
    }

    const addedLogs = logs.filter((log: any) => this.isAuditInvestorCreatedAction(log.action));
    const stageChangeLogs = logs.filter((log: any) => this.isAuditStageChangeAction(log.action));

    return {
      window,
      summary: {
        totalActions: logs.length,
        addedCount: addedLogs.length,
        stageChangeCount: stageChangeLogs.length,
        sourceBreakdown: this.buildAuditSourceBreakdown(addedLogs),
        distinctInvestorsTouched: investorIds.length,
      },
      items: logs.map((log: any) => {
        const investorId = Number(log.entityId);
        const investor = investorMap.get(investorId);

        return {
          logId: log.id,
          createdAt: log.createdAt,
          action: log.action,
          description: log.description,
          oldValue: log.oldValue,
          newValue: log.newValue,
          investorId,
          investorName: investor?.name ?? null,
          currentStage: investor?.stage ?? null,
          investorType: investor?.investorType ?? null,
          location: investor?.location ?? null,
          linkedLeadCount: linkCountMap.get(investorId) || 0,
        };
      }),
    };
  }

  async getAuditUserEpnDetails(organizationId: number, userId: string, window: string): Promise<any> {
    const windowStart = this.getAuditWindowStart(window);

    const logs = await db
      .select({
        id: activityLog.id,
        action: activityLog.action,
        entityType: activityLog.entityType,
        entityId: activityLog.entityId,
        oldValue: activityLog.oldValue,
        newValue: activityLog.newValue,
        description: activityLog.description,
        createdAt: activityLog.createdAt,
      })
      .from(activityLog)
      .where(
        and(
          eq(activityLog.organizationId, organizationId),
          eq(activityLog.userId, userId),
          or(eq(activityLog.entityType, "epn"), eq(activityLog.entityType, "epn_partner")),
          gte(activityLog.createdAt, windowStart)
        )
      )
      .orderBy(desc(activityLog.createdAt));

    const epnIds = Array.from(
      new Set(
        logs
          .map((log: any) => Number(log.entityId))
          .filter((value: number) => Number.isFinite(value) && value > 0)
      )
    );

    let epnRows: any[] = [];
    if (epnIds.length > 0) {
      epnRows = await db
        .select({
          id: epnPartners.id,
          name: epnPartners.name,
          bucket: epnPartners.bucket,
          category: epnPartners.category,
          stage: epnPartners.stage,
          city: epnPartners.city,
          createdAt: epnPartners.createdAt,
        })
        .from(epnPartners)
        .where(and(eq(epnPartners.organizationId, organizationId), inArray(epnPartners.id, epnIds)));
    }

    let epnLinkRows: any[] = [];
    if (epnIds.length > 0) {
      epnLinkRows = await db
        .select({
          epnId: epnLeadLinks.epnId,
          count: count(),
        })
        .from(epnLeadLinks)
        .where(
          and(
            eq(epnLeadLinks.organizationId, organizationId),
            inArray(epnLeadLinks.epnId, epnIds)
          )
        )
        .groupBy(epnLeadLinks.epnId);
    }

    const epnMap = new Map<number, any>();
    for (const row of epnRows) {
      epnMap.set(Number(row.id), row);
    }

    const linkCountMap = new Map<number, number>();
    for (const row of epnLinkRows) {
      linkCountMap.set(Number(row.epnId), Number(row.count || 0));
    }

    const addedLogs = logs.filter((log: any) => this.isAuditEpnCreatedAction(log.action));
    const stageChangeLogs = logs.filter((log: any) => this.isAuditStageChangeAction(log.action));

    const idfcTouchedCount = epnRows.filter((row: any) => row.bucket === "idfc").length;

    return {
      window,
      summary: {
        totalActions: logs.length,
        addedCount: addedLogs.length,
        stageChangeCount: stageChangeLogs.length,
        sourceBreakdown: this.buildAuditSourceBreakdown(addedLogs),
        distinctEpnTouched: epnIds.length,
        idfcTouchedCount,
      },
      items: logs.map((log: any) => {
        const epnId = Number(log.entityId);
        const epn = epnMap.get(epnId);

        return {
          logId: log.id,
          createdAt: log.createdAt,
          action: log.action,
          description: log.description,
          oldValue: log.oldValue,
          newValue: log.newValue,
          epnId,
          epnName: epn?.name ?? null,
          bucket: epn?.bucket ?? null,
          category: epn?.category ?? null,
          currentStage: epn?.stage ?? null,
          city: epn?.city ?? null,
          linkedLeadCount: linkCountMap.get(epnId) || 0,
          isIdfc: epn?.bucket === "idfc",
        };
      }),
    };
  }

  async getAuditUserTimeline(
    organizationId: number,
    userId: string,
    window: string,
    limit: number = 100
  ): Promise<any[]> {
    const windowStart = this.getAuditWindowStart(window);

    const logs = await db
      .select({
        id: activityLog.id,
        leadId: activityLog.leadId,
        companyId: activityLog.companyId,
        action: activityLog.action,
        entityType: activityLog.entityType,
        entityId: activityLog.entityId,
        oldValue: activityLog.oldValue,
        newValue: activityLog.newValue,
        description: activityLog.description,
        createdAt: activityLog.createdAt,
      })
      .from(activityLog)
      .where(
        and(
          eq(activityLog.organizationId, organizationId),
          eq(activityLog.userId, userId),
          gte(activityLog.createdAt, windowStart)
        )
      )
      .orderBy(desc(activityLog.createdAt))
      .limit(limit);

    const leadIds = Array.from(
      new Set(
        logs
          .filter((log: any) => log.entityType === "lead")
          .map((log: any) => Number(log.leadId ?? log.entityId))
          .filter((value: number) => Number.isFinite(value) && value > 0)
      )
    );

    const investorIds = Array.from(
      new Set(
        logs
          .filter((log: any) => log.entityType === "investor")
          .map((log: any) => Number(log.entityId))
          .filter((value: number) => Number.isFinite(value) && value > 0)
      )
    );

    const epnIds = Array.from(
      new Set(
        logs
          .filter((log: any) => log.entityType === "epn" || log.entityType === "epn_partner")
          .map((log: any) => Number(log.entityId))
          .filter((value: number) => Number.isFinite(value) && value > 0)
      )
    );

    let leadRows: any[] = [];
    if (leadIds.length > 0) {
      leadRows = await db
        .select({
          id: leads.id,
          companyName: companies.name,
        })
        .from(leads)
        .leftJoin(companies, eq(leads.companyId, companies.id))
        .where(and(eq(leads.organizationId, organizationId), inArray(leads.id, leadIds)));
    }

    let investorRows: any[] = [];
    if (investorIds.length > 0) {
      investorRows = await db
        .select({
          id: investors.id,
          name: investors.name,
        })
        .from(investors)
        .where(and(eq(investors.organizationId, organizationId), inArray(investors.id, investorIds)));
    }

    let epnRows: any[] = [];
    if (epnIds.length > 0) {
      epnRows = await db
        .select({
          id: epnPartners.id,
          name: epnPartners.name,
          bucket: epnPartners.bucket,
        })
        .from(epnPartners)
        .where(and(eq(epnPartners.organizationId, organizationId), inArray(epnPartners.id, epnIds)));
    }

    const leadNameMap = new Map<number, string>();
    for (const row of leadRows) {
      leadNameMap.set(Number(row.id), row.companyName || `Lead #${row.id}`);
    }

    const investorNameMap = new Map<number, string>();
    for (const row of investorRows) {
      investorNameMap.set(Number(row.id), row.name || `Investor #${row.id}`);
    }

    const epnNameMap = new Map<number, { name: string; bucket: string | null }>();
    for (const row of epnRows) {
      epnNameMap.set(Number(row.id), {
        name: row.name || `EPN #${row.id}`,
        bucket: row.bucket || null,
      });
    }

    return logs.map((log: any) => {
      let entityName: string | null = null;
      let extra: any = {};

      if (log.entityType === "lead") {
        const leadId = Number(log.leadId ?? log.entityId);
        entityName = leadNameMap.get(leadId) || null;
      } else if (log.entityType === "investor") {
        const investorId = Number(log.entityId);
        entityName = investorNameMap.get(investorId) || null;
      } else if (log.entityType === "epn" || log.entityType === "epn_partner") {
        const epnId = Number(log.entityId);
        const epnData = epnNameMap.get(epnId);
        entityName = epnData?.name || null;
        extra.bucket = epnData?.bucket || null;
      }

      return {
        id: log.id,
        createdAt: log.createdAt,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        entityName,
        description: log.description,
        oldValue: log.oldValue,
        newValue: log.newValue,
        ...extra,
      };
    });
  }



  // ==========================================
  // TEAM ACTIVITY & WEEKLY MOMENTUM
  // ==========================================

  async getUserActivitySummary(organizationId: number): Promise<any[]> {
    // We want today's data (from midnight to now)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const orgUsers = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        role: users.role,
        lastLoginTime: users.lastLoginTime,
        lastActionTime: users.lastActionTime,
      })
      .from(users)
      .where(eq(users.organizationId, organizationId));

    // Fetch all activity logs for today for this org
    const todaysLogs = await db
      .select({
        userId: activityLog.userId,
        action: activityLog.action,
      })
      .from(activityLog)
      .where(
        and(
          eq(activityLog.organizationId, organizationId),
          gte(activityLog.createdAt, today)
        )
      );

    // Fetch all completed tasks (interventions) for today
    const todaysTasks = await db
      .select({
        userId: interventions.userId,
      })
      .from(interventions)
      .where(
        and(
          eq(interventions.organizationId, organizationId),
          eq(interventions.status, 'completed'),
          // Fix: Changed from updatedAt to createdAt to match schema
          gte(interventions.createdAt, today) 
        )
      );

    // Aggregate the data per user
    // Fix: Added ': any' to explicitly satisfy TypeScript strict mode
    return orgUsers.map((user: any) => {
      const userLogs = todaysLogs.filter((log: any) => log.userId === user.id);
      const userTasks = todaysTasks.filter((task: any) => task.userId === user.id);

      return {
        ...user,
        updates: userLogs.length,
        notesAdded: userLogs.filter((log: any) => log.action === 'note_added' || log.action === 'remark_added').length,
        stageChanges: userLogs.filter((log: any) => log.action === 'lead_stage_changed' || log.action === 'stage_changed').length,
        tasksCompleted: userTasks.length,
      };
    });
  }

  async getWeeklyMomentum(organizationId: number): Promise<any> {
    const now = new Date();
    
    // Current Week (Last 7 days)
    const currentWeekStart = new Date(now);
    currentWeekStart.setDate(currentWeekStart.getDate() - 7);
    
    // Previous Week (Days 8-14 ago)
    const prevWeekStart = new Date(now);
    prevWeekStart.setDate(prevWeekStart.getDate() - 14);

    // Helper to get counts based on date ranges
    const getMetrics = async (startDate: Date, endDate: Date) => {
      // 1. Leads Added
      const [leadsRes] = await db.select({ count: count() }).from(leads)
        .where(and(eq(leads.organizationId, organizationId), gte(leads.createdAt, startDate), lte(leads.createdAt, endDate)));
      
      // 2. Leads Dropped (from activity log to catch stage movements)
      const [droppedRes] = await db.select({ count: count() }).from(activityLog)
        .where(and(eq(activityLog.organizationId, organizationId), eq(activityLog.action, 'lead_stage_changed'), ilike(activityLog.newValue, '%dropped%'), gte(activityLog.createdAt, startDate), lte(activityLog.createdAt, endDate)));

      // 3. Mandates Signed (moved to mandates stage)
      const [mandatesRes] = await db.select({ count: count() }).from(activityLog)
        .where(and(eq(activityLog.organizationId, organizationId), eq(activityLog.action, 'lead_stage_changed'), ilike(activityLog.newValue, '%mandates%'), gte(activityLog.createdAt, startDate), lte(activityLog.createdAt, endDate)));

      // 4. Investors Mapped (New links created)
      const [investorsMappedRes] = await db.select({ count: count() }).from(investorLeadLinks)
        .where(and(eq(investorLeadLinks.organizationId, organizationId), gte(investorLeadLinks.createdAt, startDate), lte(investorLeadLinks.createdAt, endDate)));

      // 5. Meetings Logged
      const [meetingsRes] = await db.select({ count: count() }).from(interventions)
        .where(and(eq(interventions.organizationId, organizationId), eq(interventions.type, 'meeting'), gte(interventions.createdAt, startDate), lte(interventions.createdAt, endDate)));

      // 6. Tasks Completed
      const [tasksRes] = await db.select({ count: count() }).from(interventions)
        .where(and(eq(interventions.organizationId, organizationId), eq(interventions.status, 'completed'), gte(interventions.createdAt, startDate), lte(interventions.createdAt, endDate)));

      // 7. Stage Movements Count
      const [stageMovesRes] = await db.select({ count: count() }).from(activityLog)
        .where(and(eq(activityLog.organizationId, organizationId), or(eq(activityLog.action, 'lead_stage_changed'), eq(activityLog.action, 'stage_changed')), gte(activityLog.createdAt, startDate), lte(activityLog.createdAt, endDate)));

      return {
        leadsAdded: leadsRes?.count || 0,
        leadsDropped: droppedRes?.count || 0,
        mandatesSigned: mandatesRes?.count || 0,
        investorsMapped: investorsMappedRes?.count || 0,
        meetingsLogged: meetingsRes?.count || 0,
        tasksCompleted: tasksRes?.count || 0,
        stageMovements: stageMovesRes?.count || 0,
      };
    };

    const currentWeek = await getMetrics(currentWeekStart, now);
    const prevWeek = await getMetrics(prevWeekStart, currentWeekStart);

    return { currentWeek, prevWeek };
  }


  // ✅ Implementation for Daily Activity Feed
  async getRecentStageMovements(organizationId: number, entityType: string, since: Date): Promise<any[]> {
    return await db.select({
      id: activityLog.id,
      entityId: activityLog.entityId,
      oldValue: activityLog.oldValue,
      newValue: activityLog.newValue,
      createdAt: activityLog.createdAt,
      user: {
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName
      }
    })
    .from(activityLog)
    .leftJoin(users, eq(activityLog.userId, users.id))
    .where(
      and(
        eq(activityLog.organizationId, organizationId),
        eq(activityLog.action, 'stage_changed'),
        eq(activityLog.entityType, entityType),
        gte(activityLog.createdAt, since)
      )
    )
    .orderBy(desc(activityLog.createdAt));
  }

  async getRecentNotes(organizationId: number, entityType: string, since: Date): Promise<any[]> {
    if (entityType === 'lead') {
      return await db.select({
        id: leadRemarks.id,
        entityId: leadRemarks.leadId,
        note: leadRemarks.remark,
        createdAt: leadRemarks.createdAt,
        user: {
          firstName: users.firstName,
          lastName: users.lastName
        }
      })
      .from(leadRemarks)
      .leftJoin(users, eq(leadRemarks.userId, users.id))
      .where(
        and(
          eq(leadRemarks.organizationId, organizationId),
          gte(leadRemarks.createdAt, since)
        )
      )
      .orderBy(desc(leadRemarks.createdAt));
    }
    return [];
  }



  // Other operations
}

export const storage = new DatabaseStorage();
