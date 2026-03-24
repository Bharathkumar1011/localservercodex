import { asc, desc, eq } from "drizzle-orm";
import { db } from "../db.js";
import {
  investorEvents,
  investors,
  type InsertInvestorEvent,
  type InvestorEvent,
} from "../shared/schema.js";

class InvestorEventsRepository {
  async getCachedEvents(organizationId: number): Promise<InvestorEvent[]> {
    return db
      .select()
      .from(investorEvents)
      .where(eq(investorEvents.organizationId, organizationId))
      .orderBy(
        desc(investorEvents.priorityScore),
        asc(investorEvents.eventDate),
        desc(investorEvents.publishedAt)
      );
  }

  async getLatestCreatedAt(organizationId: number): Promise<Date | null> {
    const rows = await db
      .select({ createdAt: investorEvents.createdAt })
      .from(investorEvents)
      .where(eq(investorEvents.organizationId, organizationId))
      .orderBy(desc(investorEvents.createdAt))
      .limit(1);

    return rows[0]?.createdAt ?? null;
  }

  async replaceEvents(
    organizationId: number,
    rows: InsertInvestorEvent[]
  ): Promise<void> {
    await db.transaction(async (tx) => {
      await tx
        .delete(investorEvents)
        .where(eq(investorEvents.organizationId, organizationId));

      if (rows.length > 0) {
        await tx.insert(investorEvents).values(rows);
      }
    });
  }

  async getInvestorSearchMetadata(organizationId: number) {
    return db
      .select({
        sector: investors.sector,
        investorType: investors.investorType,
        location: investors.location,
      })
      .from(investors)
      .where(eq(investors.organizationId, organizationId));
  }
}

export const investorEventsRepository = new InvestorEventsRepository();