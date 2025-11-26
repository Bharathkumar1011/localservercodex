// Integration: javascript_log_in_with_replit, javascript_database
import {
  users,
  organizations,
  companies,
  leads,
  contacts,
  leadAssignments,
  outreachActivities,
  interventions,
  activityLog,
  dealOutcomes,
  invitations,
  leadRemarks,
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
  type Intervention,
  type UpsertIntervention,
  type ActivityLog,
  type UpsertActivityLog,
  type DealOutcome,
  type UpsertDealOutcome,
  type InsertInvitationData,
} from "./shared/schema.js";
import { leadActionables } from "./shared/schema.js";
import { db } from "./db";
import { eq, and, desc, sql, ilike, or, gte, lte, count, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { randomUUID } from 'crypto';

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
  
  // Lead operations
  createLead(lead: UpsertLead): Promise<Lead>;
  getLead(id: number, organizationId: number): Promise<Lead | undefined>;
  getLeadsByStage(stage: string, organizationId: number): Promise<(Lead & { company: Company; contact?: Contact; assignedToUser?: User; ownerAnalystUser?: User })[]>;
  getAllLeads(organizationId: number): Promise<(Lead & { company: Company; contact?: Contact; assignedToUser?: User; ownerAnalystUser?: User })[]>;
  getLeadsByAssignee(userId: string, organizationId: number): Promise<(Lead & { company: Company; contact?: Contact; assignedToUser?: User })[]>;
  getLeadsByCompany(companyId: number, organizationId: number): Promise<Lead[]>;
  updateLead(id: number, organizationId: number, updates: Partial<UpsertLead>): Promise<Lead | undefined>;
  assignLead(leadId: number, organizationId: number, assignedTo: string | null, assignedBy: string, notes?: string): Promise<void>;
  assignInternsToLead(leadId: number, organizationId: number, internIds: string[], assignedBy: string, notes?: string): Promise<void>;
  
  // Assignment operations
  getLeadAssignments(leadId: number, organizationId: number): Promise<(LeadAssignment & { assignedByUser: User; assignedToUser: User })[]>;
  
  // Outreach operations
  createOutreachActivity(activity: UpsertOutreachActivity): Promise<OutreachActivity>;
  getOutreachActivities(leadId: number, organizationId: number): Promise<OutreachActivity[]>;
  updateOutreachActivity(id: number, organizationId: number, updates: Partial<UpsertOutreachActivity>): Promise<OutreachActivity | undefined>;
  
  // Intervention operations
  createIntervention(intervention: UpsertIntervention): Promise<Intervention>;
  getInterventions(leadId: number, organizationId: number): Promise<(Intervention & { user: User })[]>;
  getScheduledInterventions(user: User): Promise<Array<Intervention & { 
    lead: Lead & { 
      company: Company; 
      contact?: Contact;
    }; 
    user: User;
  }>>;
  updateIntervention(id: number, organizationId: number, updates: Partial<UpsertIntervention>): Promise<Intervention | undefined>;
  deleteIntervention(id: number, organizationId: number): Promise<Intervention | undefined>;
  
  // Activity logging operations
  createActivityLog(activity: UpsertActivityLog): Promise<ActivityLog>;
  getActivityLog(organizationId: number, leadId?: number, companyId?: number, limit?: number): Promise<(ActivityLog & { user: User })[]>;
  getActivityLogsForAudit(organizationId: number, filters: {
    search?: string;
    userId?: number;
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
  
  // Dashboard/Analytics operations
  getDashboardMetrics(organizationId: number, userId?: string): Promise<{
    totalLeads: number;
    qualified: number;
    inOutreach: number;
    inPitching: number;
    pipelineValue: number;
    leadsCountByStage: { [stage: string]: number };
  }>;
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


  async createCompanyWithDeduplication(companyData: any, organizationId: number) {
    // Normalize company name
    const normalizedName = companyData.name?.toLowerCase().trim();
    if (!normalizedName) throw new Error("Company name is required");

    // Case-insensitive check for existing company in same organization
    const [existingCompany] = await db
      .select()
      .from(companies)
      .where(
        and(
          eq(companies.organizationId, organizationId),
          sql`LOWER(TRIM(${companies.name})) = ${normalizedName}`
        )
      );

    if (existingCompany) {
      return { company: existingCompany, isExisting: true };
    }

    // Create new company record
    const [company] = await db
      .insert(companies)
      .values({
        ...companyData,
        organizationId,
        normalizedName,
      })
      .returning();

    return { company, isExisting: false };
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
    const isComplete = !!(contactData.name && contactData.designation && contactData.linkedinProfile);
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
    const isComplete = !!(updatedData.name && updatedData.designation && updatedData.linkedinProfile);
    
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

  // Lead operations
  async createLead(leadData: UpsertLead): Promise<Lead> {
    const [lead] = await db.insert(leads).values(leadData).returning();
    return lead;
  }

  async getLead(id: number, organizationId: number): Promise<Lead | undefined> {
    const [lead] = await db.select().from(leads).where(and(eq(leads.id, id), eq(leads.organizationId, organizationId)));
    return lead;
  }

  async getLeadsByStage(stage: string, organizationId: number): Promise<(Lead & { company: Company; contact?: Contact; assignedToUser?: User; ownerAnalystUser?: User })[]> {
    // Universe stage shows both 'universe' and 'qualified' leads
    // Qualified leads are still visible in Universe with their qualified status
    const stageCondition = stage === 'universe' 
      ? or(eq(leads.stage, 'universe'), eq(leads.stage, 'qualified'))
      : eq(leads.stage, stage);
    
    const assignedToUsers = alias(users, 'assignedToUser');
    const ownerAnalystUsers = alias(users, 'ownerAnalystUser');
    
    const result = await db
      .select({
        lead: leads,
        company: companies,
        contact: contacts,
        assignedToUser: assignedToUsers,
        ownerAnalystUser: ownerAnalystUsers,
      })
      .from(leads)
      .innerJoin(companies, eq(leads.companyId, companies.id))
      .leftJoin(contacts, and(eq(contacts.companyId, companies.id), eq(contacts.isPrimary, true)))
      .leftJoin(assignedToUsers, eq(leads.assignedTo, assignedToUsers.id))
      .leftJoin(ownerAnalystUsers, eq(leads.ownerAnalystId, ownerAnalystUsers.id))
      .where(and(stageCondition, eq(leads.organizationId, organizationId)))
      .orderBy(desc(leads.updatedAt));
    
    // De-duplicate leads by ID (in case multiple primary contacts exist)
    const leadMap = new Map<number, Lead & { company: Company; contact?: Contact; assignedToUser?: User; ownerAnalystUser?: User }>();
    
    for (const r of result) {
      if (!leadMap.has(r.lead.id)) {
        leadMap.set(r.lead.id, {
          ...r.lead,
          company: r.company,
          contact: r.contact || undefined,
          assignedToUser: r.assignedToUser || undefined,
          ownerAnalystUser: r.ownerAnalystUser || undefined
        });
      }
    }
    
    return Array.from(leadMap.values());
  }

  async getAllLeads(organizationId: number): Promise<(Lead & { company: Company; contact?: Contact; assignedToUser?: User; assignedInternUsers?: User[]; ownerAnalystUser?: User })[]> {
    const assignedToUsers = alias(users, 'assignedToUser');
    const ownerAnalystUsers = alias(users, 'ownerAnalystUser');
    
    const result = await db
      .select({
        lead: leads,
        company: companies,
        contact: contacts,
        assignedToUser: assignedToUsers,
        ownerAnalystUser: ownerAnalystUsers,
      })
      .from(leads)
      .innerJoin(companies, eq(leads.companyId, companies.id))
      .leftJoin(contacts, and(eq(contacts.companyId, companies.id), eq(contacts.isPrimary, true)))
      .leftJoin(assignedToUsers, eq(leads.assignedTo, assignedToUsers.id))
      .leftJoin(ownerAnalystUsers, eq(leads.ownerAnalystId, ownerAnalystUsers.id))
      .where(eq(leads.organizationId, organizationId))
      .orderBy(desc(leads.updatedAt));
    
    // De-duplicate leads by ID (in case multiple primary contacts exist)
    const leadMap = new Map<number, Lead & { company: Company; contact?: Contact; assignedToUser?: User; assignedInternUsers?: User[]; ownerAnalystUser?: User }>();
    
    for (const r of result) {
      if (!leadMap.has(r.lead.id)) {
        leadMap.set(r.lead.id, {
          ...r.lead,
          company: r.company,
          contact: r.contact || undefined,
          assignedToUser: r.assignedToUser || undefined,
          assignedInternUsers: [],
          ownerAnalystUser: r.ownerAnalystUser || undefined
        });
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

  async getLeadsByAssignee(userId: string, organizationId: number): Promise<(Lead & { company: Company; contact?: Contact; assignedToUser?: User; assignedInternUsers?: User[] })[]> {
    const result = await db
      .select({
        lead: leads,
        company: companies,
        contact: contacts,
        assignedToUser: users,
      })
      .from(leads)
      .innerJoin(companies, eq(leads.companyId, companies.id))
      .leftJoin(contacts, and(eq(contacts.companyId, companies.id), eq(contacts.isPrimary, true)))
      .leftJoin(users, eq(leads.assignedTo, users.id))
      .where(and(
        or(
          eq(leads.ownerAnalystId, userId),  // Analysts see leads they own (created)
          eq(leads.assignedTo, userId)        // Also see leads assigned to them
        ),
        eq(leads.organizationId, organizationId)
      ))
      .orderBy(desc(leads.updatedAt));
    
    // De-duplicate leads by ID (in case multiple primary contacts exist)
    const leadMap = new Map<number, Lead & { company: Company; contact?: Contact; assignedToUser?: User; assignedInternUsers?: User[] }>();
    
    for (const r of result) {
      if (!leadMap.has(r.lead.id)) {
        leadMap.set(r.lead.id, {
          ...r.lead,
          company: r.company,
          contact: r.contact || undefined,
          assignedToUser: r.assignedToUser || undefined,
          assignedInternUsers: []
        });
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

  async assignLead(leadId: number, organizationId: number, assignedTo: string | null, assignedBy: string, notes?: string): Promise<void> {
    // Get the current lead to check its stage for universe status logic
    const [currentLead] = await db
      .select()
      .from(leads)
      .where(and(eq(leads.id, leadId), eq(leads.organizationId, organizationId)));
    
    if (!currentLead) {
      throw new Error('Lead not found');
    }
    
    // Determine universe status based on assignment (only for universe stage leads)
    let updateData: any = { assignedTo, updatedAt: new Date() };
    if (currentLead.stage === 'universe') {
      updateData.universeStatus = assignedTo ? 'assigned' : 'open';
    }
    
    // If assigning to a user, check if they're an analyst
    // If yes, also update ownerAnalystId so they become the owner
    if (assignedTo) {
      const [assignee] = await db
        .select()
        .from(users)
        .where(and(eq(users.id, assignedTo), eq(users.organizationId, organizationId)));
      
      if (assignee && assignee.role === 'analyst') {
        updateData.ownerAnalystId = assignedTo;
      }
    }
    
    // Update the lead assignment and universe status
    await db
      .update(leads)
      .set(updateData)
      .where(and(eq(leads.id, leadId), eq(leads.organizationId, organizationId)));
    
    // Record the assignment history
    await db.insert(leadAssignments).values({
      organizationId,
      leadId,
      assignedBy,
      assignedTo,
      notes,
    });
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

  async getScheduledInterventions(user: User): Promise<Array<Intervention & { 
    lead: Lead & { 
      company: Company; 
      contact?: Contact;
    }; 
    user: User;
  }>> {
    if (!user.organizationId) {
      throw new Error('User organization not found');
    }
    
    console.log('[getScheduledInterventions] User:', { id: user.id, role: user.role, organizationId: user.organizationId });

    const result = await db
      .select({
        intervention: interventions,
        lead: leads,
        company: companies,
        contact: contacts,
        user: users,
      })
      .from(interventions)
      .innerJoin(leads, eq(interventions.leadId, leads.id))
      .innerJoin(companies, eq(leads.companyId, companies.id))
      .leftJoin(contacts, and(eq(contacts.companyId, companies.id), eq(contacts.isPrimary, true)))
      .leftJoin(users, eq(interventions.userId, users.id))
      .where(eq(interventions.organizationId, user.organizationId))
      .orderBy(interventions.scheduledAt);

    console.log('[getScheduledInterventions] Query result count:', result.length);
    console.log('[getScheduledInterventions] First intervention:', result[0]?.intervention);

    const mapped = result.map(r => ({
      ...r.intervention,
      lead: {
        ...r.lead,
        company: r.company,
        contact: r.contact || undefined,
      },
      user: r.user!,
    }));
    
    console.log('[getScheduledInterventions] Returning', mapped.length, 'interventions');
    return mapped;
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
    userId?: number;
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
    const whereClause = userId ? and(orgWhereClause, eq(leads.assignedTo, userId)) : orgWhereClause;
    
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
    const allUsers = await db.select().from(users).where(eq(users.organizationId, organizationId));
    
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

  // Other operations
}

export const storage = new DatabaseStorage();
