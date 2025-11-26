import { Router } from 'express';
import { leadController } from '../controllers/leadController.js';
import { requireRole } from '../middleware/auth.js';
import { validateIntParam, validateResourceExists, validateStage } from '../middleware/validation.js';
import { storage } from "../storage.js";


import { db } from "../db.js";
import { leadRemarks } from "../shared/schema.js";
import { eq, desc } from "drizzle-orm";


const router = Router();

// Individual Lead Creation Route with Deduplication
router.post('/individual', requireRole(['analyst', 'partner', 'admin']), leadController.createIndividualLead);

// Bulk assign leads route
router.post('/bulk-assign', requireRole(['partner', 'admin']), leadController.bulkAssignLeads);

// Specific routes must come BEFORE generic :id route to avoid incorrect matching
router.get('/all', requireRole(['analyst', 'partner', 'admin']), leadController.getAllLeads);
router.get('/my', requireRole(['analyst', 'partner', 'admin']), leadController.getMyLeads);
router.get('/stage/:stage', requireRole(['analyst', 'partner', 'admin']), validateStage, leadController.getLeadsByStage);
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
      const leadId = Number(req.params.id);

      const items = await storage.getLeadActionables(
        leadId,
        currentUser.organizationId
      );

      res.json(items);
    } catch (err) {
      console.error("Error fetching actionables:", err);
      res.status(500).json({ message: "Failed to fetch actionables" });
    }
  }
);

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