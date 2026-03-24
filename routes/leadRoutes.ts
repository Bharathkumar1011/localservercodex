import { Router } from 'express';
import { leadController } from '../controllers/leadController.js';
import { requireRole } from '../middleware/auth.js';
import { validateIntParam, validateResourceExists, validateStage } from '../middleware/validation.js';
import { storage } from "../storage.js";


import { db } from "../db.js";
import { leadRemarks } from "../shared/schema.js";
import { eq, desc } from "drizzle-orm";


const router = Router();

// ✅ Universe tab should show New + Active (and exclude Hold/Dropped/Rejected/etc.)
const UNIVERSE_VISIBLE_STAGES = new Set<string>([
  "universe",
  "qualified",
  "outreach",
  "pitching",
  "mandates",
]);



// ✅ Active leads = qualified + outreach + pitching + mandates (for CSV export)
const ACTIVE_LEAD_STAGES = new Set<string>([
  "qualified",
  "outreach",
  "pitching",
  "mandates",
]);

const toCsvValue = (value: any): string => {
  if (value === null || value === undefined) return "";
  const str = String(value);
  // Escape double-quotes by doubling them
  const escaped = str.replace(/"/g, '""');
  // Wrap in quotes if it contains comma, quote, or newline
  if (/[",\n\r]/.test(escaped)) return `"${escaped}"`;
  return escaped;
};

const formatUserName = (u?: any): string => {
  if (!u) return "";
  const first = String(u.firstName ?? "").trim();
  const last = String(u.lastName ?? "").trim();
  const full = `${first} ${last}`.trim();
  return full || String(u.email ?? "").trim() || String(u.id ?? "").trim();
};


const normStage = (s: any) => String(s ?? "").toLowerCase().trim();


// Individual Lead Creation Route with Deduplication
router.post('/individual', requireRole(['analyst', 'partner', 'admin']), leadController.createIndividualLead);

// Bulk assign leads route
router.post('/bulk-assign', requireRole(['partner', 'admin']), leadController.bulkAssignLeads);

// Specific routes must come BEFORE generic :id route to avoid incorrect matching
router.get('/all', requireRole(['analyst', 'partner', 'admin']), leadController.getAllLeads);
router.get('/my', requireRole(['analyst', 'partner', 'admin']), leadController.getMyLeads);
router.get(
  "/stage/:stage",
  requireRole(["analyst", "partner", "admin"]),
  validateStage,
  async (req: any, res) => {
    try {
      const user = req.verifiedUser;
      const userId = user?.id;
      const orgId = user?.organizationId;

      if (!user || !orgId) {
        return res.status(404).json({ message: "User not found or missing organization" });
      }

      const stageParam = normStage(req.params.stage);
      const isUniverse = stageParam === "universe";

      // Universe = universe + qualified + outreach + pitching + mandates
      const allowedStages = isUniverse
        ? UNIVERSE_VISIBLE_STAGES
        : new Set<string>([stageParam]);

      let leadsList: any[] = [];

      // Keep permissions consistent with your app
      if (user.role === "analyst") {
        leadsList = await storage.getLeadsByAssignee(userId, orgId);
      } else if (user.role === "partner") {
        leadsList = await storage.getLeadsByPartner(userId, orgId);
      } else {
        // admin
        if (!isUniverse) {
          // admin can fetch stage directly
          const rows = await storage.getLeadsByStage(stageParam, orgId);
          return res.json(rows);
        }
        leadsList = await storage.getAllLeads(orgId);
      }

      const filtered = (leadsList || []).filter((l: any) =>
        allowedStages.has(normStage(l?.stage))
      );

      return res.json(filtered);
    } catch (err) {
      console.error("Error fetching leads by stage:", err);
      return res.status(500).json({ message: "Failed to fetch leads" });
    }
  }
);




// ✅ Export Active Leads (Qualified + Outreach + Pitching + Mandates) as CSV
router.get(
  "/export/active-csv",
  requireRole(["analyst", "partner", "admin"]),
  async (req: any, res) => {
    try {
      const user = req.verifiedUser;
      const userId = user?.id;
      const orgId = user?.organizationId;

      if (!user || !orgId) {
        return res.status(404).json({ message: "User not found or missing organization" });
      }

      let leadsList: any[] = [];

      // Keep permissions consistent with Universe visibility
      if (user.role === "analyst") {
        leadsList = await storage.getLeadsByAssignee(userId, orgId);
      } else if (user.role === "partner") {
        leadsList = await storage.getLeadsByPartner(userId, orgId);
      } else {
        // admin
        leadsList = await storage.getAllLeads(orgId);
      }

      const activeLeads = (leadsList || []).filter((l: any) =>
        ACTIVE_LEAD_STAGES.has(normStage(l?.stage))
      );

      const columns = [
        { key: "leadId", header: "Lead ID" },
        { key: "companyId", header: "Company ID" },
        { key: "companyName", header: "Company Name" },
        { key: "stage", header: "Stage" },
        { key: "leadTemperature", header: "Lead Temperature" },
        { key: "leadSource", header: "Lead Source" },
        { key: "sector", header: "Sector" },
        { key: "website", header: "Website" },
        { key: "location", header: "Location" },
        { key: "revenueInrCr", header: "Revenue (INR Cr)" },
        { key: "ebitdaInrCr", header: "EBITDA (INR Cr)" },
        { key: "patInrCr", header: "PAT (INR Cr)" },
        { key: "primaryContactName", header: "Primary Contact Name" },
        { key: "primaryContactEmail", header: "Primary Contact Email" },
        { key: "primaryContactPhone", header: "Primary Contact Phone" },
        { key: "primaryContactLinkedin", header: "Primary Contact LinkedIn" },
        { key: "assignedTo", header: "Assigned To" },
        { key: "ownerAnalyst", header: "Owner Analyst" },
        { key: "createdBy", header: "Created By" },
        { key: "updatedAt", header: "Updated At" },
      ] as const;

      const lines: string[] = [];
      lines.push(columns.map(c => toCsvValue(c.header)).join(","));

      for (const l of activeLeads) {
        const row: Record<string, any> = {
          leadId: l.id,
          companyId: l.company?.id ?? l.companyId,
          companyName: l.company?.name ?? "",
          stage: l.stage ?? "",
          leadTemperature: l.leadTemperature ?? "",
          leadSource: l.leadSource ?? "",
          sector: l.company?.sector ?? "",
          website: l.company?.website ?? "",
          location: l.company?.location ?? "",
          revenueInrCr: l.company?.revenueInrCr ?? "",
          ebitdaInrCr: l.company?.ebitdaInrCr ?? "",
          patInrCr: l.company?.patInrCr ?? "",
          primaryContactName: l.contact?.name ?? "",
          primaryContactEmail: l.contact?.email ?? "",
          primaryContactPhone: l.contact?.phone ?? "",
          primaryContactLinkedin: l.contact?.linkedinProfile ?? "",
          assignedTo: formatUserName(l.assignedToUser),
          ownerAnalyst: formatUserName(l.ownerAnalystUser),
          createdBy: formatUserName(l.createdByUser),
          updatedAt: l.updatedAt ?? "",
        };

        lines.push(columns.map(c => toCsvValue(row[c.key])).join(","));
      }

      const date = new Date().toISOString().slice(0, 10);
      const csv = "\ufeff" + lines.join("\n"); // BOM helps Excel

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="active_leads_${date}.csv"`);
      return res.status(200).send(csv);
    } catch (err) {
      console.error("Error exporting active leads CSV:", err);
      return res.status(500).json({ message: "Failed to export CSV" });
    }
  }
);




router.get('/assigned', requireRole(['intern']), leadController.getAssignedLeads);
router.get('/assigned/:userId', requireRole(['partner', 'admin']), leadController.getLeadsByAssignee);

// Lead CRUD routes
router.post('/', requireRole(['analyst', 'partner', 'admin']), leadController.createLead);
router.get('/:id', requireRole(['analyst', 'partner', 'admin', 'intern']), validateIntParam('id'), validateResourceExists('lead'), leadController.getLead);
router.put('/:id', requireRole(['partner', 'admin']), validateResourceExists('lead'), leadController.updateLead);

// Lead stage management
router.patch('/:id/stage', requireRole(['analyst', 'partner', 'admin']), validateResourceExists('lead'), leadController.updateLeadStage);
router.patch('/:id/reject', requireRole(['analyst', 'partner', 'admin']), validateResourceExists('lead'), leadController.rejectLead);

// Lead assignment routes
router.post('/:id/assign', requireRole(['partner', 'admin',]), validateResourceExists('lead'), leadController.assignLead);
router.post('/:id/assign-interns', requireRole(['partner', 'admin']), validateResourceExists('lead'), leadController.assignInternsToLead);
router.patch('/:id/assign-intern', requireRole(['analyst', 'partner', 'admin']), validateIntParam('id'), validateResourceExists('lead'), leadController.assignInternToLead);


// --------------------------------------------
// LEAD DETAILS (Upcoming Tasks + anything else)
// --------------------------------------------
router.get("/:id/details",
  requireRole(["analyst", "partner", "admin"]),
  validateIntParam("id"),
  validateResourceExists("lead"),
  async (req: any, res) => {
    try {
      const leadId = Number(req.params.id);
      const organizationId = req.verifiedUser.organizationId;
      
      console.log("DETAIL ROUTE -> user:", req.verifiedUser);
      console.log("DETAIL ROUTE -> leadId:", leadId);
      console.log("DETAIL ROUTE -> orgId:", organizationId);
      // Fetch future tasks for this lead
      const upcomingTasks = await storage.getUpcomingTasksForLead(
        leadId,
        organizationId
      );
      console.log("DETAIL ROUTE -> tasks:", upcomingTasks);
      res.json({
        upcomingTasks,   // frontend expects this key
      });

    } catch (err) {
      console.error("Error loading lead details:", err);
      res.status(500).json({ message: "Failed to load lead details" });
    }
  }
);

router.get(
  "/scheduled",
  requireRole(["admin", "analyst", "partner"]),
  async (req: any, res) => {
    const organizationId = req.verifiedUser.organizationId;
    const list = await storage.getScheduledInterventions(req.verifiedUser);
    // const list = await storage.getScheduledInterventions(organizationId);
    res.json(list);
  }
);



// --------------------------------------------
// GET remarks
// --------------------------------------------
router.get("/:id/remarks",
  requireRole(["analyst", "partner", "admin", "intern"]),
  validateIntParam("id"),
  validateResourceExists("lead"),
  async (req: any, res) => {
    try {
      const currentUser = req.verifiedUser;
      const organizationId = currentUser.organizationId;
      const leadId = Number(req.params.id);

      const remarks = await storage.getLeadRemarks(leadId, organizationId);
      res.json(remarks);

    } catch (err) {
      console.error("Error fetching remarks:", err);
      res.status(500).json({ message: "Failed to fetch remarks" });
    }
  }
);

// --------------------------------------------
// ADD remark
// --------------------------------------------
router.post("/:id/remarks",
  requireRole(["analyst", "partner", "admin", "intern"]),
  validateIntParam("id"),
  validateResourceExists("lead"),
  async (req: any, res) => {
    try {
      const currentUser = req.verifiedUser;
      const leadId = Number(req.params.id);
      const { remark } = req.body;

      if (!remark?.trim()) {
        return res.status(400).json({ message: "Remark is required" });
      }

      const created = await storage.addLeadRemark(
        leadId,
        currentUser.organizationId,
        currentUser.id,
        remark
      );

      res.json(created);

    } catch (err) {
      console.error("Error adding remark:", err);
      res.status(500).json({ message: "Failed to add remark" });
    }
  }
);

// --------------------------------------------
// DELETE remark
// --------------------------------------------
router.delete("/:leadId/remarks/:remarkId",
  requireRole(["analyst", "partner", "admin", "intern"]),
  async (req: any, res) => {
    try {
      const currentUser = req.verifiedUser;
      const remarkId = Number(req.params.remarkId);

      await storage.deleteLeadRemark(remarkId, currentUser.organizationId);
      res.json({ success: true });

    } catch (err) {
      console.error("Error deleting remark:", err);
      res.status(500).json({ message: "Failed to delete remark" });
    }
  }
);

// ------------------------------------------------------------------
// ACTIONABLES
// ------------------------------------------------------------------

// GET Actionables
router.get("/:id/actionables",
  requireRole(["analyst", "partner", "admin", "intern"]),
  validateIntParam("id"),
  validateResourceExists("lead"),
  async (req: any, res) => {
    try {
      const currentUser = req.verifiedUser;
      const orgId = currentUser.organizationId;
      const leadId = Number(req.params.id);

      // 1. Fetch lead for permission checks
      const lead = await storage.getLead(leadId, orgId);
      if (!lead) {
        return res.status(404).json({ message: "Lead not found" });
      }

      // 2. Analyst permissions
      if (currentUser.role === "analyst") {
        const isOwner = lead.ownerAnalystId === currentUser.id;
        const isAssigned = lead.assignedTo === currentUser.id;

        if (!isOwner && !isAssigned) {
          return res.status(403).json({ message: "Not allowed to view tasks for this lead" });
        }
      }

      // 3. Fetch all tasks for this lead
      const items = await storage.getActionablesByLead(leadId, orgId);

      return res.json(items);

    } catch (err) {
      console.error("Error fetching actionables:", err);
      res.status(500).json({ message: "Failed to fetch actionables" });
    }
  }
);

// router.get("/:id/actionables",
//   requireRole(["analyst", "partner", "admin", "intern"]),
//   validateIntParam("id"),
//   validateResourceExists("lead"),
//   async (req: any, res) => {
//     try {
//       const currentUser = req.verifiedUser;
//       const leadId = Number(req.params.id);

//       const items = await storage.getLeadActionables(
//         leadId,
//         currentUser.organizationId
//       );

//       res.json(items);
//     } catch (err) {
//       console.error("Error fetching actionables:", err);
//       res.status(500).json({ message: "Failed to fetch actionables" });
//     }
//   }
// );

// ADD Actionable
router.post("/:id/actionables",
  requireRole(["analyst", "partner", "admin", "intern"]),
  validateIntParam("id"),
  validateResourceExists("lead"),
  async (req: any, res) => {
    try {
      const currentUser = req.verifiedUser;
      const leadId = Number(req.params.id);
      const { text } = req.body;

      if (!text?.trim()) {
        return res.status(400).json({ message: "Text is required" });
      }

      const created = await storage.addLeadActionable(
        leadId,
        currentUser.organizationId,
        currentUser.id,
        text
      );

      res.json(created);

    } catch (err) {
      console.error("Error adding actionable:", err);
      res.status(500).json({ message: "Failed to add actionable" });
    }
  }
);

// DELETE Actionable
router.delete("/:leadId/actionables/:actionId",
  requireRole(["analyst", "partner", "admin", "intern"]),
  async (req: any, res) => {
    try {
      const currentUser = req.verifiedUser;
      const actionId = Number(req.params.actionId);

      await storage.deleteLeadActionable(actionId, currentUser.organizationId);
      res.json({ success: true });

    } catch (err) {
      console.error("Error deleting actionable:", err);
      res.status(500).json({ message: "Failed to delete actionable" });
    }
  }
);

export { router as leadRoutes };