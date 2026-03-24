import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { z } from "zod";
import { storage } from "../../storage.js";

export const leadSolutionNoteRoutes = Router();

const uploadDir = path.join(process.cwd(), "uploads", "lead-solution-notes");
fs.mkdirSync(uploadDir, { recursive: true });

const diskStorage = multer.diskStorage({
  destination: function (_req, _file, cb) {
    cb(null, uploadDir);
  },
  filename: function (_req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  },
});

const upload = multer({ storage: diskStorage });

// GET /api/leads/:id/solution-note
leadSolutionNoteRoutes.get("/:id/solution-note", async (req: any, res) => {
  try {
    const orgId = Number(req.verifiedUser?.organizationId);
    const leadId = Number(req.params.id);

    if (!orgId) return res.status(401).json({ message: "Unauthorized" });
    if (!leadId) return res.status(400).json({ message: "Invalid lead ID" });

    const note = await storage.getLeadSolutionNote(orgId, leadId);
    return res.json(note || { links: [] });
  } catch (error) {
    console.error("Failed to fetch lead solution note:", error);
    return res.status(500).json({ message: "Failed to fetch solution note" });
  }
});

// POST /api/leads/:id/solution-note
leadSolutionNoteRoutes.post("/:id/solution-note", async (req: any, res) => {
  try {
    const orgId = Number(req.verifiedUser?.organizationId);
    const leadId = Number(req.params.id);

    if (!orgId) return res.status(401).json({ message: "Unauthorized" });
    if (!leadId) return res.status(400).json({ message: "Invalid lead ID" });

    const bodySchema = z.object({
      links: z.array(z.string()).optional(),
    });

    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(parsed.error);

    const updated = await storage.upsertLeadSolutionNote(orgId, leadId, {
      links: parsed.data.links ?? [],
    });

    return res.json(updated);
  } catch (error) {
    console.error("Failed to save lead solution note:", error);
    return res.status(500).json({ message: "Failed to save solution note" });
  }
});

// POST /api/leads/:id/solution-note/upload
leadSolutionNoteRoutes.post(
  "/:id/solution-note/upload",
  upload.single("file"),
  async (req: any, res) => {
    try {
      const orgId = Number(req.verifiedUser?.organizationId);
      const leadId = Number(req.params.id);

      if (!orgId) return res.status(401).json({ message: "Unauthorized" });
      if (!leadId) return res.status(400).json({ message: "Invalid lead ID" });
      if (!req.file) return res.status(400).json({ message: "File missing" });

      const updated = await storage.upsertLeadSolutionNote(orgId, leadId, {
        pdfPath: req.file.path,
        pdfName: req.file.originalname,
      });

      return res.json(updated);
    } catch (error) {
      console.error("Failed to upload lead solution note PDF:", error);
      return res.status(500).json({ message: "Failed to upload PDF" });
    }
  }
);

// GET /api/leads/:id/solution-note/download
leadSolutionNoteRoutes.get("/:id/solution-note/download", async (req: any, res) => {
  try {
    const orgId = Number(req.verifiedUser?.organizationId);
    const leadId = Number(req.params.id);

    if (!orgId) return res.status(401).json({ message: "Unauthorized" });
    if (!leadId) return res.status(400).json({ message: "Invalid lead ID" });

    const note = await storage.getLeadSolutionNote(orgId, leadId);
    if (!note?.pdfPath) return res.status(404).send("No PDF found");

    const absolutePath = path.isAbsolute(note.pdfPath)
      ? note.pdfPath
      : path.join(process.cwd(), note.pdfPath);

    return res.download(absolutePath, note.pdfName || "Lead_Solution_Note.pdf");
  } catch (error) {
    console.error("Failed to download lead solution note PDF:", error);
    return res.status(500).send("Failed to download PDF");
  }
});

// GET /api/leads/:id/solution-note/preview
leadSolutionNoteRoutes.get("/:id/solution-note/preview", async (req: any, res) => {
  try {
    const orgId = Number(req.verifiedUser?.organizationId);
    const leadId = Number(req.params.id);

    if (!orgId) return res.status(401).json({ message: "Unauthorized" });
    if (!leadId) return res.status(400).json({ message: "Invalid lead ID" });

    const note = await storage.getLeadSolutionNote(orgId, leadId);
    if (!note?.pdfPath) return res.status(404).send("No PDF found");

    const absolutePath = path.isAbsolute(note.pdfPath)
      ? note.pdfPath
      : path.join(process.cwd(), note.pdfPath);

    res.setHeader(
      "Content-Disposition",
      `inline; filename="${note.pdfName || "Lead_Solution_Note.pdf"}"`
    );
    res.setHeader("Content-Type", "application/pdf");

    return res.sendFile(absolutePath);
  } catch (error) {
    console.error("Failed to preview lead solution note PDF:", error);
    return res.status(500).send("Failed to preview PDF");
  }
});