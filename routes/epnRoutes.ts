import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage.js";
import { insertEpnPartnerSchema, updateEpnStageSchema } from "../shared/schema.js";

export const epnRoutes = Router();


const idfcLeadTrackerExportSchema = z.object({
  filters: z
    .object({
      serialNumber: z.string().optional(),
      rmName: z.string().optional(),
      designation: z.string().optional(),
      rmCity: z.string().optional(),
      rmStage: z.string().optional(),
      bucket: z.string().optional(),
      leadName: z.string().optional(),
      leadCity: z.string().optional(),
      leadStage: z.string().optional(),
      relationshipStatus: z.string().optional(),
      linkRemarks: z.string().optional(),
      linkedAt: z.string().optional(),
    })
    .optional(),
  selectedRows: z
    .array(
      z.object({
        epnId: z.number(),
        leadId: z.number(),
      })
    )
    .optional(),
});

function escapeCsvValue(value: unknown) {
  if (value === null || value === undefined) return "";
  const stringValue = String(value);
  if (
    stringValue.includes(",") ||
    stringValue.includes('"') ||
    stringValue.includes("\n")
  ) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

function buildIdfcLeadTrackerCsv(rows: any[]) {
  const headers = [
    "S.No.",
    "EPN ID",
    "Lead ID",
    "RM Name",
    "Designation",
    "RM City",
    "RM Stage",
    "Bucket",
    "Lead Name",
    "Lead City",
    "Lead Stage",
    "Relationship Status",
    "Link Remarks",
    "Linked At",
  ];

  const csvRows = rows.map((row) => [
    row.serialNumber,
    row.epnId,
    row.leadId,
    row.rmName,
    row.designation,
    row.rmCity,
    row.rmStage,
    row.bucket,
    row.leadName,
    row.leadCity,
    row.leadStage,
    row.relationshipStatus,
    row.linkRemarks,
    row.linkedAt ? new Date(row.linkedAt).toISOString() : "",
  ]);

  return [
    headers.map(escapeCsvValue).join(","),
    ...csvRows.map((row) => row.map(escapeCsvValue).join(",")),
  ].join("\n");
}

/**
 * GET /api/epn/universe
 * Returns all EPN partners for the org (Universe view)
 */
epnRoutes.get("/universe", async (req: any, res) => {
  try {
    const orgId = Number(req.verifiedUser?.organizationId);
    if (!orgId) return res.status(401).json({ message: "Unauthorized" });

    const data = await storage.getEpnUniverse(orgId);
    res.json(data);
  } catch (e) {
    console.error("EPN universe fetch failed:", e);
    res.status(500).json({ message: "Failed to fetch EPN universe" });
  }
});

/**
 * GET /api/epn
 * Optional query: ?bucket=idfc&stage=outreach
 * - If bucket+stage -> return that stage list
 * - If only bucket -> return that bucket list (all stages)
 */
epnRoutes.get("/", async (req: any, res) => {
  try {
    const orgId = Number(req.verifiedUser?.organizationId);
    if (!orgId) return res.status(401).json({ message: "Unauthorized" });

    const bucket = (req.query.bucket as string | undefined)?.trim();
    const stage = (req.query.stage as string | undefined)?.trim();

    if (bucket && stage) {
      const data = await storage.getEpnByBucketStage(orgId, bucket, stage);
      return res.json(data);
    }

    if (bucket) {
      const data = await storage.getEpnByBucket(orgId, bucket);
      return res.json(data);
    }

    // fallback: same as universe
    const data = await storage.getEpnUniverse(orgId);
    return res.json(data);
  } catch (e) {
    console.error("EPN list fetch failed:", e);
    res.status(500).json({ message: "Failed to fetch EPN partners" });
  }
});

/**
 * POST /api/epn
 * Create a new EPN partner
 */
epnRoutes.post("/", async (req: any, res) => {
  try {
    const orgId = Number(req.verifiedUser?.organizationId);
    if (!orgId) return res.status(401).json({ message: "Unauthorized" });

    const parsed = insertEpnPartnerSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(parsed.error);

    const created = await storage.createEpnPartner(orgId, parsed.data);
    res.json(created);
  } catch (e) {
    console.error("EPN create failed:", e);
    res.status(500).json({ message: "Failed to create EPN partner" });
  }
});

/**
 * POST /api/epn/bulk
 * Bulk create EPN partners
 * Body: { partners: InsertEpnPartner[] }
 */
epnRoutes.post("/bulk", async (req: any, res) => {
  try {
    const orgId = Number(req.verifiedUser?.organizationId);
    if (!orgId) return res.status(401).json({ message: "Unauthorized" });

    const bodySchema = z.object({
      partners: z.array(insertEpnPartnerSchema).min(1),
    });

    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(parsed.error);

    const created = await storage.createEpnPartnersBulk(orgId, parsed.data.partners);
    res.json({ createdCount: created.length, created });
  } catch (e) {
    console.error("EPN bulk create failed:", e);
    res.status(500).json({ message: "Failed to bulk create EPN partners" });
  }
});


/**
 * PATCH /api/epn/:epnId/stage
 * Update stage (Outreach -> Active -> Rainmaking)
 */
epnRoutes.patch("/:epnId/stage", async (req: any, res) => {
  try {
    const orgId = Number(req.verifiedUser?.organizationId);
    if (!orgId) return res.status(401).json({ message: "Unauthorized" });

    const epnId = Number(req.params.epnId);
    if (!epnId) return res.status(400).json({ message: "Invalid epnId" });

    const parsed = updateEpnStageSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(parsed.error);

    const updated = await storage.updateEpnStage(orgId, epnId, parsed.data.stage);
    res.json(updated);
  } catch (e) {
    console.error("EPN stage update failed:", e);
    res.status(500).json({ message: "Failed to update EPN stage" });
  }
});

/**
 * POST /api/epn/:epnId/link-lead
 * Link an EPN partner to a lead (Linked Companies)
 * (UI can come later, but backend is ready)
 */
epnRoutes.post("/:epnId/link-lead", async (req: any, res) => {
  try {
    const orgId = Number(req.verifiedUser?.organizationId);
    if (!orgId) return res.status(401).json({ message: "Unauthorized" });

    const epnId = Number(req.params.epnId);
    if (!epnId) return res.status(400).json({ message: "Invalid epnId" });

    const bodySchema = z.object({ leadId: z.number() });
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(parsed.error);

    const link = await storage.linkEpnToLead(orgId, epnId, parsed.data.leadId);

    // ✅ NEW: Auto-sync the EPN Partner's stage based on the newly linked lead
    await storage.syncEpnPartnerStage(orgId, epnId);

    res.json(link);
  } catch (e) {
    console.error("EPN link-lead failed:", e);
    res.status(500).json({ message: "Failed to link lead" });
  }
});


/**
 * GET /api/epn/links?stage=qualified
 * Returns EPN links for ALL leads in a given lead stage (one-shot for LeadManagement filters)
 * Response: [{ leadId, epns: [...] }]
 */
epnRoutes.get("/links", async (req: any, res) => {
  try {
    const orgId = Number(req.verifiedUser?.organizationId);
    if (!orgId) return res.status(401).json({ message: "Unauthorized" });

    const stage = (req.query.stage as string | undefined)?.trim();
    const allowed = ["universe", "qualified", "outreach", "pitching", "mandates", "completed_mandate","won", "lost", "hold", "dropped", "rejected"];

    if (!stage || !allowed.includes(stage)) {
      return res.status(400).json({ message: "Invalid stage" });
    }

    const data = await storage.getEpnLinksForLeadStage(orgId, stage);
    return res.json(data);
  } catch (e) {
    console.error("Failed to fetch EPN lead links:", e);
    return res.status(500).json({ message: "Failed to fetch EPN lead links" });
  }
});



/**
 * GET /api/epn/linked-to-lead/:leadId
 * Get all Network Partners linked to a specific lead
 */
epnRoutes.get("/linked-to-lead/:leadId", async (req: any, res) => {
  try {
    const orgId = Number(req.verifiedUser?.organizationId);
    const leadId = Number(req.params.leadId);
    if (!orgId) return res.status(401).json({ message: "Unauthorized" });

    const linked = await storage.getLinkedEpnsForLead(orgId, leadId);
    res.json(linked);
  } catch (e) {
    console.error("Failed to fetch linked EPNs:", e);
    res.status(500).json({ message: "Failed to fetch linked Network Partners" });
  }
});

/**
 * DELETE /api/epn/:epnId/link-lead/:leadId
 * Unlink a Network Partner from a lead
 */
/**
 * DELETE /api/epn/:epnId/link-lead/:leadId
 * Unlink a Network Partner from a lead
 */
epnRoutes.delete("/:epnId/link-lead/:leadId", async (req: any, res) => {
  try {
    const orgId = Number(req.verifiedUser?.organizationId);
    const epnId = Number(req.params.epnId);
    const leadId = Number(req.params.leadId);
    if (!orgId) return res.status(401).json({ message: "Unauthorized" });

    await storage.unlinkEpnFromLead(orgId, epnId, leadId);
    
    // ✅ NEW: Re-evaluate and auto-sync the EPN Partner's stage 
    // (in case their only mandate was just removed, they drop down)
    await storage.syncEpnPartnerStage(orgId, epnId);

    res.json({ success: true });
  } catch (e) {
    console.error("Failed to unlink EPN:", e);
    res.status(500).json({ message: "Failed to unlink Network Partner" });
  }
});

/**
 * PATCH /api/epn/:epnId/category
 * Update category instantly
 */
epnRoutes.patch("/:epnId/category", async (req: any, res) => {
  try {
    const orgId = Number(req.verifiedUser?.organizationId);
    if (!orgId) return res.status(401).json({ message: "Unauthorized" });

    const epnId = Number(req.params.epnId);
    if (!epnId) return res.status(400).json({ message: "Invalid epnId" });

    // Extract category (allow null/empty string to clear it)
    const category = req.body.category || null;

    const updated = await storage.updateEpnCategory(orgId, epnId, category);
    res.json(updated);
  } catch (e) {
    console.error("EPN category update failed:", e);
    res.status(500).json({ message: "Failed to update EPN category" });
  }
});


/**
 * GET /api/epn/reports/idfc-lead-tracker
 * IDFC-only detailed RM ↔ Lead table
 */
epnRoutes.get("/reports/idfc-lead-tracker", async (req: any, res) => {
  try {
    const orgId = Number(req.verifiedUser?.organizationId);
    if (!orgId) return res.status(401).json({ message: "Unauthorized" });

    const data = await storage.getIdfcLeadTrackerReport(orgId);
    res.json(data);
  } catch (e) {
    console.error("IDFC lead tracker report failed:", e);
    res.status(500).json({ message: "Failed to fetch IDFC lead tracker report" });
  }
});


/**
 * POST /api/epn/reports/idfc-lead-tracker/preview
 * Returns preview rows after applying backend filters + selected rows
 */
epnRoutes.post("/reports/idfc-lead-tracker/preview", async (req: any, res) => {
  try {
    const orgId = Number(req.verifiedUser?.organizationId);
    if (!orgId) return res.status(401).json({ message: "Unauthorized" });

    const parsed = idfcLeadTrackerExportSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(parsed.error);
    }

    const data = await storage.getIdfcLeadTrackerReport(orgId, {
      filters: parsed.data.filters,
      selectedRows: parsed.data.selectedRows,
    });

    res.json({
      totalRows: data.length,
      rows: data,
    });
  } catch (e) {
    console.error("IDFC lead tracker preview failed:", e);
    res.status(500).json({ message: "Failed to preview IDFC lead tracker export" });
  }
});



/**
 * POST /api/epn/reports/idfc-lead-tracker/export
 * Returns CSV file after applying backend filters + selected rows
 */
epnRoutes.post("/reports/idfc-lead-tracker/export", async (req: any, res) => {
  try {
    const orgId = Number(req.verifiedUser?.organizationId);
    if (!orgId) return res.status(401).json({ message: "Unauthorized" });

    const parsed = idfcLeadTrackerExportSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(parsed.error);
    }

    const data = await storage.getIdfcLeadTrackerReport(orgId, {
      filters: parsed.data.filters,
      selectedRows: parsed.data.selectedRows,
    });

    const csv = buildIdfcLeadTrackerCsv(data);
    const fileName = `idfc-lead-tracker-${new Date().toISOString().slice(0, 10)}.csv`;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.status(200).send(csv);
  } catch (e) {
    console.error("IDFC lead tracker export failed:", e);
    res.status(500).json({ message: "Failed to export IDFC lead tracker" });
  }
});



/**
 * GET /api/epn/reports/idfc-rm-summary
 * IDFC-only RM summary table
 */
epnRoutes.get("/reports/idfc-rm-summary", async (req: any, res) => {
  try {
    const orgId = Number(req.verifiedUser?.organizationId);
    if (!orgId) return res.status(401).json({ message: "Unauthorized" });

    const data = await storage.getIdfcRmSummaryReport(orgId);
    res.json(data);
  } catch (e) {
    console.error("IDFC RM summary report failed:", e);
    res.status(500).json({ message: "Failed to fetch IDFC RM summary report" });
  }
});

/**
 * GET /api/epn/reports/epn-level?bucket=idfc
 * Broad EPN-level report with optional bucket filter
 */
epnRoutes.get("/reports/epn-level", async (req: any, res) => {
  try {
    const orgId = Number(req.verifiedUser?.organizationId);
    if (!orgId) return res.status(401).json({ message: "Unauthorized" });

    const bucket = (req.query.bucket as string | undefined)?.trim();
    const data = await storage.getEpnLevelReport(orgId, bucket);
    res.json(data);
  } catch (e) {
    console.error("EPN level report failed:", e);
    res.status(500).json({ message: "Failed to fetch EPN level report" });
  }
});



/**
 * GET /api/epn/:epnId
 * Get details for a single EPN partner
 */
epnRoutes.get("/:epnId", async (req: any, res) => {
  try {
    const orgId = Number(req.verifiedUser?.organizationId);
    const epnId = Number(req.params.epnId);
    if (!orgId) return res.status(401).json({ message: "Unauthorized" });

    const partner = await storage.getEpnById(orgId, epnId);
    if (!partner) return res.status(404).json({ message: "Partner not found" });
    res.json(partner);
  } catch (e) {
    res.status(500).json({ message: "Failed to fetch partner" });
  }
});

/**
 * GET /api/epn/:epnId/linked-leads
 * Get all Companies (Leads) linked to this EPN Partner
 */
epnRoutes.get("/:epnId/linked-leads", async (req: any, res) => {
  try {
    const orgId = Number(req.verifiedUser?.organizationId);
    const epnId = Number(req.params.epnId);
    if (!orgId) return res.status(401).json({ message: "Unauthorized" });

    const linked = await storage.getLinkedLeadsForEpn(orgId, epnId);
    res.json(linked);
  } catch (e) {
    res.status(500).json({ message: "Failed to fetch linked leads" });
  }
});

/**
 * PATCH /api/epn/:epnId
 * Update full details of an EPN partner
 */
epnRoutes.patch("/:epnId", async (req: any, res) => {
  try {
    const orgId = Number(req.verifiedUser?.organizationId);
    const epnId = Number(req.params.epnId);
    if (!orgId) return res.status(401).json({ message: "Unauthorized" });

    const updated = await storage.updateEpnPartnerDetails(orgId, epnId, req.body);
    if (!updated) return res.status(404).json({ message: "Partner not found" });
    
    res.json(updated);
  } catch (e) {
    console.error("EPN details update failed:", e);
    res.status(500).json({ message: "Failed to update partner details" });
  }
});



/**
 * GET /api/epn/bucket-metrics/:bucket
 * Gets the count of partners in each stage for a dashboard
 */
epnRoutes.get("/bucket-metrics/:bucket", async (req: any, res) => {
  try {
    const orgId = Number(req.verifiedUser?.organizationId);
    if (!orgId) return res.status(401).json({ message: "Unauthorized" });

    const bucket = req.params.bucket;
    const metrics = await storage.getEpnBucketMetrics(orgId, bucket);
    
    res.json(metrics);
  } catch (e) {
    console.error("EPN metrics fetch failed:", e);
    res.status(500).json({ message: "Failed to fetch EPN metrics" });
  }
});



/**
 * PATCH /api/epn/:epnId/link-lead/:leadId/status
 * Update status of a linked Network Partner
 */
epnRoutes.patch("/:epnId/link-lead/:leadId/status", async (req: any, res) => {
  try {
    const orgId = Number(req.verifiedUser?.organizationId);
    const epnId = Number(req.params.epnId);
    const leadId = Number(req.params.leadId);
    const { status } = req.body;
    if (!orgId) return res.status(401).json({ message: "Unauthorized" });

    const updated = await storage.updateEpnLinkStatus(orgId, epnId, leadId, status);
    res.json(updated);
  } catch (e) {
    console.error("Failed to update EPN link status:", e);
    res.status(500).json({ message: "Failed to update status" });
  }
});

/**
 * PATCH /api/epn/:epnId/link-lead/:leadId/remarks
 * Update remarks of a linked Network Partner
 */
epnRoutes.patch("/:epnId/link-lead/:leadId/remarks", async (req: any, res) => {
  try {
    const orgId = Number(req.verifiedUser?.organizationId);
    const epnId = Number(req.params.epnId);
    const leadId = Number(req.params.leadId);
    const { remarks } = req.body;
    if (!orgId) return res.status(401).json({ message: "Unauthorized" });

    const updated = await storage.updateEpnLinkRemarks(orgId, epnId, leadId, remarks);
    res.json(updated);
  } catch (e) {
    console.error("Failed to update EPN link remarks:", e);
    res.status(500).json({ message: "Failed to update remarks" });
  }
});