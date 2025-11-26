import { storage } from './storage';
import { UpsertActivityLog } from '@shared/schema';

export class ActivityLogService {
  /**
   * Logs company creation activity
   */
  static async logCompanyCreated(
    organizationId: number,
    userId: string,
    companyId: number,
    companyName: string
  ) {
    await storage.createActivityLog({
      organizationId,
      userId,
      companyId,
      action: 'company_created',
      entityType: 'company',
      entityId: companyId,
      description: `Created company "${companyName}"`,
    });
  }

  /**
   * Logs lead creation activity
   */
  static async logLeadCreated(
    organizationId: number,
    userId: string,
    leadId: number,
    companyId: number,
    companyName: string,
    stage: string = 'universe'
  ) {
    await storage.createActivityLog({
      organizationId,
      userId,
      leadId,
      companyId,
      action: 'lead_created',
      entityType: 'lead',
      entityId: leadId,
      description: `Created lead for "${companyName}" in ${stage} stage`,
    });
  }

  /**
   * Logs lead assignment activity
   */
  static async logLeadAssigned(
    organizationId: number,
    assignedBy: string,
    leadId: number,
    companyId: number,
    companyName: string,
    assignedTo: string | null,
    assignedToName?: string
  ) {
    const description = assignedTo
      ? `Assigned lead for "${companyName}" to ${assignedToName || assignedTo}`
      : `Unassigned lead for "${companyName}"`;

    await storage.createActivityLog({
      organizationId,
      userId: assignedBy,
      leadId,
      companyId,
      action: 'lead_assigned',
      entityType: 'lead',
      entityId: leadId,
      description,
    });
  }

  /**
   * Logs stage progression activity
   */
  static async logStageChanged(
    organizationId: number,
    userId: string,
    leadId: number,
    companyId: number,
    companyName: string,
    oldStage: string,
    newStage: string
  ) {
    await storage.createActivityLog({
      organizationId,
      userId,
      leadId,
      companyId,
      action: 'stage_changed',
      entityType: 'lead',
      entityId: leadId,
      oldValue: oldStage,
      newValue: newStage,
      description: `Changed stage for "${companyName}" from ${oldStage} to ${newStage}`,
    });
  }

  /**
   * Logs contact creation activity
   */
  static async logContactAdded(
    organizationId: number,
    userId: string,
    contactId: number,
    companyId: number,
    companyName: string,
    contactName: string,
    isPrimary: boolean = false
  ) {
    const primaryText = isPrimary ? ' as primary contact' : '';
    await storage.createActivityLog({
      organizationId,
      userId,
      companyId,
      action: 'contact_added',
      entityType: 'contact',
      entityId: contactId,
      description: `Added contact "${contactName}" to "${companyName}"${primaryText}`,
    });
  }

  /**
   * Logs POC status update activity
   */
  static async logPOCStatusUpdated(
    organizationId: number,
    userId: string,
    leadId: number,
    companyId: number,
    companyName: string,
    oldStatus: string,
    newStatus: string,
    pocCount: number
  ) {
    await storage.createActivityLog({
      organizationId,
      userId,
      leadId,
      companyId,
      action: 'poc_status_updated',
      entityType: 'lead',
      entityId: leadId,
      oldValue: oldStatus,
      newValue: newStatus,
      description: `Updated POC status for "${companyName}" from ${oldStatus} to ${newStatus} (${pocCount} contacts)`,
    });
  }

  /**
   * Logs intervention activity
   */
  static async logInterventionAdded(
    organizationId: number,
    userId: string,
    interventionId: number,
    leadId: number,
    companyId: number,
    companyName: string,
    interventionType: string,
    scheduledAt: Date
  ) {
    const formattedDate = scheduledAt.toLocaleDateString();
    await storage.createActivityLog({
      organizationId,
      userId,
      leadId,
      companyId,
      action: 'intervention_added',
      entityType: 'intervention',
      entityId: interventionId,
      description: `Scheduled ${interventionType.replace('_', ' ')} intervention for "${companyName}" on ${formattedDate}`,
    });
  }

  /**
   * Logs bulk operations
   */
  static async logBulkLeadsCreated(
    organizationId: number,
    userId: string,
    count: number,
    duplicates: number = 0
  ) {
    const duplicateText = duplicates > 0 ? ` (${duplicates} duplicates skipped)` : '';
    await storage.createActivityLog({
      organizationId,
      userId,
      action: 'bulk_leads_created',
      entityType: 'lead',
      description: `Bulk created ${count} leads${duplicateText}`,
    });
  }

  /**
   * Logs user role changes (admin only)
   */
  static async logUserRoleChanged(
    organizationId: number,
    changedBy: string,
    targetUserId: string,
    targetUserName: string,
    oldRole: string,
    newRole: string
  ) {
    await storage.createActivityLog({
      organizationId,
      userId: changedBy,
      action: 'user_role_changed',
      entityType: 'user',
      oldValue: oldRole,
      newValue: newRole,
      description: `Changed ${targetUserName}'s role from ${oldRole} to ${newRole}`,
    });
  }

  /**
   * Generic activity logger for custom actions
   */
  static async logCustomActivity(
    activityData: Omit<UpsertActivityLog, 'organizationId'> & { organizationId: number }
  ) {
    await storage.createActivityLog(activityData);
  }

  /**
   * Generic activity logger (alias for logCustomActivity for backward compatibility)
   */
  static async logActivity(
    activityData: Omit<UpsertActivityLog, 'organizationId'> & { organizationId: number }
  ) {
    await storage.createActivityLog(activityData);
  }
}

export default ActivityLogService;