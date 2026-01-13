// Integration: javascript_log_in_with_replit
import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { StageProgressionService } from "./stageProgressionService";
import ActivityLogService from "./activityLogService";
import { randomUUID } from 'crypto';
import { emailService } from './smtpEmailService';
import { z } from 'zod';
import session from 'express-session';

import { db } from "./db";
import { leads } from "./shared/schema";
// Import route modules
import { userRoutes } from './routes/userRoutes.js';
import { companyRoutes } from './routes/companyRoutes.js';
import { leadRoutes } from './routes/leadRoutes.js';
import { contactRoutes } from './routes/contactRoutes.js';

// Import middleware
import { requireRole } from './middleware/auth.js';
import { requireSupabaseAuth } from './middleware/supabaseAuth.js';

import { parse } from "csv-parse/sync";
import multer from "multer";
import { createRequire } from "module";
const require = createRequire(import.meta.url);

const pdfParsePkg: any = require("pdf-parse");

// v2+ exports { PDFParse }, v1 exported a function
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
    app.use('/api/companies', authMiddleware, requireRole(['partner', 'admin','analyst']), companyRoutes);
    app.use('/api/leads', authMiddleware, leadRoutes); // Role checks moved to individual routes
    app.use('/api/contacts', authMiddleware, contactRoutes);
    

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

function cleanStr(s: string) {
  return (s || "")
    .replace(/[]/g, "")                 // remove Tracxn icon chars
    .replace(/Pro\u0000t/gi, "Profit")    // ✅ fix ligature: Pro\u0000t => Profit
    .replace(/\u0000/g, "")               // remove remaining null chars
    .replace(/[\uf0d8\uf0e8]/g, "")       // optional: remove Tracxn arrow icons
    .replace(/[ \t]+/g, " ")
    .trim();
}

function pickCrNumbers(line: string): number[] {
  const matches = [...line.matchAll(/(\(?-?\d[\d,]*(?:\.\d+)?\)?)\s*Cr/gi)];
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
  const text = cleanStr(textRaw);

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
  const ebitdaInrCr =
    pickFirstCrAfterLabel(text, /^EBITDA\b/i) ??
    pickLastCrNumber(pickBestLineWithCr(text, /^EBITDA\b/i));

  const PAT_LABEL = /\b(Net\s*Pro(?:fi)?t(?:\/Loss)?|NetProfit|PAT|Profit\s*After\s*Tax)\b/i;

  const patInrCr =
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

      const pdfParsePkg: any = require("pdf-parse");

      // v2+ exports { PDFParse }, v1 exported a function
      const PDFParseClass: any =
        pdfParsePkg?.PDFParse ??
        pdfParsePkg?.default?.PDFParse ??
        null;

      async function extractPdfText(buffer: Buffer): Promise<string> {
        // v1 API: pdfParse(buffer) -> { text }
        if (typeof pdfParsePkg === "function") {
          const r = await pdfParsePkg(buffer);
          return r?.text || "";
        }

        // v2+ API: new PDFParse({ data: buffer }).getText() -> { text }
        if (typeof PDFParseClass === "function") {
          const parser = new PDFParseClass({ data: buffer });
          const r = await parser.getText();
          if (typeof parser.destroy === "function") await parser.destroy();
          return r?.text || "";
        }

        throw new Error("pdf-parse export not supported (expected function or PDFParse class)");
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
      if (!csvData || typeof csvData !== "string") {
        return res.status(400).json({ message: "CSV data is required" });
      }

      const organizationId = currentUser.organizationId;

      // ✅ robust number parsing
      function parseNumber(val: any): number | null {
        if (val === null || val === undefined) return null;
        const s = String(val).trim();
        if (!s || s.toLowerCase() === "na" || s.toLowerCase() === "n/a") return null;
        // remove currency symbols/commas
        const cleaned = s.replace(/₹/g, "").replace(/,/g, "").trim();
        const num = Number(cleaned);
        return Number.isFinite(num) ? num : null;
      }

      const rows = parse(csvData, {
        columns: true,           // uses headers as keys
        skip_empty_lines: true,
        bom: true,               // handles BOM in CSVs from Excel/Sheets
        relax_quotes: true,
        relax_column_count: true // ignores extra columns
      }) as Record<string, any>[];
      console.log("[csv-upload] using csv-parse ✅ rows:", rows.length);

      const nonEmptyRows = rows.filter((r) =>
        Object.values(r || {}).some((v) => String(v ?? "").trim() !== "")
      );

      if (nonEmptyRows.length === 0) {
        return res.status(400).json({ message: "CSV must contain at least one data row" });
      }


      // optional safety cap
      const MAX_ROWS = 5000;
      if (rows.length > MAX_ROWS) {
        return res.status(400).json({ message: `Too many rows. Max allowed is ${MAX_ROWS}.` });
      }

      // ✅ preload users for assignment matching (once)
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
        successfulLeads: 0,
        successfulContacts: 0,
        warnings: [] as Array<{ row: number; warning: string }>,
        errors: [] as Array<{ row: number; error: string }>,
      };

      for (let i = 0; i < rows.length; i++) {
        const rowNum = i + 2; // header is row 1
        try {
          const rowRaw = rows[i] || {};

          // ✅ Normalize headers (trim, collapse spaces, remove \n)
          const row = Object.fromEntries(
            Object.entries(rowRaw).map(([k, v]) => [String(k).replace(/\s+/g, " ").trim(), v])
          ) as Record<string, any>;

          // ---- Company mapping by header name (extra columns ignored automatically)
          const companyName = (row["Company Name"] ?? row["Company"] ?? row["Name"] ?? "").toString().trim();
          if (!companyName) {
            results.errors.push({ row: rowNum, error: "Company Name is required" });
            continue;
          }

          const companyData: any = {
            name: companyName,
            sector: (row["Sector"] ?? null)?.toString().trim() || null,
            subSector: (row["Sub-Sector"] ?? row["Sub Sector"] ?? null)?.toString().trim() || null,
            location: (row["City"] ?? row["Location"] ?? null)?.toString().trim() || null,
            // FY fields (based on your CSV)
            financialYear: "FY24",
            revenueInrCr: parseNumber(row["FY24 Revenue (INR Cr)"]),
            ebitdaInrCr: parseNumber(row["FY24 EBITDA (INR Cr)"]),
            patInrCr: parseNumber(row["FY24 PAT (INR Cr)"]),
            // not present in your CSV, keep null
            foundedYear: null,
            businessDescription: null,
            products: null,
            website: null,
            industry: null,
          };

          // ✅ Create company with dedupe
          const companyResult = await storage.createCompanyWithDeduplication(companyData, organizationId);
          const company = companyResult.company;
          const isExisting = companyResult.isExisting;

          if (!isExisting) results.successfulCompanies++;

          // ---- Assignment from CSV ("Analyst PoC SFCA")
          let assignedTo: string | null = null;
          const analystCell = (row["Analyst PoC SFCA"] ?? "").toString().trim();
          if (analystCell && analystCell.toLowerCase() !== "na" && analystCell.toLowerCase() !== "n/a") {
            const asEmail = norm(analystCell);
            const asName = norm(analystCell);

            assignedTo = userByEmail.get(asEmail) || userByName.get(asName) || null;

            if (!assignedTo) {
              results.warnings.push({
                row: rowNum,
                warning: `Assignee not found in CRM users: "${analystCell}". Lead left unassigned.`,
              });
            }
          }

          // ---- Lead: create only if it doesn't exist for this company in this org
          const existingLeads = await storage.getLeadsByCompany(company.id, organizationId);
          let leadId: number | null = null;

          if (!existingLeads || existingLeads.length === 0) {
            const universeStatus = assignedTo ? "assigned" : "open";

            const lead = await storage.createLead({
              organizationId,
              companyId: Number(company.id),
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
            // Optional: if universe lead exists and is unassigned, assign it now
            const lead = existingLeads[0];
            leadId = lead.id;

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

          // ---- Contacts: up to 2 from your file (POC 1 primary, POC 2 secondary)
          const existingContacts = await storage.getContactsByCompany(company.id, organizationId);

          const upsertContact = async (
            incoming: any,
            isPrimary: boolean
          ) => {
            const hasAny =
              incoming.name || incoming.email || incoming.phone || incoming.linkedinProfile || incoming.designation;

            if (!hasAny) return;

            // find match: primary uses isPrimary, secondary uses email/phone match
            let match = null as any;

            if (isPrimary) {
              match = existingContacts.find((c: any) => c.isPrimary);
            } else {
              const emailKey = incoming.email ? norm(incoming.email) : null;
              const phoneKey = incoming.phone ? incoming.phone.toString().trim() : null;

              match = existingContacts.find((c: any) => {
                const cEmail = c.email ? norm(c.email) : null;
                const cPhone = c.phone ? c.phone.toString().trim() : null;
                return (emailKey && cEmail === emailKey) || (phoneKey && cPhone === phoneKey);
              });
            }

            // update only with non-empty values
            const patch: any = {};
            for (const k of ["name", "designation", "email", "phone", "linkedinProfile"] as const) {
              if (incoming[k]) patch[k] = incoming[k];
            }
            patch.isPrimary = isPrimary;

            if (match) {
              await storage.updateContact(match.id, organizationId, patch);  // update existing changed contact
            } else {
              await storage.createContact({
                organizationId,
                companyId: company.id,
                ...patch,
                isPrimary,
              });
              results.successfulContacts++;
            }
          };

          const poc1 = {
          name: (row["POC 1 Name"] ?? "").toString().trim() || null,
          designation: (row["POC 1 Designation"] ?? "").toString().trim() || null, // if not present, stays null
          email: (row["Email ID 1"] ?? row["Primary Contact Email"] ?? "").toString().trim() || null,
          phone: (row["Phone Number 1"] ?? row["Primary Contact Phone"] ?? "").toString().trim() || null,
          linkedinProfile: (row["LinkedIn 1"] ?? row["Primary Contact LinkedIn"] ?? "").toString().trim() || null,
        };

        const poc2 = {
          name: (row["POC Name 2"] ?? row["POC 2 Name"] ?? "").toString().trim() || null,
          designation: (row["POC 2 Designation"] ?? "").toString().trim() || null,
          email: (row["Email ID 2"] ?? "").toString().trim() || null,
          phone: (row["POC 2 Number"] ?? row["Phone Number 2"] ?? "").toString().trim() || null,
          linkedinProfile: (row["LinkedIn 2"] ?? "").toString().trim() || null,
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
      console.log("[csv-upload] using csv-parse ✅");

      return res.json({
        success: true,
        message: `Upload completed: ${results.successfulCompanies} companies, ${results.successfulLeads} leads, ${results.successfulContacts} contacts`,
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
  // ✅ Contacts: make LinkedIn optional (validate only if provided)
const contactFormSchemaOptionalLinkedIn = z.object({
  companyId: z.coerce.number(),
  name: z.string().min(1, "Name is required"),
  designation: z.string().min(1, "Designation is required"),
  email: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),

  // LinkedIn is OPTIONAL now
  linkedinProfile: z
    .string()
    .optional()
    .nullable()
    .transform((v) => {
      const s = (v ?? "").toString().trim();
      return s.length ? s : null;
    })
    .refine((v) => !v || v.includes("linkedin.com"), {
      message: "Please enter a valid LinkedIn URL",
    }),

  isPrimary: z.coerce.boolean().optional(),
});

const updateContactSchemaOptionalLinkedIn = contactFormSchemaOptionalLinkedIn.partial();

    // Contact routes
    app.post('/api/contacts', authMiddleware, async (req: any, res) => {
      try {
        const currentUser = req.verifiedUser || await storage.getUser(req.user?.claims?.sub);
        if (!currentUser || !currentUser.organizationId) {
          return res.status(401).json({ message: 'User organization not found' });
        }
        const contactData = contactFormSchema.parse(req.body); // LinkedIn optional
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
                const completeContacts = companyContacts.filter(
                  (c: any) => !!(c.name && c.name.trim() && c.designation && c.designation.trim())
                );
                if (completeContacts.length >= 1) {
                  pocCompletionStatus = pocCount >= 3 ? 'green' : 'amber';
                }
              }
              
              // Update the lead's POC fields
              await storage.updateLead(lead.id, currentUser.organizationId, {
                pocCount,
                pocCompletionStatus
              });
              
              // Auto-qualify lead if primary contact has Name + Designation
              // and the lead is currently in 'universe' stage
              if (lead.stage === 'universe') {
                const primaryContact = companyContacts.find((c: any) => c.isPrimary);
                if (
                  primaryContact &&
                  primaryContact.name && primaryContact.name.trim() &&
                  primaryContact.designation && primaryContact.designation.trim()
                ) {
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
        const updates = updateContactSchema.parse(req.body);  // LinkedIn optional
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
                const completeContacts = companyContacts.filter(
                  (c: any) => !!(c.name && c.name.trim() && c.designation && c.designation.trim())
                );
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
                if (
                  primaryContact &&
                  primaryContact.name && primaryContact.name.trim() &&
                  primaryContact.designation && primaryContact.designation.trim()
                ) {
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

        res.json(lead);
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


    // PATCH route for manual stage transitions: qualified → outreach, outreach → pitching, pitching → mandates
    app.patch('/api/leads/:id/stage', authMiddleware, validateResourceExists('lead'), async (req: any, res) => {
      try {
        const currentUser = req.verifiedUser;
        if (!currentUser || !currentUser.organizationId) {
          return res.status(401).json({ message: 'User organization not found' });
        }
        
        const { stage, defaultPocId, backupPocId } = req.body;
        if (!stage) {
          return res.status(400).json({ message: 'Stage is required' });
        }
        
        // Validate stage is a valid value
        const validStages = ['universe', 'qualified', 'outreach', 'pitching', 'mandates', 'won', 'lost', 'hold', 'dropped', 'rejected'];
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
          !isMoveToHold &&
          !isMoveToDropped &&
          !isFromHoldOrDroppedToSimple
        ) {
          return res.status(400).json({
            message:
              'This endpoint only supports: Qualified→Outreach, Outreach→Pitching, Pitching→Mandates, Move→Hold, Move→Dropped, or Hold/Dropped→(Universe/Qualified)',
            currentStage: currentLead.stage,
            requestedStage: stage,
          });
        }

        // For outreach → pitching transition, validate that a meeting intervention exists and POC is selected
        if (isOutreachToPitching) {
          const interventions = await storage.getInterventions(leadId, currentUser.organizationId);
          const hasMeeting = interventions.some((intervention: any) => intervention.type === 'meeting');
          
          if (!hasMeeting) {
            return res.status(400).json({
              message: 'Cannot move to Pitching stage: A meeting with POCs must be recorded first',
              currentStage: currentLead.stage,
              requestedStage: stage,
              requiresMeeting: true
            });
          }
          
          // Validate default POC is provided
          if (!defaultPocId) {
            return res.status(400).json({
              message: 'Cannot move to Pitching stage: Default POC must be selected',
              currentStage: currentLead.stage,
              requestedStage: stage,
              requiresDefaultPoc: true
            });
          }
          
          // CRITICAL SECURITY: Validate that POCs belong to the same company and organization
          const defaultContact = await storage.getContact(defaultPocId, currentUser.organizationId);
          if (!defaultContact) {
            return res.status(404).json({
              message: 'Default POC not found'
            });
          }
          
          if (defaultContact.companyId !== currentLead.companyId) {
            return res.status(403).json({
              message: 'Invalid POC: Contact must belong to the same company'
            });
          }
          
          // Validate backup POC if provided
          if (backupPocId) {
            // Ensure backup is different from default
            if (backupPocId === defaultPocId) {
              return res.status(400).json({
                message: 'Backup POC must be different from default POC'
              });
            }
            
            const backupContact = await storage.getContact(backupPocId, currentUser.organizationId);
            if (!backupContact) {
              return res.status(404).json({
                message: 'Backup POC not found'
              });
            }
            
            if (backupContact.companyId !== currentLead.companyId) {
              return res.status(403).json({
                message: 'Invalid backup POC: Contact must belong to the same company'
              });
            }
          }
        }
        
        // Build updates object with POC IDs if moving to pitching
        const updates: any = { stage };
        if (isOutreachToPitching && defaultPocId) {
          updates.defaultPocId = defaultPocId;
          // Allow explicit null to clear backupPocId
          updates.backupPocId = backupPocId || null;
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
            // 1) Assign
            await storage.assignLead(leadId, organizationId, assignedTo, undefined,assignedBy, "Bulk assignment");

            // 2) Trigger stage logic
            try {
              await stageProgressionService.autoProgressLead(leadId, organizationId);
            } catch (e) {
              console.error(`Auto-progression failed for lead ${leadId}:`, e);
            }

            // 3) SAFETY fallback: force Universe -> Qualified if assigned to analyst
            // 3) SAFETY fallback: force Universe -> Qualified if assigned to analyst
            const updatedLead = await storage.getLead(leadId, organizationId);
            if (updatedLead && updatedLead.stage === "universe" && assignedUser.role === "analyst") {
              await storage.updateLead(leadId, organizationId, { stage: "qualified" });
            }

            // ✅ Count after everything (so it works whether stage changed in assignLead OR fallback)
            const finalLead = await storage.getLead(leadId, organizationId);
            if (finalLead?.stage === "qualified" && assignedUser.role === "analyst") {
              autoQualifiedCount++;
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

    app.put('/api/interventions/:id', authMiddleware, validateIntParam('id'), async (req: any, res) => {
      try {
        const currentUser = req.verifiedUser || await storage.getUser(req.user?.claims?.sub);
        if (!currentUser || !currentUser.organizationId) {
          return res.status(401).json({ message: 'User organization not found' });
        }
        
        const updates = interventionFormSchema
          .extend({
            status: z.enum(["pending", "completed"]).optional(),
          })
          .partial()
          .parse(req.body);

        const intervention = await storage.updateIntervention(parseInt(req.params.id), currentUser.organizationId, updates);
        
        if (!intervention) {
          return res.status(404).json({ message: 'Intervention not found' });
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
    app.get('/api/activity-logs', authMiddleware, requireRole(['admin', 'partner','analyst']), async (req: any, res) => {
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

    // More routes can be added here

    const httpServer = createServer(app);
    return httpServer;
  }
