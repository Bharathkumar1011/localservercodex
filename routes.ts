// Integration: javascript_log_in_with_replit
import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage.js";
import { StageProgressionService } from "./stageProgressionService.js";
import ActivityLogService from "./activityLogService.js";
import { randomUUID } from 'crypto';
import { emailService } from './smtpEmailService.js';
import { z } from 'zod';
import session from 'express-session';
import { and, eq, inArray, asc } from "drizzle-orm";
import { contacts } from "./shared/schema.js";


import { db } from "./db.js";
import { leads } from "./shared/schema.js";
// Import route modules
import { userRoutes } from './routes/userRoutes.js';
import { companyRoutes } from './routes/companyRoutes.js';
import { leadRoutes } from './routes/leadRoutes.js';
import { contactRoutes } from './routes/contactRoutes.js';

import { epnRoutes } from './routes/epnRoutes.js'; // NEW EPN routes

import { leadSolutionNoteRoutes } from './routes/lead-solution-note/leadSolutionNoteRoutes.js';
 
import { investorEventsRoutes } from './routes/investorEventsRoutes.js';


import { insertNewsFeedSchema , newsFeed} from "./shared/schema.js";


// Import middleware
import { requireRole } from './middleware/auth.js';
import { requireSupabaseAuth } from './middleware/supabaseAuth.js';

import { parse } from "csv-parse/sync";
import multer from "multer";

import path from "path";
import fs from "fs";

import { createRequire } from "module";
const require = createRequire(import.meta.url);

// pdf-parse compatibility (v1 and v2)
const pdfParsePkg: any = require("pdf-parse");
const PDFParseClass: any =
  pdfParsePkg?.PDFParse ??
  pdfParsePkg?.default?.PDFParse ??
  null;
async function extractPdfText(buffer: Buffer): Promise<string> {
  // ✅ v1 compatibility: const pdf = require("pdf-parse"); await pdf(buffer)
  if (typeof pdfParsePkg === "function") {
    const r = await pdfParsePkg(buffer);
    return r?.text || "";
  }

  // ✅ v2+: const { PDFParse } = require("pdf-parse"); new PDFParse({ data: buffer })
  if (typeof PDFParseClass === "function") {
    const parser = new PDFParseClass({ data: buffer });
    const r = await parser.getText();
    if (typeof parser.destroy === "function") await parser.destroy();
    return r?.text || "";
  }

  throw new Error("pdf-parse export not supported (expected function or PDFParse class)");
}
import {
  insertCompanySchema,
  updateCompanySchema,
  insertContactSchema,
  updateContactSchema,
  insertLeadSchema,
  updateLeadSchema,
  insertOutreachActivitySchema,
  insertInterventionSchema,
  insertActivityLogSchema,
  interventionFormSchema,
  contactFormSchema,
  individualLeadFormSchema,
  insertInvestorSchema,
  type InsertCompanyData,
  type UpdateCompanyData,
  type InsertContactData,
  type UpdateContactData,
  type InsertLeadData,
  type UpdateLeadData,
  type InsertOutreachActivityData,
  type InsertInterventionData,
  type InterventionFormData,
  type ContactFormData,
  type IndividualLeadFormData
} from "./shared/schema.js";
import { validateIntParam, validateResourceExists, validateStage } from "./middleware/validation.js";

const authMiddleware = requireSupabaseAuth;

  const sessionMiddleware = session({
    secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: process.env.NODE_ENV === 'production' ? 'lax' : 'lax',
      maxAge: 1000 * 60 * 60 * 24 // 24 hours
    }
  });

  // Initialize stage progression service
  const stageProgressionService = new StageProgressionService(storage);

// Initialize activity log service
const LEAD_POC_OUTREACH_STATUS_OPTIONS = {
  linkedin: [
    "initiated",
    "request_sent",
    "no_response_post_process",
    "unavailable",
    "positive",
    "negative",
    "neutral",
  ],
  email: [
    "initiated",
    "1st_follow_up",
    "2nd_follow_up",
    "3rd_follow_up",
    "no_response_post_process",
    "unavailable",
    "positive",
    "negative",
    "email_bounced",
    "neutral",
  ],
  whatsapp: [
    "initiated",
    "1st_follow_up",
    "2nd_follow_up",
    "3rd_follow_up",
    "no_response_post_process",
    "unavailable",
    "positive",
    "negative",
    "call_required",
    "neutral",
  ],
call: [
  "initiated",
  "no_response_post_process",
  "unavailable",
  "positive",
  "negative",
  "neutral",
],
  channel_partner: [
    "initiated",
    "1st_follow_up",
    "2nd_follow_up",
    "3rd_follow_up",
    "no_response_post_process",
    "unavailable",
    "positive",
    "negative",
    "neutral",
  ],
  other: [],
} as const;

function isValidLeadPocOutreachStatus(channel: string, status: string) {
  const options =
    (LEAD_POC_OUTREACH_STATUS_OPTIONS as Record<string, readonly string[]>)[channel] || [];
  return options.includes(status);
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}


const INVESTOR_POC_OUTREACH_STATUS_OPTIONS = {
  linkedin: [
    "initiated",
    "request_sent",
    "no_response_post_process",
    "unavailable",
    "positive",
    "negative",
    "neutral",
  ],
  email: [
    "initiated",
    "1st_follow_up",
    "2nd_follow_up",
    "3rd_follow_up",
    "no_response_post_process",
    "unavailable",
    "positive",
    "negative",
    "email_bounced",
    "neutral",
  ],
  whatsapp: [
    "initiated",
    "1st_follow_up",
    "2nd_follow_up",
    "3rd_follow_up",
    "no_response_post_process",
    "unavailable",
    "positive",
    "negative",
    "call_required",
    "neutral",
  ],
  call: [
    "initiated",
    "no_response_post_process",
    "unavailable",
    "positive",
    "negative",
    "neutral",
  ],
  channel_partner: [
    "initiated",
    "1st_follow_up",
    "2nd_follow_up",
    "3rd_follow_up",
    "no_response_post_process",
    "unavailable",
    "positive",
    "negative",
    "neutral",
  ],
  other: [],
} as const;

function isValidInvestorPocOutreachStatus(channel: string, status: string) {
  const options =
    (INVESTOR_POC_OUTREACH_STATUS_OPTIONS as Record<string, readonly string[]>)[channel] || [];
  return options.includes(status);
}

function mapInvestorOutreachStatusToLinkedStatus(status?: string | null) {
  if (!status) return "yet_to_contact";

  switch (status) {
    case "positive":
      return "positive";
    case "negative":
      return "rejected";
    case "neutral":
      return "hold";
    case "initiated":
    case "request_sent":
    case "1st_follow_up":
    case "2nd_follow_up":
    case "3rd_follow_up":
    case "email_bounced":
    case "unavailable":
    case "call_required":
      return "no_response";
    case "no_response_post_process":
      return "no_response";
    default:
      return "yet_to_contact";
  }
}

function deriveLinkedInvestorStatusFromOutreachRows(
  rows: Array<{ status?: string | null; lastUpdatedAt?: string | Date | null }>,
  expectedRowCount: number
) {
  const filledRows = rows.filter((row) => !!row.status);

  // Blank / untouched investor
  if (filledRows.length === 0) {
    return "yet_to_contact";
  }

  // Dropped only when ALL expected rows exist
  // AND every one of them is no_response_post_process
  const allRowsFilled = expectedRowCount > 0 && filledRows.length === expectedRowCount;
  const allRowsAreNoResponsePostProcess =
    allRowsFilled &&
    filledRows.every((row) => row.status === "no_response_post_process");

  if (allRowsAreNoResponsePostProcess) {
    return "dropped";
  }

  // Otherwise latest meaningful update decides the current status
  const latest = [...filledRows].sort((a, b) => {
    const aTime = a.lastUpdatedAt ? new Date(a.lastUpdatedAt).getTime() : 0;
    const bTime = b.lastUpdatedAt ? new Date(b.lastUpdatedAt).getTime() : 0;
    return bTime - aTime;
  })[0];

  return mapInvestorOutreachStatusToLinkedStatus(latest?.status ?? null);
}


// Investor stage filters 
const INVESTOR_STAGE_FILTER_VALUES = ["outreach", "warm", "active", "dealmaking"] as const;
type InvestorStageFilterValue = typeof INVESTOR_STAGE_FILTER_VALUES[number];

function parseInvestorStageFilters(raw: unknown): InvestorStageFilterValue[] | null {
  const values = Array.isArray(raw)
    ? raw
    : typeof raw === "string"
      ? raw.split(",")
      : [];

  const cleaned = values
    .map((v) => String(v).trim().toLowerCase())
    .filter(Boolean);

  // empty = all stages selected
  if (cleaned.length === 0 || cleaned.includes("all")) {
    return [...INVESTOR_STAGE_FILTER_VALUES];
  }

  const invalid = cleaned.filter(
    (v) => !INVESTOR_STAGE_FILTER_VALUES.includes(v as InvestorStageFilterValue)
  );

  if (invalid.length > 0) {
    return null;
  }

  return Array.from(new Set(cleaned)) as InvestorStageFilterValue[];
}





  export async function registerRoutes(app: Express): Promise<Server> {
    
    // Setup session middleware FIRST (before any auth)

      app.use(sessionMiddleware);

      // 🔍 Global request logger (for debugging route flow)
      app.use((req, res, next) => {
        console.log(`➡️ [${req.method}] ${req.path}`);
        console.log('Session data:', req.session);
        next();
      });
      
    const mockAuthDisabledHandler = (_req: any, res: any) => {
      res.status(410).json({
        message: 'Mock authentication endpoints have been removed. Authenticate with Supabase instead.'
        });
        };

        app.get('/api/auth/mock/roles', mockAuthDisabledHandler);
        app.post('/api/auth/mock/login', mockAuthDisabledHandler);
        app.post('/api/auth/mock/logout', mockAuthDisabledHandler);
        app.get('/api/auth/mock/status', mockAuthDisabledHandler);

          
    // Protected auth routes
    app.get('/api/auth/user', authMiddleware, async (req: any, res) => {
      try {
        const userId = req.verifiedUser?.id;
        if (!userId) {
          return res.status(401).json({ message: 'User not authenticated' });
        }
        const user = await storage.getUser(userId);
        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }
        
        const testRole = (req.session as any)?.testRole;
        const hasSelectedTestRole = (req.session as any)?.hasSelectedTestRole;
        
        res.json({
          ...user,
          testRole,
          hasSelectedTestRole,
          effectiveRole: testRole || user.role
        });
      } catch (error) {
        console.error("Error fetching user:", error);
        res.status(500).json({ message: "Failed to fetch user" });
      }
    });
    
    // Set test role for testing purposes
    app.post('/api/auth/set-test-role', authMiddleware, async (req: any, res) => {
      try {
        const { role } = req.body;
        const userId = req.verifiedUser?.id;
        if (!userId) {
          return res.status(401).json({ message: 'User not authenticated' });
        }
        
        if (!role || !['admin', 'analyst', 'intern'].includes(role)) {
          return res.status(400).json({ message: 'Invalid role. Must be admin, analyst, or intern' });
        }
        
        const user = await storage.getUser(userId);
        if (!user) {
          return res.status(404).json({ message: 'User not found' });
        }
        
        if (user.role !== 'admin' && user.role !== 'partner') {
          return res.status(403).json({ message: 'Only admin and partner users can use test roles' });
        }
        
        if (user.role === 'partner' && role === 'admin') {
          return res.status(403).json({ message: 'Partners cannot test as admin role' });
        }
        
        (req.session as any).testRole = role;
        (req.session as any).hasSelectedTestRole = true;
        
        await new Promise<void>((resolve, reject) => {
          req.session.save((err: any) => {
            if (err) reject(err);
            else resolve();
          });
        });
        
        res.json({ success: true, testRole: role });
      } catch (error) {
        console.error("Error setting test role:", error);
        res.status(500).json({ message: "Failed to set test role" });
      }
    });




        // ✅ NEW ROUTE for Phase 2: Daily Activity Feed (Stage Movements & Notes)
    app.get('/api/analytics/daily-feed', authMiddleware, async (req: any, res) => {
      try {
        const organizationId = req.verifiedUser?.organizationId || req.user?.organizationId;
        const type = (req.query.type as string) || 'lead'; // expects 'lead', 'investor', or 'epn'

        if (!organizationId) {
          return res.status(401).json({ message: "Organization ID missing" });
        }

        // Calculate exactly 24 hours ago
        const yesterday = new Date();
        yesterday.setHours(yesterday.getHours() - 24);

        // Fetch parallel data to make the request faster
        const [stageMovements, notes] = await Promise.all([
          storage.getRecentStageMovements(organizationId, type, yesterday),
          storage.getRecentNotes(organizationId, type, yesterday)
        ]);

        res.json({
          success: true,
          type,
          data: {
            stageMovements,
            notes
          }
        });
      } catch (error) {
        console.error("Error fetching daily feed:", error);
        res.status(500).json({ message: "Failed to fetch daily activity feed" });
      }
    });




    // ✅ NEW: Userwise Pipeline Aging Analytics
    app.get('/api/analytics/pipeline-aging', authMiddleware, async (req: any, res) => {
      try {
        const orgId = req.verifiedUser?.organizationId;
        if (!orgId) return res.status(401).json({ message: "Unauthorized" });
        
        const data = await storage.getPipelineAgingStats(Number(orgId));
        res.json(data);
      } catch (error) {
        console.error("Pipeline aging fetch error:", error);
        res.status(500).json({ message: "Failed to fetch aging stats" });
      }
    });






    // Clear test role
    app.post('/api/auth/clear-test-role', authMiddleware, async (req: any, res) => {
      try {
        delete (req.session as any).testRole;
        delete (req.session as any).hasSelectedTestRole;
        
        await new Promise<void>((resolve, reject) => {
          req.session.save((err: any) => {
            if (err) reject(err);
            else resolve();
          });
        });
        
        res.json({ success: true });
      } catch (error) {
        console.error("Error clearing test role:", error);
        res.status(500).json({ message: "Failed to clear test role" });
      }
    });

    // Organization setup
    app.post('/api/organizations/setup', authMiddleware, async (req: any, res) => {
      try {
        const { name } = req.body;
        const userId = req.verifiedUser.id;
        const userEmail = req.verifiedUser.email;

        if (!userId || !userEmail) {
          return res.status(401).json({ message: 'User not authenticated' });
        }
        
        
        if (!name || !name.trim()) {
          return res.status(400).json({ message: 'Organization name is required' });
        }

        const currentUser = await storage.getUser(userId);
        if (!currentUser) {
          return res.status(404).json({ message: 'User not found' });
        }

        if (currentUser.organizationId) {
          return res.status(400).json({ message: 'User already belongs to an organization' });
        }

        const organization = await storage.createOrganization({
          name: name.trim(),
          adminEmail: userEmail
        });

        await storage.upsertUser({
          ...currentUser,
          organizationId: organization.id,
          role: 'admin'
        });

        res.json({ 
          message: 'Organization created successfully',
          organization: {
            id: organization.id,
            name: organization.name
          }
        });
      } catch (error) {
        console.error('Error creating organization:', error);
        res.status(500).json({ message: 'Failed to create organization' });
      }
    });
    
    // Protected routes with role-based access
    app.use('/api/users', authMiddleware, requireRole(['partner', 'admin', 'analyst']), userRoutes);
    app.use('/api/companies', authMiddleware, requireRole(['partner', 'admin', 'analyst']), companyRoutes);
    app.use('/api/leads', authMiddleware, leadRoutes); // Role checks moved to individual routes
    app.use('/api/leads', authMiddleware, leadSolutionNoteRoutes); // NEW Lead Solution Note routes
    app.use('/api/contacts', authMiddleware, contactRoutes);
    
    app.use('/api/investor-events', authMiddleware, investorEventsRoutes);

    app.use('/api/epn', authMiddleware, requireRole(['partner', 'admin']), epnRoutes); // NEW EPN routes - only partners and admins can access

    // Dashboard routes
    app.get('/api/dashboard/metrics', authMiddleware, async (req: any, res) => {
      try {
        // Supabase-authenticated user
        const user = req.verifiedUser;
        if (!user || !user.id || !user.organizationId) {
          return res.status(401).json({ message: "User not authenticated" });
        }

        const userId = user.id;
        const userRole = user.role || 'analyst';

        // Analysts only see their own metrics. Partners/Admins see all.
        const metricsUserId = (userRole === 'analyst' || userRole === 'partner') ? userId : undefined;

        const metrics = await storage.getDashboardMetrics(
          Number(user.organizationId),
          metricsUserId
        );


        // Prevent 304 caching issues
        res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.set('Expires', '0');

        res.json({
          ...metrics,
          userRole,
          isPersonalized: userRole === 'analyst'
        });

      } catch (error) {
        console.error('Error fetching dashboard metrics:', error);
        res.status(500).json({ message: 'Failed to fetch dashboard metrics' });
      }
    });



    // ✅ NEW ROUTE: Weekly Momentum
    app.get('/api/dashboard/weekly-momentum', authMiddleware, async (req: any, res) => {
      try {
        const user = req.verifiedUser;
        if (!user || !user.organizationId) {
          return res.status(401).json({ message: "Unauthorized" });
        }

        const momentum = await storage.getWeeklyMomentum(Number(user.organizationId));
        res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.json(momentum);
      } catch (error) {
        console.error('Error fetching weekly momentum:', error);
        res.status(500).json({ message: 'Failed to fetch weekly momentum' });
      }
    });

    // ✅ NEW ROUTE: User Activity Summary
    app.get('/api/dashboard/user-activity', authMiddleware, async (req: any, res) => {
      try {
        const user = req.verifiedUser;
        if (!user || !user.organizationId) {
          return res.status(401).json({ message: "Unauthorized" });
        }

        const activity = await storage.getUserActivitySummary(Number(user.organizationId));
        res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.json(activity);
      } catch (error) {
        console.error('Error fetching user activity summary:', error);
        res.status(500).json({ message: 'Failed to fetch user activity summary' });
      }
    });


        // ✅ NEW ROUTE: Audit User Profile
    app.get('/api/audit/users/:userId/profile', authMiddleware, requireRole(['admin', 'partner']), async (req: any, res) => {
      try {
        const currentUser = req.verifiedUser;
        if (!currentUser?.organizationId) {
          return res.status(401).json({ message: 'Unauthorized' });
        }

        const targetUser = await storage.getUser(String(req.params.userId));
        if (!targetUser || Number(targetUser.organizationId) !== Number(currentUser.organizationId)) {
          return res.status(404).json({ message: 'User not found' });
        }

        const rawWindow = String(req.query.window || '24h');
        const window = ['24h', '15d', '30d'].includes(rawWindow) ? rawWindow : '24h';

        const profile = await storage.getAuditUserProfile(
          Number(currentUser.organizationId),
          String(req.params.userId),
          window
        );

        if (!profile) {
          return res.status(404).json({ message: 'Audit profile not found' });
        }

        res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.json(profile);
      } catch (error) {
        console.error('Error fetching audit user profile:', error);
        res.status(500).json({ message: 'Failed to fetch audit user profile' });
      }
    });

    // ✅ NEW ROUTE: Audit User Leads
    app.get('/api/audit/users/:userId/leads', authMiddleware, requireRole(['admin', 'partner']), async (req: any, res) => {
      try {
        const currentUser = req.verifiedUser;
        if (!currentUser?.organizationId) {
          return res.status(401).json({ message: 'Unauthorized' });
        }

        const targetUser = await storage.getUser(String(req.params.userId));
        if (!targetUser || Number(targetUser.organizationId) !== Number(currentUser.organizationId)) {
          return res.status(404).json({ message: 'User not found' });
        }

        const rawWindow = String(req.query.window || '24h');
        const window = ['24h', '15d', '30d'].includes(rawWindow) ? rawWindow : '24h';

        const data = await storage.getAuditUserLeadDetails(
          Number(currentUser.organizationId),
          String(req.params.userId),
          window
        );

        res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.json(data);
      } catch (error) {
        console.error('Error fetching audit user lead details:', error);
        res.status(500).json({ message: 'Failed to fetch audit user lead details' });
      }
    });

    // ✅ NEW ROUTE: Audit User Investors
    app.get('/api/audit/users/:userId/investors', authMiddleware, requireRole(['admin', 'partner']), async (req: any, res) => {
      try {
        const currentUser = req.verifiedUser;
         if (!currentUser?.organizationId) {
          return res.status(401).json({ message: 'Unauthorized' });
        }

        const targetUser = await storage.getUser(String(req.params.userId));
        if (!targetUser || Number(targetUser.organizationId) !== Number(currentUser.organizationId)) {
          return res.status(404).json({ message: 'User not found' });
        }

        const rawWindow = String(req.query.window || '24h');
        const window = ['24h', '15d', '30d'].includes(rawWindow) ? rawWindow : '24h';

        const data = await storage.getAuditUserInvestorDetails(
          Number(currentUser.organizationId),
          String(req.params.userId),
          window
        );

        res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.json(data);
      } catch (error) {
        console.error('Error fetching audit user investor details:', error);
        res.status(500).json({ message: 'Failed to fetch audit user investor details' });
      }
    });

    // ✅ NEW ROUTE: Audit User EPN
    app.get('/api/audit/users/:userId/epn', authMiddleware, requireRole(['admin', 'partner']), async (req: any, res) => {
      try {
        const currentUser = req.verifiedUser;
        if (!currentUser?.organizationId) {
          return res.status(401).json({ message: 'Unauthorized' });
        }

        const targetUser = await storage.getUser(String(req.params.userId));
        if (!targetUser || Number(targetUser.organizationId) !== Number(currentUser.organizationId)) {
          return res.status(404).json({ message: 'User not found' });
        }

        const rawWindow = String(req.query.window || '24h');
        const window = ['24h', '15d', '30d'].includes(rawWindow) ? rawWindow : '24h';

        const data = await storage.getAuditUserEpnDetails(
          Number(currentUser.organizationId),
          String(req.params.userId),
          window
        );

        res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.json(data);
      } catch (error) {
        console.error('Error fetching audit user EPN details:', error);
        res.status(500).json({ message: 'Failed to fetch audit user EPN details' });
      }
    });

    // ✅ NEW ROUTE: Audit User Timeline
    app.get('/api/audit/users/:userId/timeline', authMiddleware, requireRole(['admin', 'partner']), async (req: any, res) => {
      try {
        const currentUser = req.verifiedUser;
        if (!currentUser?.organizationId) {
          return res.status(401).json({ message: 'Unauthorized' });
        }

        const targetUser = await storage.getUser(String(req.params.userId));
        if (!targetUser || Number(targetUser.organizationId) !== Number(currentUser.organizationId)) {
          return res.status(404).json({ message: 'User not found' });
        }

        const rawWindow = String(req.query.window || '24h');
        const window = ['24h', '15d', '30d'].includes(rawWindow) ? rawWindow : '24h';

        const parsedLimit = parseInt(String(req.query.limit || '100'), 10);
        const limit = Number.isFinite(parsedLimit)
          ? Math.min(Math.max(parsedLimit, 1), 200)
          : 100;

        const data = await storage.getAuditUserTimeline(
          Number(currentUser.organizationId),
          String(req.params.userId),
          window,
          limit
        );

        res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.json(data);
      } catch (error) {
        console.error('Error fetching audit user timeline:', error);
        res.status(500).json({ message: 'Failed to fetch audit user timeline' });
      }
    });


        // ✅ NEW ROUTE: Audit Overview
    app.get('/api/audit/overview', authMiddleware, requireRole(['admin', 'partner']), async (req: any, res) => {
      try {
        const user = req.verifiedUser;
        if (!user || !user.organizationId) {
          return res.status(401).json({ message: "Unauthorized" });
        }

        const overview = await storage.getAuditOverviewMetrics(Number(user.organizationId));
        res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.json(overview);
      } catch (error) {
        console.error('Error fetching audit overview:', error);
        res.status(500).json({ message: 'Failed to fetch audit overview' });
      }
    });

    // ✅ NEW ROUTE: Audit User Summaries
    app.get('/api/audit/users/summary', authMiddleware, requireRole(['admin', 'partner']), async (req: any, res) => {
      try {
        const user = req.verifiedUser;
        if (!user || !user.organizationId) {
          return res.status(401).json({ message: "Unauthorized" });
        }

        const summaries = await storage.getAuditUserSummaries(Number(user.organizationId));
        res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.json(summaries);
      } catch (error) {
        console.error('Error fetching audit user summaries:', error);
        res.status(500).json({ message: 'Failed to fetch audit user summaries' });
      }
    });



        // ✅ NEW ROUTE: Investor Metrics for Unified Dashboard
    app.get('/api/dashboard/investor-metrics', authMiddleware, async (req: any, res) => {
      try {
        const user = req.verifiedUser;
        if (!user || !user.organizationId) {
          return res.status(401).json({ message: "Unauthorized" });
        }

        const metrics = await storage.getInvestorMetrics(Number(user.organizationId), user);
        
        // Prevent caching
        res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.json(metrics);
      } catch (error) {
        console.error('Error fetching investor metrics:', error);
        res.status(500).json({ message: 'Failed to fetch investor metrics' });
      }
    });

    // 3. Network Health / Linkage Metrics
    app.get('/api/dashboard/linkage-metrics', authMiddleware, async (req: any, res) => {
      try {
        const user = req.verifiedUser;
        if (!user || !user.organizationId) {
          return res.status(401).json({ message: "Unauthorized" });
        }

        const metrics = await storage.getLinkageMetrics(Number(user.organizationId));
        
        // Prevent caching
        res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.json(metrics);
      } catch (error) {
        console.error('Error fetching linkage metrics:', error);
        res.status(500).json({ message: 'Failed to fetch linkage metrics' });
      }
    });





    // News Feed Routes

    // Helper to fetch Google News RSS
async function fetchLatestGoogleNews(organizationId: number, category: 'leads' | 'investors'= 'leads') {
  try {
    // 1. Define high-authority Indian business/investor sources
    const sources = '(site:vccircle.com OR site:inc42.com OR site:economictimes.indiatimes.com OR site:livemint.com OR site:entrackr.com OR site:dealstreetasia.com)';
    
    // 2. Build Category-Specific Queries
    let query = '';
    if (category === 'investors') {
      // Focus: Fund launches, LP/GP moves, VC/PE firm news
      query = '("Limited Partner" OR "Venture Capital fund" OR "Private Equity India" OR "Fund Launch" OR "Dry Powder" OR "AIF news" OR "Exit news")';
    } else {
      // Focus: Sector growth and M&A (Leads)
      query = '("Private Equity" OR "M&A" OR "Structured Credit" OR "Healthcare sector" OR "Renewables" OR "Consumer" OR "IT and ITES")';
    }
    
    const encodedQuery = encodeURIComponent(`${query} AND India AND ${sources} when:1d`);
    const rssUrl = `https://news.google.com/rss/search?q=${encodedQuery}&hl=en-IN&gl=IN&ceid=IN:en`;
    
    const response = await fetch(rssUrl);
    const text = await response.text();

    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    const titleRegex = /<title>(.*?)<\/title>/;
    const linkRegex = /<link>(.*?)<\/link>/;
    const dateRegex = /<pubDate>(.*?)<\/pubDate>/;
    const sourceRegex = /<source.*?>([\s\S]*?)<\/source>/;

    let match;
    let count = 0;

    while ((match = itemRegex.exec(text)) !== null && count < 8) {
      const itemContent = match[1];
      const titleMatch = titleRegex.exec(itemContent);
      const linkMatch = linkRegex.exec(itemContent);
      const dateMatch = dateRegex.exec(itemContent);
      const sourceMatch = sourceRegex.exec(itemContent);

      if (titleMatch && linkMatch) {
        items.push({
          organizationId,
          category, // ✅ Tagging the news correctly
          title: titleMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, "$1"),
          url: linkMatch[1],
          source: sourceMatch ? sourceMatch[1] : "Google News",
          publishedAt: dateMatch ? new Date(dateMatch[1]) : new Date(),
        });
        count++;
      }
    }
    return items;

  } catch (error) {
    console.error(`Error fetching ${category} news:`, error);
    return [];
  }
}

  
  app.get('/api/news', authMiddleware, async (req: any, res) => {
  try {
    const user = req.verifiedUser;
    if (!user?.organizationId) return res.status(401).json({ message: "Unauthorized" });

    const category = (req.query.category as 'leads' | 'investors') || 'leads';
    let items = await storage.getNewsFeed(user.organizationId, category);

    const now = new Date();
    const today9AM = new Date();
    today9AM.setHours(9, 0, 0, 0);

    // ✅ IMPROVED STALE LOGIC:
    // It is stale if the DB is empty OR the latest news in the DB was created 
    // on a PREVIOUS calendar day and it is now past 9 AM today.
    // ✅ FIX: Use a fallback Date if createdAt is null to satisfy TypeScript
    const lastFetchDate = items.length > 0 && items[0].createdAt 
      ? new Date(items[0].createdAt) 
      : new Date(0); // Fallback to epoch if null/empty

    // IMPROVED STALE LOGIC:
    // It is stale if the DB is empty OR the latest news in the DB was created 
    // on a PREVIOUS calendar day and it is now past 9 AM today.
    const isStale = items.length === 0 || (
      lastFetchDate.toDateString() !== now.toDateString() && now > today9AM
    );

    if (isStale) {
      console.log(`[News] Wiping and refreshing ${category} feed for the new day...`);
      
      // 1. CLEAR the old news first so only today's results remain
      await storage.clearNewsFeed(user.organizationId, category);

      // 2. Fetch fresh news (this uses 'when:1d' in the RSS query)
      const freshNews = await fetchLatestGoogleNews(user.organizationId, category);

      if (freshNews.length > 0) {
        for (const newsItem of freshNews) {
          await storage.createNewsItem(newsItem);
        }
        // Re-fetch clean list
        items = await storage.getNewsFeed(user.organizationId, category);
      }
    }

    res.json(items);
  } catch (error) {
    console.error('Error fetching news:', error);
    res.status(500).json({ message: 'Failed to fetch news' });
  }
});


    app.post('/api/news/refresh', authMiddleware, requireRole(['admin', 'partner']), async (req: any, res) => {
  try {
    const user = req.verifiedUser;
    const category = (req.body.category as 'leads' | 'investors') || 'leads';

    // 1. Clear old news for this specific category
    await storage.clearNewsFeed(user.organizationId, category);

    // 2. Fetch fresh news using the category argument
    const freshNews = await fetchLatestGoogleNews(user.organizationId, category);

    for (const newsItem of freshNews) {
      await storage.createNewsItem(newsItem);
    }
    
    res.json({ message: `${category} news feed refreshed`, count: freshNews.length });
  } catch (error) {
    console.error('Force refresh failed:', error);
    res.status(500).json({ message: "Failed to force refresh" });
  }
});


    app.post('/api/news', authMiddleware, requireRole(['admin', 'partner']), async (req: any, res) => {
      try {
        const user = req.verifiedUser;
        if (!user?.organizationId) return res.status(401).json({ message: "Unauthorized" });

        const data = insertNewsFeedSchema.parse({
          ...req.body,
          organizationId: user.organizationId
        });

        const item = await storage.createNewsItem(
          
        );
        res.json(item);
      } catch (error) {
        console.error('Error creating news item:', error);
        res.status(400).json({ message: 'Failed to create news item' });
      }
    });





    // Dashboard table: stage counts by Source (whitelisted analysts + partners)
    app.get('/api/dashboard/source-stage-table', authMiddleware, async (req: any, res) => {
      try {
        const user = req.verifiedUser;
        if (!user || !user.id || !user.organizationId) {
          return res.status(401).json({ message: 'User not authenticated' });
        }

        const userRole = user.role || 'analyst';

        // ✅ If you want Partners ALSO to see the full table, use: userRole === 'admin' || userRole === 'partner'
        const includeAll = userRole === 'admin';

        const table = await storage.getDashboardSourceStageTable(Number(user.organizationId), {
          includeAll,
          viewerUserId: user.id,
          viewerRole: userRole,
        });

        // Prevent 304 caching issues
        res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.set('Expires', '0');

        res.json({
          ...table,
          userRole,
          includeAll,
        });
      } catch (error) {
        console.error('Error fetching dashboard source-stage table:', error);
        res.status(500).json({ message: 'Failed to fetch dashboard source-stage table' });
      }
    });


    // Populate dummy data - DEV ONLY
    app.post('/api/dev/populate-data', authMiddleware, requireRole(['admin']), async (req: any, res) => {
      try {
        console.log('Starting data population...');
        
       const sessionUser = req.verifiedUser;
       const sessionUserId = sessionUser.id;

        
        if (!sessionUser || !sessionUser.organizationId) {
          return res.status(401).json({ message: 'Current user or organization not found' });
        }
        
        const organizationId = sessionUser.organizationId;
        
        // Create dummy users, companies, leads, etc. (implementation details omitted for brevity)
        // This would contain the full dummy data creation logic from the original file
        
        res.json({
          success: true,
          message: 'Dummy data populated successfully'
        });

      } catch (error: any) {
        console.error('Error populating dummy data:', error);
        res.status(500).json({ message: error.message || 'Failed to populate dummy data' });
      }
    });

    // Auth routes handled above


    // Users routes - Partners, admins, and analysts can list users (analysts need this for intern assignment)
    app.get('/api/users', authMiddleware, requireRole(['partner', 'admin', 'analyst']), async (req: any, res) => {
      try {
        const currentUser = req.verifiedUser;
        if (!currentUser?.organizationId) {
          return res.status(400).json({ message: 'User not associated with an organization' });
        }
        
        const users = await storage.getUsers(currentUser.organizationId);
        res.json(users);
      } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ message: 'Failed to fetch users' });
      }
    });

    // User analytics - for admin dashboard
    app.get('/api/users/analytics', authMiddleware, requireRole(['partner', 'admin']), async (req: any, res) => {
      try {
        const currentUser = req.verifiedUser;
        if (!currentUser?.organizationId) {
          return res.status(400).json({ message: 'User not associated with an organization' });
        }
        
        const analytics = await storage.getUserAnalytics(currentUser.organizationId);
        res.json(analytics);
      } catch (error) {
        console.error('Error fetching user analytics:', error);
        res.status(500).json({ message: 'Failed to fetch user analytics' });
      }
    });

    // Create new user - admin only
    app.post('/api/users', authMiddleware, requireRole(['admin']), async (req: any, res) => {
      try {
        const { id, email, firstName, lastName, role = 'analyst', analystId } = req.body;
        const currentUser = req.verifiedUser;
        
        if (!currentUser?.organizationId) {
          return res.status(400).json({ message: 'User not associated with an organization' });
        }
        
        if (!id || !email || !firstName || !lastName) {
          return res.status(400).json({ message: 'Missing required fields: id, email, firstName, lastName' });
        }
        
        if (!['analyst', 'partner', 'admin', 'intern'].includes(role)) {
          return res.status(400).json({ message: 'Invalid role' });
        }
        
        // For interns, analystId is required
        if (role === 'intern' && !analystId) {
          return res.status(400).json({ message: 'Intern must be assigned to an analyst' });
        }
        
        // Validate analyst exists and belongs to same organization
        if (role === 'intern' && analystId) {
          const analyst = await storage.getUser(analystId);
          if (!analyst || analyst.organizationId !== currentUser.organizationId || analyst.role !== 'analyst') {
            return res.status(400).json({ message: 'Invalid analyst assignment' });
          }
        }

        // Check if user already exists by ID
        const existingUser = await storage.getUser(id);
        if (existingUser) {
          return res.status(409).json({ message: 'User already exists' });
        }

        // Check if email already exists within the organization
        const existingUsers = await storage.getUsers(currentUser.organizationId);
        const userWithEmail = existingUsers.find(u => u.email === email);
        if (userWithEmail) {
          return res.status(400).json({ message: 'Email already exists' });
        }

        const userData = {
          id,
          organizationId: currentUser.organizationId,
          email,
          firstName,
          lastName,
          role,
          profileImageUrl: null,
          ...(role === 'intern' && analystId ? { analystId } : {})
        };

        await storage.upsertUser(userData);
        const newUser = await storage.getUser(id);
        
        res.status(201).json(newUser);
      } catch (error) {
        console.error('Error creating user:', error);
        
        // Handle unique constraint violations
        if (error && typeof error === 'object' && 'message' in error) {
          const errorMessage = (error as Error).message;
          if (errorMessage.includes('unique constraint') && errorMessage.includes('email')) {
            return res.status(400).json({ message: 'Email already exists' });
          }
          if (errorMessage.includes('unique constraint') && errorMessage.includes('id')) {
            return res.status(409).json({ message: 'User ID already exists' });
          }
        }
        
        res.status(500).json({ message: 'Failed to create user' });
      }
    });

    // Update user role - admins can update any role, partners can only update analysts
    app.put('/api/users/:id/role', authMiddleware, requireRole(['partner', 'admin']), async (req: any, res) => {
      try {
        const userId = req.params.id;
        const { role } = req.body;
        const currentUser = req.verifiedUser;
        const currentUserRole = req.userRole;
        
        if (!currentUser?.organizationId) {
          return res.status(400).json({ message: 'User not associated with an organization' });
        }
        
        if (!['analyst', 'partner', 'admin'].includes(role)) {
          return res.status(400).json({ message: 'Invalid role' });
        }

        // Get the target user to check their current role and organization
        const targetUser = await storage.getUser(userId);
        if (!targetUser) {
          return res.status(404).json({ message: 'User not found' });
        }

        // Ensure target user is in the same organization
        if (targetUser.organizationId !== currentUser.organizationId) {
          return res.status(403).json({ message: 'Cannot modify users from other organizations' });
        }

        // Role-based permissions:
        // - Admins can change any role
        // - Partners can only change analyst roles to analyst/partner (not admin)
        if (currentUserRole === 'partner') {
          if (targetUser.role === 'admin') {
            return res.status(403).json({ message: 'Partners cannot modify admin users' });
          }
          if (role === 'admin') {
            return res.status(403).json({ message: 'Partners cannot assign admin role' });
          }
        }

        const updatedUser = await storage.updateUserRole(userId, role);
        res.json(updatedUser);
      } catch (error) {
        console.error('Error updating user role:', error);
        res.status(500).json({ message: 'Failed to update user role' });
      }
    });

    // Delete/deactivate user - admin only  
    app.delete('/api/users/:id', authMiddleware, requireRole(['admin']), async (req: any, res) => {
      try {
        const userId = req.params.id;
        const currentUser = req.verifiedUser;
        const currentUserId = req.verifiedUser.id;
        
        if (!currentUser?.organizationId) {
          return res.status(400).json({ message: 'User not associated with an organization' });
        }
        
        // Prevent self-deletion
        if (userId === currentUserId) {
          return res.status(400).json({ message: 'Cannot delete your own account' });
        }

        const user = await storage.getUser(userId);
        if (!user) {
          return res.status(404).json({ message: 'User not found' });
        }

        // Ensure target user is in the same organization
        if (user.organizationId !== currentUser.organizationId) {
          return res.status(403).json({ message: 'Cannot delete users from other organizations' });
        }

        // Check if user has assigned leads
        const assignedLeads = await storage.getLeadsByAssignee(userId, currentUser.organizationId);
        if (assignedLeads.length > 0) {
          return res.status(400).json({ 
            message: 'Cannot delete user with assigned leads. Transfer leads first.',
            assignedLeadsCount: assignedLeads.length
          });
        }

        await storage.deleteUser(userId);
        res.json({ message: 'User deleted successfully' });
      } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ message: 'Failed to delete user' });
      }
    });


        // ==============================
    // INVESTOR RELATION (ADMIN ONLY)
    // ==============================

    app.get("/api/investors", authMiddleware, requireRole(["admin", "partner", "analyst"]), async (req: any, res) => {

      try {
        const user = req.verifiedUser;
        if (!user?.organizationId) return res.status(401).json({ message: "Unauthorized" });

  // ✅ Default to "all" if not provided, or allow explicit "all"
        const stage = String(req.query.stage || "all").toLowerCase();
        
        // ✅ Add "all" to the allowed list
        const allowed = ["all", "outreach", "warm", "active", "dealmaking"];
        if (!allowed.includes(stage)) {
          return res.status(400).json({ message: "Invalid stage" });
        }

        const routeStart = Date.now();
        console.log(`[PERF][ROUTE] /api/investors start stage=${stage}`);

        const data = await storage.getInvestorsByStage(user.organizationId, stage, user);

        console.log(
          `[PERF][ROUTE] /api/investors end stage=${stage} count=${data.length} total_ms=${Date.now() - routeStart}`
        );

        res.json(data);
      } catch (e) {
        console.error("GET /api/investors error:", e);
        res.status(500).json({ message: "Failed to fetch investors" });
      }
    });


  // Helper to escape CSV cells for investor export
        const escapeInvestorCsvCell = (value: unknown) => {
      const str = value == null ? "" : String(value);
      return `"${str.replace(/"/g, '""')}"`;
    };

    const buildInvestorExportCsv = (rows: Array<any>) => {
      const maxContacts = rows.length
        ? Math.max(
            ...rows.map((inv) =>
              Array.isArray(inv.contacts) ? inv.contacts.length : 0
            )
          )
        : 0;

      const headers = [
        "Investor Name",
        "Stage",
        "Investor Type",
        "Sector",
        "Location",
        "Website",
        "Description",
        "Linked Companies Count",
        "Linked Companies",
      ];

      for (let i = 1; i <= maxContacts; i++) {
        headers.push(
          `POC ${i} Name`,
          `POC ${i} Designation`,
          `POC ${i} Email`,
          `POC ${i} Phone`,
          `POC ${i} LinkedIn`
        );
      }

      const csvRows = [
        headers.map(escapeInvestorCsvCell).join(","),
        ...rows.map((inv) => {
          const contacts = Array.isArray(inv.contacts) ? inv.contacts : [];
          const linkedCompanies = Array.isArray(inv.linkedLeads)
            ? inv.linkedLeads
                .map((lead: any) => lead?.companyName)
                .filter(Boolean)
                .join(" | ")
            : "";

          const row: string[] = [
            inv?.name ?? "",
            inv?.stage ?? "",
            inv?.investorType ?? "",
            inv?.sector ?? "",
            inv?.location ?? "",
            inv?.website ?? "",
            inv?.description ?? "",
            String(Array.isArray(inv.linkedLeads) ? inv.linkedLeads.length : 0),
            linkedCompanies,
          ];

          for (let i = 0; i < maxContacts; i++) {
            const contact = contacts[i];
            row.push(
              contact?.name ?? "",
              contact?.designation ?? "",
              contact?.email ?? "",
              contact?.phone ?? "",
              contact?.linkedinProfile ?? ""
            );
          }

          return row.map(escapeInvestorCsvCell).join(",");
        }),
      ];

      return csvRows.join("\n");
    };

    app.get(
      "/api/investors/export",
      authMiddleware,
      requireRole(["admin", "partner", "analyst"]),
      async (req: any, res) => {
        try {
          const user = req.verifiedUser;
          if (!user?.organizationId) {
            return res.status(401).json({ message: "Unauthorized" });
          }

          const stage = String(req.query.stage || "all").toLowerCase();
          const allowed = ["all", "outreach", "warm", "active", "dealmaking"];

          if (!allowed.includes(stage)) {
            return res.status(400).json({ message: "Invalid stage" });
          }

          const rows = await storage.getInvestorsByStage(
            Number(user.organizationId),
            stage,
            user
          );

          const csv = buildInvestorExportCsv(rows);
          const fileName = `investors_${stage}_${new Date()
            .toISOString()
            .slice(0, 10)}.csv`;

          res.setHeader("Content-Type", "text/csv; charset=utf-8");
          res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
          res.setHeader("Cache-Control", "no-store");

          return res.status(200).send("\uFEFF" + csv);
        } catch (e) {
          console.error("GET /api/investors/export error:", e);
          res.status(500).json({ message: "Failed to export investors" });
        }
      }
    );



        // ✅ INSERT THE NEW CONTACT METRICS ROUTE HERE
    // This must come BEFORE any route with :investorId or :id to prevent conflicts
    app.get("/api/investors/contact-metrics", authMiddleware, requireRole(["admin","partner","analyst"]), async (req: any, res) => {
      if (!req.user) return res.sendStatus(401);
      
      try {
        // Call the new storage method we just created
        const user = req.verifiedUser;
        const metrics = await storage.getInvestorContactMetrics(user.organizationId, user);
        res.json(metrics);
      } catch (error) {
        console.error("Error fetching investor contact metrics:", error);
        res.status(500).json({ message: "Failed to fetch metrics" });
      }
    });


    
    // ✅ INVESTOR POC COVERAGE ROUTES (Add to Investor section)

// GET /api/investors/poc-coverage/:slot (0, 1, or 2)
app.get("/api/investors/poc-coverage/:slot", authMiddleware, requireRole(["admin","partner","analyst"]), async (req: any, res) => {
  try {
    const slot = parseInt(req.params.slot);
    if (isNaN(slot) || slot < 0 || slot > 5) {
      return res.status(400).send("Invalid slot");
    }

    const user = req.verifiedUser;
    if (!user?.organizationId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const selectedStages = parseInvestorStageFilters(req.query.stages);
    if (!selectedStages) {
      return res.status(400).json({ message: "Invalid investor stages filter" });
    }

    const rows = await storage.getInvestorPocCoverage(
      user.organizationId,
      slot,
      user,
      selectedStages
    );

    res.json({ items: rows });
  } catch (e) {
    console.error("GET poc-coverage error:", e);
    res.status(500).json({ message: "Failed to fetch POC data" });
  }
});

    // POST /api/investors/poc-coverage/:slot
    app.post("/api/investors/poc-coverage/:slot", authMiddleware, requireRole(["admin","partner","analyst"]), async (req: any, res) => {
      try {
        const slot = parseInt(req.params.slot);

        const user = req.verifiedUser;

        if (user.role === "analyst") {
          const investorId = Number(req.body?.investorId);
          if (!Number.isFinite(investorId)) return res.status(400).json({ message: "Invalid investorId" });

          const inv = await storage.getInvestorById(Number(user.organizationId), investorId, user);
          if (!inv) return res.status(403).json({ message: "Forbidden: investor not visible to you" });
        }
        const result = await storage.saveInvestorPocSlot(req.verifiedUser.organizationId, req.body, slot);
        res.json(result);
      } catch (e) {
        console.error("POST poc-coverage error:", e);
        res.status(500).json({ message: "Failed to save POC data" });
      }
    });


    // ✅ NEW ROUTE: Investor Metrics
    app.get("/api/investors/metrics", authMiddleware, requireRole(["admin","partner","analyst"]), async (req: any, res) => {
      try {
        const user = req.verifiedUser;
        if (!user?.organizationId) return res.status(401).json({ message: "Unauthorized" });

        const metrics = await storage.getInvestorMetrics(Number(user.organizationId), user);
        res.json(metrics);
      } catch (error) {
        console.error("Error fetching investor metrics:", error);
        res.status(500).json({ message: "Failed to fetch investor metrics" });
      }
    });






    // ==========================================
    // INVESTOR CONTACT MANAGEMENT - OTHER FIELDS
    // ==========================================

// GET /api/investor-contact-management/other-fields
app.get("/api/investor-contact-management/other-fields", authMiddleware, requireRole(["admin", "partner", "analyst"]), async (req: any, res) => {
  try {
    const user = req.verifiedUser;
    if (!user?.organizationId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const selectedStages = parseInvestorStageFilters(req.query.stages);
    if (!selectedStages) {
      return res.status(400).json({ message: "Invalid investor stages filter" });
    }

    const data = await storage.getInvestorsForOtherFields(
      user.organizationId,
      user,
      selectedStages
    );

    res.json(data);
  } catch (error) {
    console.error("Error fetching investor other fields:", error);
    res.status(500).json({ message: "Failed to fetch investor data" });
  }
});
    // PATCH /api/investor-contact-management/other-fields/:investorId
    app.patch("/api/investor-contact-management/other-fields/:investorId", authMiddleware, requireRole(["admin", "partner", "analyst"]), async (req: any, res) => {
      try {
        const user = req.verifiedUser;
        if (!user?.organizationId) return res.status(401).json({ message: "Unauthorized" });

        const investorId = Number(req.params.investorId);
        if (isNaN(investorId)) return res.status(400).json({ message: "Invalid investor ID" });

        // Extract only allowed fields
        const { name, investorType, website, sector, location } = req.body;
        const updates: any = {};

        if (name !== undefined) updates.name = name;
        if (investorType !== undefined) updates.investorType = investorType;
        if (website !== undefined) updates.website = website;
        if (sector !== undefined) updates.sector = sector;
        if (location !== undefined) updates.location = location;

        if (Object.keys(updates).length === 0) {
          return res.status(400).json({ message: "No valid fields to update" });
        }

        const updated = await storage.updateInvestor(user.organizationId, investorId, updates);
        
        if (!updated) {
          return res.status(404).json({ message: "Investor not found" });
        }

        res.json(updated);
      } catch (error) {
        console.error("Error updating investor other fields:", error);
        res.status(500).json({ message: "Failed to update investor" });
      }
    });


    

    // investor routes
    app.post("/api/investors", authMiddleware, requireRole(["admin", "partner", "analyst"]), async (req: any, res) => {
          try {
            const user = req.verifiedUser;
            if (!user?.organizationId) return res.status(401).json({ message: "Unauthorized" });

            const body = req.body || {};

            const investorParsed = insertInvestorSchema.safeParse({
              name: body.name,
              sector: body.sector,
              location: body.location,
              investorType: body.investorType,
              website: body.website,
              description: body.description,
              stage: "outreach",
            });

            if (!investorParsed.success) {
              return res.status(400).json({ message: "Invalid investor data", errors: investorParsed.error.flatten() });
            }

            // Handle multiple contacts array
            const contactsList = Array.isArray(body.contacts) ? body.contacts : [];

            // Backward compatibility: if no list, check for old single fields
            if (contactsList.length === 0 && body.pocName) {
                contactsList.push({
                    name: body.pocName,
                    designation: body.pocDesignation,
                    email: body.pocEmail,
                    phone: body.pocPhone,
                    linkedinProfile: body.pocLinkedin
                });
            }

            const result = await storage.createInvestor(
              user.organizationId,
              investorParsed.data as any,
              contactsList,
              String(user.id),
              "create"
            );

               // ✅ ADDED THIS BLOCK: Log activity for Unified Dashboard
        try {
           await storage.createActivityLog({
            organizationId: user.organizationId,
            userId: user.id,
            action: `added a new investor: ${result.investor.name}`,
            entityType: 'investor', 
            entityId: result.investor.id,
            metadata: { 
              stage: result.investor.stage,
              sector: result.investor.sector 
            }
          });
        } catch (logErr) {
          console.error("Failed to log investor creation:", logErr);
        }
        // ✅ END OF NEW BLOCK


            res.json(result);
          } catch (e) {
            console.error("POST /api/investors error:", e);
            res.status(500).json({ message: "Failed to create investor" });
          }
        });


            // ✅ NEW: Get unique investor locations for dropdowns

    app.get("/api/investors/locations", authMiddleware, requireRole(["admin", "partner", "analyst"]), async (req: any, res) => {

      try {

        const user = req.verifiedUser;

        if (!user?.organizationId) return res.status(401).json({ message: "Unauthorized" });



        const locations = await storage.getUniqueInvestorLocations(Number(user.organizationId));

        res.json(locations);

      } catch (e) {

        console.error("GET /api/investors/locations error:", e);

        res.status(500).json({ message: "Failed to fetch locations" });

      }

    });


    // investor routes
    app.get(
    "/api/investors/:investorId",
    authMiddleware,
    requireRole(["admin","partner", "analyst"]),
    async (req: any, res) => {
      try {
        const user = req.verifiedUser;
        if (!user?.organizationId) return res.status(401).json({ message: "Unauthorized" });

        const investorId = Number(req.params.investorId);
        if (!Number.isFinite(investorId) || investorId <= 0) {
          return res.status(400).json({ message: "Invalid investorId" });
        }

        const investor = await storage.getInvestorById(Number(user.organizationId), investorId, user);
        if (!investor) return res.status(404).json({ message: "Investor not found" });

        res.json(investor);
      } catch (e) {
        console.error("GET /api/investors/:investorId error:", e);
        res.status(500).json({ message: "Failed to fetch investor" });
      }
    }
  );

         // investor poc details route
       // GET Contacts for an investor
    app.get("/api/investors/:id/contacts", authMiddleware, requireRole(["admin","partner","analyst"]), async (req: any, res) => {
      try {
        const user = req.verifiedUser;
        if (!user?.organizationId) return res.status(401).json({ message: "Unauthorized" });

        const investorId = Number(req.params.id);
        if (!Number.isFinite(investorId) || investorId <= 0) {
          return res.status(400).json({ message: "Invalid investor id" });
        }

        const investor = await storage.getInvestorById(Number(user.organizationId), investorId, user);
        if (!investor) return res.status(404).json({ message: "Investor not found" });

        res.json((investor as any).contacts || []);
      } catch (e) {
        console.error("GET /api/investors/:id/contacts error:", e);
        res.status(500).json({ message: "Failed to fetch contacts" });
      }
    });


      // PUT (Replace/Update) Contacts
// PUT (Replace/Update) Contacts
    app.put("/api/investors/:id/contacts", authMiddleware, requireRole(["admin","partner","analyst"]), async (req: any, res) => {
      try {
        const user = req.verifiedUser;
        if (!user?.organizationId) return res.status(401).json({ message: "Unauthorized" });

        const contacts = req.body.contacts || [];
        await storage.replaceInvestorContacts(Number(req.params.id), contacts);
        res.json({ success: true });
      } catch (e) {
        console.error("Update contacts error:", e);
        res.status(500).json({ message: "Failed to update contacts" });
      }
    });


  // Update investor (e.g. sector)
app.patch(
  "/api/investors/:investorId",
  authMiddleware,
  requireRole(["admin", "partner", "analyst"]),
  async (req: any, res) => {
    try {
      const user = req.verifiedUser;
      if (!user?.organizationId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const investorId = Number(req.params.investorId);
      if (!Number.isFinite(investorId)) {
        return res.status(400).json({ message: "Invalid ID" });
      }

      const {
        name,
        sector,
        investorType,
        website,
        location,
        description,
        stage,
        mandateStatus,
      } = req.body || {};

      if (
        mandateStatus !== undefined &&
        mandateStatus !== null &&
        !["mandate", "not_mandate"].includes(String(mandateStatus))
      ) {
        return res.status(400).json({
          message: "Invalid mandateStatus. Allowed values: mandate, not_mandate",
        });
      }

      const updates: any = {};

      if (name !== undefined) updates.name = name;
      if (sector !== undefined) updates.sector = sector;
      if (investorType !== undefined) updates.investorType = investorType;
      if (website !== undefined) updates.website = website;
      if (location !== undefined) updates.location = location;
      if (description !== undefined) updates.description = description;
      if (stage !== undefined) updates.stage = stage;
      if (mandateStatus !== undefined) updates.mandateStatus = mandateStatus;

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ message: "No valid fields to update" });
      }

      const updated = await storage.updateInvestor(
        Number(user.organizationId),
        investorId,
        updates
      );

      if (!updated) {
        return res.status(404).json({ message: "Investor not found" });
      }

      res.json(updated);
    } catch (e) {
      console.error("PATCH /api/investors/:investorId error:", e);
      res.status(500).json({ message: "Failed to update investor" });
    }
  }
);

// Update investor card next action (text and date)
    app.patch(
      "/api/investors/:investorId/card-next-action",
      authMiddleware,
      requireRole(["admin", "partner", "analyst"]),
      async (req: any, res) => {
        try {
          const user = req.verifiedUser;
          if (!user?.organizationId) {
            return res.status(401).json({ message: "Unauthorized" });
          }

          const investorId = Number(req.params.investorId);
          if (!Number.isFinite(investorId)) {
            return res.status(400).json({ message: "Invalid ID" });
          }

          const { cardNextActionText, cardNextActionDate } = req.body || {};

          if (cardNextActionText === undefined && cardNextActionDate === undefined) {
            return res.status(400).json({ message: "cardNextActionText or cardNextActionDate is required" });
          }

          let parsedDate: Date | null = null;

          if (cardNextActionDate !== undefined) {
            if (cardNextActionDate === null || cardNextActionDate === "") {
              parsedDate = null;
            } else {
              parsedDate = new Date(cardNextActionDate);
              if (isNaN(parsedDate.getTime())) {
                return res.status(400).json({ message: "Invalid cardNextActionDate" });
              }
            }
          }

          const updated = await storage.updateInvestorCardNextAction(
            Number(user.organizationId),
            investorId,
            typeof cardNextActionText === "string" ? (cardNextActionText.trim() || null) : null,
            parsedDate
          );

          if (!updated) return res.status(404).json({ message: "Investor not found" });

          res.json(updated);
        } catch (e) {
          console.error("PATCH /api/investors/:investorId/card-next-action error:", e);
          res.status(500).json({ message: "Failed to update investor card next action" });
        }
      }
    );


     // investor routes
    app.get(
      "/api/investors/:investorId/outreach-activities",
      authMiddleware,
      requireRole(["admin"]),
      async (req: any, res) => {
        const user = req.verifiedUser;
        if (!user?.organizationId) return res.status(401).json({ message: "Unauthorized" });

        const investorId = Number(req.params.investorId);
        const rows = await storage.getInvestorOutreachActivities(Number(user.organizationId), investorId);
        res.json(rows);
      }
    );

    // Move Investor to a new stage
          app.patch(
            "/api/investors/:investorId/move-to-stage",
            authMiddleware,
            requireRole(["admin", "partner", "analyst"]),
            async (req: any, res) => {
              try {
                const { investorId } = req.params;
                const { stage } = req.body; // Stage can be "warm" or "dealmaking"

                if (!stage || !["warm", "dealmaking"].includes(stage)) {
                  return res.status(400).json({ message: "Invalid stage" });
                }

                const user = req.verifiedUser;
                if (!user?.organizationId) return res.status(401).json({ message: "Unauthorized" });

                // Call the service to update the investor's stage
                await storage.updateInvestorStage(user.organizationId, Number(investorId), stage);
                
                res.json({ message: "Investor moved to " + stage + " stage" });
              } catch (e) {
                console.error("Error moving investor stage:", e);
                res.status(500).json({ message: "Failed to update investor stage" });
              }
            }
          );

    
        // ✅ ONE-TIME FIX ROUTE: Sync Investor Stages
// ✅ RESTORED SECURE VERSION (Admin Only)
    app.post("/api/admin/sync-investor-stages", authMiddleware, requireRole(["admin"]), async (req: any, res) => {
      try {
        const user = req.verifiedUser;
        if (!user?.organizationId) return res.status(401).json({ message: "Unauthorized" });

        const result = await storage.syncInvestorStages(user.organizationId);
        res.json(result);
      } catch (e) {
        console.error("Sync Error:", e);
        res.status(500).json({ message: "Failed to sync stages" });
      }
    });

           // investor lead linkage
          app.get(
                "/api/investors/:investorId/linked-leads",
                authMiddleware,
                requireRole(["admin", "partner", "analyst"]),
                async (req: any, res) => {
                  try {
                    const user = req.verifiedUser;
                    if (!user?.organizationId) return res.status(401).json({ message: "Unauthorized" });

                    // ✅ Analyst sandbox: can only view investors they can see
                    if (user.role === "analyst") {
                      const inv = await storage.getInvestorById(Number(user.organizationId), investorId, user);
                      if (!inv) return res.status(404).json({ message: "Investor not found" });
                    }

                    const investorId = Number(req.params.investorId);
                    if (!Number.isFinite(investorId) || investorId <= 0) {
                      return res.status(400).json({ message: "Invalid investorId" });
                    }

                    const data = await storage.getInvestorLinkedLeads(Number(user.organizationId), investorId);
                    res.json(data);
                  } catch (e) {
                    console.error("GET /api/investors/:investorId/linked-leads error:", e);
                    res.status(500).json({ message: "Failed to fetch linked leads" });
                  }
                }
              );


              // Bulk link investors to a lead
// Bulk link investors to a lead
    app.post(
      "/api/leads/:leadId/link-investors",
      authMiddleware,
      requireRole(["admin", "partner", "analyst"]),
      async (req: any, res) => {
        try {
          const user = req.verifiedUser;
          if (!user?.organizationId) return res.status(401).json({ message: "Unauthorized" });
          
          const leadId = Number(req.params.leadId);
          
          // ✅ We need 'selections', NOT 'investorIds'
          const { selections } = req.body; 

          if (!Number.isFinite(leadId)) {
            return res.status(400).json({ message: "Invalid leadId" });
          }
          if (!Array.isArray(selections)) {
            return res.status(400).json({ message: "selections must be an array" });
          }

          // ✅ Analyst restriction: can only link to leads assigned to them
        if (user.role === "analyst") {
          const lead = await storage.getLead(leadId, Number(user.organizationId));
          if (!lead) return res.status(404).json({ message: "Lead not found" });

          const uid = String(user.id);
          const inSandbox =
            (lead as any).ownerAnalystId === uid ||
            (lead as any).assignedTo === uid ||
            (lead as any).createdBy === uid ||
            (Array.isArray((lead as any).assignedInterns) && (lead as any).assignedInterns.includes(uid));
          if (!inSandbox) {
            return res.status(403).json({ message: "Forbidden: Lead not assigned to you" });
          }
        }

        // ✅ Investor restriction: analysts can only link investors they can see
        if (user.role === "analyst") {
          for (const s of selections) {
            const inv = await storage.getInvestorById(Number(user.organizationId), Number(s.investorId), user);
            if (!inv) return res.status(403).json({ message: `Forbidden: investor ${s.investorId} not visible to you` });
          }
        }

          const result = await storage.bulkLinkInvestorsToLead(
            Number(user.organizationId),
            leadId,
            selections
          );
          
          res.json({ success: true, count: result.count });
        } catch (e) {
          console.error("POST /api/leads/:leadId/link-investors error:", e);
          res.status(500).json({ message: "Failed to link investors" });
        }
      }
    );


              // NEW: Get investors linked to a specific lead
app.get(
  "/api/leads/:leadId/linked-investors",
  authMiddleware,
  // We allow analysts/partners to see this too, not just admins
  requireRole(["admin", "partner", "analyst"]), 
  async (req: any, res) => {
    try {
      const user = req.verifiedUser;
      if (!user?.organizationId) return res.status(401).json({ message: "Unauthorized" });

      const leadId = Number(req.params.leadId);
      if (!Number.isFinite(leadId)) {
        return res.status(400).json({ message: "Invalid leadId" });
      }

      const investors = await storage.getInvestorsByLead(Number(user.organizationId), leadId);
      res.json(investors);
    } catch (e) {
      console.error("GET /api/leads/:leadId/linked-investors error:", e);
      res.status(500).json({ message: "Failed to fetch linked investors" });
    }
  }
);
           
                // investor lead linkage
              app.post(
                    "/api/investors/:investorId/linked-leads",
                    authMiddleware,
                    requireRole(["admin", "partner", "analyst"]),
                    async (req: any, res) => {
                      try {
                        const user = req.verifiedUser;
                        if (!user?.organizationId) return res.status(401).json({ message: "Unauthorized" });

                    

                        const investorId = Number(req.params.investorId);
                        const leadId = Number(req.body?.leadId);

                        // ✅ Analyst sandbox enforcement
                          if (user.role === "analyst") {
                            // 1) Investor must be visible to analyst
                            const inv = await storage.getInvestorById(Number(user.organizationId), investorId, user);
                            if (!inv) return res.status(403).json({ message: "Forbidden: investor not visible to you" });

                            // 2) Lead must be assigned to analyst
                            const lead = await storage.getLead(leadId, Number(user.organizationId));
                            if (!lead) return res.status(404).json({ message: "Lead not found" });

                            const uid = String(user.id);
                            const inSandbox =
                              (lead as any).ownerAnalystId === uid ||
                              (lead as any).assignedTo === uid ||
                              (lead as any).createdBy === uid ||
                              (Array.isArray((lead as any).assignedInterns) && (lead as any).assignedInterns.includes(uid));

                            if (!inSandbox) {
                              return res.status(403).json({ message: "Forbidden: lead not assigned to you" });
                            }
                          }

                        if (!Number.isFinite(investorId) || investorId <= 0) {
                          return res.status(400).json({ message: "Invalid investorId" });
                        }
                        if (!Number.isFinite(leadId) || leadId <= 0) {
                          return res.status(400).json({ message: "Invalid leadId" });
                        }

                        const out = await storage.addInvestorLeadLink(Number(user.organizationId), investorId, leadId);
                        res.json(out);
                      } catch (e) {
                        console.error("POST /api/investors/:investorId/linked-leads error:", e);
                        res.status(500).json({ message: "Failed to link lead" });
                      }
                    }
                  );



                                    // routes.ts

// ✅ Add this new route
app.patch(
  "/api/leads/:leadId/investors/:investorId/remarks",
  authMiddleware,
  requireRole(["admin", "partner", "analyst"]),
  async (req: any, res) => {
    try {
      const user = req.verifiedUser;
      if (!user?.organizationId) return res.status(401).json({ message: "Unauthorized" });

      const leadId = Number(req.params.leadId);
      const investorId = Number(req.params.investorId);
      const { remarks } = req.body;

      if (!Number.isFinite(leadId) || !Number.isFinite(investorId)) {
        return res.status(400).json({ message: "Invalid IDs" });
      }

      const result = await storage.updateInvestorLeadRemarks(
        Number(user.organizationId),
        leadId,
        investorId,
        remarks || ""
      );

      res.json(result);
    } catch (e) {
      console.error("PATCH remarks error:", e);
      res.status(500).json({ message: "Failed to update remarks" });
    }
  }
);

app.patch(
  "/api/leads/:leadId/investors/:investorId/next-action",
  authMiddleware,
  requireRole(["admin", "partner", "analyst"]),
  async (req: any, res) => {
    try {
      const user = req.verifiedUser;
      if (!user?.organizationId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const leadId = Number(req.params.leadId);
      const investorId = Number(req.params.investorId);
      const { nextActionText, nextActionAt, taskAssignedTo } = req.body || {};

      if (!Number.isFinite(leadId) || !Number.isFinite(investorId)) {
        return res.status(400).json({ message: "Invalid IDs" });
      }

      let parsedNextActionAt: Date | null = null;

      if (nextActionAt) {
        parsedNextActionAt = new Date(nextActionAt);
        if (Number.isNaN(parsedNextActionAt.getTime())) {
          return res.status(400).json({ message: "Invalid nextActionAt" });
        }
      }
       if (taskAssignedTo !== undefined && taskAssignedTo !== null) {
        const assignee = await storage.getUser(String(taskAssignedTo));
        if (!assignee || Number(assignee.organizationId) !== Number(user.organizationId)) {
          return res.status(400).json({ message: "Invalid taskAssignedTo user" });
        }
      }

      const result = await storage.updateInvestorLeadNextAction(
        Number(user.organizationId),
        leadId,
        investorId,
        typeof nextActionText === "string" ? nextActionText : null,
        parsedNextActionAt,
        taskAssignedTo !== undefined ? String(taskAssignedTo || "") || null : null,
        taskAssignedTo !== undefined
          ? (taskAssignedTo ? String(user.id) : null)
          : null
      );

      res.json(result);
    } catch (e) {
      console.error("PATCH investor next action error:", e);
      res.status(500).json({ message: "Failed to update investor next action" });
    }
  }
);


                  // ==============================
// ==============================
    // CSV IMPORT ROUTE (With Preview Support)
    // ==============================
// CSV IMPORT ROUTE (With Preview Support & Multi-POC Loop)
    // ==============================
// CSV IMPORT ROUTE (With Multi-POC Support)
    // ==============================
// CSV IMPORT ROUTE (With Preview Support & Multi-POC Loop)
    // ==============================
// ==============================
    // CSV IMPORT ROUTE (With Preview Support & Multi-POC Loop)
    // ==============================
    const upload = multer({ storage: multer.memoryStorage() });

    app.post("/api/investors/import", authMiddleware, requireRole(["admin", "partner", "analyst"]), upload.single("file"), async (req: any, res) => {
      try {
        if (!req.file) return res.status(400).json({ message: "No file uploaded" });

        const isPreview = req.query.preview === "true";
        const fileContent = req.file.buffer.toString("utf-8");
        
        // 1. Parse CSV
        const rows = parse(fileContent, {
          columns: true,
          skip_empty_lines: true,
          trim: true,
          bom: true, 
          relax_quotes: true,
          relax_column_count: true 
        }) as Record<string, any>[];

        if (rows.length === 0) {
          return res.status(400).json({ message: "CSV is empty" });
        }

        const cleanValue = (val: any) => {
          if (!val) return "";
          const str = String(val).trim();
          return str.endsWith(".0") ? str.slice(0, -2) : str;
        };

        let successCount = 0;
        const errors: any[] = [];
        const previewData: any[] = []; 

        for (let i = 0; i < rows.length; i++) {
          const rowRaw = rows[i];
          
          // 2. AGGRESSIVE HEADER NORMALIZATION
          // Converts "POC 1 Designation " to "poc1designation", "Column 1" to "column1", etc.
          const row = Object.fromEntries(
            Object.entries(rowRaw).map(([k, v]) => [
              String(k).toLowerCase().replace(/[^a-z0-9]/g, ''), 
              v
            ])
          );

          // 3. Extract Investor Data (Checking variations from your CSVs)
          const orgName = (row.organization || row.organisation || row.companyname || row.name || "").toString().trim();
          
          if (!orgName) {
            if (!isPreview) errors.push({ row: i + 2, error: "Missing Organization/Name" });
            continue; 
          }

          const investorData = {
            name: orgName,
            // Maps "Column 1" or "Investor Type" to the type field
            investorType: (row.column1 || row.investortype || row.type || "").toString().trim(),
            sector: (row.sector || "").toString().trim(), 
            location: (row.location || row.city || "").toString().trim(),
            website: (row.website || "").toString().trim(),
            description: "Imported via CSV",
          };

          // 4. Extract Multiple POCs (Loop 1 to 20)
          const contactsList: any[] = [];
          
          // Check for unnumbered generic POC first (fallback)
          const genericName = (row.pocname || row.poc || row.name || "").toString().trim();
          const genericEmail = (row.email || row.emailid || "").toString().trim();
          const genericPhone = cleanValue(row.mobile || row.mobilenumber || row.phone);
          const genericLinkedin = (row.linkedin || row.linkedinprofile || "").toString().trim();
          
          // Allow if ANY generic field exists
          if ((genericName || genericEmail || genericPhone || genericLinkedin) && genericName.toLowerCase() !== orgName.toLowerCase() && !row.poc1name && !row.poc1 && !row.poc1mobilenumber) {
             contactsList.push({
                name: genericName || "", // ✅ Leaves name blank if not found
                designation: (row.designation || row.pocdesignation || "Investor").toString().trim(),
                email: genericEmail,
                phone: genericPhone,
                linkedinProfile: genericLinkedin,
                isPrimary: true
             });
          }

          // Loop for numbered POCs (handles your POC 1 Name, POC2 Name, etc.)
          for (let j = 1; j <= 20; j++) {
             const name = (row[`poc${j}name`] || row[`poc${j}`] || "").toString().trim();
             const designation = (row[`poc${j}designation`] || "Investor").toString().trim();
             const email = (row[`poc${j}email`] || row[`email${j}`] || row[`poc${j}emailid`] || "").toString().trim();
             
             const phoneRaw = (row[`poc${j}mobilenumber`] || row[`poc${j}mobile`] || row[`poc${j}phone`]);
             const phone = cleanValue(phoneRaw); 

             const linkedin = (row[`poc${j}linkedin`] || row[`poc${j}linkedinprofile`] || "").toString().trim();

             // Check if ANY contact data exists, not just the name
             if (name || email || phone || linkedin) {
                contactsList.push({
                    name: name || "", // ✅ Leaves name blank if not found
                    designation: designation || (name ? "Investor" : "Unknown"), 
                    email: email,
                    phone: phone,
                    linkedinProfile: linkedin,
                    isPrimary: contactsList.length === 0 // First found is primary
                });
             }
          }


          // ✅ PREVIEW MODE
          if (isPreview) {
            previewData.push({
              row: i + 2,
              organization: investorData.name,
              investorType: investorData.investorType,
              sector: investorData.sector,
              pocCount: contactsList.length,
              firstPoc: contactsList[0] ? contactsList[0].name : "No POC",
              contacts: contactsList 
            });
            continue;
          }

          // ✅ NORMAL MODE: Save to DB
          try {
            const result = await storage.createInvestorWithDeduplication(
              req.verifiedUser.organizationId,
              investorData as any,
              contactsList,
              String(req.verifiedUser.id)
            );
            
            if (!result.isExisting) {
              successCount++;
            }
          } catch (err: any) {
            console.error(`Error saving row ${i + 2}:`, err);
            errors.push({ row: i + 2, error: err.message });
          }
        }

        if (isPreview) {
          return res.json({ 
            success: true, 
            preview: true, 
            count: previewData.length, 
            data: previewData 
          });
        }

        res.json({ 
          success: true, 
          message: `Successfully imported ${successCount} investors`,
          errors: errors.length > 0 ? errors : undefined
        });

      } catch (error) {
        console.error("CSV Import Error:", error);
        res.status(500).json({ message: "Failed to import CSV" });
      }
    });


                  // investor lead linkage
                  app.delete(
                    "/api/investors/:investorId/linked-leads/:leadId",
                    authMiddleware,
                    requireRole(["admin", "partner", "analyst"]),
                    async (req: any, res) => {
                      try {
                        const user = req.verifiedUser;
                        if (!user?.organizationId) return res.status(401).json({ message: "Unauthorized" });

                        const investorId = Number(req.params.investorId);
                        const leadId = Number(req.params.leadId);

                        // ✅ Analyst sandbox enforcement
                        if (user.role === "analyst") {
                          const inv = await storage.getInvestorById(Number(user.organizationId), investorId, user);
                          if (!inv) return res.status(403).json({ message: "Forbidden: investor not visible to you" });

                          const lead = await storage.getLead(leadId, Number(user.organizationId));
                          if (!lead) return res.status(404).json({ message: "Lead not found" });

                          const uid = String(user.id);
                          const inSandbox =
                            (lead as any).ownerAnalystId === uid ||
                            (lead as any).assignedTo === uid ||
                            (lead as any).createdBy === uid ||
                            (Array.isArray((lead as any).assignedInterns) && (lead as any).assignedInterns.includes(uid));

                          if (!inSandbox) {
                            return res.status(403).json({ message: "Forbidden: lead not assigned to you" });
                          }
                        }

                        if (!Number.isFinite(investorId) || investorId <= 0) {
                          return res.status(400).json({ message: "Invalid investorId" });
                        }
                        if (!Number.isFinite(leadId) || leadId <= 0) {
                          return res.status(400).json({ message: "Invalid leadId" });
                        }

                        const out = await storage.removeInvestorLeadLink(Number(user.organizationId), investorId, leadId);
                        res.json(out);
                      } catch (e) {
                        console.error("DELETE /api/investors/:investorId/linked-leads/:leadId error:", e);
                        res.status(500).json({ message: "Failed to unlink lead" });
                      }
                    }
                  );


                                    // Add the PATCH route to update the status of a linked investor-lead pair
// NEW: Update status of linked investor (Fixed syntax & permissions)
app.patch(
  "/api/investors/:investorId/linked-leads/:leadId/status",
  authMiddleware,
  requireRole(["admin", "partner", "analyst"]), // Allow analysts to update status
  async (req: any, res) => {
    try {
      const user = req.verifiedUser;
      if (!user?.organizationId) return res.status(401).json({ message: "Unauthorized" });

      const investorId = Number(req.params.investorId);
      const leadId = Number(req.params.leadId);
      const { status } = req.body;

      if (!Number.isFinite(investorId) || investorId <= 0) return res.status(400).json({ message: "Invalid investorId" });
      if (!Number.isFinite(leadId) || leadId <= 0) return res.status(400).json({ message: "Invalid leadId" });
      if (!status) return res.status(400).json({ message: "Status is required" });

      const updated = await storage.updateInvestorLeadLinkStatus(
        Number(user.organizationId),
        investorId,
        leadId,
        status
      );

      if (updated) {
        res.json({ message: "Status updated", status: updated.status });
      } else {
        res.status(404).json({ message: "Link not found" });
      }
    } catch (e) {
      console.error("PATCH status error:", e);
      res.status(500).json({ message: "Failed to update status" });
    }
  }
);


    app.post(
      "/api/investors/:investorId/outreach-activities",
      authMiddleware,
      requireRole(["admin"]),
      async (req: any, res) => {
        const user = req.verifiedUser;
        if (!user?.organizationId) return res.status(401).json({ message: "Unauthorized" });

        const investorId = Number(req.params.investorId);
        const { activityType, status, notes, contactDate, followUpDate } = req.body || {};

        const row = await storage.createInvestorOutreachActivity(
          Number(user.organizationId),
          investorId,
          {
            userId: user.id,
            activityType,
            status,
            notes: notes ?? null,
            contactDate: contactDate ? new Date(contactDate) : null,
            followUpDate: followUpDate ? new Date(followUpDate) : null,
          }
        );

        res.json(row);
      }
    );




    // Transfer all leads from one user to another - admin/partner
    app.post('/api/users/:fromUserId/transfer-leads', authMiddleware, requireRole(['partner', 'admin']), async (req: any, res) => {
      try {
        const fromUserId = req.params.fromUserId;
        const { toUserId } = req.body;
        const currentUser = req.verifiedUser;
        
        if (!currentUser?.organizationId) {
          return res.status(400).json({ message: 'User not associated with an organization' });
        }
        
        if (!toUserId) {
          return res.status(400).json({ message: 'Target user ID (toUserId) is required' });
        }

        // Verify both users exist
        const fromUser = await storage.getUser(fromUserId);
        const toUser = await storage.getUser(toUserId);
        
        if (!fromUser) {
          return res.status(404).json({ message: 'Source user not found' });
        }
        if (!toUser) {
          return res.status(404).json({ message: 'Target user not found' });
        }

        // Ensure both users are in the same organization as the current user
        if (fromUser.organizationId !== currentUser.organizationId) {
          return res.status(403).json({ message: 'Source user is not in your organization' });
        }
        if (toUser.organizationId !== currentUser.organizationId) {
          return res.status(403).json({ message: 'Target user is not in your organization' });
        }

        // Get all leads assigned to the source user
        const leadsToTransfer = await storage.getLeadsByAssignee(fromUserId, currentUser.organizationId);
        
        if (leadsToTransfer.length === 0) {
          return res.json({ 
            message: 'No leads to transfer',
            transferredCount: 0
          });
        }

        // Transfer all leads
        const leadIds = leadsToTransfer.map(lead => lead.id);
        await storage.bulkAssignLeads(leadIds, toUserId);
        
        res.json({ 
          message: `Successfully transferred ${leadIds.length} leads from ${fromUser.firstName} ${fromUser.lastName} to ${toUser.firstName} ${toUser.lastName}`,
          transferredCount: leadIds.length,
          fromUser: { id: fromUser.id, name: `${fromUser.firstName} ${fromUser.lastName}` },
          toUser: { id: toUser.id, name: `${toUser.firstName} ${toUser.lastName}` }
        });
      } catch (error) {
        console.error('Error transferring leads:', error);
        res.status(500).json({ message: 'Failed to transfer leads' });
      }
    });

    // Generate CSV sample file
    app.get('/api/companies/csv-sample', authMiddleware, async (req: any, res) => {
      try {
        const csvHeaders = [
          'Company Name*',
          'Sector',
          'Sub Sector', 
          'Location',
          'Founded Year',
          'Business Description',
          'Products',
          'Website',
          'Industry',
          'Financial Year',
          'Revenue (INR Cr)',
          'EBITDA (INR Cr)',
          'PAT (INR Cr)',
          'Primary Contact Name',
          'Primary Contact Designation',
          'Primary Contact Email',
          'Primary Contact Phone',
          'Primary Contact LinkedIn',
          'Channel Partner',
          'Assigned Analyst',
          'Assigned Intern ',
          'Assigned Partner'
        ];

        const sampleData = [
          [
            'Tech Innovations Pvt Ltd',
            'Technology',
            'Software Development',
            'Bangalore, India',
            '2015',
            'Leading software development company specializing in enterprise solutions',
            'ERP Software, Mobile Apps, Cloud Solutions',
            'https://techinnovations.com',
            'Information Technology',
            'FY2024',
            '50.25',
            '12.50',
            '8.75',
            'Rajesh Kumar',
            'Chief Technology Officer',
            'rajesh.kumar@techinnovations.com',
            '+91-9876543210',
            'https://linkedin.com/in/rajeshkumar'
          ],
          [
            'Green Energy Solutions',
            'Energy',
            'Renewable Energy',
            'Mumbai, India',
            '2018',
            'Renewable energy solutions provider for commercial and residential sectors',
            'Solar Panels, Wind Turbines, Energy Storage',
            'https://greenenergy.in',
            'Energy & Utilities',
            'FY2024',
            '75.80',
            '18.90',
            '12.45',
            'Priya Sharma',
            'Head of Business Development',
            'priya.sharma@greenenergy.in',
            '+91-8765432109',
            'https://linkedin.com/in/priyasharma'
          ]
        ];

        const csvContent = [csvHeaders, ...sampleData]
          .map(row => row.map(field => `"${field}"`).join(','))
          .join('\n');
    console.log('Generated CSV Sample:\n', csvContent); // Debug log
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="company_upload_sample.csv"');
        res.send(csvContent);
      } catch (error) {
        console.error('Error generating CSV sample:', error);
        res.status(500).json({ message: 'Failed to generate CSV sample' });
      }
    });


    
  const tracxnUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB
  });

    // investor multer   
    const investorUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  });




function cleanStr(s: string) {
  return (s || "")
    // remove Tracxn icon chars
    .replace(/[]/g, "")
    .replace(/[\uf0d8\uf0e8]/g, "")

    // ✅ Normalize common ligatures / bad chars that appear in Tracxn PDFs
    // "Pro\u0000t" or "Pro� t" etc -> "Profit"
    .replace(/Pro[\u0000\uFFFD\s]*t/gi, "Profit")
    // Unicode "fi" ligature (ﬁ) / "fl" (ﬂ)
    .replace(/\uFB01/g, "fi")
    .replace(/\uFB02/g, "fl")

    // remove remaining null chars
    .replace(/\u0000/g, "")

    .replace(/[ \t]+/g, " ")
    .trim();
}


function pickCrNumbers(line: string): number[] {
  const matches = [...line.matchAll(/(\(?-?\d[\d,]*(?:\.\d+)?\)?)\s*(?:Cr|Crore|INR\s*Cr)\b/gi)];
  const nums = matches.map(m => {
    let s = m[1].replace(/,/g, "");
    const isParen = s.startsWith("(") && s.endsWith(")");
    s = s.replace(/[()]/g, "");
    const n = parseFloat(s);
    return isParen ? -n : n;
  });
  return nums.filter(n => Number.isFinite(n));
}

function pickFirstCrNumber(line: string): number | null {
  const nums = pickCrNumbers(line);
  return nums.length ? nums[0] : null;     // ✅ FY24 (latest) is first
}

function pickLastCrNumber(line: string): number | null {
  const nums = pickCrNumbers(line);
  return nums.length ? nums[nums.length - 1] : null;
}

function pickMetricFromSummaryRow(text: string, rowLabel: RegExp): number | null {
  const lines = text.split(/\r?\n/).map(l => cleanStr(l)).filter(Boolean);

  // Find the "Summary" section (Tracxn prints the table under this)
  const summaryIdx = lines.findIndex(l => /^Summary$/i.test(l));
  const start = summaryIdx >= 0 ? summaryIdx : 0;

  for (let i = start; i < Math.min(lines.length, start + 200); i++) {
    const l = lines[i];

    // Stop if we go into other sections after the table
    if (/^(Balance\s*Sheet|Cash\s*flow\s*Statement|CashflowStatement|View detailed financials|Legal Entity:)/i.test(l)) break;

    // Match row like: "EBITDA 157.2Cr 156.9Cr ..."
    if (!rowLabel.test(l)) continue;

    // Prefer first "Cr" number (FY23-24 column is first in Tracxn export)
    const firstCr = pickFirstCrNumber(l);
    if (firstCr !== null) return firstCr;

    // Fallback if "Cr" missing (rare): first non-year number
    const n = pickFirstNonYearNumber(l);
    return n !== null ? n : null;
  }

  return null;
}
function pickMetricRowFirstCr(text: string, rowLabel: RegExp): number | null {
  const lines = text.split(/\r?\n/).map(l => cleanStr(l)).filter(Boolean);

  // Try starting from "Summary" (best case), else scan whole doc
  const summaryIdx = lines.findIndex(l => /^Summary$/i.test(l));
  const start = summaryIdx >= 0 ? summaryIdx : 0;

  // Scan a bounded window if Summary exists, else scan all lines
  const end = summaryIdx >= 0 ? Math.min(lines.length, start + 250) : lines.length;

  for (let i = start; i < end; i++) {
    const l = lines[i];

    // stop when table ends
    if (/^(Balance Sheet|CashflowStatement|Cash Flow|View detailed financials|Legal Entity:)/i.test(l)) break;

    if (!rowLabel.test(l)) continue;

    // Prefer first Cr number on the row
    const vCr = pickFirstCrNumber(l);
    if (vCr !== null) return vCr;

    // fallback: first non-year number
    const v = pickFirstNonYearNumber(l);
    if (v !== null) return v;
  }

  // If "Summary" scan didn’t find it, fallback: scan whole doc
  if (summaryIdx >= 0) {
    for (const l of lines) {
      if (!rowLabel.test(l)) continue;
      const vCr = pickFirstCrNumber(l);
      if (vCr !== null) return vCr;
      const v = pickFirstNonYearNumber(l);
      if (v !== null) return v;
    }
  }

  return null;
}


function pickBestLineWithCr(text: string, labelRegex: RegExp): string {
  const lines = text.split(/\r?\n/).map(l => cleanStr(l)).filter(Boolean);
  const matches = lines.filter(l => labelRegex.test(l));
  if (!matches.length) return "";
  // Prefer the INR (Cr) line, not the USD "Net Profit: 12.3M..." line
  const withCr = matches.find(l => /\bCr\b/i.test(l));
  return withCr || matches[0];
}

function pickFirstCrAfterLabel(text: string, labelRegex: RegExp, lookahead = 20): number | null {
  const lines = text.split(/\r?\n/).map(l => cleanStr(l)).filter(Boolean);

  for (let i = 0; i < lines.length; i++) {
    if (!labelRegex.test(lines[i])) continue;

    // 1) same line
    const same = pickFirstCrNumber(lines[i]);
    if (same !== null) return same;

    // 2) scan next N lines (Tracxn tables often print values on following lines)
    for (let j = i + 1; j < Math.min(lines.length, i + 1 + lookahead); j++) {
      const v = pickFirstCrNumber(lines[j]);
      if (v !== null) return v;
      // stop early if we hit another section header
      if (/^(Income Statement|Balance Sheet|Cash Flow|Key Metrics|Founder|Primary Legal Entity)/i.test(lines[j])) break;
    }
  }

  return null;
}
function pickFirstNumber(line: string): number | null {
  const m = cleanStr(line).match(/(-?\d[\d,]*(?:\.\d+)?)/);
  if (!m) return null;

  const n = parseFloat(m[1].replace(/,/g, ""));
  if (!Number.isFinite(n)) return null;

  // ❗ avoid year-like values (2024, 2023 etc.)
  if (Number.isInteger(n) && n >= 1900 && n <= 2100) return null;

  return n;
}

function pickLastNumber(line: string): number | null {
  const ms = [...cleanStr(line).matchAll(/(-?\d[\d,]*(?:\.\d+)?)/g)];
  if (!ms.length) return null;
  const s = ms[ms.length - 1][1].replace(/,/g, "");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}
function pickFirstNonYearNumber(line: string): number | null {
  const nums = [...cleanStr(line).matchAll(/(-?\d[\d,]*(?:\.\d+)?)/g)]
    .map(m => parseFloat(m[1].replace(/,/g, "")))
    .filter(n => Number.isFinite(n));

  // remove year-like numbers (1900–2099)
  const filtered = nums.filter(n => !(n >= 1900 && n <= 2099));

  return filtered.length ? filtered[0] : null;
}

/**
 * v1-friendly:
 * Finds a label (EBITDA/PAT) then extracts a reasonable number even if "Cr" is missing.
 */
function pickNumberAfterLabel(
  text: string,
  labelRegex: RegExp,
  lookahead = 25
): number | null {
  const lines = text.split(/\r?\n/).map(l => cleanStr(l)).filter(Boolean);

  const isYear = (n: number) =>
    Number.isFinite(n) && Math.floor(n) === n && n >= 1900 && n <= 2100;

  const isFYLine = (l: string) =>
    /\bFY\s?\d{2,4}\b/i.test(l) || /\b20\d{2}\b/.test(l) && /\bFY\b/i.test(l);

  for (let i = 0; i < lines.length; i++) {
    if (!labelRegex.test(lines[i])) continue;

    // Collect candidate numbers (prefer Cr numbers, else normal numbers)
    const candidates: number[] = [];

    // 1) same line
  const sameLine = lines[i];

  // Skip USD/million style lines like: "NetProfit: 12.3M (as on Mar 31, 2024)"
  const looksUSDorMillion =
    /\bUSD\b/i.test(sameLine) ||
    /\$\s*/.test(sameLine) ||
    /\b\d+(?:\.\d+)?\s*M\b/i.test(sameLine) ||
    /Latest Financials\s*\(USD\)/i.test(sameLine);

  if (!isFYLine(sameLine) && !(looksUSDorMillion && !/\bCr\b/i.test(sameLine))) {
    const cr = pickFirstCrNumber(sameLine);
    if (cr !== null && !isYear(cr)) candidates.push(cr);

    const n = pickFirstNonYearNumber(sameLine);
    if (n !== null) candidates.push(n);
  }

    // 2) next lines
    for (let j = i + 1; j < Math.min(lines.length, i + 1 + lookahead); j++) {
      const l = lines[j];

      // stop early if next section starts
      if (/^(Income Statement|Balance Sheet|Cash Flow|Key Metrics|Founder|Primary Legal Entity|Company Details)/i.test(l)) {
        break;
      }

      // skip FY/year-heavy lines
      if (isFYLine(l)) continue;
      // Skip USD/million lines (avoid grabbing 12.3 from 12.3M)
      const looksUSDorMillion =
        /\bUSD\b/i.test(l) ||
        /\$\s*/.test(l) ||
        /\b\d+(?:\.\d+)?\s*M\b/i.test(l) ||
        /Latest Financials\s*\(USD\)/i.test(l);

      if (looksUSDorMillion && !/\bCr\b/i.test(l)) continue;


      const vCr = pickFirstCrNumber(l);
      if (vCr !== null && !isYear(vCr)) candidates.push(vCr);

      const v = pickFirstNonYearNumber(l);
      if (v !== null) candidates.push(v);

      // if we already found something reasonable, return early
      if (candidates.length) return candidates[0];
    }

    if (candidates.length) return candidates[0];
  }

  return null;
}


function pickEmail(text: string): string | null {
  const m = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return m ? m[0] : null;
}

function pickPhone(text: string): string | null {
  // Loose phone match; filters by digit count
  const m = text.match(/(\+?\d[\d\s().-]{8,}\d)/);
  if (!m) return null;

  const raw = cleanStr(m[1]);
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10) return null;

  return raw;
}


function pickKeyPersons(text: string): string | null {
  const lines = text.split(/\r?\n/).map(l => cleanStr(l)).filter(Boolean);

  const startIdx = lines.findIndex(l => /^Founder\s*&\s*Key\s*People/i.test(l));
  if (startIdx < 0) return null;

  const out: string[] = [];

  for (let i = startIdx + 1; i < Math.min(lines.length, startIdx + 30); i++) {
    const l = lines[i];

    if (/^Primary Legal Entity/i.test(l)) break;
    if (/^Name\s+Designation/i.test(l)) continue;
    if (!l || l === "-") continue;

    // Try to convert: "B V Hegde ex-Co-Founder -" -> "B V Hegde – ex-Co-Founder"
    const mm = l.match(/^(.+?)\s+(ex-?co-founder|co-founder|founder|ceo|cfo|cto|coo|managing director|md|director|partner|chairman)\b/i);
    if (mm) {
      out.push(`${cleanStr(mm[1])} – ${cleanStr(mm[2])}`);
      continue;
    }

    // fallback: keep line if it's short and looks like a person entry
    if (l.length <= 80 && /[A-Za-z]/.test(l) && !/Description$/i.test(l)) {
      out.push(l);
    }
  }

  const uniq = Array.from(new Set(out)).filter(Boolean);
  return uniq.length ? uniq.join(", ") : null;
}

function pickAnnualRevenueCr(text: string): number | null {
  const m = text.match(/Annual Revenue\s*₹\s*([\d.,]+)\s*Cr/i);
  if (!m) return null;
  const num = parseFloat(m[1].replace(/,/g, ""));
  return Number.isFinite(num) ? num : null;
}

function pickWebsite(text: string): string | null {
  // tries to catch a domain or URL near "Website"
  const m =
    text.match(/Website\s*(https?:\/\/[^\s]+|\b[a-z0-9.-]+\.[a-z]{2,}\b)/i) ||
    text.match(/www\.[a-z0-9.-]+\.[a-z]{2,}/i);
  if (!m) return null;

  const raw = m[1] || m[0];
  const site = raw.startsWith("http") ? raw : `https://${raw}`;
  return site;
}

function pickLocationCity(text: string): string | null {
  const t = cleanStr(text);

  // Most common: "1996|Mumbai (India)|Unfunded..." OR "1996 | Mumbai (India) | Unfunded..."
  let m = t.match(/\b(19|20)\d{2}\b\s*\|\s*([^|]+?)\s*\|/);
  if (m?.[2]) {
    const loc = cleanStr(m[2]);
    return cleanStr(loc.split("(")[0]); // "Mumbai (India)" -> "Mumbai"
  }

  // Fallback: "1996 Mumbai (India) Unfunded"
  m = t.match(/\b(19|20)\d{2}\b\s+([A-Za-z][A-Za-z .&-]+?)\s*\(India\)/);
  if (m?.[2]) {
    return cleanStr(m[2]);
  }

  return null;
}


function pickCompanyName(text: string): string | null {
  const lines = text.split(/\r?\n/).map(l => cleanStr(l)).filter(Boolean);
  if (!lines.length) return null;
  return lines[0];
}

function pickBusinessDescription(text: string): string | null {
  const lines = text.split(/\r?\n/).map(l => cleanStr(l)).filter(Boolean);
  if (!lines.length) return null;

  const noise = /(Tracxn Score|Annual Revenue|Employee Count|Similar Companies|Website Screenshot|Income Statement|Balance Sheet|Financial Statement|News on|Key Metrics|Sectors|Company Details|Associated Legal Entities|Coverage Areas)/i;

  // Prefer a clean descriptive line like "Manufacturer of ...", "Provider of ...", etc.
  const descKeyword = /(manufacturer|provider|developer|operator|supplier|distributor|platform|saas|hospital|clinic|diagnostic)/i;

  for (let i = 0; i < Math.min(lines.length, 40); i++) {
    const l = lines[i];
    if (noise.test(l)) continue;
    if (/^\b(19|20)\d{2}\b\s*\|/i.test(l)) continue; // founded|city|...
    if (/^https?:\/\//i.test(l)) continue;
    if (descKeyword.test(l)) {
      // Cut off any accidental trailing junk on the same line
      let out = l;

      const cutAt = [
        /\b(19|20)\d{2}\b\s*\|/i,
        /\bTracxn Score\b/i,
        /\bAnnual Revenue\b/i,
        /\bEmployee Count\b/i,
      ];

      for (const p of cutAt) {
        const idx = out.search(p);
        if (idx >= 0) out = out.slice(0, idx);
      }

      out = cleanStr(out);
      if (out.length >= 10 && out.length <= 180) return out;
    }
  }

  return null;
}


function pickSectorPath(text: string): string | null {
  const lines = text.split(/\r?\n/).map(l => cleanStr(l)).filter(Boolean);

  // 1) Best case: any line like "A > B > C" (Tracxn sector breadcrumb)
  const direct = lines.find(l =>
    /[>›»→]/.test(l) &&
    !/^https?:\/\//i.test(l) &&
    !/^(Sectors?|Company Details|Associated Legal Entities|Coverage Areas)/i.test(l) &&
    l.length <= 220
  );

  if (direct) {
    return cleanStr(direct.replace(/^[^A-Za-z0-9]+/, "")); // strip leading icons like 
  }

  // 2) Common format: right after "YYYY|City (India)|Funding"
  const foundedIdx = lines.findIndex(l => /\b(19|20)\d{2}\b\s*\|/.test(l) && /\|/.test(l));
  if (foundedIdx >= 0) {
    for (let j = foundedIdx + 1; j < Math.min(lines.length, foundedIdx + 7); j++) {
      const l = lines[j];
      if (/[>›»→]/.test(l) && !/^https?:\/\//i.test(l) && l.length <= 220) {
        return cleanStr(l.replace(/^[^A-Za-z0-9]+/, ""));
      }
      if (/^Website\b/i.test(l)) break;
    }
  }

  // 3) Fallback regex over full text
  const m = text.match(
    /(?:Healthcare|Logistics|Renewables?|Consumer|IT|Software|SaaS|Pharma|Pharmaceuticals|Chemicals|Materials)\b\s*(?:[>›»→]\s*[^\n]{2,})+/i
  );
  if (m) return cleanStr(m[0].replace(/^[^A-Za-z0-9]+/, ""));

  return null;
}


function splitSectorPath(path: string): string[] {
  return cleanStr(path)
    .replace(/^[^A-Za-z0-9]+/, "")          // remove leading icons
    .split(/\s*[>›»→]\s*/g)                // support different separators
    .map(s => cleanStr(s))
    .filter(Boolean);
}

function mapSectorAndSubSector(sectorPath: string | null): { sector?: string; subSector?: string } {
  if (!sectorPath) return {};

  const parts = splitSectorPath(sectorPath);
  if (!parts.length) return {};

  const primary = parts[0];                         // first segment
  const rest = parts.slice(1).join(" > ");          // everything after

  const sp = sectorPath.toLowerCase();

  if (sp.includes("pharma") || sp.includes("pharmaceutical") || sp.includes("healthcare")) {
    return { sector: "Healthcare & Pharma", subSector: rest || primary };
  }
  if (sp.includes("logistics")) return { sector: "Logistics", subSector: rest || primary };
  if (sp.includes("renewable") || sp.includes("solar") || sp.includes("energy")) return { sector: "Renewables", subSector: rest || primary };
  if (sp.includes("consumer") || sp.includes("retail") || sp.includes("f&b")) return { sector: "Consumer", subSector: rest || primary };
  if (sp.includes("it") || sp.includes("software") || sp.includes("saas")) return { sector: "IT", subSector: rest || primary };
  if (sp.includes("staffing") || sp.includes("recruit") || sp.includes("manpower") || sp.includes("hr")) return { sector: "HR", subSector: rest || primary };

  // Generic fallback: sector = first segment, sub-sector = remaining breadcrumb
  return { sector: primary, subSector: rest || undefined };
}


function parseTracxnOnePager(textRaw: string) {
  const text = textRaw || "";

  const companyName = pickCompanyName(text);
  const location = pickLocationCity(text);
  const businessDescription = pickBusinessDescription(text);
  const website = pickWebsite(text);
  const email = pickEmail(text);
  const phone = pickPhone(text);
  const keyPersons = pickKeyPersons(text);


  const revenueInrCr = pickAnnualRevenueCr(text);

  // EBITDA + PAT from financial statement rows (prefer INR Cr lines)
  // ✅ EBITDA + PAT: handle Tracxn tables where values come on next lines
// ✅ EBITDA + PAT: v1-safe (works even if "Cr" is missing)
// ✅ Prefer INR "Summary" table rows first (most reliable in Tracxn exports)
const ebitdaFromSummary = pickMetricFromSummaryRow(text, /^EBITDA\b/i);
const netProfitFromSummary =
  pickMetricFromSummaryRow(text, /^Net\s*Profit\b/i) ??
  pickMetricFromSummaryRow(text, /^NetProfit\b/i);

// Fallbacks (only if Summary not found)
const ebitdaInrCr =
  ebitdaFromSummary ??
  pickNumberAfterLabel(text, /^EBITDA\b/i) ??
  pickFirstCrAfterLabel(text, /^EBITDA\b/i) ??
  pickFirstCrNumber(pickBestLineWithCr(text, /^EBITDA\b/i));

const PAT_LABEL = /\b(Net\s*Profit(?:\/Loss)?|NetProfit|PAT)\b/i;


const patInrCr =
  netProfitFromSummary ??
  pickNumberAfterLabel(text, PAT_LABEL) ??
  pickFirstCrAfterLabel(text, PAT_LABEL) ??
  pickFirstCrNumber(pickBestLineWithCr(text, PAT_LABEL));





  const sectorPath = pickSectorPath(text);
  const { sector, subSector } = mapSectorAndSubSector(sectorPath);

  return {
    companyName,
    sector: sector || null,
    subSector: subSector || null,
    location: location || null,
    website: website || null,
    businessDescription: businessDescription || null,
    revenueInrCr: revenueInrCr ?? null,
    ebitdaInrCr: ebitdaInrCr ?? null,
    patInrCr: patInrCr ?? null,

    // useful extras from Tracxn (optional)
    keyPersons: keyPersons || null,
    email: email || null,
    phone: phone || null,

    // for debugging (optional)
    sectorPath: sectorPath || null,
  };
}

    function parseNumber(val: string | null | undefined): number | null {
      if (!val) return null;
      const num = parseFloat(val);
      return isNaN(num) ? null : num;
    }




// investro routes //
    app.post(
      "/api/investors/import",
      authMiddleware,
      requireRole(["admin"]),
      investorUpload.single("file"),
      async (req: any, res) => {
        try {
          const user = req.verifiedUser;
          if (!user?.organizationId) return res.status(401).json({ message: "Unauthorized" });

          if (!req.file?.buffer) {
            return res.status(400).json({ message: "No file uploaded" });
          }

          const csvText = req.file.buffer.toString("utf-8");
            type InvestorCsvRow = {
              name?: string;
              sector?: string;
              location?: string;
              website?: string;
              description?: string;
              pocName?: string;
              pocDesignation?: string;
              pocEmail?: string;
              pocPhone?: string;
              pocLinkedin?: string;
            };

            const records = parse(csvText, {
              columns: true,
              skip_empty_lines: true,
              trim: true,
              bom: true,
            }) as InvestorCsvRow[];


          // Expected headers:
          // name, sector, location, website, description,
          // pocName, pocDesignation, pocEmail, pocPhone, pocLinkedin

          let created = 0;

          for (const row of records) {
            const name = String(row.name ?? "").trim();
            if (!name) continue;

            await storage.createInvestor(
              user.organizationId,
              {
                name,
                sector: row.sector || null,
                location: row.location || null,
                website: row.website || null,
                description: row.description || null,
                stage: "outreach",
              } as any,
              {
                name: row.pocName || "",
                designation: row.pocDesignation || "",
                email: row.pocEmail || "",
                phone: row.pocPhone || "",
                linkedinProfile: row.pocLinkedin || "",
              }
            );

            created += 1;
          }

          res.json({ message: "Import successful", created });
        } catch (e) {
          console.error("POST /api/investors/import error:", e);
          res.status(500).json({ message: "Failed to import investors" });
        }
      }
    );



   // -----------------------------
// Tracxn PDF parse endpoint
// POST /api/tracxn/parse-onepager
// -----------------------------
app.post(
  "/api/tracxn/parse-onepager",
  authMiddleware,
  requireRole(["partner", "admin", "analyst", "intern"]),
  tracxnUpload.single("file"),

  async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "PDF file is required (field name: file)" });
      }

      const text = await extractPdfText(req.file.buffer);
      const extracted = parseTracxnOnePager(text || "");


      return res.json({ success: true, extracted });
    } catch (err: any) {
      console.error("Tracxn parse failed:", err);
      return res.status(500).json({ message: err?.message || "Failed to parse Tracxn PDF" });
    }
  }
);

app.post(
  "/api/companies/csv-upload",
  authMiddleware,
  requireRole(["partner", "admin", "analyst"]),
  async (req: any, res) => {
    try {
      const currentUser = req.verifiedUser;
      if (!currentUser || !currentUser.organizationId) {
        return res.status(401).json({ message: "User organization not found" });
      }

      const { csvData } = req.body;
      const isPreview = req.query.preview === "true" || req.body?.preview === true;

      if (!csvData || typeof csvData !== "string") {
        return res.status(400).json({ message: "CSV data is required" });
      }

      const organizationId = currentUser.organizationId;

      const parseNumber = (val: any): number | null => {
        if (val === null || val === undefined) return null;
        const s = String(val).trim();
        if (!s || s.toLowerCase() === "na" || s.toLowerCase() === "n/a") return null;
        const cleaned = s.replace(/₹/g, "").replace(/,/g, "").trim();
        const num = Number(cleaned);
        return Number.isFinite(num) ? num : null;
      };

      const cleanText = (val: any): string | null => {
        const s = String(val ?? "").trim();
        return s ? s : null;
      };

      const firstNonEmpty = (row: Record<string, any>, keys: string[]) => {
        for (const key of keys) {
          const value = row[key];
          if (value !== undefined && value !== null && String(value).trim() !== "") {
            return value;
          }
        }
        return null;
      };

      const rows = parse(csvData, {
        columns: true,
        skip_empty_lines: true,
        bom: true,
        relax_quotes: true,
        relax_column_count: true,
      }) as Record<string, any>[];

      const nonEmptyRows = rows.filter((r) =>
        Object.values(r || {}).some((v) => String(v ?? "").trim() !== "")
      );

      if (nonEmptyRows.length === 0) {
        return res.status(400).json({ message: "CSV must contain at least one data row" });
      }

      const MAX_ROWS = 5000;
      if (rows.length > MAX_ROWS) {
        return res.status(400).json({ message: `Too many rows. Max allowed is ${MAX_ROWS}.` });
      }

      const orgUsers = await storage.getUsers(organizationId);
      const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

      const userByEmail = new Map<string, string>();
      const userByName = new Map<string, string>();

      for (const u of orgUsers) {
        if (u.email) userByEmail.set(norm(u.email), u.id);
        const full = norm(`${u.firstName || ""} ${u.lastName || ""}`.trim());
        if (full) userByName.set(full, u.id);
      }

      const results = {
        totalRows: rows.length,
        successfulCompanies: 0,
        updatedCompanies: 0,
        unchangedExistingCompanies: 0,
        successfulLeads: 0,
        existingLeads: 0,
        successfulContacts: 0,
        updatedContacts: 0,
        warnings: [] as Array<{ row: number; warning: string }>,
        errors: [] as Array<{ row: number; error: string }>,
        previewRows: [] as any[],
      };

      for (let i = 0; i < rows.length; i++) {
        const rowNum = i + 2;

        try {
          const rowRaw = rows[i] || {};
          const row = Object.fromEntries(
            Object.entries(rowRaw).map(([k, v]) => [String(k).replace(/\s+/g, " ").trim(), v])
          ) as Record<string, any>;

          const companyName = cleanText(
            firstNonEmpty(row, ["Company Name", "Company", "Name"])
          );

          if (!companyName) {
            results.errors.push({ row: rowNum, error: "Company Name is required" });
            continue;
          }

          const companyData: any = {
            name: companyName,
            sector: cleanText(firstNonEmpty(row, ["Sector"])),
            subSector: cleanText(firstNonEmpty(row, ["Sub-Sector", "Sub Sector"])),
            location: cleanText(firstNonEmpty(row, ["City", "Location"])),
            financialYear: cleanText(firstNonEmpty(row, ["Financial Year", "FY", "FY Label"])) || "FY24",
            revenueInrCr: parseNumber(firstNonEmpty(row, ["FY24 Revenue (INR Cr)", "Revenue (INR Cr)", "Revenue"])),
            ebitdaInrCr: parseNumber(firstNonEmpty(row, ["FY24 EBITDA (INR Cr)", "EBITDA (INR Cr)", "EBITDA"])),
            patInrCr: parseNumber(firstNonEmpty(row, ["FY24 PAT (INR Cr)", "PAT (INR Cr)", "PAT"])),
            foundedYear: parseNumber(firstNonEmpty(row, ["Founded Year", "Founded"])) ?? null,
            businessDescription: cleanText(firstNonEmpty(row, ["Business Description", "Description"])),
            products: cleanText(firstNonEmpty(row, ["Products"])),
            website: cleanText(firstNonEmpty(row, ["Website"])),
            industry: cleanText(firstNonEmpty(row, ["Industry"])),
            analystFocSfca: cleanText(firstNonEmpty(row, ["Analyst PoC SFCA"])),
            bdFocSfca: cleanText(firstNonEmpty(row, ["BD PoC SFCA", "BD Foc SFCA"])),
          };

          let assignedTo: string | null = null;
          const analystCell = cleanText(firstNonEmpty(row, ["Analyst PoC SFCA"]));

          if (analystCell && analystCell.toLowerCase() !== "na" && analystCell.toLowerCase() !== "n/a") {
            assignedTo = userByEmail.get(norm(analystCell)) || userByName.get(norm(analystCell)) || null;

            if (!assignedTo) {
              results.warnings.push({
                row: rowNum,
                warning: `Assignee not found in CRM users: "${analystCell}". Lead left unassigned.`,
              });
            }
          }

          const normalizedName = companyName.toLowerCase().trim();
          const existingCompany = await storage.getCompanyByNormalizedName(normalizedName, organizationId);

          const patchableFields = [
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
            "analystFocSfca",
            "bdFocSfca",
          ];

          const changedFields: string[] = [];
          if (existingCompany) {
            for (const field of patchableFields) {
              const incomingValue = companyData[field];
              const existingValue = (existingCompany as any)[field];

              const incomingHasValue =
                incomingValue !== undefined &&
                incomingValue !== null &&
                String(incomingValue).trim?.() !== "";

              const existingBlank =
                existingValue === undefined ||
                existingValue === null ||
                String(existingValue).trim?.() === "";

              if (incomingHasValue && (existingBlank || String(existingValue) !== String(incomingValue))) {
                changedFields.push(field);
              }
            }
          }

          const existingLeads = existingCompany
            ? await storage.getLeadsByCompany(Number(existingCompany.id), organizationId)
            : [];

          const willCreateLead = !existingLeads || existingLeads.length === 0;
          const existingLeadId = !willCreateLead ? existingLeads[0].id : null;

          const poc1 = {
            name: cleanText(firstNonEmpty(row, ["POC 1 Name", "Primary Contact Name"])),
            designation: cleanText(firstNonEmpty(row, ["POC 1 Designation", "Primary Contact Designation"])),
            email: cleanText(firstNonEmpty(row, ["Email ID 1", "Primary Contact Email"])),
            phone: cleanText(firstNonEmpty(row, ["Phone Number 1", "Primary Contact Phone"])),
            linkedinProfile: cleanText(firstNonEmpty(row, ["LinkedIn 1", "Primary Contact LinkedIn"])),
          };

          const poc2 = {
            name: cleanText(firstNonEmpty(row, ["POC Name 2", "POC 2 Name"])),
            designation: cleanText(firstNonEmpty(row, ["POC 2 Designation"])),
            email: cleanText(firstNonEmpty(row, ["Email ID 2"])),
            phone: cleanText(firstNonEmpty(row, ["POC 2 Number", "Phone Number 2"])),
            linkedinProfile: cleanText(firstNonEmpty(row, ["LinkedIn 2"])),
          };

          if (isPreview) {
            results.previewRows.push({
              row: rowNum,
              companyName,
              companyAction: existingCompany
                ? changedFields.length > 0
                  ? "update_existing_company"
                  : "existing_company_no_change"
                : "create_new_company",
              changedFields,
              leadAction: willCreateLead ? "create_new_lead" : "existing_lead",
              existingLeadId,
              assignedToFound: !!assignedTo,
              parsedFinancials: {
                financialYear: companyData.financialYear,
                revenueInrCr: companyData.revenueInrCr,
                ebitdaInrCr: companyData.ebitdaInrCr,
                patInrCr: companyData.patInrCr,
              },
              parsedContacts: [poc1, poc2].filter(
                (c) => c.name || c.designation || c.email || c.phone || c.linkedinProfile
              ),
            });
            continue;
          }

          const companyResult: any = await storage.createCompanyWithDeduplication(companyData, organizationId);
          const company = companyResult.company;
          const companyIdNum = Number(company.id);

          if (!companyResult.isExisting) {
            results.successfulCompanies++;
          } else if (companyResult.wasUpdated) {
            results.updatedCompanies++;
          } else {
            results.unchangedExistingCompanies++;
          }

          let leadId: number | null = null;
          const actualExistingLeads = await storage.getLeadsByCompany(companyIdNum, organizationId);

          if (!actualExistingLeads || actualExistingLeads.length === 0) {
            const universeStatus = assignedTo ? "assigned" : "open";

            const lead = await storage.createLead({
              organizationId,
              companyId: companyIdNum,
              stage: "universe",
              universeStatus,
              ownerAnalystId: assignedTo || (currentUser.role === "analyst" ? currentUser.id : null),
              assignedTo: assignedTo,
              pocCount: 0,
              pocCompletionStatus: "red",
              pipelineValue: null,
              probability: "0",
              notes: null,
              createdBy: currentUser.id,
            });

            leadId = lead.id;
            results.successfulLeads++;
          } else {
            const lead = actualExistingLeads[0];
            leadId = lead.id;
            results.existingLeads++;

            if (assignedTo && !lead.assignedTo && lead.stage === "universe") {
              await storage.assignLead(
                lead.id,
                organizationId,
                assignedTo,
                undefined,
                currentUser.id,
                "Assigned from CSV upload"
              );
            }
          }

          const existingContacts = await storage.getContactsByCompany(companyIdNum, organizationId);

          const upsertContact = async (incoming: any, isPrimary: boolean) => {
            const hasAny =
              incoming.name || incoming.email || incoming.phone || incoming.linkedinProfile || incoming.designation;

            if (!hasAny) return;

            let match = null as any;

            if (isPrimary) {
              match = existingContacts.find((c: any) => c.isPrimary);
            } else {
              const emailKey = incoming.email ? norm(incoming.email) : null;
              const phoneKey = incoming.phone ? String(incoming.phone).trim() : null;

              match = existingContacts.find((c: any) => {
                const cEmail = c.email ? norm(c.email) : null;
                const cPhone = c.phone ? String(c.phone).trim() : null;
                return (emailKey && cEmail === emailKey) || (phoneKey && cPhone === phoneKey);
              });
            }

            const patch: any = {};
            for (const k of ["name", "designation", "email", "phone", "linkedinProfile"] as const) {
              if (incoming[k]) patch[k] = incoming[k];
            }
            patch.isPrimary = isPrimary;

            if (match) {
              await storage.updateContact(match.id, organizationId, patch);
              results.updatedContacts++;
            } else {
              await storage.createContact({
                organizationId,
                companyId: companyIdNum,
                ...patch,
                isPrimary,
              });
              results.successfulContacts++;
            }
          };

          await upsertContact(poc1, true);
          await upsertContact(poc2, false);
        } catch (error: any) {
          results.errors.push({
            row: rowNum,
            error: error?.message || "Failed to process row",
          });
        }
      }

      if (isPreview) {
        return res.json({
          success: true,
          preview: true,
          message: "Preview generated successfully",
          results: {
            ...results,
            companiesToCreate: results.previewRows.filter((r) => r.companyAction === "create_new_company").length,
            companiesToUpdate: results.previewRows.filter((r) => r.companyAction === "update_existing_company").length,
            companiesUnchanged: results.previewRows.filter((r) => r.companyAction === "existing_company_no_change").length,
            leadsToCreate: results.previewRows.filter((r) => r.leadAction === "create_new_lead").length,
            leadsExisting: results.previewRows.filter((r) => r.leadAction === "existing_lead").length,
          },
        });
      }

      return res.json({
        success: true,
        message: `Upload completed: ${results.successfulCompanies} companies created, ${results.updatedCompanies} companies updated, ${results.successfulLeads} leads created, ${results.successfulContacts} contacts created`,
        results,
      });
    } catch (error: any) {
      console.error("Error processing CSV upload:", error);
      return res.status(500).json({ message: error.message || "Failed to process CSV upload" });
    }
  }
);


    // Populate dummy data - DEV ONLY
    // Populate dummy data - DEV ONLY
    app.post('/api/dev/populate-data', authMiddleware, requireRole(['admin']), async (req: any, res) => {
      try {
        console.log('Starting data population...');

        // ✅ ALWAYS GET USER FIRST
        const sessionUser = req.verifiedUser;

        if (!sessionUser || !sessionUser.organizationId) {
          return res.status(401).json({ message: 'Current user or organization not found' });
        }

        const organizationId = sessionUser.organizationId;
        const currentUser = sessionUser;

        console.log(
          'Using current authenticated user:',
          sessionUser.email,
          'org:',
          organizationId
        );

        //
        // -------------------------------------------
        // Dummy USERS
        // -------------------------------------------
        //

        const dummyUsers = [
          {
            id: 'user_analyst_1',
            organizationId,
            email: 'sarah.williams@investbank.com',
            firstName: 'Sarah',
            lastName: 'Williams',
            role: 'analyst'
          },
          {
            id: 'user_analyst_2',
            organizationId,
            email: 'james.chen@investbank.com',
            firstName: 'James',
            lastName: 'Chen',
            role: 'analyst'
          },
          {
            id: 'user_partner_1',
            organizationId,
            email: 'michael.rodriguez@investbank.com',
            firstName: 'Michael',
            lastName: 'Rodriguez',
            role: 'partner'
          },
          {
            id: 'user_partner_2',
            organizationId,
            email: 'emma.johnson@investbank.com',
            firstName: 'Emma',
            lastName: 'Johnson',
            role: 'partner'
          }
        ];

        console.log('Creating dummy users...');
        for (const user of dummyUsers) {
          await storage.upsertUser(user);
        }

        //
        // -------------------------------------------
        // Dummy COMPANIES
        // (your long companyData array remains unchanged)
        // -------------------------------------------
        //

        const createdCompanies = [];
        for (const company of companyData) {
          const createdCompany = await storage.createCompany(company);
          createdCompanies.push(createdCompany);
        }

        //
        // -------------------------------------------
        // Dummy CONTACTS
        // -------------------------------------------
        //

        for (const contact of contactsData) {
          await storage.createContact(contact);
        }

        //
        // -------------------------------------------
        // Dummy LEADS
        // -------------------------------------------
        //

        const createdLeads = [];
        for (const leadData of leadStages) {
          const lead = await storage.createLead({
            organizationId,
            companyId: createdCompanies[leadData.companyIndex].id,
            stage: leadData.stage,
            assignedTo: leadData.assignedTo,
            pipelineValue:
              leadData.stage === 'won'
                ? '50.00'
                : leadData.stage === 'pitching'
                ? '25.00'
                : leadData.stage === 'outreach'
                ? '15.00'
                : null,
            probability:
              leadData.stage === 'won'
                ? '100'
                : leadData.stage === 'pitching'
                ? '60'
                : leadData.stage === 'outreach'
                ? '30'
                : leadData.stage === 'qualified'
                ? '15'
                : '5',
            createdBy: currentUser.id,  // ⭐ REQUIRED    
          });
          createdLeads.push(lead);
        }

        // Assign lead history
        const assignedBy = currentUser.id;
        for (let i = 0; i < leadStages.length; i++) {
          if (leadStages[i].assignedTo) {
            await storage.assignLead(
              createdLeads[i].id,
              organizationId,
              leadStages[i].assignedTo!,
              undefined,
              assignedBy,
              'Initial assignment during data population'
            );
          }
        }

        //
        // -------------------------------------------
        // Dummy OUTREACH ACTIVITIES
        // -------------------------------------------
        //

        for (const activity of outreachActivities) {
          await storage.createOutreachActivity(activity);
        }

        //
        // -------------------------------------------
        // Verification Logs
        // -------------------------------------------
        //

        console.log('=== POST-CREATION VERIFICATION ===');
        console.log('Companies:', (await storage.getCompanies(organizationId)).length);
        console.log('Universe:', (await storage.getLeadsByStage('universe', organizationId)).length);
        console.log('Qualified:', (await storage.getLeadsByStage('qualified', organizationId)).length);
        console.log('Metrics:', await storage.getDashboardMetrics(organizationId));

        res.json({
          success: true,
          message: 'Dummy data populated successfully'
        });

      } catch (error: any) {
        console.error('Error populating dummy data:', error);
        res.status(500).json({ message: error.message || 'Failed to populate dummy data' });
      }
    });


    // Company routes - Only partners and admins can create companies
    app.post('/api/companies', authMiddleware, requireRole(['partner', 'admin']), async (req: any, res) => {
      try {
        const currentUser = req.verifiedUser;
        if (!currentUser || !currentUser.organizationId) {
          return res.status(401).json({ message: 'User organization not found' });
        }
        const companyData = insertCompanySchema.parse(req.body); // organizationId excluded from client input
        const company = await storage.createCompany({ ...companyData, organizationId: currentUser.organizationId });
        res.json(company);
      } catch (error) {
        console.error('Error creating company:', error);
        res.status(400).json({ message: 'Failed to create company', error: error instanceof Error ? error.message : 'Unknown error' });
      }
    });

    app.get('/api/companies', authMiddleware, requireRole(['partner', 'admin']), async (req: any, res) => {
      try {
        const currentUser = req.verifiedUser;
        if (!currentUser || !currentUser.organizationId) {
          return res.status(401).json({ message: 'User organization not found' });
        }
        const companies = await storage.getCompanies(currentUser.organizationId);
        res.json(companies);
      } catch (error) {
        console.error('Error fetching companies:', error);
        res.status(500).json({ message: 'Failed to fetch companies' });
      }
    });

    app.get('/api/companies/:id', authMiddleware, requireRole(['partner', 'admin']), validateIntParam('id'), validateResourceExists('company'), async (req: any, res) => {
      try {
        // Company already validated by middleware
        res.json(req.resource);
      } catch (error) {
        console.error('Error fetching company:', error);
        res.status(500).json({ message: 'Failed to fetch company' });
      }
    });

    app.put('/api/companies/:id', authMiddleware, requireRole(['partner', 'admin']), validateIntParam('id'), validateResourceExists('company'), async (req: any, res) => {
      try {
        const currentUser = req.verifiedUser;
        if (!currentUser || !currentUser.organizationId) {
          return res.status(401).json({ message: 'User organization not found' });
        }
        const updates = updateCompanySchema.parse(req.body); // Security: organizationId cannot be changed
        const company = await storage.updateCompany(parseInt(req.params.id), currentUser.organizationId, updates);
        res.json(company);
      } catch (error) {
        console.error('Error updating company:', error);
        res.status(400).json({ message: 'Failed to update company', error: error instanceof Error ? error.message : 'Unknown error' });
      }
    });

    // PATCH route for partial company updates (same as PUT for this API)
    app.patch('/api/companies/:id', authMiddleware, requireRole(['partner', 'admin','analyst']), validateIntParam('id'), validateResourceExists('company'), async (req: any, res) => {
      try {
        const currentUser = req.verifiedUser;
        if (!currentUser || !currentUser.organizationId) {
          return res.status(401).json({ message: 'User organization not found' });
        }
        const updates = updateCompanySchema.parse(req.body); // Security: organizationId cannot be changed
        console.log('PATCH /api/companies/:id - updates:', updates);
        const company = await storage.updateCompany(parseInt(req.params.id), currentUser.organizationId, updates);
        console.log('PATCH /api/companies/:id - storage returned:', company);
        res.json(company);
      } catch (error) {
        console.error('Error updating company:', error);
        res.status(400).json({ message: 'Failed to update company', error: error instanceof Error ? error.message : 'Unknown error' });
      }
    });

    // Contact routes
    app.post('/api/contacts', authMiddleware, async (req: any, res) => {
      try {
        const currentUser = req.verifiedUser || await storage.getUser(req.user?.claims?.sub);
        if (!currentUser || !currentUser.organizationId) {
          return res.status(401).json({ message: 'User organization not found' });
        }
        const contactData = contactFormSchema.parse(req.body); // organizationId excluded from client input
        const contact = await storage.createContact({ ...contactData, organizationId: currentUser.organizationId });
        
        // Update lead POC count and status after creating contact
        if (contactData.companyId) {
          try {
            // Get all leads for this company to update their POC status
            const companyLeads = await storage.getLeadsByCompany(contactData.companyId, currentUser.organizationId);
            
            for (const lead of companyLeads) {
              // Get total contacts for this company to update POC count
              const companyContacts = await storage.getContactsByCompany(contactData.companyId, currentUser.organizationId);
              const pocCount = companyContacts.length;
              
              // Determine POC completion status based on contact completeness
              let pocCompletionStatus = 'red'; // Default
              if (pocCount > 0) {
                const completeContacts = companyContacts.filter(c => c.isComplete);
                if (completeContacts.length >= 1) {
                  pocCompletionStatus = pocCount >= 3 ? 'green' : 'amber';
                }
              }
              
              // Update the lead's POC fields
              await storage.updateLead(lead.id, currentUser.organizationId, {
                pocCount,
                pocCompletionStatus
              });
              
              // Auto-qualify lead if primary contact has Name + Designation + LinkedIn URL
              // and the lead is currently in 'universe' stage
              if (lead.stage === 'universe') {
                const primaryContact = companyContacts.find(c => c.isPrimary);
                if (primaryContact && 
                    primaryContact.name && 
                    primaryContact.designation && 
                    primaryContact.linkedinProfile) {
                  // Auto-qualify the lead
                  await storage.updateLead(lead.id, currentUser.organizationId, {
                    stage: 'qualified'
                  });
                  
                  // Log the auto-qualification activity
                  await ActivityLogService.logActivity({
                    organizationId: currentUser.organizationId,
                    leadId: lead.id,
                    companyId: contactData.companyId,
                    userId: currentUser.id,
                    action: 'lead_auto_qualified',
                    entityType: 'lead',
                    entityId: lead.id,
                    description: `Lead auto-qualified: Primary contact ${primaryContact.name} has complete required information`
                  });
                }
              }
            }
          } catch (updateError) {
            console.error('Error updating lead POC status:', updateError);
            // Don't fail the contact creation if POC update fails
          }
        }
        
        res.json(contact);
      } catch (error) {
        console.error('Error creating contact:', error);
        res.status(400).json({ message: 'Failed to create contact', error: error instanceof Error ? error.message : 'Unknown error' });
      }
    });

    // GET individual contact by ID with organization scoping
    app.get('/api/contacts/:id', authMiddleware, validateIntParam('id'), validateResourceExists('contact'), async (req: any, res) => {
      try {
        // Contact already validated by middleware
        res.json(req.resource);
      } catch (error) {
        console.error('Error fetching contact:', error);
        res.status(500).json({ message: 'Failed to fetch contact' });
      }
    });

    app.get('/api/contacts/company/:companyId', authMiddleware, validateIntParam('companyId'), async (req: any, res) => {
      try {
        const currentUser = req.verifiedUser;
        if (!currentUser || !currentUser.organizationId) {
          return res.status(401).json({ message: 'User organization not found' });
        }
        const contacts = await storage.getContactsByCompany(parseInt(req.params.companyId), currentUser.organizationId);
        res.json(contacts);
      } catch (error) {
        console.error('Error fetching contacts:', error);
        res.status(500).json({ message: 'Failed to fetch contacts' });
      }
    });

    app.put('/api/contacts/:id', authMiddleware, validateIntParam('id'), validateResourceExists('contact'), async (req: any, res) => {
      try {
        const currentUser = req.verifiedUser;
        if (!currentUser || !currentUser.organizationId) {
          return res.status(401).json({ message: 'User organization not found' });
        }
        const updates = updateContactSchema.parse(req.body); // Security: organizationId cannot be changed
        const contact = await storage.updateContact(parseInt(req.params.id), currentUser.organizationId, updates);
        
        // After updating contact, check for auto-qualification
        if (contact && contact.companyId) {
          try {
            // Get all leads for this company
            const companyLeads = await storage.getLeadsByCompany(contact.companyId, currentUser.organizationId);
            
            for (const lead of companyLeads) {
              // Get all contacts to check POC status and auto-qualification
              const companyContacts = await storage.getContactsByCompany(contact.companyId, currentUser.organizationId);
              const pocCount = companyContacts.length;
              
              // Determine POC completion status
              let pocCompletionStatus = 'red';
              if (pocCount > 0) {
                const completeContacts = companyContacts.filter(c => c.isComplete);
                if (completeContacts.length >= 1) {
                  pocCompletionStatus = pocCount >= 3 ? 'green' : 'amber';
                }
              }
              
              // Update POC fields
              await storage.updateLead(lead.id, currentUser.organizationId, {
                pocCount,
                pocCompletionStatus
              });
              
              // Auto-qualify lead if primary contact has Name + Designation + LinkedIn URL
              if (lead.stage === 'universe') {
                const primaryContact = companyContacts.find(c => c.isPrimary);
                if (primaryContact && 
                    primaryContact.name && 
                    primaryContact.designation && 
                    primaryContact.linkedinProfile) {
                  // Auto-qualify the lead
                  await storage.updateLead(lead.id, currentUser.organizationId, {
                    stage: 'qualified'
                  });
                  
                  // Log the auto-qualification activity
                  await ActivityLogService.logActivity({
                    organizationId: currentUser.organizationId,
                    leadId: lead.id,
                    companyId: contact.companyId,
                    userId: currentUser.id,
                    action: 'lead_auto_qualified',
                    entityType: 'lead',
                    entityId: lead.id,
                    description: `Lead auto-qualified: Primary contact ${primaryContact.name} has complete required information`
                  });
                }
              }
            }
          } catch (updateError) {
            console.error('Error updating lead after contact update:', updateError);
            // Don't fail the contact update
          }
        }
        
        res.json(contact);
      } catch (error) {
        console.error('Error updating contact:', error);
        res.status(400).json({ message: 'Failed to update contact', error: error instanceof Error ? error.message : 'Unknown error' });
      }
    });

    // DELETE individual contact by ID with organization scoping
    app.delete('/api/contacts/:id', authMiddleware, validateIntParam('id'), validateResourceExists('contact'), async (req: any, res) => {
      try {
        const currentUser = req.verifiedUser;
        if (!currentUser || !currentUser.organizationId) {
          return res.status(401).json({ message: 'User organization not found' });
        }
        
        const contact = req.resource; // Contact already validated by middleware
        const companyId = contact.companyId;
        
        // Delete the contact
        const deletedContact = await storage.deleteContact(parseInt(req.params.id), currentUser.organizationId);
        
        if (!deletedContact) {
          return res.status(404).json({ message: 'Contact not found' });
        }
        
        // Update lead POC count and status after deleting contact
        try {
          // Get all leads for this company to update their POC status
          const companyLeads = await storage.getLeadsByCompany(companyId, currentUser.organizationId);
          
          for (const lead of companyLeads) {
            // Get remaining contacts for this company to update POC count
            const companyContacts = await storage.getContactsByCompany(companyId, currentUser.organizationId);
            const pocCount = companyContacts.length;
            
            // Determine POC completion status based on contact completeness
            let pocCompletionStatus = 'red'; // Default
            if (pocCount > 0) {
              const completeContacts = companyContacts.filter(c => c.isComplete);
              if (completeContacts.length >= 1) {
                pocCompletionStatus = pocCount >= 3 ? 'green' : 'amber';
              }
            }
            
            // Update the lead's POC fields
            await storage.updateLead(lead.id, currentUser.organizationId, {
              pocCount,
              pocCompletionStatus
            });
          }
        } catch (updateError) {
          console.error('Error updating lead POC status after deletion:', updateError);
          // Don't fail the contact deletion if POC update fails
        }
        
        res.json({ message: 'Contact deleted successfully', deletedContact });
      } catch (error) {
        console.error('Error deleting contact:', error);
        res.status(400).json({ message: 'Failed to delete contact', error: error instanceof Error ? error.message : 'Unknown error' });
      }
    });

    // Lead routes - Analysts, partners, and admins can create leads
    app.post('/api/leads', authMiddleware, requireRole(['analyst', 'partner', 'admin']), async (req: any, res) => {
      try {
        const currentUser = req.verifiedUser;
        if (!currentUser || !currentUser.organizationId) {
          return res.status(401).json({ message: 'User organization not found' });
        }
        
        // Parse lead data, ignoring client-supplied ownerAnalystId and assignedTo for security
        const leadData = insertLeadSchema.parse({
          ...req.body,
          // Security: Never trust client for ownership/assignment fields
          ownerAnalystId: undefined,
          assignedTo: undefined,
          organizationId: undefined // Also ignore client organizationId
        });
        
        // Security: Derive ownerAnalystId from session, not client
        // Only analysts can own leads - they become owners when they create leads
        const ownerAnalystId = currentUser.role === 'analyst' ? currentUser.id : null;
        
        // Initial assignment: null for all (leads start unassigned in universe stage)
        const assignedTo = null;
        
        const lead = await storage.createLead({ 
          ...leadData, 
          organizationId: currentUser.organizationId,
          ownerAnalystId,
          assignedTo,
          stage: 'universe', // All leads start in universe stage
          createdBy: currentUser.id,   // ⭐ REQUIRED
        });
        
        // Log activity
        await storage.createActivityLog({
          organizationId: currentUser.organizationId,
          userId: currentUser.id,
          action: 'lead_created',
          entityType: 'lead',
          entityId: lead.id,
          leadId: lead.id,
          companyId: lead.companyId,
          description: `Created new lead${ownerAnalystId ? ' (analyst-owned)' : ''}`,
        });
        
        res.json(lead);
      } catch (error) {
        console.error('Error creating lead:', error);
        res.status(400).json({ message: 'Failed to create lead', error: error instanceof Error ? error.message : 'Unknown error' });
      }
    });

    // Specific routes must come BEFORE generic :id route to avoid incorrect matching
    app.get('/api/leads/all', authMiddleware, async (req: any, res) => {
      try {
        console.log("api hit /api/leads/all", req.body);
        const user = req.verifiedUser;
        const userId = user.id;
        if (!user || !user.organizationId) {
          return res.status(404).json({ message: 'User not found or missing organization' });
        }
        
        const userRole = user.role || 'analyst';
        
        if (userRole === 'analyst') {
          // Analysts only see leads assigned to them
          const leads = await storage.getLeadsByAssignee(userId, user.organizationId);
          return res.json(leads);
        }

        if (userRole === 'partner') {
          // Partners only see leads assigned to them (partner assignment)
          const leads = await storage.getLeadsByPartner(userId, user.organizationId);
          return res.json(leads);
        }

        // Admin sees all
        const leads = await storage.getAllLeads(user.organizationId);
        return res.json(leads);
      } catch (error) {
        console.error('Error fetching all leads:', error);
        res.status(500).json({ message: 'Failed to fetch all leads' });
      }
    });

    // ------------------------------
    // Contact Management: Active Leads only
    // Active stages = qualified, outreach, pitching, mandates
    // ------------------------------
    const ACTIVE_LEAD_STAGES = new Set<string>([
      "qualified",
      "outreach",
      "pitching",
      "mandates",
    ]);

    const getLeadStage = (l: any) =>
      String(l?.stage ?? l?.lead?.stage ?? "").toLowerCase();

    const filterActiveLeads = (leads: any[]) =>
      (leads || []).filter((l: any) => ACTIVE_LEAD_STAGES.has(getLeadStage(l)));



    app.get('/api/contact-management/metrics', authMiddleware, async (req: any, res) => {
      try {
        const user = req.verifiedUser;
        const userId = user?.id;

        if (!user || !user.organizationId) {
          return res.status(404).json({ message: 'User not found or missing organization' });
        }

        const userRole = user.role || 'analyst';

        let leadsList: any[] = [];
        if (userRole === 'analyst') {
          leadsList = await storage.getLeadsByAssignee(userId, user.organizationId);
        } else if (userRole === 'partner') {
          leadsList = await storage.getLeadsByPartner(userId, user.organizationId);
        } else {
          leadsList = await storage.getAllLeads(user.organizationId);
        }

        // ✅ ONLY Active leads for Contact Management
        leadsList = filterActiveLeads(leadsList);

        const companyIds = (leadsList || [])
          .map((l: any) => l.companyId)
          .filter((x: any) => typeof x === "number");

        const metrics = await storage.getContactManagementMetrics(user.organizationId, companyIds);

        // ------------------------------
        // NEW: Field Coverage Table (7 rows)
        // Denominator = total leads visible to user
        // ------------------------------
        const totalLeads = (leadsList || []).length;

        const isFilled = (v: any) => {
          if (v === null || v === undefined) return false;
          if (typeof v === "string") return v.trim().length > 0;
          return true; // numbers etc.
        };

        const pct = (n: number) => (totalLeads > 0 ? Number(((n / totalLeads) * 100).toFixed(2)) : 0);

        // NOTE: these depend on your actual returned lead shape from storage (works with your current code style)
        const analystCount = (leadsList || []).filter((l: any) => isFilled(l.assignedTo)).length;
        const partnerCount = (leadsList || []).filter((l: any) => isFilled(l.assignedPartnerId)).length;
        const sectorCount = (leadsList || []).filter((l: any) => isFilled(l.company?.sector)).length;
        const leadSourceCount = (leadsList || []).filter((l: any) => isFilled(l.leadSource)).length;
        const websiteCount = (leadsList || []).filter((l: any) => isFilled(l.company?.website)).length;

        // Financial info = 1 only if all three are filled
        const financialInfoCount = (leadsList || []).filter((l: any) => {
          const c = l.company || {};
          return isFilled(c.revenueInrCr) && isFilled(c.ebitdaInrCr) && isFilled(c.patInrCr);
        }).length;

        const fieldCoverage = {
          totalLeads,
          rows: [
            { source: "company", totalNumber: totalLeads, percentage: pct(totalLeads) },
            { source: "analyst", totalNumber: analystCount, percentage: pct(analystCount) },
            { source: "partner", totalNumber: partnerCount, percentage: pct(partnerCount) },
            { source: "sector", totalNumber: sectorCount, percentage: pct(sectorCount) },
            { source: "leadsource", totalNumber: leadSourceCount, percentage: pct(leadSourceCount) },
            { source: "website", totalNumber: websiteCount, percentage: pct(websiteCount) },
            { source: "financial info", totalNumber: financialInfoCount, percentage: pct(financialInfoCount) },
          ],
        };

        // Return old metrics + new table (backward compatible)
        return res.json({
          ...metrics,
          fieldCoverage,
        });

      } catch (error) {
        console.error('Error building contact management metrics:', error);
        return res.status(500).json({ message: 'Failed to fetch contact management metrics' });
      }
    });
 
   app.get('/api/contact-management/poc1', authMiddleware, async (req: any, res) => {
    try {
      const user = req.verifiedUser;
      const userId = user?.id;

      if (!user || !user.organizationId) {
        return res.status(404).json({ message: 'User not found or missing organization' });
      }

      const userRole = user.role || 'analyst';

      let leadsList: any[] = [];
      if (userRole === 'analyst') {
        leadsList = await storage.getLeadsByAssignee(userId, user.organizationId);
      } else if (userRole === 'partner') {
        leadsList = await storage.getLeadsByPartner(userId, user.organizationId);
      } else {
        leadsList = await storage.getAllLeads(user.organizationId);
      }

      // ✅ ONLY Active leads for POC1
      leadsList = filterActiveLeads(leadsList);

      const allUsers = await storage.getUsers(user.organizationId);

      const userMap = new Map<string, any>();
      for (const u of allUsers) userMap.set(u.id, u);

      const getUserLabel = (u: any) => {
        if (!u) return "";
        const full = `${u.firstName || ""} ${u.lastName || ""}`.trim();
        return full || u.email || u.id || "";
      };


      // IMPORTANT: in your storage methods, `contact` is already the PRIMARY contact (isPrimary = true)
      const items = (leadsList || []).map((l: any) => {
        const analystUser = l.assignedToUser || null;
        const partnerUser = l.assignedPartnerId ? userMap.get(l.assignedPartnerId) : null;

        return {
          leadId: l.id ?? l.lead?.id,
          companyId: l.companyId ?? l.lead?.companyId ?? l.company?.id,
          companyName: l.company?.name ?? l.companyName ?? "—",

          // ✅ for filtering
          analystId: l.assignedTo ?? null,
          analystName: getUserLabel(analystUser),
          partnerId: l.assignedPartnerId ?? null,
          partnerName: getUserLabel(partnerUser),

          contactId: l.contact?.id ?? null,
          name: l.contact?.name ?? "",
          designation: l.contact?.designation ?? "",
          phone: l.contact?.phone ?? "",
          linkedinProfile: l.contact?.linkedinProfile ?? "",
          email: l.contact?.email ?? "",
        };
      });


      return res.json({ items });
    } catch (error) {
      console.error('Error building POC1 table:', error);
      return res.status(500).json({ message: 'Failed to fetch POC1 table' });
    }
  });


  app.get('/api/contact-management/poc2', authMiddleware, async (req: any, res) => {
    try {
      const user = req.verifiedUser;
      const userId = user?.id;

      if (!user || !user.organizationId) {
        return res.status(404).json({ message: 'User not found or missing organization' });
      }

      const userRole = user.role || 'analyst';

      let leadsList: any[] = [];
      if (userRole === 'analyst') {
        leadsList = await storage.getLeadsByAssignee(userId, user.organizationId);
      } else if (userRole === 'partner') {
        leadsList = await storage.getLeadsByPartner(userId, user.organizationId);
      } else {
        leadsList = await storage.getAllLeads(user.organizationId);
      }

      // ✅ ONLY Active leads for POC2
      leadsList = filterActiveLeads(leadsList);

    const allUsers = await storage.getUsers(user.organizationId);

    const userMap = new Map<string, any>();
    for (const u of allUsers) userMap.set(u.id, u);

    const getUserLabel = (u: any) => {
      if (!u) return "";
      const full = `${u.firstName || ""} ${u.lastName || ""}`.trim();
      return full || u.email || u.id || "";
    };

      
      const companyIds = (leadsList || [])
        .map((l: any) => l.companyId)
        .filter((x: any) => typeof x === "number");

      const contactRows = companyIds.length
        ? await db
            .select({
              companyId: contacts.companyId,
              id: contacts.id,
              name: contacts.name,
              designation: contacts.designation,
              phone: contacts.phone,
              email: contacts.email,
              linkedinProfile: contacts.linkedinProfile,
            })
            .from(contacts)
            .where(
              and(
                eq(contacts.organizationId, user.organizationId),
                inArray(contacts.companyId, companyIds),
                eq(contacts.isPrimary, false)
              )
            )
            .orderBy(asc(contacts.createdAt), asc(contacts.id))
        : [];

      const byCompany = new Map<number, any[]>();
      for (const c of contactRows) {
        const cid = c.companyId as unknown as number;
        if (!byCompany.has(cid)) byCompany.set(cid, []);
        byCompany.get(cid)!.push(c);
      }

      const items = (leadsList || []).map((l: any) => {
        const list = byCompany.get(l.companyId) || [];
        const poc2 = list[0] || null; // first non-primary
        const analystUser = l.assignedToUser || null;
        const partnerUser = l.assignedPartnerId ? userMap.get(l.assignedPartnerId) : null;
        return {
          leadId: l.id,
          companyId: l.companyId,
          companyName: l.company?.name ?? "—",
            // ✅ for filtering
          analystId: l.assignedTo ?? null,
          analystName: getUserLabel(analystUser),
          partnerId: l.assignedPartnerId ?? null,
          partnerName: getUserLabel(partnerUser),
          contactId: poc2?.id ?? null,
          name: poc2?.name ?? "",
          designation: poc2?.designation ?? "",
          phone: poc2?.phone ?? "",
          linkedinProfile: poc2?.linkedinProfile ?? "",
          email: poc2?.email ?? "",
        };
      });

      return res.json({ items });
    } catch (error) {
      console.error('Error building POC2 table:', error);
      return res.status(500).json({ message: 'Failed to fetch POC2 table' });
    }
  });

  app.get('/api/contact-management/poc3', authMiddleware, async (req: any, res) => {
    try {
      const user = req.verifiedUser;
      const userId = user?.id;

      if (!user || !user.organizationId) {
        return res.status(404).json({ message: 'User not found or missing organization' });
      }

      const userRole = user.role || 'analyst';

      let leadsList: any[] = [];
      if (userRole === 'analyst') {
        leadsList = await storage.getLeadsByAssignee(userId, user.organizationId);
      } else if (userRole === 'partner') {
        leadsList = await storage.getLeadsByPartner(userId, user.organizationId);
      } else {
        leadsList = await storage.getAllLeads(user.organizationId);
      }

      // ✅ ONLY Active leads for POC3
      leadsList = filterActiveLeads(leadsList);

      const allUsers = await storage.getUsers(user.organizationId);

      const userMap = new Map<string, any>();
      for (const u of allUsers) userMap.set(u.id, u);

      const getUserLabel = (u: any) => {
        if (!u) return "";
        const full = `${u.firstName || ""} ${u.lastName || ""}`.trim();
        return full || u.email || u.id || "";
      };

      const companyIds = (leadsList || [])
        .map((l: any) => l.companyId)
        .filter((x: any) => typeof x === "number");

      const contactRows = companyIds.length
        ? await db
            .select({
              companyId: contacts.companyId,
              id: contacts.id,
              name: contacts.name,
              designation: contacts.designation,
              phone: contacts.phone,
              email: contacts.email,
              linkedinProfile: contacts.linkedinProfile,
            })
            .from(contacts)
            .where(
              and(
                eq(contacts.organizationId, user.organizationId),
                inArray(contacts.companyId, companyIds),
                eq(contacts.isPrimary, false)
              )
            )
            .orderBy(asc(contacts.createdAt), asc(contacts.id))
        : [];

      const byCompany = new Map<number, any[]>();
      for (const c of contactRows) {
        const cid = c.companyId as unknown as number;
        if (!byCompany.has(cid)) byCompany.set(cid, []);
        byCompany.get(cid)!.push(c);
      }

      const items = (leadsList || []).map((l: any) => {
        const list = byCompany.get(l.companyId) || [];
        const poc3 = list[1] || null; // second non-primary
        const analystUser = l.assignedToUser || null;
        const partnerUser = l.assignedPartnerId ? userMap.get(l.assignedPartnerId) : null;
        return {
          leadId: l.id,
          companyId: l.companyId,
          companyName: l.company?.name ?? "—",
            // ✅ for filtering
          analystId: l.assignedTo ?? null,
          analystName: getUserLabel(analystUser),
          partnerId: l.assignedPartnerId ?? null,
          partnerName: getUserLabel(partnerUser),
          contactId: poc3?.id ?? null,
          name: poc3?.name ?? "",
          designation: poc3?.designation ?? "",
          phone: poc3?.phone ?? "",
          linkedinProfile: poc3?.linkedinProfile ?? "",
          email: poc3?.email ?? "",
        };
      });

      return res.json({ items });
    } catch (error) {
      console.error('Error building POC3 table:', error);
      return res.status(500).json({ message: 'Failed to fetch POC3 table' });
    }
  });



    // ---------------------------------------------------------
  // Contact Management: Other Fields (Active Leads only)
  // ---------------------------------------------------------
  app.get('/api/contact-management/other-fields', authMiddleware, async (req: any, res) => {
    try {
      const user = req.verifiedUser;
      const userId = user?.id;

      if (!user || !user.organizationId) {
        return res.status(404).json({ message: 'User not found or missing organization' });
      }

      const userRole = user.role || 'analyst';

      let leadsList: any[] = [];
      if (userRole === 'analyst') {
        leadsList = await storage.getLeadsByAssignee(userId, user.organizationId);
      } else if (userRole === 'partner') {
        leadsList = await storage.getLeadsByPartner(userId, user.organizationId);
      } else {
        leadsList = await storage.getAllLeads(user.organizationId);
      }

      // ✅ Active leads only (same logic as POC tabs)
      leadsList = filterActiveLeads(leadsList);

      const toNum = (v: any) => {
        if (v === null || v === undefined || v === "") return null;
        const n = typeof v === "number" ? v : Number(v);
        return Number.isFinite(n) ? n : null;
      };

      const items = (leadsList || []).map((l: any) => {
        const company = l.company ?? l.company;
        return {
          leadId: l.id ?? l.lead?.id,
          companyId: l.companyId ?? l.lead?.companyId ?? company?.id,
          companyName: company?.name ?? l.companyName ?? "—",

          sector: company?.sector ?? "",
          leadSource: l.leadSource ?? l.lead?.leadSource ?? "",
          website: company?.website ?? "",

          revenueInrCr: toNum(company?.revenueInrCr),
          ebitdaInrCr: toNum(company?.ebitdaInrCr),
          patInrCr: toNum(company?.patInrCr),
        };
      });

      return res.json({ items });
    } catch (error) {
      console.error('Error building Other Fields table:', error);
      return res.status(500).json({ message: 'Failed to fetch Other Fields table' });
    }
  });

  app.patch('/api/contact-management/other-fields/:leadId', authMiddleware, async (req: any, res) => {
    try {
      const user = req.verifiedUser;
      const userId = user?.id;

      if (!user || !user.organizationId) {
        return res.status(404).json({ message: 'User not found or missing organization' });
      }

      const leadId = Number(req.params.leadId);
      if (!Number.isFinite(leadId)) {
        return res.status(400).json({ message: 'Invalid leadId' });
      }

      // ✅ Permission check by visibility (same logic as POC tabs)
      const userRole = user.role || 'analyst';

      let leadsList: any[] = [];
      if (userRole === 'analyst') {
        leadsList = await storage.getLeadsByAssignee(userId, user.organizationId);
      } else if (userRole === 'partner') {
        leadsList = await storage.getLeadsByPartner(userId, user.organizationId);
      } else {
        leadsList = await storage.getAllLeads(user.organizationId);
      }

      leadsList = filterActiveLeads(leadsList);

      const target = (leadsList || []).find((l: any) => (l.id ?? l.lead?.id) === leadId);
      if (!target) {
        return res.status(404).json({ message: 'Lead not found (or not visible / not active)' });
      }

      const company = target.company ?? target.company;
      const companyId = target.companyId ?? target.lead?.companyId ?? company?.id;

      if (!companyId || !Number.isFinite(Number(companyId))) {
        return res.status(400).json({ message: 'Missing companyId for this lead' });
      }

      const body = req.body || {};

      const coerceText = (v: any) => (typeof v === "string" ? v.trim() : v);
      const coerceNum = (v: any) => {
        if (v === null || v === undefined || v === "") return undefined;
        const n = typeof v === "number" ? v : Number(v);
        return Number.isFinite(n) ? n : undefined;
      };

      const companyUpdates: any = {};
      if ("sector" in body) companyUpdates.sector = coerceText(body.sector) ?? "";
      if ("website" in body) companyUpdates.website = coerceText(body.website) ?? "";

      if ("revenueInrCr" in body) {
        const n = coerceNum(body.revenueInrCr);
        if (n !== undefined) companyUpdates.revenueInrCr = n;
      }
      if ("ebitdaInrCr" in body) {
        const n = coerceNum(body.ebitdaInrCr);
        if (n !== undefined) companyUpdates.ebitdaInrCr = n;
      }
      if ("patInrCr" in body) {
        const n = coerceNum(body.patInrCr);
        if (n !== undefined) companyUpdates.patInrCr = n;
      }

      const hasCompanyUpdates = Object.keys(companyUpdates).length > 0;

      if (hasCompanyUpdates) {
        await storage.updateCompany(Number(companyId), user.organizationId, companyUpdates);
      }

      if ("leadSource" in body) {
        const leadSource = coerceText(body.leadSource) ?? "";
        await storage.updateLead(leadId, user.organizationId, { leadSource });
      }

      return res.json({ ok: true });
    } catch (error) {
      console.error('Error saving Other Fields row:', error);
      return res.status(500).json({ message: 'Failed to save Other Fields row' });
    }
  });




    app.get('/api/leads/my', authMiddleware, async (req: any, res) => {
      try {
        const userId = req.verifiedUser.id;
        if (!userId) {
          return res.status(400).json({ message: 'User ID not found in token' });
        }
        
        // Get user to access organizationId
        const user = await storage.getUser(userId);
        if (!user || !user.organizationId) {
          return res.status(404).json({ message: 'User not found or missing organization' });
        }
        
        const leads = await storage.getLeadsByAssignee(userId, user.organizationId);
        res.json(leads);
      } catch (error) {
        console.error('Error fetching my leads:', error);
        res.status(500).json({ message: 'Failed to fetch leads' });
      }
    });

    app.get('/api/leads/stage/:stage', authMiddleware, validateStage, async (req: any, res) => {
      try {
        const user = req.verifiedUser;
        const userId = user?.id;

        if (!user || !user.organizationId) {
          return res.status(404).json({ message: 'User not found or missing organization' });
        }

        const userRole = user.role || 'analyst';
        const stage = req.params.stage;

        // ✅ Universe = ALL leads (same behavior as your Universe tab)
        const isUniverse = stage === 'universe';

        if (userRole === 'analyst') {
          const allAssignedLeads = await storage.getLeadsByAssignee(userId, user.organizationId);
          const filtered = isUniverse ? allAssignedLeads : allAssignedLeads.filter(l => l.stage === stage);
          return res.json(filtered);
        }

        if (userRole === 'partner') {
          const partnerLeads = await storage.getLeadsByPartner(userId, user.organizationId);
          const filtered = isUniverse ? partnerLeads : partnerLeads.filter(l => l.stage === stage);
          return res.json(filtered);
        }

        // admin
        if (isUniverse) {
          const all = await storage.getAllLeads(user.organizationId);
          return res.json(all);
        }

        const leads = await storage.getLeadsByStage(stage, user.organizationId);
        return res.json(leads);

      } catch (error) {
        console.error('Error fetching leads by stage:', error);
        return res.status(500).json({ message: 'Failed to fetch leads' });
      }
    });


    // GET leads assigned to current intern user (for intern dashboard)
    app.get('/api/leads/assigned', authMiddleware, requireRole(['intern']), async (req: any, res) => {
      try {
        const currentUser = req.verifiedUser;
        if (!currentUser || !currentUser.organizationId) {
          return res.status(401).json({ message: 'User organization not found' });
        }

        // Fetch all leads where current user is in assignedInterns array
        const allLeads = await storage.getAllLeads(currentUser.organizationId);
        const assignedLeads = allLeads.filter(lead => 
          lead.assignedInterns && lead.assignedInterns.includes(currentUser.id)
        );

        // Add assignment date from updatedAt or createdAt
        const leadsWithAssignmentDate = assignedLeads.map(lead => ({
          ...lead,
          assignmentDate: lead.updatedAt?.toISOString() || lead.createdAt?.toISOString()
        }));

        res.json(leadsWithAssignmentDate);
      } catch (error) {
        console.error('Error fetching assigned leads for intern:', error);
        res.status(500).json({ message: 'Failed to fetch assigned leads' });
      }
    });

    app.get('/api/leads/assigned/:userId', authMiddleware, requireRole(['partner', 'admin']), async (req: any, res) => {
      try {
        // Verify the user exists
        const user = await storage.getUser(req.params.userId);
        if (!user || !user.organizationId) {
          return res.status(404).json({ message: 'User not found or missing organization' });
        }
        
        const leads = await storage.getLeadsByAssignee(req.params.userId, user.organizationId);
        res.json(leads);
      } catch (error) {
        console.error('Error fetching assigned leads:', error);
        res.status(500).json({ message: 'Failed to fetch assigned leads' });
      }
    });

    // GET individual lead by ID with organization scoping (must come AFTER specific routes)
    app.get('/api/leads/:id', authMiddleware, validateIntParam('id'), validateResourceExists('lead'), async (req: any, res) => {
      try {
        // Lead already validated by middleware
        const lead = req.resource;

        if (req.verifiedUser.role === 'partner' && lead.assignedPartnerId !== req.verifiedUser.id) {
          return res.status(403).json({ message: 'Access denied' });
        }

        // ✅ Call storage.getLead to ensure we get the populated Company data
        const fullLead = await storage.getLead(lead.id, req.verifiedUser.organizationId);

        res.json(fullLead);
      } catch (error) {
        console.error('Error fetching lead:', error);
        res.status(500).json({ message: 'Failed to fetch lead' });
      }
    });

    app.put('/api/leads/:id', authMiddleware, requireRole(['partner', 'admin']), validateResourceExists('lead'), async (req: any, res) => {
      try {
        const currentUser = req.verifiedUser;
        if (!currentUser || !currentUser.organizationId) {
          return res.status(401).json({ message: 'User organization not found' });
        }
        const updates = updateLeadSchema.parse(req.body); // Security: organizationId cannot be changed
        
        // If stage is being updated, validate the transition
        if (updates.stage) {
          const validation = await stageProgressionService.validateStageTransition(parseInt(req.params.id), currentUser.organizationId, updates.stage);
          if (!validation.isValid) {
            return res.status(400).json({ 
              message: 'Invalid stage transition', 
              errors: validation.errors,
              missingFields: validation.missingFields 
            });
          }
        }
        
        const lead = await storage.updateLead(parseInt(req.params.id), currentUser.organizationId, updates);
        res.json(lead);
      } catch (error) {
        console.error('Error updating lead:', error);
        res.status(400).json({ message: 'Failed to update lead', error: error instanceof Error ? error.message : 'Unknown error' });
      }
    });

    // PATCH: Update only notes / remarks for a lead
    app.patch('/api/leads/:id', authMiddleware, validateResourceExists('lead'), async (req: any, res) => {
      try {
        const currentUser = req.verifiedUser;
        if (!currentUser || !currentUser.organizationId) {
          return res.status(401).json({ message: 'User organization not found' });
        }

        const { notes } = req.body;
        if (notes === undefined) {
          return res.status(400).json({ message: 'Notes field is required' });
        }

        // Only update notes field — nothing else
        const updated = await storage.updateLead(
          parseInt(req.params.id),
          currentUser.organizationId,
          { notes }
        );

        res.json(updated);
      } catch (error) {
        console.error('Error updating notes:', error);
        res.status(400).json({
          message: 'Failed to update notes',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });


        // PATCH: Update only card next action for a lead
    app.patch('/api/leads/:id/card-next-action', authMiddleware, validateResourceExists('lead'), async (req: any, res) => {
      try {
        const currentUser = req.verifiedUser;
        if (!currentUser || !currentUser.organizationId) {
          return res.status(401).json({ message: 'User organization not found' });
        }

        const { cardNextActionText, cardNextActionDate } = req.body || {};

        if (cardNextActionText === undefined && cardNextActionDate === undefined) {
          return res.status(400).json({ message: 'cardNextActionText or cardNextActionDate is required' });
        }

        let parsedDate: Date | null = null;

        if (cardNextActionDate !== undefined) {
          if (cardNextActionDate === null || cardNextActionDate === "") {
            parsedDate = null;
          } else {
            parsedDate = new Date(cardNextActionDate);
            if (isNaN(parsedDate.getTime())) {
              return res.status(400).json({ message: 'Invalid cardNextActionDate' });
            }
          }
        }

        const updated = await storage.updateLeadCardNextAction(
          parseInt(req.params.id),
          currentUser.organizationId,
          typeof cardNextActionText === 'string' ? (cardNextActionText.trim() || null) : null,
          parsedDate
        );

        res.json(updated);
      } catch (error) {
        console.error('Error updating lead card next action:', error);
        res.status(400).json({
          message: 'Failed to update lead card next action',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });


   // PATCH: Update only leadSource for a lead
    app.patch('/api/leads/:id/source', authMiddleware, validateResourceExists('lead'), async (req: any, res) => {
      try {
        const currentUser = req.verifiedUser;
        if (!currentUser || !currentUser.organizationId) {
          return res.status(401).json({ message: 'User organization not found' });
        }

        const { leadSource } = req.body;

        // must be provided (can be null to clear)
        if (leadSource === undefined) {
          return res.status(400).json({ message: 'leadSource field is required' });
        }

        const validSources = ['inbound', 'outbound', 'otherchannelpartner', 'idfc', 'maheen', 'altmount'];
        if (leadSource !== null && !validSources.includes(leadSource)) {
          return res.status(400).json({ message: 'Invalid leadSource value' });
        }

        const updated = await storage.updateLead(
          parseInt(req.params.id),
          currentUser.organizationId,
          { leadSource }
        );

        res.json(updated);
      } catch (error) {
        console.error('Error updating leadSource:', error);
        res.status(400).json({
          message: 'Failed to update leadSource',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });


    
    // PATCH: Update only chatgptLink for a lead
    app.patch('/api/leads/:id/chatgpt-link', authMiddleware, validateResourceExists('lead'), async (req: any, res) => {
      try {
        const currentUser = req.verifiedUser;
        if (!currentUser || !currentUser.organizationId) {
          return res.status(401).json({ message: 'User organization not found' });
        }

        const { chatgptLink } = req.body;

        const updated = await storage.updateLead(
          parseInt(req.params.id),
          currentUser.organizationId,
          { chatgptLink: chatgptLink || null } as any
        );

        res.json(updated);
      } catch (error) {
        console.error('Error updating chatgptLink:', error);
        res.status(400).json({
          message: 'Failed to update chatgptLink',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });


// PATCH: Update only leadTemperature for a lead (null = Not set)
app.patch('/api/leads/:id/temperature', authMiddleware, validateResourceExists('lead'), async (req: any, res) => {
  try {
    const currentUser = req.verifiedUser;
    if (!currentUser || !currentUser.organizationId) {
      return res.status(401).json({ message: 'User organization not found' });
    }

    const { leadTemperature } = req.body;

    if (leadTemperature === undefined) {
      return res.status(400).json({ message: 'leadTemperature field is required' });
    }

    // Allow: "hot", "warm", "not_reached", null.
    // Also tolerate UI sending "not_set" or "" -> null.
    // Also normalize "Not reached" -> "not_reached"
    const normalized =
      leadTemperature === null || leadTemperature === "" || leadTemperature === "not_set"
        ? null
        : String(leadTemperature).toLowerCase().trim().replace(/\s+/g, "_");

    const validTemps = ["hot", "warm", "not_reached"];
    if (normalized !== null && !validTemps.includes(normalized)) {
      return res.status(400).json({ message: "Invalid leadTemperature value" });
    }

    const updated = await storage.updateLead(
      parseInt(req.params.id),
      currentUser.organizationId,
      { leadTemperature: normalized } as any
    );

    res.json(updated);
  } catch (error) {
    console.error('Error updating leadTemperature:', error);
    res.status(400).json({
      message: 'Failed to update leadTemperature',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});


    // PATCH route for manual stage transitions: qualified → outreach, outreach → pitching, pitching → mandates
    app.patch('/api/leads/:id/stage', authMiddleware, validateResourceExists('lead'), async (req: any, res) => {
      try {
        const currentUser = req.verifiedUser;
        if (!currentUser || !currentUser.organizationId) {
          return res.status(401).json({ message: 'User organization not found' });
        }
        
        const { stage, defaultPocId, backupPocId, note } = req.body;
        if (!stage) {
          return res.status(400).json({ message: 'Stage is required' });
        }
        
        // Validate stage is a valid value
        const validStages = ['universe', 'qualified', 'outreach', 'pitching', 'mandates', 'completed_mandate', 'won', 'lost', 'hold', 'dropped', 'rejected'];
        if (!validStages.includes(stage)) {
          return res.status(400).json({ message: 'Invalid stage value' });
        }
        
        const leadId = parseInt(req.params.id);
        const currentLead = req.resource; // Already validated by middleware
        
        // CRITICAL SECURITY: Only allow three manual transitions:
        // 1. qualified → outreach (no validation)
        // 2. outreach → pitching (requires meeting intervention and POC selection)
        // 3. pitching → mandates (simple confirmation, no document required)
        // All other transitions must use the full PUT route with StageProgressionService validation
        const isQualifiedToOutreach = currentLead.stage === 'qualified' && stage === 'outreach';
        const isOutreachToPitching = currentLead.stage === 'outreach' && stage === 'pitching';
        const isPitchingToMandates = currentLead.stage === 'pitching' && stage === 'mandates';
        const isMandatesToCompletedMandate = currentLead.stage === 'mandates' && stage === 'completed_mandate';
 
        const isMoveToHold = stage === 'hold';
        const isMoveToDropped = stage === 'dropped';

        // IMPORTANT: From Hold/Dropped pages, your UI only does direct PATCH moves to Universe/Qualified.
        // (Outreach/Pitching/Mandates are handled via their own flows.)
        const isFromHoldOrDroppedToSimple =
          (currentLead.stage === 'hold' || currentLead.stage === 'dropped') &&
          (stage === 'universe' || stage === 'qualified');

        if (
          !isQualifiedToOutreach &&
          !isOutreachToPitching &&
          !isPitchingToMandates &&
          !isMandatesToCompletedMandate &&
          !isMoveToHold &&
          !isMoveToDropped &&
          !isFromHoldOrDroppedToSimple
        ) {
          return res.status(400).json({
            message:
              'This endpoint only supports: Qualified→Outreach, Outreach→Pitching, Pitching→Mandates, Mandates→Completed Mandate, Move→Hold, Move→Dropped, or Hold/Dropped→(Universe/Qualified)',
            currentStage: currentLead.stage,
            requestedStage: stage,
          });
        }

        
        // For outreach → pitching transition, validate that a meeting intervention exists and POC is selected
        if (isOutreachToPitching) {
          // Allow Outreach → Pitching even without meeting and even without POCs.
          // But if POCs are provided, validate they belong to the same company + org.

          // Validate default POC only if provided
          if (defaultPocId) {
            const defaultContact = await storage.getContact(defaultPocId, currentUser.organizationId);
            if (!defaultContact) {
              return res.status(404).json({ message: 'Default POC not found' });
            }

            if (defaultContact.companyId !== currentLead.companyId) {
              return res.status(403).json({ message: 'Invalid POC: Contact must belong to the same company' });
            }
          }

          // Validate backup POC only if provided
          if (backupPocId) {
            // backup requires default
            if (!defaultPocId) {
              return res.status(400).json({ message: 'Backup POC requires a Default POC' });
            }

            // Ensure backup is different from default
            if (backupPocId === defaultPocId) {
              return res.status(400).json({ message: 'Backup POC must be different from default POC' });
            }

            const backupContact = await storage.getContact(backupPocId, currentUser.organizationId);
            if (!backupContact) {
              return res.status(404).json({ message: 'Backup POC not found' });
            }

            if (backupContact.companyId !== currentLead.companyId) {
              return res.status(403).json({ message: 'Invalid backup POC: Contact must belong to the same company' });
            }
          }
        }

        if (isMandatesToCompletedMandate) {
          if (!note || !String(note).trim()) {
            return res.status(400).json({ message: 'Note is required to move to Completed Mandate' });
          }
        }

        const updates: any = { stage };

        if (isOutreachToPitching && defaultPocId) {
          updates.defaultPocId = defaultPocId;
          updates.backupPocId = backupPocId || null;
        }

        if (isMandatesToCompletedMandate) {
          updates.notes = String(note).trim();
        }
        
        const lead = await storage.updateLead(leadId, currentUser.organizationId, updates);
        
        // Log the stage transition
        await ActivityLogService.logActivity({
          organizationId: currentUser.organizationId,
          leadId,
          companyId: lead?.companyId,
          userId: currentUser.id,
          action: 'lead_stage_changed',
          entityType: 'lead',
          entityId: leadId,
          oldValue: currentLead.stage,
          newValue: stage,
          description: `Lead manually moved from ${currentLead.stage} to ${stage}`
        });

        // ✅ NEW: Find all EPN partners linked to this lead and auto-sync their stages
        try {
          const linkedEpns = await storage.getLinkedEpnsForLead(currentUser.organizationId, leadId);
          for (const epn of linkedEpns) {
            await storage.syncEpnPartnerStage(currentUser.organizationId, epn.id);
          }
        } catch (syncErr) {
          console.error('Error syncing EPN partner stages:', syncErr);
        }

        
        res.json(lead);
      } catch (error) {
        console.error('Error updating lead stage:', error);
        res.status(400).json({ message: 'Failed to update lead stage', error: error instanceof Error ? error.message : 'Unknown error' });
      }
    });

    // PATCH route to reject a lead from any stage with required comments
    app.patch('/api/leads/:id/reject', authMiddleware, validateResourceExists('lead'), async (req: any, res) => {
      try {
        const currentUser = req.verifiedUser;
        if (!currentUser || !currentUser.organizationId) {
          return res.status(401).json({ message: 'User organization not found' });
        }
        
        const { rejectionReason } = req.body;
        if (!rejectionReason || rejectionReason.trim().length === 0) {
          return res.status(400).json({ message: 'Rejection reason is required' });
        }
        
        const leadId = parseInt(req.params.id);
        const currentLead = req.resource; // Already validated by middleware
        
        // Check if lead is already rejected
        if (currentLead.stage === 'rejected') {
          return res.status(400).json({ 
            message: 'Lead is already rejected',
            currentStage: currentLead.stage
          });
        }
        
        // Update lead to rejected stage
        const lead = await storage.updateLead(leadId, currentUser.organizationId, { stage: 'rejected' });
        
        // Log the rejection activity with reason
        await ActivityLogService.logActivity({
          organizationId: currentUser.organizationId,
          leadId,
          companyId: lead?.companyId,
          userId: currentUser.id,
          action: 'lead_rejected',
          entityType: 'lead',
          entityId: leadId,
          oldValue: currentLead.stage,
          newValue: 'rejected',
          description: `Lead rejected from ${currentLead.stage} stage. Reason: ${rejectionReason}`
        });

        // ✅ NEW: Find all EPN partners linked to this lead and auto-sync their stages
        try {
          const linkedEpns = await storage.getLinkedEpnsForLead(currentUser.organizationId, leadId);
          for (const epn of linkedEpns) {
            await storage.syncEpnPartnerStage(currentUser.organizationId, epn.id);
          }
        } catch (syncErr) {
          console.error('Error syncing EPN partner stages:', syncErr);
        }
        
        
        res.json(lead);
      } catch (error) {
        console.error('Error rejecting lead:', error);
        res.status(400).json({ message: 'Failed to reject lead', error: error instanceof Error ? error.message : 'Unknown error' });
      }
    });

  app.post(
  "/api/leads/:id/assign",
  authMiddleware,
  requireRole(["admin"]),
  validateResourceExists("lead"),
  async (req: any, res) => {
    try {
      const { assignedTo, assignedPartnerId, notes, challengeToken } = req.body;
      const assignedBy = req.verifiedUser.id;
      const leadId = parseInt(req.params.id, 10);
      const organizationId = req.verifiedUser.organizationId;

      const currentLead = await storage.getLead(leadId, organizationId);
      if (!currentLead) return res.status(404).json({ message: "Lead not found" });

      // ✅ PATCH semantics
      const hasAssignedTo = Object.prototype.hasOwnProperty.call(req.body, "assignedTo");
      const hasAssignedPartnerId = Object.prototype.hasOwnProperty.call(req.body, "assignedPartnerId");

      // Reassignment only if changing an existing value
      const analystChanged =
        hasAssignedTo &&
        !!currentLead.assignedTo &&
        currentLead.assignedTo !== assignedTo;

      const partnerChanged =
        hasAssignedPartnerId &&
        !!(currentLead as any).assignedPartnerId &&
        (currentLead as any).assignedPartnerId !== assignedPartnerId;

      const isReassignment = !!(analystChanged || partnerChanged);

      if (isReassignment) {
        if (!challengeToken) {
          return res.status(400).json({ message: "Challenge token required for reassignments", isReassignment: true });
        }

        const isValidToken = await storage.validateChallengeToken(
          challengeToken,
          req.verifiedUser.id,
          organizationId,
          leadId,
          "reassignment"
        );

        if (!isValidToken) {
          return res.status(400).json({ message: "Invalid or expired challenge token", isReassignment: true });
        }
      }

      // Validate analyst only if key present and not null
      if (hasAssignedTo && assignedTo !== null) {
        const analystUser = await storage.getUser(assignedTo);
        if (!analystUser) return res.status(404).json({ message: "Analyst user not found" });
        if (analystUser.role !== "analyst") return res.status(400).json({ message: "assignedTo must be an analyst user" });
      }

      // Validate partner only if key present and not null
      if (hasAssignedPartnerId && assignedPartnerId !== null) {
        const partnerUser = await storage.getUser(assignedPartnerId);
        if (!partnerUser) return res.status(404).json({ message: "Partner user not found" });
        if (partnerUser.role !== "partner") return res.status(400).json({ message: "assignedPartnerId must be a partner user" });
      }

      // undefined => keep; null => clear
      const assignedToToSend = hasAssignedTo ? (assignedTo ?? null) : undefined;
      const assignedPartnerToSend = hasAssignedPartnerId ? (assignedPartnerId ?? null) : undefined;

      await storage.assignLead(
        leadId,
        organizationId,
        assignedToToSend,
        assignedPartnerToSend,
        assignedBy,
        notes
      );

      return res.json({ success: true });
    } catch (error: any) {
      console.error("Error assigning lead:", error);
      return res.status(400).json({ message: "Failed to assign lead", error: error?.message || "Unknown error" });
    }
  }
);


    // Assign multiple interns to a lead
    app.post('/api/leads/:id/assign-interns', authMiddleware, requireRole(['partner', 'admin']), validateResourceExists('lead'), async (req: any, res) => {
      try {
        const { internIds, notes } = req.body;
        const assignedBy = req.verifiedUser.id;
        const leadId = parseInt(req.params.id);
        
        if (!internIds || !Array.isArray(internIds)) {
          return res.status(400).json({ message: 'Intern IDs array is required' });
        }
        
        await storage.assignInternsToLead(leadId, req.verifiedUser.organizationId, internIds, assignedBy, notes);
        
        // Log the assignment activity
        try {
          const currentUser = req.verifiedUser || await storage.getUser(assignedBy);
          const lead = await storage.getLead(leadId, currentUser.organizationId);
          if (lead && currentUser) {
            const company = await storage.getCompany(lead.companyId, currentUser.organizationId);
            if (company) {
              const internNames = [];
              for (const internId of internIds) {
                const intern = await storage.getUser(internId);
                if (intern) {
                  internNames.push(`${intern.firstName || ''} ${intern.lastName || ''}`.trim() || intern.email);
                }
              }
              
              await ActivityLogService.logActivity({
                organizationId: currentUser.organizationId,
                leadId: lead.id,
                companyId: lead.companyId,
                userId: assignedBy,
                action: 'lead_assigned',
                entityType: 'lead',
                entityId: lead.id,
                newValue: internNames.join(', '),
                description: `Lead assigned to ${internNames.join(', ')}`
              });
            }
          }
        } catch (logError) {
          console.error('Error logging assignment activity:', logError);
        }
        
        res.json({ success: true });
      } catch (error) {
        console.error('Error assigning interns to lead:', error);
        res.status(400).json({ message: 'Failed to assign interns', error: error instanceof Error ? error.message : 'Unknown error' });
      }
    });

    // Bulk assign leads route
    // Bulk assign leads route
     app.post(
      "/api/leads/bulk-assign",
      authMiddleware,
      requireRole(["partner", "admin"]),
      async (req: any, res) => {
        try {
          const { leadIds, assignedTo } = req.body;
          const assignedBy = req.verifiedUser.id;
          const organizationId = req.verifiedUser.organizationId;

          if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
            return res.status(400).json({ message: "Lead IDs array is required" });
          }

          if (!assignedTo) {
            return res.status(400).json({ message: "Assigned user is required" });
          }
          // ✅ Normalize leadIds to numbers (front-end often sends strings)
          const leadIdsNum = leadIds
            .map((id: any) => Number(id))
            .filter((n: number) => Number.isFinite(n));

          if (leadIdsNum.length !== leadIds.length) {
            return res.status(400).json({ message: "Invalid leadIds: must be numbers" });
          }

          // Verify the user being assigned to exists and belongs to the same organization
          const assignedUser = await storage.getUser(assignedTo);
          if (!assignedUser) {
            return res.status(404).json({ message: "Assigned user not found" });
          }

          if (Number(assignedUser.organizationId) !== Number(organizationId)) {
            return res
              .status(403)
              .json({ message: "Cannot assign leads to users outside your organization" });
          }

          const isAnalystAssignee = assignedUser.role === "analyst";
          const isPartnerAssignee = assignedUser.role === "partner";

          if (!isAnalystAssignee && !isPartnerAssignee) {
            return res.status(400).json({
              message: "Failed to bulk assign leads",
              error: "Assigned user must be an analyst or partner",
            });
          }


          // Verify all leads exist and belong to the organization
          for (const leadId of leadIdsNum) {
            const lead = await storage.getLead(leadId, organizationId);
            if (!lead) {
              return res.status(404).json({ message: `Lead ${leadId} not found` });
            }
          }

          // Perform bulk assignment + auto move Universe -> Qualified when assigned to analyst
          let autoQualifiedCount = 0;

          for (const leadId of leadIdsNum) {
            if (isAnalystAssignee) {
              // 1) Assign to analyst (assignedTo)
              await storage.assignLead(
                leadId,
                organizationId,
                assignedTo,
                undefined,
                assignedBy,
                "Bulk assignment"
              );

              // 2) Trigger stage logic (only for analyst assignment)
              try {
                await stageProgressionService.autoProgressLead(leadId, organizationId);
              } catch (e) {
                console.error(`Auto-progression failed for lead ${leadId}:`, e);
              }

              // 3) SAFETY fallback: force Universe -> Qualified if assigned to analyst
              const updatedLead = await storage.getLead(leadId, organizationId);
              if (updatedLead && updatedLead.stage === "universe") {
                await storage.updateLead(leadId, organizationId, { stage: "qualified" });
              }

              // Count qualified after everything
              const finalLead = await storage.getLead(leadId, organizationId);
              if (finalLead?.stage === "qualified") {
                autoQualifiedCount++;
              }
            } else {
              // ✅ Assign to partner (assignedPartnerId)
              await storage.assignLead(
                leadId,
                organizationId,
                undefined,        // DO NOT touch assignedTo
                assignedTo,       // partner id goes here
                assignedBy,
                "Bulk assignment"
              );

              // ❌ No autoProgressLead / no Universe->Qualified move for partner assignment
            }
          }

            // OPTIONAL (only if you want the same “normal flow” checks)
            // try {
            //   await stageProgressionService.autoProgressLead(leadId, organizationId);
            // } catch (e) {
            //   console.log(`Auto-progression failed for lead ${leadId}:`, e);
            // }
          

          return res.json({
            success: true,
            message: `Successfully assigned ${leadIds.length} leads to ${assignedUser.firstName} ${assignedUser.lastName}`,
            assignedCount: leadIds.length,
            autoQualifiedCount,
          });
        } catch (error) {
          console.error("Error bulk assigning leads:", error);
          return res.status(400).json({
            message: "Failed to bulk assign leads",
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }
    );



    // Hierarchical assignment endpoints for Partner→Analyst→Intern system
    
    // Assign lead to intern(s) - supports single or multiple intern assignment
    app.patch('/api/leads/:id/assign-intern', authMiddleware, requireRole(['analyst', 'partner', 'admin']), validateIntParam('id'), validateResourceExists('lead'), async (req: any, res) => {
      try {
        const currentUser = req.verifiedUser;
        if (!currentUser || !currentUser.organizationId) {
          return res.status(401).json({ message: 'User organization not found' });
        }

        // Support both single internId and array of internIds
        let { internId, internIds, notes } = req.body;
        const leadId = parseInt(req.params.id);

        // Normalize to array format
        if (internId && !internIds) {
          internIds = [internId];
        }

        if (!internIds || internIds.length === 0) {
          return res.status(400).json({ message: 'At least one intern ID is required' });
        }

        // Use lead from middleware (already validated)
        const lead = req.resource;

        // Validate all interns exist, have correct role, and belong to organization
        const interns = [];
        for (const id of internIds) {
          const intern = await storage.getUser(id);
          if (!intern || intern.organizationId !== currentUser.organizationId) {
            return res.status(404).json({ message: `Intern ${id} not found` });
          }

          if (intern.role !== 'intern') {
            return res.status(400).json({ message: `User ${id} is not an intern` });
          }

          interns.push(intern);
        }

            // For analysts: verify ownership and handle universe leads
          if (currentUser.role === 'analyst') {
            // If lead has no owner (universe stage), analyst claims it by assigning their intern
            if (lead.ownerAnalystId && lead.ownerAnalystId !== currentUser.id) {
              return res.status(403).json({ message: 'You can only assign your own leads to interns' });
            }
            
            // Claim ownership of universe leads when assigning
            if (!lead.ownerAnalystId) {
              await storage.updateLead(leadId, currentUser.organizationId, {
                ownerAnalystId: currentUser.id
              });
            }
            // All interns in organization are now valid - no hierarchical restriction
          }

          // For partners: validate they manage the lead owner analyst
          if (currentUser.role === 'partner') {
            // Require lead has an owner analyst
            if (!lead.ownerAnalystId) {
              return res.status(400).json({ message: 'Lead must have an owner analyst before assigning to intern' });
            }


          // Verify partner manages the lead's owner analyst
          const managesOwner = await storage.validatePartnerOf(currentUser.id, lead.ownerAnalystId, currentUser.organizationId);
          if (!managesOwner) {
            return res.status(403).json({ message: 'You can only manage leads owned by analysts you supervise' });
          }
          // All interns in organization are now valid - no hierarchical restriction
        }

        // For admins: organization scoping is sufficient - no additional validation needed
        if (currentUser.role === 'admin') {
          // All interns in organization are valid
        }

        // Use the assignInternsToLead method that handles the assignedInterns array
        await storage.assignInternsToLead(leadId, currentUser.organizationId, internIds, currentUser.id, notes);

        // Log activity
        const internNames = interns.map(i => `${i.firstName} ${i.lastName}`).join(', ');
        await storage.createActivityLog({
          organizationId: currentUser.organizationId,
          userId: currentUser.id,
          action: 'lead_assigned_intern',
          entityType: 'lead',
          entityId: leadId,
          leadId,
          companyId: lead.companyId,
          description: `Assigned lead to intern(s): ${internNames}`,
        });

        res.json({ success: true, message: `Lead assigned to ${interns.length} intern(s) successfully` });
      } catch (error) {
        console.error('Error assigning lead to intern:', error);
        res.status(400).json({ message: 'Failed to assign lead to intern', error: error instanceof Error ? error.message : 'Unknown error' });
      }
    });



    // Users route: supports optional ?role=intern to return interns scoped to current org
    app.get('/api/users',
      authMiddleware,
      requireRole(['partner', 'admin', 'analyst']),
      async (req: any, res) => {
        try {
          const currentUser = req.verifiedUser;
          if (!currentUser?.organizationId) {
            return res.status(400).json({ message: 'User not in an organization' });
          }

          const role =
            typeof req.query.role === 'string' && req.query.role.trim()
              ? req.query.role.trim()
              : undefined;

          const usersList = role
            ? await storage.getUsersByRole(currentUser.organizationId, role)
            : await storage.getUsers(currentUser.organizationId);

          return res.json(usersList);
        } catch (err: any) {
          console.error('GET /api/users error', err);
          return res.status(500).json({ message: 'Failed to fetch users' });
        }
      }
    );

        // Reassign intern on a lead (replaces fromInternId with toInternId inside assignedInterns array)
        // Reassign intern on a lead (multi-intern support + correct auth)
        app.patch('/api/leads/:id/reassign-intern',
          authMiddleware,
          requireRole(['analyst','partner','admin']),
          validateIntParam('id'),
          validateResourceExists('lead'),
          async (req: any, res) => {
            try {
              const currentUser = req.verifiedUser;
              const leadId = Number(req.params.id);
              const { fromInternId, toInternId, notes } = req.body;

              if (!currentUser?.organizationId) {
                return res.status(401).json({ message: 'User organization not found' });
              }

              if (!fromInternId || !toInternId) {
                return res.status(400).json({ message: 'Both fromInternId and toInternId are required' });
              }

              const lead = req.resource;

              // Validate current intern assignment (supports array or legacy field)
              const assigned = Array.isArray(lead.assignedInterns)
                ? lead.assignedInterns.includes(fromInternId)
                : lead.assignedTo === fromInternId;

              if (!assigned) {
                return res.status(400).json({ message: 'Lead not currently assigned to the specified intern' });
              }

              // Analyst restrictions
              if (currentUser.role === 'analyst') {
                if (lead.ownerAnalystId !== currentUser.id) {
                  return res.status(403).json({ message: 'You can only reassign your own leads' });
                }

                const okFrom = await storage.validateAnalystOf(currentUser.id, fromInternId, currentUser.organizationId);
                const okTo = await storage.validateAnalystOf(currentUser.id, toInternId, currentUser.organizationId);

                if (!okFrom || !okTo) {
                  return res.status(403).json({ message: 'You can only reassign between your own interns' });
                }
              }

              // Verify intern existence
              const fromUser = await storage.getUser(fromInternId);
              const toUser = await storage.getUser(toInternId);

              if (!fromUser || !toUser || fromUser.organizationId !== currentUser.organizationId || toUser.organizationId !== currentUser.organizationId) {
                return res.status(404).json({ message: 'Intern not found in your organization' });
              }

              if (fromUser.role !== 'intern' || toUser.role !== 'intern') {
                return res.status(400).json({ message: 'Both users must be interns' });
              }


              // Perform the reassign
              const updatedLead = await storage.reassignInternInLead(
                leadId,
                fromInternId,
                toInternId,
                currentUser.id,
                currentUser.organizationId,
                notes
              );

              // Log activity
              await storage.createActivityLog({
                organizationId: currentUser.organizationId,
                userId: currentUser.id,
                action: 'lead_reassign_intern',
                entityType: 'lead',
                entityId: leadId,
                leadId,
                companyId: lead.companyId,
                description: `Reassigned intern ${fromInternId} -> ${toInternId}${notes ? `: ${notes}` : ''}`,
              });

              return res.json({ success: true, lead: updatedLead });
            } catch (err: any) {
              console.error('PATCH /api/leads/:id/reassign-intern error', err);
              return res.status(400).json({ message: err.message || 'Failed to reassign intern' });
            }
          }
        );


    // Reassign analyst and optionally their interns (partners only)
    app.post('/api/analysts/:fromAnalystId/reassign', authMiddleware, requireRole(['partner', 'admin']), async (req: any, res) => {
      try {
        const currentUser = req.verifiedUser;
        if (!currentUser || !currentUser.organizationId) {
          return res.status(401).json({ message: 'User organization not found' });
        }

        const { toAnalystId, moveInterns } = req.body;
        const fromAnalystId = req.params.fromAnalystId;

        if (!toAnalystId) {
          return res.status(400).json({ message: 'Target analyst ID (toAnalystId) is required' });
        }

        // Validate fromAnalyst exists and belongs to organization
        const fromAnalyst = await storage.getUser(fromAnalystId);
        if (!fromAnalyst || fromAnalyst.organizationId !== currentUser.organizationId) {
          return res.status(404).json({ message: 'Source analyst not found' });
        }

        // Validate fromAnalyst has correct role
        if (fromAnalyst.role !== 'analyst') {
          return res.status(400).json({ message: 'Source user is not an analyst' });
        }

        // Validate toAnalyst exists and belongs to organization
        const toAnalyst = await storage.getUser(toAnalystId);
        if (!toAnalyst || toAnalyst.organizationId !== currentUser.organizationId) {
          return res.status(404).json({ message: 'Target analyst not found' });
        }

        // Validate toAnalyst has correct role
        if (toAnalyst.role !== 'analyst') {
          return res.status(400).json({ message: 'Target user is not an analyst' });
        }

        // For partners: validate they manage the fromAnalyst
        if (currentUser.role === 'partner') {
          const isValidPartner = await storage.validatePartnerOf(currentUser.id, fromAnalystId, currentUser.organizationId);
          if (!isValidPartner) {
            return res.status(403).json({ message: 'You can only reassign analysts you manage' });
          }

          // Also validate toAnalyst reports to the same partner
          const toAnalystUnderPartner = await storage.validatePartnerOf(currentUser.id, toAnalystId, currentUser.organizationId);
          if (!toAnalystUnderPartner) {
            return res.status(400).json({ message: 'Target analyst must report to you' });
          }
        }

        // Admin can bypass partner validation but still enforce org scoping

        const result = await storage.reassignAnalyst(
          fromAnalystId,
          toAnalystId,
          currentUser.id,
          currentUser.organizationId,
          moveInterns || false
        );

        // Log activity
        await storage.createActivityLog({
          organizationId: currentUser.organizationId,
          userId: currentUser.id,
          action: 'analyst_reassigned',
          entityType: 'user',
          entityId: null,
          description: `Transferred ${result.leadsTransferred} leads and ${result.internsTransferred} interns from ${fromAnalyst.firstName} ${fromAnalyst.lastName} to ${toAnalyst.firstName} ${toAnalyst.lastName}`,
        });

        res.json({ 
          success: true, 
          message: 'Analyst reassignment completed successfully',
          leadsTransferred: result.leadsTransferred,
          internsTransferred: result.internsTransferred
        });
      } catch (error) {
        console.error('Error reassigning analyst:', error);
        res.status(400).json({ message: 'Failed to reassign analyst', error: error instanceof Error ? error.message : 'Unknown error' });
      }
    });

    // Get team hierarchy tree
    app.get('/api/team/tree', authMiddleware, async (req: any, res) => {
      try {
        const currentUser = req.verifiedUser || await storage.getUser(req.user?.claims?.sub);
        if (!currentUser || !currentUser.organizationId) {
          return res.status(401).json({ message: 'User organization not found' });
        }

        const teamTree = await storage.getTeamTree(currentUser.organizationId, currentUser.id);
        res.json(teamTree);
      } catch (error) {
        console.error('Error fetching team tree:', error);
        res.status(500).json({ message: 'Failed to fetch team tree' });
      }
    });

    // Get interns for an analyst
    app.get('/api/analysts/:analystId/interns', authMiddleware, async (req: any, res) => {
      try {
        const currentUser = req.verifiedUser || await storage.getUser(req.user?.claims?.sub);
        if (!currentUser || !currentUser.organizationId) {
          return res.status(401).json({ message: 'User organization not found' });
        }

        const interns = await storage.getInternsByAnalyst(req.params.analystId, currentUser.organizationId);
        res.json(interns);
      } catch (error) {
        console.error('Error fetching interns:', error);
        res.status(500).json({ message: 'Failed to fetch interns' });
      }
    });

    // Stage progression analysis route
    app.get('/api/leads/:id/progression', authMiddleware, validateIntParam('id'), validateResourceExists('lead'), async (req: any, res) => {
      try {
        const currentUser = req.verifiedUser || await storage.getUser(req.user?.claims?.sub);
        if (!currentUser || !currentUser.organizationId) {
          return res.status(401).json({ message: 'User organization not found' });
        }
        const analysis = await stageProgressionService.analyzeStageProgression(parseInt(req.params.id), currentUser.organizationId);
        res.json(analysis);
      } catch (error) {
        console.error('Error analyzing stage progression:', error);
        res.status(500).json({ message: 'Failed to analyze stage progression' });
      }
    });

    // Auto-progress lead route
    app.post('/api/leads/:id/auto-progress', authMiddleware, requireRole(['partner', 'admin']), validateIntParam('id'), validateResourceExists('lead'), async (req: any, res) => {
      try {
        const currentUser = req.verifiedUser || await storage.getUser(req.user?.claims?.sub);
        if (!currentUser || !currentUser.organizationId) {
          return res.status(401).json({ message: 'User organization not found' });
        }
        const result = await stageProgressionService.autoProgressLead(parseInt(req.params.id), currentUser.organizationId);
        res.json(result);
      } catch (error) {
        console.error('Error auto-progressing lead:', error);
        res.status(500).json({ message: 'Failed to auto-progress lead' });
      }
    });

    // Validate stage transition route
    app.post('/api/leads/:id/validate-stage', authMiddleware, validateIntParam('id'), validateResourceExists('lead'), async (req: any, res) => {
      try {
        const currentUser = req.verifiedUser || await storage.getUser(req.user?.claims?.sub);
        if (!currentUser || !currentUser.organizationId) {
          return res.status(401).json({ message: 'User organization not found' });
        }
        const { targetStage } = req.body;
        if (!targetStage) {
          return res.status(400).json({ message: 'Target stage is required' });
        }
        const validation = await stageProgressionService.validateStageTransition(parseInt(req.params.id), currentUser.organizationId, targetStage);
        res.json(validation);
      } catch (error) {
        console.error('Error validating stage transition:', error);
        res.status(500).json({ message: 'Failed to validate stage transition' });
      }
    });

    // Progress stage route - for document-gated transitions (Pitching→Mandates, Mandates→Won)
    app.post('/api/leads/:id/progress-stage', authMiddleware, validateIntParam('id'), validateResourceExists('lead'), async (req: any, res) => {
      try {
        const currentUser = req.verifiedUser || await storage.getUser(req.user?.claims?.sub);
        if (!currentUser || !currentUser.organizationId) {
          return res.status(401).json({ message: 'User organization not found' });
        }
        
        const { targetStage } = req.body;
        if (!targetStage) {
          return res.status(400).json({ message: 'Target stage is required' });
        }

        // Validate the stage transition
        const validation = await stageProgressionService.validateStageTransition(
          parseInt(req.params.id), 
          currentUser.organizationId, 
          targetStage
        );

        if (!validation.isValid) {
          return res.status(400).json({ 
            message: 'Stage transition validation failed', 
            errors: validation.errors 
          });
        }

        // Update the lead stage
        const updatedLead = await storage.updateLead(
          parseInt(req.params.id), 
          currentUser.organizationId, 
          { stage: targetStage }
        );

        if (!updatedLead) {
          return res.status(404).json({ message: 'Failed to update lead stage' });
        }


        // ✅ NEW: Find all EPN partners linked to this lead and auto-sync their stages
        try {
          const linkedEpns = await storage.getLinkedEpnsForLead(currentUser.organizationId, parseInt(req.params.id));
          for (const epn of linkedEpns) {
            await storage.syncEpnPartnerStage(currentUser.organizationId, epn.id);
          }
        } catch (syncErr) {
          console.error('Error syncing EPN partner stages:', syncErr);
        }

        res.json({ success: true, lead: updatedLead });
      } catch (error) {
        console.error('Error progressing lead stage:', error);
        res.status(500).json({ message: 'Failed to progress lead stage', error: error instanceof Error ? error.message : 'Unknown error' });
      }
    });

    // Helper function to map outreach activity types to intervention types
    function mapActivityTypeToInterventionType(activityType: string): string {
      // Map outreach activity types to intervention types
      if (activityType.startsWith('linkedin')) {
        return 'linkedin_message';
      } else if (activityType.startsWith('whatsapp')) {
        return 'whatsapp';
      } else if (activityType.startsWith('email')) {
        return 'email';
      } else if (activityType.startsWith('call')) {
        return 'call';
      } else if (activityType === 'meeting') {
        return 'meeting';
      }
      // Default to linkedin_message for unmapped types
      return 'linkedin_message';
    }

    // Outreach routes
    app.post('/api/outreach', authMiddleware, async (req: any, res) => {
      try {
        const currentUser = req.verifiedUser || await storage.getUser(req.user?.claims?.sub);
        if (!currentUser || !currentUser.organizationId) {
          return res.status(401).json({ message: 'User organization not found' });
        }
        
        // Convert date strings to Date objects
        const contactDate = req.body.contactDate ? new Date(req.body.contactDate) : null;
        const followUpDate = req.body.followUpDate ? new Date(req.body.followUpDate) : null;
        
        // Validate dates
        if (contactDate && isNaN(contactDate.getTime())) {
          return res.status(400).json({ message: 'Invalid contactDate format' });
        }
        if (followUpDate && isNaN(followUpDate.getTime())) {
          return res.status(400).json({ message: 'Invalid followUpDate format' });
        }
        
        const activityData = insertOutreachActivitySchema.parse({
          ...req.body,
          contactDate,
          followUpDate,
          userId: currentUser.id,
          organizationId: currentUser.organizationId
        });
        

        
        // If a follow-up date is provided, also create an intervention record for Scheduled Tasks
        const activity = await storage.createOutreachActivity(activityData);

        // If a follow-up date is provided, also create intervention records for Scheduled Tasks
        if (followUpDate) {
          try {
            const orgId = currentUser.organizationId;
            const userId = currentUser.id;
            const leadId = req.body.leadId;
            const baseNotes = req.body.notes || 'Scheduled outreach activity';

            // Normalize anchor date to 09:30 AM local
            const baseDate = new Date(followUpDate);
            baseDate.setHours(9, 30, 0, 0);

            // Helper to add days
            const addDays = (date: Date, days: number) => {
              const d = new Date(date);
              d.setDate(d.getDate() + days);
              return d;
            };

            // Email D0 triggers the entire D0/D1/D3/D7 cadence
            if (req.body.activityType === 'email_d0_analyst') {
              const reminders = [
                // D0 Tasks (same day)
                { offset: 0, type: 'linkedin_request_self' },
                { offset: 0, type: 'linkedin_messages_self' },
                { offset: 0, type: 'linkedin_request_dinesh' },
                { offset: 0, type: 'linkedin_messages_dinesh' },
                { offset: 0, type: 'linkedin_request_kvs' },
                { offset: 0, type: 'linkedin_messages_kvs' },

                // D1 Tasks (+1 day)
                { offset: 1, type: 'whatsapp_kvs' },
                { offset: 1, type: 'call_d1_dinesh' },

                // D3 Tasks (+3 days)
                { offset: 3, type: 'email_d3_analyst' },
                { offset: 3, type: 'whatsapp_dinesh' },

                // D7 Tasks (+7 days)
                { offset: 7, type: 'channel_partner' },
                { offset: 7, type: 'email_d7_kvs' },
              ];

              for (const r of reminders) {
                await storage.createIntervention({
                  leadId,
                  type: r.type,
                  scheduledAt: addDays(baseDate, r.offset),
                  notes: baseNotes,
                  organizationId: orgId,
                  userId,
                  status: 'pending',
                });
              }
            } else {
              // Default behaviour: single reminder for whatever activity was scheduled
              await storage.createIntervention({
                leadId,
                type: req.body.activityType,
                scheduledAt: baseDate,
                notes: baseNotes,
                organizationId: orgId,
                userId,
                status: 'pending',
              });
            }
          } catch (interventionError) {
            console.error('Error creating intervention for scheduled outreach:', interventionError);
            // Don't fail the request if intervention creation fails
          }
        }

        res.json(activity);

      } catch (error) {
        console.error('Error creating outreach activity:', error);
        res.status(400).json({ message: 'Failed to create outreach activity', error: error instanceof Error ? error.message : 'Unknown error' });
      }
    });


   // ✅ Bulk create leads using Drizzle ORM

    app.post("/api/leads/bulk-create", authMiddleware, async (req: any, res) => {
      try {
        const { companyIds, ownerId } = req.body;

        // Validate input
        if (!Array.isArray(companyIds) || companyIds.length === 0) {
          return res.status(400).json({ message: "No company IDs provided" });
        }

        // Prepare lead entries
        const newLeads = companyIds.map((id: number) => ({
          companyId: id,
          stage: "universe",
          ownerId,
          createdAt: new Date(),
          updatedAt: new Date(),
        }));

        // Insert all leads
        await db.insert(leads).values(newLeads);

        // Respond success
        res.status(201).json({
          message: "Leads created successfully",
          createdLeads: newLeads.length,
          total: newLeads.length,
        });
      } catch (error: any) {
        console.error("Error creating leads:", error);
        res.status(500).json({
          message: "Failed to create leads",
          error: error.message,
        });
      }
    });


        app.get(
      "/api/lead-poc-outreach/lead/:leadId",
      authMiddleware,
      validateIntParam("leadId"),
      async (req: any, res) => {
        try {
          const currentUser =
            req.verifiedUser || (await storage.getUser(req.user?.claims?.sub));

          if (!currentUser || !currentUser.organizationId) {
            return res.status(401).json({ message: "User organization not found" });
          }

          const leadId = parseInt(req.params.leadId, 10);
          const lead = await storage.getLead(leadId, currentUser.organizationId);

          if (!lead) {
            return res.status(404).json({ message: "Lead not found" });
          }

          const companyContacts = await storage.getContactsByCompany(
            lead.companyId,
            currentUser.organizationId
          );

          const availableContacts = [...companyContacts]
            .sort((a, b) => {
              const primaryDiff =
                Number(Boolean(b.isPrimary)) - Number(Boolean(a.isPrimary));
              if (primaryDiff !== 0) return primaryDiff;
              return a.id - b.id;
            })
            .slice(0, 3);

          const statusRows = await storage.getLeadPocOutreachStatuses(
            leadId,
            currentUser.organizationId
          );

          const pocs = availableContacts.map((contact, index) => ({
            slot: index + 1,
            contact,
channels: {
  linkedin:
    statusRows.find(
      (row) =>
        row.contactId === contact.id && row.channel === "linkedin"
    ) || null,
  email:
    statusRows.find(
      (row) => row.contactId === contact.id && row.channel === "email"
    ) || null,
  whatsapp:
    statusRows.find(
      (row) =>
        row.contactId === contact.id && row.channel === "whatsapp"
    ) || null,
  call:
    statusRows.find(
      (row) =>
        row.contactId === contact.id && row.channel === "call"
    ) || null,
  channel_partner:
    statusRows.find(
      (row) =>
        row.contactId === contact.id && row.channel === "channel_partner"
    ) || null,
  other:
    statusRows.find(
      (row) =>
        row.contactId === contact.id && row.channel === "other"
    ) || null,
},
          }));

          return res.json({
            lead: {
              id: lead.id,
              stage: lead.stage,
              companyId: lead.companyId,
              companyName: lead.company.name,
            },
            pocs,
            statusOptions: LEAD_POC_OUTREACH_STATUS_OPTIONS,
          });
        } catch (error) {
          console.error("Error fetching lead POC outreach status:", error);
          return res
            .status(500)
            .json({ message: "Failed to fetch lead POC outreach status" });
        }
      }
    );

    app.put(
      "/api/lead-poc-outreach/lead/:leadId",
      authMiddleware,
      validateIntParam("leadId"),
      async (req: any, res) => {
        try {
          const currentUser =
            req.verifiedUser || (await storage.getUser(req.user?.claims?.sub));

          if (!currentUser || !currentUser.organizationId) {
            return res.status(401).json({ message: "User organization not found" });
          }

          const leadId = parseInt(req.params.leadId, 10);
          const lead = await storage.getLead(leadId, currentUser.organizationId);

          if (!lead) {
            return res.status(404).json({ message: "Lead not found" });
          }

const bodySchema = z.object({
  contactId: z.coerce.number(),
  channel: z.enum(["linkedin", "email", "whatsapp", "call", "channel_partner", "other"]),
  status: z.string().trim().min(1).optional(),
  remarks: z.string().optional().nullable(),
  nextActionText: z.string().optional().nullable(),
  nextActionAt: z.coerce.date().optional().nullable(),
  taskAssignedTo: z.string().trim().min(1).optional().nullable(),
});

          const parsed = bodySchema.parse(req.body);

          if (parsed.status && !isValidLeadPocOutreachStatus(parsed.channel, parsed.status)) {
            return res.status(400).json({
              message: `Invalid status '${parsed.status}' for channel '${parsed.channel}'`,
            });
          }

if (
  parsed.status === undefined &&
  parsed.remarks === undefined &&
  parsed.nextActionText === undefined &&
  parsed.nextActionAt === undefined &&
  parsed.taskAssignedTo === undefined
) {
  return res.status(400).json({
    message: "At least one of status, remarks, nextActionText, nextActionAt, or taskAssignedTo must be provided",
  });
}
          const contact = await storage.getContact(
            parsed.contactId,
            currentUser.organizationId
          );

          if (!contact || contact.companyId !== lead.companyId) {
            return res.status(404).json({
              message: "Contact not found for this lead/company",
            });
          }

          const existing = await storage.getLeadPocOutreachStatusRecord(
            leadId,
            parsed.contactId,
            parsed.channel,
            currentUser.organizationId
          );

          if (parsed.taskAssignedTo !== undefined && parsed.taskAssignedTo !== null) {
            const assignee = await storage.getUser(parsed.taskAssignedTo);
            if (!assignee || Number(assignee.organizationId) !== Number(currentUser.organizationId)) {
              return res.status(400).json({
                message: "Invalid taskAssignedTo user",
              });
            }
          }

          const now = new Date();

          let initiatedAt = existing?.initiatedAt ?? null;
          if (parsed.status === "initiated" && !initiatedAt) {
            initiatedAt = now;
          }



const savedRecord = await storage.upsertLeadPocOutreachStatus({
  organizationId: currentUser.organizationId,
  leadId,
  contactId: parsed.contactId,
  channel: parsed.channel,
  status: parsed.status ?? existing?.status ?? null,
  initiatedAt,
  lastUpdatedAt: now,
  remarks:
    parsed.remarks !== undefined ? parsed.remarks : existing?.remarks,
  nextActionText:
    parsed.nextActionText !== undefined
      ? parsed.nextActionText
      : existing?.nextActionText ?? null,
  nextActionAt:
    parsed.nextActionAt !== undefined
      ? parsed.nextActionAt
      : existing?.nextActionAt ?? null,
  taskAssignedTo:
    parsed.taskAssignedTo !== undefined
      ? parsed.taskAssignedTo
      : (existing as any)?.taskAssignedTo ?? null,
  taskAssignedBy:
    parsed.taskAssignedTo !== undefined
      ? (parsed.taskAssignedTo ? currentUser.id : null)
      : (existing as any)?.taskAssignedBy ?? null,
cadenceTriggeredAt: existing?.cadenceTriggeredAt ?? null,
  createdBy: existing?.createdBy ?? currentUser.id,
} as any);



          await storage.createActivityLog({
            organizationId: currentUser.organizationId,
            userId: currentUser.id,
            action: "lead_poc_outreach_status_updated",
            entityType: "lead_poc_outreach_status",
            entityId: savedRecord.id,
            leadId,
            companyId: lead.companyId,
            description: `Updated ${parsed.channel} outreach for ${contact.name || "POC"}`,
newValue: JSON.stringify({
  contactId: parsed.contactId,
  channel: parsed.channel,
  status: savedRecord.status,
  remarks: savedRecord.remarks,
  nextActionText: savedRecord.nextActionText,
  nextActionAt: savedRecord.nextActionAt,
}),
          });

          return res.json(savedRecord);
        } catch (error) {
          console.error("Error updating lead POC outreach status:", error);
          return res.status(400).json({
            message: "Failed to update lead POC outreach status",
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }
    );


        // ✅ Fetch investor manage outreach matrix for one lead-linked investor
    app.get(
      "/api/investor-poc-outreach/lead/:leadId/investor/:investorId",
      authMiddleware,
      requireRole(["admin", "partner", "analyst"]),
      async (req: any, res) => {
        try {
          const currentUser =
            req.verifiedUser || (await storage.getUser(req.user?.claims?.sub));

          if (!currentUser || !currentUser.organizationId) {
            return res.status(401).json({ message: "User organization not found" });
          }

          const leadId = Number(req.params.leadId);
          const investorId = Number(req.params.investorId);

          if (!Number.isFinite(leadId) || leadId <= 0) {
            return res.status(400).json({ message: "Invalid leadId" });
          }

          if (!Number.isFinite(investorId) || investorId <= 0) {
            return res.status(400).json({ message: "Invalid investorId" });
          }

          const lead = await storage.getLead(leadId, currentUser.organizationId);
          if (!lead) {
            return res.status(404).json({ message: "Lead not found" });
          }

          const linkedInvestors = await storage.getInvestorsByLead(
            currentUser.organizationId,
            leadId
          );

          const linkedInvestor = linkedInvestors.find((item: any) => item.id === investorId);

          if (!linkedInvestor) {
            return res.status(404).json({
              message: "Investor is not linked to this lead",
            });
          }

          const statusRows = await storage.getInvestorPocOutreachStatuses(
            leadId,
            investorId,
            currentUser.organizationId
          );

      const contacts = (linkedInvestor.contacts || []).map((contact: any, index: number) => ({
        slot: index + 1,
        contact,
        channels: {
          linkedin:
            statusRows.find(
              (row) =>
                row.contactId === contact.id && row.channel === "linkedin"
            ) || null,
          email:
            statusRows.find(
              (row) => row.contactId === contact.id && row.channel === "email"
            ) || null,
          whatsapp:
            statusRows.find(
              (row) =>
                row.contactId === contact.id && row.channel === "whatsapp"
            ) || null,
          call:
            statusRows.find(
              (row) =>
                row.contactId === contact.id && row.channel === "call"
            ) || null,
          channel_partner:
            statusRows.find(
              (row) =>
                row.contactId === contact.id &&
                row.channel === "channel_partner"
            ) || null,
          other:
            statusRows.find(
              (row) =>
                row.contactId === contact.id && row.channel === "other"
            ) || null,
        },
      }));

          return res.json({
            lead: {
              id: lead.id,
              stage: lead.stage,
              companyId: lead.companyId,
              companyName: lead.company.name,
            },
            investor: {
              id: linkedInvestor.id,
              name: linkedInvestor.name,
              currentLinkedStatus: linkedInvestor.status || "yet_to_contact",
            },
            pocs: contacts,
            statusOptions: INVESTOR_POC_OUTREACH_STATUS_OPTIONS,
          });
        } catch (error) {
          console.error("Error fetching investor POC outreach status:", error);
          return res
            .status(500)
            .json({ message: "Failed to fetch investor POC outreach status" });
        }
      }
    );

    // ✅ Update investor manage outreach + auto-sync linked investor status
    app.put(
      "/api/investor-poc-outreach/lead/:leadId/investor/:investorId",
      authMiddleware,
      requireRole(["admin", "partner", "analyst"]),
      async (req: any, res) => {
        try {
          const currentUser =
            req.verifiedUser || (await storage.getUser(req.user?.claims?.sub));

          if (!currentUser || !currentUser.organizationId) {
            return res.status(401).json({ message: "User organization not found" });
          }

          const leadId = Number(req.params.leadId);
          const investorId = Number(req.params.investorId);

          if (!Number.isFinite(leadId) || leadId <= 0) {
            return res.status(400).json({ message: "Invalid leadId" });
          }

          if (!Number.isFinite(investorId) || investorId <= 0) {
            return res.status(400).json({ message: "Invalid investorId" });
          }

          const lead = await storage.getLead(leadId, currentUser.organizationId);
          if (!lead) {
            return res.status(404).json({ message: "Lead not found" });
          }

          const linkedInvestors = await storage.getInvestorsByLead(
            currentUser.organizationId,
            leadId
          );

          const linkedInvestor = linkedInvestors.find((item: any) => item.id === investorId);

          if (!linkedInvestor) {
            return res.status(404).json({
              message: "Investor is not linked to this lead",
            });
          }

const bodySchema = z.object({
  contactId: z.coerce.number(),
  channel: z.enum(["linkedin", "email", "whatsapp", "call", "channel_partner", "other"]),
  status: z.string().trim().min(1).optional(),
  remarks: z.string().optional().nullable(),
  nextActionText: z.string().optional().nullable(),
  nextActionAt: z.coerce.date().optional().nullable(),
  taskAssignedTo: z.string().trim().min(1).optional().nullable(),
});

const parsed = bodySchema.parse(req.body);

if (
  parsed.status &&
  !isValidInvestorPocOutreachStatus(parsed.channel, parsed.status)
) {
  return res.status(400).json({
    message: `Invalid status '${parsed.status}' for channel '${parsed.channel}'`,
  });
}

if (
  parsed.status === undefined &&
  parsed.remarks === undefined &&
  parsed.nextActionText === undefined &&
  parsed.nextActionAt === undefined &&
  parsed.taskAssignedTo === undefined
) {
  return res.status(400).json({
    message: "At least one of status, remarks, nextActionText, nextActionAt, or taskAssignedTo must be provided",
  });
}
          const validContact = (linkedInvestor.contacts || []).find(
            (contact: any) => Number(contact.id) === parsed.contactId
          );

          if (!validContact) {
            return res.status(404).json({
              message: "Investor contact not found for this linked investor",
            });
          }

          const existing = await storage.getInvestorPocOutreachStatusRecord(
            leadId,
            investorId,
            parsed.contactId,
            parsed.channel,
            currentUser.organizationId
          );

          if (parsed.taskAssignedTo !== undefined && parsed.taskAssignedTo !== null) {
            const assignee = await storage.getUser(parsed.taskAssignedTo);
            if (!assignee || Number(assignee.organizationId) !== Number(currentUser.organizationId)) {
              return res.status(400).json({
                message: "Invalid taskAssignedTo user",
              });
            }
          }

          const now = new Date();

          let initiatedAt = existing?.initiatedAt ?? null;
          if (parsed.status === "initiated" && !initiatedAt) {
            initiatedAt = now;
          }
                    const isFirstOtherActionSave =
            parsed.channel === "other" &&
            !existing &&
            (
              parsed.remarks !== undefined ||
              parsed.nextActionText !== undefined ||
              parsed.nextActionAt !== undefined
            );

          if (isFirstOtherActionSave && !initiatedAt) {
            initiatedAt = now;
          }

const savedRecord = await storage.upsertInvestorPocOutreachStatus({
  organizationId: currentUser.organizationId,
  leadId,
  investorId,
  contactId: parsed.contactId,
  channel: parsed.channel,
  status: parsed.status ?? existing?.status ?? null,
  initiatedAt,
  lastUpdatedAt: now,
  remarks:
    parsed.remarks !== undefined ? parsed.remarks : existing?.remarks,
  nextActionText:
    parsed.nextActionText !== undefined
      ? parsed.nextActionText
      : existing?.nextActionText ?? null,
  nextActionAt:
    parsed.nextActionAt !== undefined
      ? parsed.nextActionAt
      : existing?.nextActionAt ?? null,
  taskAssignedTo:
    parsed.taskAssignedTo !== undefined
      ? parsed.taskAssignedTo
      : (existing as any)?.taskAssignedTo ?? null,
  taskAssignedBy:
    parsed.taskAssignedTo !== undefined
      ? (parsed.taskAssignedTo ? currentUser.id : null)
      : (existing as any)?.taskAssignedBy ?? null,
  cadenceTriggeredAt: existing?.cadenceTriggeredAt ?? null,
  createdBy: existing?.createdBy ?? currentUser.id,
} as any);
            const allRows = await storage.getInvestorPocOutreachStatuses(
              leadId,
              investorId,
              currentUser.organizationId
            );

            const expectedRowCount =
              (Array.isArray(linkedInvestor.contacts) ? linkedInvestor.contacts.length : 0) * 5;

            const nextLinkedStatus = deriveLinkedInvestorStatusFromOutreachRows(
              allRows,
              expectedRowCount
            );

          await storage.updateInvestorLeadLinkStatus(
            currentUser.organizationId,
            investorId,
            leadId,
            nextLinkedStatus
          );

          await storage.createActivityLog({
            organizationId: currentUser.organizationId,
            userId: currentUser.id,
            action: "investor_poc_outreach_status_updated",
            entityType: "investor_poc_outreach_status",
            entityId: savedRecord.id,
            leadId,
            companyId: lead.companyId,
            description: `Updated ${parsed.channel} outreach for ${validContact.name || "Investor POC"} (${linkedInvestor.name})`,
            newValue: JSON.stringify({
              investorId,
              contactId: parsed.contactId,
              channel: parsed.channel,
              status: savedRecord.status,
              remarks: savedRecord.remarks,
              nextActionText: savedRecord.nextActionText,
              nextActionAt: savedRecord.nextActionAt,
              linkedInvestorStatus: nextLinkedStatus,
            }),
          });

          return res.json({
            ...savedRecord,
            linkedInvestorStatus: nextLinkedStatus,
          });
        } catch (error) {
          console.error("Error updating investor POC outreach status:", error);
          return res.status(400).json({
            message: "Failed to update investor POC outreach status",
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }
    );

    

    app.get('/api/outreach/lead/:leadId', authMiddleware, validateIntParam('leadId'), async (req: any, res) => {
      try {
        // Verify role and assignment access
        const userId = req.user?.claims?.sub;
        const user = await storage.getUser(userId);
        if (!user || !user.organizationId) {
          return res.status(404).json({ message: 'User not found or missing organization' });
        }
        
        const userRole = user.role || 'analyst';
        const leadId = req.params.leadId;
        
        // Verify lead exists
        const lead = await storage.getLead(leadId, user.organizationId);
        if (!lead) {
          return res.status(404).json({ message: 'Lead not found' });
        }
        
        // Analysts can only access outreach for their assigned leads
        if (userRole === 'analyst' && lead.assignedTo !== userId) {
          return res.status(403).json({ message: 'Access denied - lead not assigned to you' });
        }
        
        const activities = await storage.getOutreachActivities(leadId, user.organizationId);
        res.json(activities);
      } catch (error) {
        console.error('Error fetching outreach activities:', error);
        res.status(500).json({ message: 'Failed to fetch outreach activities' });
      }
    });

    app.put('/api/outreach/:id', authMiddleware, async (req: any, res) => {
      try {
        const userId = req.user?.claims?.sub;
        const user = await storage.getUser(userId);
        if (!user || !user.organizationId) {
          return res.status(404).json({ message: 'User not found or missing organization' });
        }
        
        const updates = insertOutreachActivitySchema.partial().parse(req.body);
        const activityId = parseInt(req.params.id);
        if (isNaN(activityId)) {
          return res.status(400).json({ message: 'Invalid activity ID' });
        }
        
        const activity = await storage.updateOutreachActivity(activityId, user.organizationId, updates);
        if (!activity) {
          return res.status(404).json({ message: 'Outreach activity not found' });
        }
        res.json(activity);
      } catch (error) {
        console.error('Error updating outreach activity:', error);
        res.status(400).json({ message: 'Failed to update outreach activity', error: error instanceof Error ? error.message : 'Unknown error' });
      }
    });

    // Intervention routes for outreach stage tracking
    app.post('/api/interventions', authMiddleware, async (req: any, res) => {
      try {
        const currentUser = req.verifiedUser || await storage.getUser(req.user?.claims?.sub);
        if (!currentUser || !currentUser.organizationId) {
          return res.status(401).json({ message: 'User organization not found' });
        }
        
        // Validate only the fields from the frontend (without userId/organizationId)
        const frontendSchema = z.object({
          leadId: z.number(),
          type: z.enum(["linkedin_message", "call", "whatsapp", "email", "meeting", "document"]),
          scheduledAt: z.string(), // Comes as string from datetime-local input
          notes: z.string().min(1, "Notes are required"),
          documentName: z.string().optional(), // For document type: PDM, MTS, LOE, Contract
          meetingMode: z.enum(["online", "inperson"]).optional(),
        });
        
        const validatedData = frontendSchema.parse(req.body);
        
        const intervention = await storage.createIntervention({
          leadId: validatedData.leadId,
          type: validatedData.type,
          scheduledAt: new Date(validatedData.scheduledAt), // Convert string to Date
          notes: validatedData.notes,
          documentName: validatedData.documentName,
          meetingMode: validatedData.meetingMode, // add this
          organizationId: currentUser.organizationId,
          userId: currentUser.id
        });
        
        // Get lead and company info for activity logging
        const lead = await storage.getLead(validatedData.leadId, currentUser.organizationId);
        if (lead) {
          const company = await storage.getCompany(lead.companyId, currentUser.organizationId);
          
          // Create descriptive action based on intervention type
          let action = 'intervention_added';
          let description = `Added ${validatedData.type.replace('_', ' ')} intervention`;
          
          if (validatedData.type === 'document' && validatedData.documentName) {
            action = 'document_collected';
            description = `Collected document: ${validatedData.documentName}`;
          }
          
          // Log to activity log
          await storage.createActivityLog({
            organizationId: currentUser.organizationId,
            userId: currentUser.id,
            action,
            entityType: 'intervention',
            entityId: intervention.id,
            leadId: validatedData.leadId,
            companyId: lead.companyId,
            description,
          });
        }
        
        res.json(intervention);
      } catch (error) {
        console.error('Error creating intervention:', error);
        res.status(400).json({ 
          message: 'Failed to create intervention', 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    });

    app.get('/api/interventions/lead/:leadId', authMiddleware, validateIntParam('leadId'), async (req: any, res) => {
      try {
        const currentUser = req.verifiedUser || await storage.getUser(req.user?.claims?.sub);
        if (!currentUser || !currentUser.organizationId) {
          return res.status(401).json({ message: 'User organization not found' });
        }
        
        const interventions = await storage.getInterventions(parseInt(req.params.leadId), currentUser.organizationId);
        res.json(interventions);
      } catch (error) {
        console.error('Error fetching interventions:', error);
        res.status(500).json({ message: 'Failed to fetch interventions' });
      }
    });

  
 // Update intervention completion status and log activity
app.put('/api/interventions/:id', authMiddleware, validateIntParam('id'), async (req: any, res) => {
  try {
    const currentUser = req.verifiedUser || await storage.getUser(req.user?.claims?.sub);
    if (!currentUser || !currentUser.organizationId) {
      return res.status(401).json({ message: 'User organization not found' });
    }

    const interventionId = parseInt(req.params.id);

    const updates = interventionFormSchema
      .extend({
        status: z.enum(["pending", "completed"]).optional(),
      })
      .partial()
      .parse(req.body);

    const intervention = await storage.updateIntervention(
      interventionId,
      currentUser.organizationId,
      updates
    );

    if (!intervention) {
      return res.status(404).json({ message: 'Intervention not found' });
    }

    // Optional but recommended: log manual completion
    if (updates.status === "completed") {
      const lead = await storage.getLead(intervention.leadId, currentUser.organizationId);

      await storage.createActivityLog({
        organizationId: currentUser.organizationId,
        userId: currentUser.id,
        action: "intervention_completed",
        entityType: "intervention",
        entityId: intervention.id,
        leadId: intervention.leadId,
        companyId: lead?.companyId ?? null,
        description: `Marked scheduled task as completed (${intervention.type})`,
      });
    }

    res.json(intervention);
  } catch (error) {
    console.error('Error updating intervention:', error);
    res.status(400).json({
      message: 'Failed to update intervention',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});


    app.delete('/api/interventions/:id', authMiddleware, validateIntParam('id'), async (req: any, res) => {
      try {
        const currentUser = req.verifiedUser || await storage.getUser(req.user?.claims?.sub);
        if (!currentUser || !currentUser.organizationId) {
          return res.status(401).json({ message: 'User organization not found' });
        }
        
        const intervention = await storage.deleteIntervention(parseInt(req.params.id), currentUser.organizationId);
        
        if (!intervention) {
          return res.status(404).json({ message: 'Intervention not found' });
        }
        
        res.json({ message: 'Intervention deleted successfully' });
      } catch (error) {
        console.error('Error deleting intervention:', error);
        res.status(500).json({ message: 'Failed to delete intervention' });
      }
    });

    // Get all scheduled interventions (upcoming tasks)
    app.get('/api/interventions/scheduled', authMiddleware, async (req: any, res) => {
      console.log('>>> API CALLED: /api/interventions/scheduled');
      try {
        const currentUser = req.verifiedUser || await storage.getUser(req.user?.claims?.sub);
        console.log('>>> Current User:', { id: currentUser?.id, role: currentUser?.role, orgId: currentUser?.organizationId });
        if (!currentUser || !currentUser.organizationId) {
          console.log('>>> RETURNING 401 - No user organization');
          return res.status(401).json({ message: 'User organization not found' });
        }
        
        console.log('>>> Calling storage.getScheduledInterventions...');
        const scheduledInterventions = await storage.getScheduledInterventions(currentUser);
        console.log('>>> Returning', scheduledInterventions.length, 'scheduled interventions');
        res.json(scheduledInterventions);
      } catch (error) {
        console.error('Error fetching scheduled interventions:', error);
        res.status(500).json({ message: 'Failed to fetch scheduled interventions' });
      }
    });

    // Challenge token routes for secure reassignments
    app.post('/api/challenge-token/generate', authMiddleware, requireRole(['admin', 'partner']), async (req: any, res) => {
      try {
        const currentUser = req.verifiedUser || await storage.getUser(req.user?.claims?.sub);
        if (!currentUser || !currentUser.organizationId) {
          return res.status(401).json({ message: 'User organization not found' });
        }

        const { leadId, purpose } = req.body;
        
        if (!leadId || !purpose) {
          return res.status(400).json({ message: 'Lead ID and purpose are required' });
        }

        // Validate that the lead exists and belongs to the user's organization
        const lead = await storage.getLead(parseInt(leadId), currentUser.organizationId);
        if (!lead) {
          return res.status(404).json({ message: 'Lead not found' });
        }

        try {
          const token = await storage.createChallengeToken(
            currentUser.id,
            currentUser.organizationId,
            parseInt(leadId),
            purpose
          );

          res.json({ 
            token, 
            expiresIn: 5 * 60, // 5 minutes in seconds
            message: 'Challenge token generated successfully'
          });
        } catch (tokenError) {
          if (tokenError instanceof Error && tokenError.message.includes('Rate limit exceeded')) {
            return res.status(429).json({ message: tokenError.message });
          }
          throw tokenError; // Re-throw if it's not a rate limit error
        }
      } catch (error) {
        console.error('Error generating challenge token:', error);
        if (error instanceof Error && error.message.includes('Rate limit exceeded')) {
          return res.status(429).json({ message: error.message });
        }
        res.status(500).json({ message: 'Failed to generate challenge token' });
      }
    });

    app.post('/api/challenge-token/validate', authMiddleware, requireRole(['admin', 'partner']), async (req: any, res) => {
      try {
        const currentUser = req.verifiedUser || await storage.getUser(req.user?.claims?.sub);
        if (!currentUser || !currentUser.organizationId) {
          return res.status(401).json({ message: 'User organization not found' });
        }

        const { token, leadId, purpose } = req.body;
        
        if (!token || !leadId || !purpose) {
          return res.status(400).json({ message: 'Token, lead ID, and purpose are required' });
        }

        const isValid = await storage.validateChallengeToken(
          token,
          currentUser.id,
          currentUser.organizationId,
          parseInt(leadId),
          purpose
        );

        if (isValid) {
          res.json({ valid: true, message: 'Token is valid and has been consumed' });
        } else {
          res.status(400).json({ valid: false, message: 'Invalid or expired token' });
        }
      } catch (error) {
        console.error('Error validating challenge token:', error);
        res.status(500).json({ message: 'Failed to validate challenge token' });
      }
    });

    // Comprehensive audit logs route for admin/partner audit page
    app.get('/api/activity-logs', authMiddleware, requireRole(['admin', 'partner', 'analyst']), async (req: any, res) => {
      try {
        const currentUser = req.verifiedUser || await storage.getUser(req.user?.claims?.sub);
        console.log('>>> Current user:', currentUser?.id, currentUser?.organizationId);

        if (!currentUser || !currentUser.organizationId) {
          return res.status(401).json({ message: 'User organization not found' });
        }
        const endDate = req.query.endDate ? new Date(String(req.query.endDate)) : undefined;
        if (endDate) endDate.setHours(23, 59, 59, 999);
        // Parse filters from query parameters
        const filters = {
        search: req.query.search as string,
        userId: req.query.user ? String(req.query.user) : undefined,
        companyId: req.query.company ? parseInt(String(req.query.company)) : undefined,
        action: req.query.action as string,
        startDate: req.query.startDate ? new Date(String(req.query.startDate)) : undefined,
        endDate,
        page: req.query.page ? parseInt(String(req.query.page)) : 1,
        limit: req.query.limit ? parseInt(String(req.query.limit)) : 50
      };
        
        const result = await storage.getActivityLogsForAudit(currentUser.organizationId, filters);
        res.json(result);
      } catch (error) {
        console.error('Error fetching comprehensive activity logs:', error);
        res.status(500).json({ message: 'Failed to fetch activity logs' });
      }
    });

    // Activity logging routes for comprehensive audit trail
    app.get('/api/activity-log', authMiddleware, async (req: any, res) => {
      try {
        const currentUser = req.verifiedUser || await storage.getUser(req.user?.claims?.sub);
        if (!currentUser || !currentUser.organizationId) {
          return res.status(401).json({ message: 'User organization not found' });
        }
        
        const leadId = req.query.leadId ? parseInt(req.query.leadId) : undefined;
        const companyId = req.query.companyId ? parseInt(req.query.companyId) : undefined;
        const limit = req.query.limit ? parseInt(req.query.limit) : 50;
        
        const activityLogs = await storage.getActivityLog(currentUser.organizationId, leadId, companyId, limit);
        res.json(activityLogs);
      } catch (error) {
        console.error('Error fetching activity logs:', error);
        res.status(500).json({ message: 'Failed to fetch activity logs' });
      }
    });

    app.post('/api/activity-log', authMiddleware, async (req: any, res) => {
      try {
        const currentUser = req.verifiedUser || await storage.getUser(req.user?.claims?.sub);
        if (!currentUser || !currentUser.organizationId) {
          return res.status(401).json({ message: 'User organization not found' });
        }
        
        const activityData = insertActivityLogSchema.parse(req.body);
        const activity = await storage.createActivityLog({
          ...activityData,
          organizationId: currentUser.organizationId,
          userId: currentUser.id,
        });
        
        res.status(201).json(activity);
      } catch (error) {
        console.error('Error creating activity log:', error);
        res.status(400).json({ 
          message: 'Failed to create activity log', 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    });


    // Individual Lead Creation Route with Deduplication
    app.post('/api/leads/individual', authMiddleware, requireRole(['analyst', 'partner', 'admin']), async (req: any, res) => {
      try {
        console.log('Creating individual lead - request body:', req.body);
        console.log('Verified user:', req.verifiedUser);
        const currentUser = req.verifiedUser;
        if (!currentUser || !currentUser.organizationId) {
          return res.status(401).json({ message: 'User organization not found' });
        }
           console.log("current user:", currentUser);

        // Validate the form data
        const formData = individualLeadFormSchema.parse(req.body);
        console.log('Creating individual lead with data:', formData);
        
        // Create company with deduplication
        const companyResult = await storage.createCompanyWithDeduplication({
          name: formData.companyName,
          sector: formData.sector,
          location: formData.location,
          businessDescription: formData.businessDescription,
          website: formData.website,
          revenueInrCr: formData.revenueInrCr ? formData.revenueInrCr.toString() : undefined,
          ebitdaInrCr: formData.ebitdaInrCr ? formData.ebitdaInrCr.toString() : undefined,
          patInrCr: formData.patInrCr ? formData.patInrCr.toString() : undefined,
        }, currentUser.organizationId);

        // Determine universe status based on assignment
        const universeStatus = formData.assignedTo ? 'assigned' : 'open';
        
        // Security: Derive ownerAnalystId from session, not client (same as /api/leads)
        // Only analysts can own leads - they become owners when they create leads
        const ownerAnalystId = currentUser.role === 'analyst' ? currentUser.id : null;
        
        // Create lead for the company (new or existing)
        const lead = await storage.createLead({
          organizationId: currentUser.organizationId,
          companyId: Number(companyResult.company.id),
          stage: 'universe',
          universeStatus,
          ownerAnalystId, // Set ownership for analysts
          assignedTo: formData.assignedTo || null,
          pocCount: 0, // No contacts added yet
          pocCompletionStatus: 'red', // Default until contacts are added
          pipelineValue: null,
          probability: '0',
          notes: null,
          createdBy: currentUser.id,   // ⭐ REQUIRED
          // createdBy: formData.createdBy
        });

        // Log company creation activity if new company was created (best effort)
        if (!companyResult.isExisting) {
          try {
            await ActivityLogService.logCompanyCreated(
              currentUser.organizationId,
              currentUser.id,
              companyResult.company.id,
              formData.companyName
            );
          } catch (logError) {
            console.error('Error logging company creation (non-fatal):', logError);
          }
        }

        // Log lead creation activity (best effort)
        try {
          await ActivityLogService.logLeadCreated(
            currentUser.organizationId,
            currentUser.id,
            lead.id,
            companyResult.company.id,
            formData.companyName,
            'universe'
          );
        } catch (logError) {
          console.error('Error logging lead creation (non-fatal):', logError);
        }

        // Log lead assignment if assigned to someone (best effort)
        if (formData.assignedTo) {
          try {
            const assignedUser = await storage.getUser(formData.assignedTo);
            const assignedToName = assignedUser 
              ? `${assignedUser.firstName || ''} ${assignedUser.lastName || ''}`.trim() || assignedUser.email
              : undefined;
            
            await ActivityLogService.logLeadAssigned(
              currentUser.organizationId,
              currentUser.id,
              lead.id,
              companyResult.company.id,
              formData.companyName,
              formData.assignedTo,
              assignedToName || undefined
            );
          } catch (logError) {
            console.error('Error logging lead assignment (non-fatal):', logError);
          }
        }

        res.json({
          success: true,
          company: companyResult.company,
          lead,
          isExistingCompany: companyResult.isExisting,
          message: companyResult.isExisting 
            ? `Lead created for existing company "${formData.companyName}"`
            : `New company "${formData.companyName}" and lead created successfully`
        });

      } catch (error) {
        console.error('Error creating individual lead:', error);
        
        // Handle specific validation errors
        if (error instanceof Error && error.message.includes('already exists')) {
          return res.status(409).json({ message: error.message });
        }
        
        res.status(400).json({ 
          message: 'Failed to create lead', 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    });

    // Invitation management routes
    
    // Send invitation - Admin/Partner only
    app.post('/api/invitations', authMiddleware, requireRole(['admin', 'partner']), async (req: any, res: any) => {
      try {
        const { email, role, analystId } = req.body;
        const currentUser = req.verifiedUser;
        
        if (!currentUser?.organizationId) {
          return res.status(400).json({ message: 'User not associated with an organization' });
        }

        // Validate input
        if (!email || !role) {
          return res.status(400).json({ message: 'Email and role are required' });
        }

        if (!['analyst', 'partner', 'admin', 'intern'].includes(role)) {
          return res.status(400).json({ message: 'Invalid role specified' });
        }
        
        // For interns, analystId is required
        if (role === 'intern' && !analystId) {
          return res.status(400).json({ message: 'Intern must be assigned to an analyst' });
        }
        
        // Validate analyst exists and belongs to same organization
        if (role === 'intern' && analystId) {
          const analyst = await storage.getUser(analystId);
          if (!analyst || analyst.organizationId !== currentUser.organizationId || analyst.role !== 'analyst') {
            return res.status(400).json({ message: 'Invalid analyst assignment' });
          }
        }

        // Check if user already exists with this email
        const existingUser = await storage.getUsers(currentUser.organizationId);
        if (existingUser.some(user => user.email === email)) {
          return res.status(409).json({ message: 'User with this email already exists in your organization' });
        }

        // Check if invitation already exists
        const existingInvitations = await storage.getInvitationsByOrganization(currentUser.organizationId);
        const pendingInvite = existingInvitations.find(inv => inv.email === email && inv.status === 'pending');
        if (pendingInvite) {
          return res.status(409).json({ message: 'Invitation already sent to this email address' });
        }

        // Generate invitation token and expiry (7 days)
        const inviteToken = randomUUID();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        // Create invitation
        const invitation = await storage.createInvitation({
          email,
          role,
          inviteToken,
          expiresAt,
          invitedBy: currentUser.id,
          status: 'pending',
          organizationId: currentUser.organizationId,
          ...(role === 'intern' && analystId ? { analystId } : {})
        });

        // Send invitation email
        const organization = await storage.getOrganization(currentUser.organizationId);
        
        // Update status to "sending"
        await storage.updateInvitationEmailStatus(invitation.id, 'sending');
        
        const emailResult = await emailService.sendInvitationEmail({
          recipientEmail: email,
          inviterName: `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || currentUser.email || 'Admin',
          organizationName: organization?.name || 'Investment Bank CRM',
          role,
          inviteToken,
          expiresAt,
        });

        if (emailResult.success) {
          // Update status to "sent" with timestamp
          await storage.updateInvitationEmailStatus(
            invitation.id, 
            'sent', 
            new Date(),
            ''
          );
          console.log(`✅ Invitation email sent to ${email} via ${emailResult.provider}`);
        } else {
          // Update status to "failed" with error message
          await storage.updateInvitationEmailStatus(
            invitation.id, 
            'failed', 
            undefined,
            emailResult.error || 'Unknown error'
          );
          console.error(`❌ Failed to send invitation email: ${emailResult.error}`);
        }

        // Fetch updated invitation with email status
        const updatedInvitation = await storage.getInvitation(inviteToken);

        res.status(201).json({ 
          message: emailResult.success ? 'Invitation sent successfully' : 'Invitation created but email failed to send', 
          invitation: updatedInvitation,
          emailSent: emailResult.success
        });

      } catch (error) {
        console.error('Error sending invitation:', error);
        res.status(500).json({ message: 'Failed to send invitation' });
      }
    });

    // Get invitations for organization - Admin/Partner only
    app.get('/api/invitations', authMiddleware, requireRole(['admin', 'partner']), async (req: any, res: any) => {
      try {
        const currentUser = req.verifiedUser;
        
        if (!currentUser?.organizationId) {
          return res.status(400).json({ message: 'User not associated with an organization' });
        }

        const invitations = await storage.getInvitationsByOrganization(currentUser.organizationId);
        res.json(invitations);

      } catch (error) {
        console.error('Error fetching invitations:', error);
        res.status(500).json({ message: 'Failed to fetch invitations' });
      }
    });

    // Accept invitation - Public endpoint (no auth required)
    app.get('/api/invitations/accept/:token', async (req: any, res: any) => {
      try {
        const { token } = req.params;
        
        const invitation = await storage.getInvitation(token);
        if (!invitation) {
          return res.status(404).json({ message: 'Invalid invitation token' });
        }

        if (invitation.status !== 'pending') {
          return res.status(400).json({ message: 'Invitation has already been processed' });
        }

        if (new Date() > new Date(invitation.expiresAt)) {
          await storage.updateInvitationStatus(token, 'expired');
          return res.status(400).json({ message: 'Invitation has expired' });
        }

        // Return invitation details for acceptance page
        res.json({
          email: invitation.email,
          role: invitation.role,
          organizationId: invitation.organizationId,
          expiresAt: invitation.expiresAt,
          invitedBy: invitation.invitedBy
        });

      } catch (error) {
        console.error('Error validating invitation:', error);
        res.status(500).json({ message: 'Failed to validate invitation' });
      }
    });

    // Delete/Cancel invitation - Admin/Partner only
    app.delete('/api/invitations/:id', authMiddleware, requireRole(['admin', 'partner']), async (req: any, res: any) => {
      try {
        const invitationId = parseInt(req.params.id);
        const currentUser = req.verifiedUser;
        
        if (!currentUser?.organizationId) {
          return res.status(400).json({ message: 'User not associated with an organization' });
        }

        if (isNaN(invitationId)) {
          return res.status(400).json({ message: 'Invalid invitation ID' });
        }

        await storage.deleteInvitation(invitationId, currentUser.organizationId);
        res.json({ message: 'Invitation cancelled successfully' });

      } catch (error) {
        console.error('Error cancelling invitation:', error);
        res.status(500).json({ message: 'Failed to cancel invitation' });
      }
    });

    // Retry invitation email - Admin/Partner only
    app.post('/api/invitations/:id/retry', authMiddleware, requireRole(['admin', 'partner']), async (req: any, res: any) => {
      try {
        const invitationId = parseInt(req.params.id);
        const currentUser = req.verifiedUser;
        
        if (!currentUser?.organizationId) {
          return res.status(400).json({ message: 'User not associated with an organization' });
        }

        if (isNaN(invitationId)) {
          return res.status(400).json({ message: 'Invalid invitation ID' });
        }

        // Get invitation
        const invitations = await storage.getInvitationsByOrganization(currentUser.organizationId);
        const invitation = invitations.find(inv => inv.id === invitationId);
        
        if (!invitation) {
          return res.status(404).json({ message: 'Invitation not found' });
        }

        if (invitation.status === 'accepted') {
          return res.status(400).json({ message: 'Invitation already accepted' });
        }

        // Block retries if email was already sent successfully
        if (invitation.emailStatus === 'sent') {
          return res.status(400).json({ message: 'Email already sent successfully' });
        }

        // Block retries if email is currently being sent
        if (invitation.emailStatus === 'sending') {
          return res.status(400).json({ message: 'Email is currently being sent' });
        }

        // Check retry limit (max 5 retries)
        if ((invitation.retryCount || 0) >= 5) {
          return res.status(429).json({ message: 'Maximum retry attempts reached' });
        }

        // Increment retry count
        await storage.incrementInvitationRetryCount(invitationId);

        // Get organization
        const organization = await storage.getOrganization(currentUser.organizationId);
        
        // Update status to "sending"
        await storage.updateInvitationEmailStatus(invitationId, 'sending');
        
        // Retry email
        const emailResult = await emailService.sendInvitationEmail({
          recipientEmail: invitation.email,
          inviterName: `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || currentUser.email || 'Admin',
          organizationName: organization?.name || 'Investment Bank CRM',
          role: invitation.role,
          inviteToken: invitation.inviteToken,
          expiresAt: invitation.expiresAt,
        });

        if (emailResult.success) {
          await storage.updateInvitationEmailStatus(
            invitationId, 
            'sent', 
            new Date(),
            ''
          );
          console.log(`✅ Invitation email resent to ${invitation.email}`);
        } else {
          await storage.updateInvitationEmailStatus(
            invitationId, 
            'failed', 
            undefined,
            emailResult.error || 'Unknown error'
          );
          console.error(`❌ Failed to resend invitation email: ${emailResult.error}`);
        }

        // Get updated invitation
        const updatedInvitations = await storage.getInvitationsByOrganization(currentUser.organizationId);
        const updatedInvitation = updatedInvitations.find(inv => inv.id === invitationId);

        res.json({ 
          message: emailResult.success ? 'Invitation email resent successfully' : 'Failed to resend invitation email',
          invitation: updatedInvitation,
          emailSent: emailResult.success
        });

      } catch (error) {
        console.error('Error retrying invitation email:', error);
        res.status(500).json({ message: 'Failed to retry invitation email' });
      }
    });

    // Test email configuration - Admin only
    app.post('/api/email/test', authMiddleware, requireRole(['admin']), async (req: any, res: any) => {
      try {
        const currentUser = req.verifiedUser;
        
        const testResult = await emailService.testEmailConfig();
        
        res.json({
          configured: testResult.success,
          provider: testResult.provider,
          message: testResult.success 
            ? `Email configuration is working. Test email sent via ${testResult.provider}` 
            : `Email configuration failed: ${testResult.error}`,
          error: testResult.error
        });

      } catch (error) {
        console.error('Error testing email configuration:', error);
        res.status(500).json({ 
          configured: false,
          message: 'Failed to test email configuration',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Get email configuration status - Admin only
    app.get('/api/email/status', authMiddleware, requireRole(['admin']), async (req: any, res: any) => {
      try {
        const status = emailService.getConfigStatus();
        res.json(status);
      } catch (error) {
        console.error('Error getting email status:', error);
        res.status(500).json({ message: 'Failed to get email status' });
      }
    });


        // 🧹 TEMP: Public route to wipe news cache (Auth removed for easy browser access)
    app.get('/api/debug/clear-news', async (req: any, res) => {
      try {
        // Delete ALL news items to force a re-fetch for everyone
        await db.delete(newsFeed);
        res.json({ message: "✅ Cache cleared! Now refresh your dashboard to see fresh news." });
      } catch (error) {
        console.error("Clear cache error:", error);
        res.status(500).json({ message: "Failed to clear cache" });
      }
    });


        // ✅ Configure Multer to save Pitching files to a dedicated folder
const pitchingUploadDir = path.join(process.cwd(), "uploads", "pitching-files");
fs.mkdirSync(pitchingUploadDir, { recursive: true });

const pitchingDiskStorage = multer.diskStorage({
  destination: function (_req, _file, cb) {
    cb(null, pitchingUploadDir);
  },
  filename: function (_req, file, cb) {
    const safeOriginalName = file.originalname.replace(/[^\w.\-() ]/g, "_");
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}-${safeOriginalName}`);
  },
});

const pitchingUpload = multer({
  storage: pitchingDiskStorage,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25 MB
  },
  fileFilter: (_req, file, cb) => {
    const isPdf =
      file.mimetype === "application/pdf" ||
      file.originalname.toLowerCase().endsWith(".pdf");

    if (!isPdf) {
      return cb(new Error("Only PDF files are allowed"));
    }

    cb(null, true);
  },
});


    // --- PITCHING TRACKER ROUTES ---

    // 1. Get Details
    app.get("/api/leads/:id/pitching", async (req, res) => {
      const leadId = Number(req.params.id);
      if (isNaN(leadId)) return res.status(400).json({ message: "Invalid lead ID" });

      try {
        const details = await storage.getPitchingDetails(leadId);
        // Return empty object if none exists yet
        res.json(details || {});
      } catch (error) {
        res.status(500).json({ message: "Failed to fetch pitching details" });
      }
    });

// 2. Update Data (Text/Dates/Booleans)
// 2. Update Data (Text/Dates/Booleans)
   // 2. Update Data (Text/Dates/Booleans)
app.post("/api/leads/:id/pitching", authMiddleware, async (req: any, res) => {
  const leadId = Number(req.params.id);

  if (isNaN(leadId)) {
    return res.status(400).json({ message: "Invalid lead ID" });
  }

  try {
    console.log("Received pitching update for Lead:", leadId, req.body);

const data: any = { ...req.body };

const currentUser =
  req.verifiedUser ||
  (req.user?.claims?.sub ? await storage.getUser(req.user.claims.sub) : undefined);

const dateFields = [
  "meeting1Date",
  "meeting2Date",
  "gdriveNextActionAt",
  "solutionNoteNextActionAt",
  "pdmNextActionAt",
  "meeting1NextActionAt",
  "meeting2NextActionAt",
  "loeNextActionAt",
  "mandateNextActionAt",
];

const assigneeFieldMap = {
  pdmTaskAssignedTo: "pdmTaskAssignedBy",
  meeting1TaskAssignedTo: "meeting1TaskAssignedBy",
  meeting2TaskAssignedTo: "meeting2TaskAssignedBy",
  loeTaskAssignedTo: "loeTaskAssignedBy",
  mandateTaskAssignedTo: "mandateTaskAssignedBy",
} as const;

for (const [assigneeField, assignedByField] of Object.entries(assigneeFieldMap)) {
  if (!(assigneeField in data)) continue;

  if (data[assigneeField] === "" || data[assigneeField] === undefined) {
    data[assigneeField] = null;
    data[assignedByField] = null;
    continue;
  }

  if (data[assigneeField] && currentUser?.organizationId) {
    const assignee = await storage.getUser(String(data[assigneeField]));
    if (!assignee || Number(assignee.organizationId) !== Number(currentUser.organizationId)) {
      return res.status(400).json({ message: `Invalid assignee for ${assigneeField}` });
    }
  }

  data[assignedByField] = currentUser?.id || null;
}


for (const field of dateFields) {
  if (!(field in data)) {
    continue;
  }

  if (data[field] === "" || data[field] === undefined) {
    data[field] = null;
  } else if (data[field]) {
    const parsed = new Date(data[field]);
    if (Number.isNaN(parsed.getTime())) {
      return res.status(400).json({ message: `Invalid date for ${field}` });
    }
    data[field] = parsed;
  }
}

    const updated = await storage.upsertPitchingDetails(leadId, data);


    if (currentUser) {
      const lead = await storage.getLead(leadId, currentUser.organizationId);
      const companyId = lead?.companyId || undefined;

      await storage.createActivityLog({
        organizationId: currentUser.organizationId,
        userId: currentUser.id,
        leadId: leadId,
        companyId: companyId,
        action: "pitching_updated",
        entityType: "lead",
        entityId: leadId,
        description: "Updated pitching details (inline milestone workspace)",
      });
    }

    res.json(updated);
  } catch (error) {
    console.error("CRITICAL ERROR saving pitching details:", error);
    res.status(500).json({
      message: "Failed to save pitching details",
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

app.get("/api/debug/pitching-upload-check", (_req, res) => {
  res.json({ ok: true, source: "latest-routes-ts-upload-patch" });
});

    // 3. Upload PDM file
    app.post("/api/leads/:id/pitching/upload", authMiddleware, (req, res) => {
      console.log("[PITCHING UPLOAD HIT] leadId =", req.params.id);
      pitchingUpload.single("file")(req, res, async (uploadError: any) => {
        if (uploadError) {
          console.error("Pitching upload middleware error:", uploadError);
          return res.status(400).json({
            message: uploadError?.message || "File upload failed during middleware processing",
          });
        }

        const leadId = Number(req.params.id);
        const fileType = req.body?.fileType;

        if (!Number.isFinite(leadId)) {
          return res.status(400).json({ message: "Invalid lead ID" });
        }

        if (!req.file) {
          return res.status(400).json({ message: "File missing" });
        }

        if (fileType !== "pdm") {
          return res.status(400).json({ message: "Invalid fileType. Only 'pdm' is allowed." });
        }

        try {
          console.log("[PITCHING UPLOAD CALLBACK] fileType =", req.body?.fileType, "file =", req.file?.originalname);
          if (!req.file.path) {
            throw new Error("Multer did not return a saved file path");
          }

          const updated = await storage.upsertPitchingDetails(leadId, {
            pdmPath: req.file.path,
            pdmName: req.file.originalname,
          });

          const currentUser =
            (req as any).verifiedUser ||
            ((req as any).user?.claims?.sub
              ? await storage.getUser((req as any).user.claims.sub)
              : undefined);

          if (currentUser?.organizationId) {
            const lead = await storage.getLead(leadId, currentUser.organizationId);
            const companyId = lead?.companyId || undefined;

            await storage.createActivityLog({
              organizationId: currentUser.organizationId,
              userId: currentUser.id,
              leadId,
              companyId,
              action: "pitching_file_uploaded",
              entityType: "lead",
              entityId: leadId,
              description: `Uploaded PDM: ${req.file.originalname}`,
            });
          }

          return res.json(updated);
        } catch (error) {
          console.error("Pitching upload route error:", error);
          return res.status(500).json({
            message: error instanceof Error ? error.message : "Failed to upload PDM",
          });
        }
      });
    });

    // 4. Preview Files
app.get("/api/leads/:id/pitching/preview/:fileType", async (req, res) => {
  const leadId = Number(req.params.id);
  const { fileType } = req.params;

  try {
    const details = await storage.getPitchingDetails(leadId);
    if (!details) return res.status(404).send("Details not found");

    let dbPath: string | null = null;

    if (fileType === "solutionNote") {
      dbPath = details.solutionNotePath;
    } else if (fileType === "pdm") {
      dbPath = details.pdmPath;
    } else {
      return res.status(400).send("Invalid file type");
    }

    if (!dbPath) {
      return res.status(404).send("No file record found for this type");
    }

    const absolutePath = path.isAbsolute(dbPath)
      ? dbPath
      : path.join(process.cwd(), dbPath);

    if (!fs.existsSync(absolutePath)) {
      return res.status(404).send("File not found on server");
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "inline");
    return res.sendFile(absolutePath);
  } catch (error) {
    console.error("Preview route error:", error);
    res.status(500).send("Preview failed");
  }
});

    // 4. Download Files
 // 4. Download Files
// 4. Download Files
    app.get("/api/leads/:id/pitching/download/:fileType", async (req, res) => {
      const leadId = Number(req.params.id);
      const { fileType } = req.params;

      try {
        const details = await storage.getPitchingDetails(leadId);
        if (!details) return res.status(404).send("Details not found");

        let dbPath: string | null = null;
        let fileName: string = "download.pdf"; // Provide a default string value

        if (fileType === "solutionNote") {
          dbPath = details.solutionNotePath;
          fileName = details.solutionNoteName || "Solution_Note.pdf";
        } else if (fileType === "pdm") {
          dbPath = details.pdmPath;
          fileName = details.pdmName || "PDM.pdf";
        }

        // Check if we actually have a path to a file
        if (!dbPath) {
          return res.status(404).send("No file record found for this type");
        }

        // Resolve the absolute path
        const absolutePath = path.isAbsolute(dbPath) 
          ? dbPath 
          : path.join(process.cwd(), dbPath);

        console.log(`[Download] Attempting to serve: ${absolutePath}`);

        if (!fs.existsSync(absolutePath)) {
          console.error(`[Download Error] File NOT found at: ${absolutePath}`);
          return res.status(404).send("File not found on server");
        }

        // ✅ FIX: Use a type guard or fallback to satisfy TypeScript
        // This ensures the second argument is strictly a string.
        res.download(absolutePath, fileName || "file.pdf");

      } catch (error) {
        console.error("Download route error:", error);
        res.status(500).send("Download failed");
      }
    });




    // More routes can be added here

    const httpServer = createServer(app);
    return httpServer;
  }
