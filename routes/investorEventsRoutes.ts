import { Router } from "express";
import { requireRole } from "../middleware/auth.js";
import { investorEventsService } from "../services/investorEventsService.js";

export const investorEventsRoutes = Router();

investorEventsRoutes.get("/", async (req: any, res) => {
  try {
    const user = req.verifiedUser;
    if (!user?.organizationId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const feed = await investorEventsService.getInvestorEventsFeed(
      Number(user.organizationId),
      false
    );

    res.set("Cache-Control", "no-cache, no-store, must-revalidate");
    res.json(feed);
  } catch (error) {
    console.error("[InvestorEvents] GET failed:", error);
    res.status(500).json({ message: "Failed to fetch investor events" });
  }
});

investorEventsRoutes.post(
  "/refresh",
  requireRole(["admin", "partner"]),
  async (req: any, res) => {
    try {
      const user = req.verifiedUser;
      if (!user?.organizationId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const feed = await investorEventsService.getInvestorEventsFeed(
        Number(user.organizationId),
        true
      );

      res.json({
        message: "Investor events refreshed successfully",
        hyderabadCount: feed.hyderabadEvents.length,
        indiaCount: feed.indiaEvents.length,
      });
    } catch (error) {
      console.error("[InvestorEvents] Refresh failed:", error);
      res.status(500).json({ message: "Failed to refresh investor events" });
    }
  }
);