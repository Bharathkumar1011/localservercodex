import { Request } from 'express';
import { storage } from '../storage.js';
import { StageProgressionService } from '../stageProgressionService.js';
import ActivityLogService from '../activityLogService.js';
import { insertLeadSchema, updateLeadSchema, individualLeadFormSchema } from '../shared/schema.js';

const stageProgressionService = new StageProgressionService(storage);

export const leadService = {
  createLead: async (leadData: any, req: Request) => {
    const currentUser = (req as any).verifiedUser;
    if (!currentUser || !currentUser.organizationId) {
      throw new Error('User organization not found');
    }
    
    // Parse lead data, ignoring client-supplied ownerAnalystId and assignedTo for security
    const validatedData = insertLeadSchema.parse({
      ...leadData,
      ownerAnalystId: undefined,
      assignedTo: undefined,
      organizationId: undefined
    });
    
    // Security: Derive ownerAnalystId from session, not client
    const ownerAnalystId = currentUser.role === 'analyst' ? currentUser.id : null;
    // const assignedTo = null;

    // NEW: auto-assign lead to analyst so they can see it
    const assignedTo = currentUser.role === 'analyst' ? currentUser.id : null;
    
    // Change is here 👇
    const stage = currentUser.role === 'analyst' ? 'qualified' : 'universe';

    const lead = await storage.createLead({ 
      ...validatedData, 
      organizationId: currentUser.organizationId,
      ownerAnalystId,
      assignedTo,
      stage  // ✅ Add this line
      // stage: 'universe'
      // stage: currentUser.role === 'analyst' ? 'qualified' : 'universe'
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
    
    return lead;
  },

  getAllLeads: async (req: Request) => {
    const userId = (req as any).user?.claims?.sub;
    const user = await storage.getUser(userId);
    if (!user || !user.organizationId) {
      throw new Error('User not found or missing organization');
    }
    
    const userRole = user.role || 'analyst';
    
    if (userRole === 'analyst') {
      return await storage.getLeadsByAssignee(userId, user.organizationId);
    } else {
      return await storage.getAllLeads(user.organizationId);
    }
  },

  getMyLeads: async (req: Request) => {
    const userId = (req as any).user?.claims?.sub;
    if (!userId) {
      throw new Error('User ID not found in token');
    }
    
    const user = await storage.getUser(userId);
    if (!user || !user.organizationId) {
      throw new Error('User not found or missing organization');
    }
    
    return await storage.getLeadsByAssignee(userId, user.organizationId);
  },

  getLeadsByStage: async (stage: string, req: Request) => {
    const userId = (req as any).user?.claims?.sub;
    const user = await storage.getUser(userId);
    if (!user || !user.organizationId) {
      throw new Error('User not found or missing organization');
    }
    
    const userRole = user.role || 'analyst';
    
    if (userRole === 'analyst') {
      const allAssignedLeads = await storage.getLeadsByAssignee(userId, user.organizationId);
      return allAssignedLeads.filter(lead => lead.stage === stage);
    } else {
      return await storage.getLeadsByStage(stage, user.organizationId);
    }
  },

  getAssignedLeads: async (req: Request) => {
    const currentUser = (req as any).verifiedUser || await storage.getUser((req as any).user?.claims?.sub);
    if (!currentUser || !currentUser.organizationId) {
      throw new Error('User organization not found');
    }

    console.log('[getAssignedLeads] Current user:', currentUser.id, currentUser.role);
    const allLeads = await storage.getAllLeads(currentUser.organizationId);
    console.log('[getAssignedLeads] Total leads:', allLeads.length);
    console.log('[getAssignedLeads] Sample lead assignedInterns:', allLeads[0]?.assignedInterns);
    
    const assignedLeads = allLeads.filter(lead => {
      const isAssigned = lead.assignedInterns && Array.isArray(lead.assignedInterns) && lead.assignedInterns.includes(currentUser.id);
      if (isAssigned) {
        console.log('[getAssignedLeads] Found assigned lead:', lead.id, lead.assignedInterns);
      }
      return isAssigned;
    });
    
    console.log('[getAssignedLeads] Assigned leads count:', assignedLeads.length);

    return assignedLeads.map(lead => ({
      ...lead,
      assignmentDate: lead.updatedAt?.toISOString() || lead.createdAt?.toISOString()
    }));
  },

  getLeadsByAssignee: async (userId: string, req: Request) => {
    const user = await storage.getUser(userId);
    if (!user || !user.organizationId) {
      throw new Error('User not found or missing organization');
    }
    
    return await storage.getLeadsByAssignee(userId, user.organizationId);
  },

  updateLead: async (leadId: number, updates: any, req: Request) => {
    const currentUser = (req as any).verifiedUser;
    if (!currentUser || !currentUser.organizationId) {
      throw new Error('User organization not found');
    }
    const validatedUpdates = updateLeadSchema.parse(updates);
    
    // If stage is being updated, validate the transition
    if (validatedUpdates.stage) {
      const validation = await stageProgressionService.validateStageTransition(leadId, currentUser.organizationId, validatedUpdates.stage);
      if (!validation.isValid) {
        throw new Error(`Invalid stage transition: ${validation.errors?.join(', ')}`);
      }
    }
    
    return await storage.updateLead(leadId, currentUser.organizationId, validatedUpdates);
  },

  updateLeadStage: async (leadId: number, stageData: any, req: Request) => {
    const currentUser = (req as any).verifiedUser || await storage.getUser((req as any).user?.claims?.sub);
    if (!currentUser || !currentUser.organizationId) {
      throw new Error('User organization not found');
    }
    
    const { stage, defaultPocId, backupPocId } = stageData;
    if (!stage) {
      throw new Error('Stage is required');
    }
    
    const validStages = ['universe', 'qualified', 'outreach', 'pitching', 'mandates', 'won', 'lost', 'rejected'];
    if (!validStages.includes(stage)) {
      throw new Error('Invalid stage value');
    }
    
    const currentLead = (req as any).resource;
    
    // CRITICAL SECURITY: Only allow three manual transitions
    const isQualifiedToOutreach = currentLead.stage === 'qualified' && stage === 'outreach';
    const isOutreachToPitching = currentLead.stage === 'outreach' && stage === 'pitching';
    const isPitchingToMandates = currentLead.stage === 'pitching' && stage === 'mandates';
    
    if (!isQualifiedToOutreach && !isOutreachToPitching && !isPitchingToMandates) {
      throw new Error(`This endpoint only supports manual transitions: Qualified→Outreach, Outreach→Pitching, or Pitching→Mandates. Current: ${currentLead.stage}, Requested: ${stage}`);
    }
    
    // For outreach → pitching transition, validate meeting intervention and POC selection
    if (isOutreachToPitching) {
      const interventions = await storage.getInterventions(leadId, currentUser.organizationId);
      const hasMeeting = interventions.some((intervention: any) => intervention.type === 'meeting');
      
      if (!hasMeeting) {
        throw new Error('Cannot move to Pitching stage: A meeting with POCs must be recorded first');
      }
      
      if (!defaultPocId) {
        throw new Error('Cannot move to Pitching stage: Default POC must be selected');
      }
      
      // Validate POCs belong to the same company and organization
      const defaultContact = await storage.getContact(defaultPocId, currentUser.organizationId);
      if (!defaultContact || defaultContact.companyId !== currentLead.companyId) {
        throw new Error('Invalid POC: Contact must belong to the same company');
      }
      
      if (backupPocId) {
        if (backupPocId === defaultPocId) {
          throw new Error('Backup POC must be different from default POC');
        }
        
        const backupContact = await storage.getContact(backupPocId, currentUser.organizationId);
        if (!backupContact || backupContact.companyId !== currentLead.companyId) {
          throw new Error('Invalid backup POC: Contact must belong to the same company');
        }
      }
    }
    
    // Build updates object with POC IDs if moving to pitching
    const updates: any = { stage };
    if (isOutreachToPitching && defaultPocId) {
      updates.defaultPocId = defaultPocId;
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
    
    return lead;
  },

  rejectLead: async (leadId: number, rejectionReason: string, req: Request) => {
    const currentUser = (req as any).verifiedUser || await storage.getUser((req as any).user?.claims?.sub);
    if (!currentUser || !currentUser.organizationId) {
      throw new Error('User organization not found');
    }
    
    if (!rejectionReason || rejectionReason.trim().length === 0) {
      throw new Error('Rejection reason is required');
    }
    
    const currentLead = (req as any).resource;
    
    if (currentLead.stage === 'rejected') {
      throw new Error('Lead is already rejected');
    }
    
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
    
    return lead;
  },

  assignLead: async (leadId: number, assignmentData: any, req: Request) => {
    const { assignedTo, notes, challengeToken } = assignmentData;
    const assignedBy = (req as any).user?.claims?.sub;
    
    // Get the current lead to check if it's a reassignment
    const currentLead = await storage.getLead(leadId, (req as any).verifiedUser.organizationId);
    if (!currentLead) {
      throw new Error('Lead not found');
    }
    
    // Check if this is a reassignment
    const isReassignment = currentLead.assignedTo && currentLead.assignedTo !== assignedTo;
    
    // For reassignments, require a challenge token
    if (isReassignment) {
      if (!challengeToken) {
        throw new Error('Challenge token required for reassignments');
      }
      
      const isValidToken = await storage.validateChallengeToken(
        challengeToken,
        (req as any).verifiedUser.id,
        (req as any).verifiedUser.organizationId,
        leadId,
        'reassignment'
      );
      
      if (!isValidToken) {
        throw new Error('Invalid or expired challenge token');
      }
    }
    
    // Support unassigning by allowing null assignedTo
    if (assignedTo !== null && assignedTo !== undefined) {
      const assignedUser = await storage.getUser(assignedTo);
      if (!assignedUser) {
        throw new Error('Assigned user not found');
      }
    }
    
    await storage.assignLead(leadId, (req as any).verifiedUser.organizationId, assignedTo, assignedBy, notes);
    // 🚀 Auto-progress Universe → Qualified when assigned to analyst
    try {
      const orgId = (req as any).verifiedUser.organizationId;
      const lead = await storage.getLead(leadId, orgId);

      // Make sure a lead was found before checking properties
      if (lead && lead.stage === 'universe' && assignedTo) {
        const assignedUser = await storage.getUser(assignedTo);

        // Ensure the assigned user is an analyst
        if (assignedUser && assignedUser.role === 'analyst') {
          await storage.updateLead(leadId, orgId, { stage: 'qualified' });

          await ActivityLogService.logActivity({
            organizationId: orgId,
            leadId: lead.id,
            companyId: lead.companyId,
            userId: assignedBy,
            action: 'lead_auto_qualified_on_assignment',
            entityType: 'lead',
            entityId: lead.id,
            description: `Lead auto-moved from Universe to Qualified after being assigned to analyst ${
              assignedUser.firstName || assignedUser.email
            }`,
          });
        }
      }
    } catch (autoQualifyError) {
      console.error('Auto-qualification on assignment failed:', autoQualifyError);
    }

    // Log the assignment activity
    try {
      const currentUser = (req as any).verifiedUser || await storage.getUser(assignedBy);
      const lead = await storage.getLead(leadId, currentUser.organizationId);
      if (lead && currentUser) {
        const company = await storage.getCompany(lead.companyId, currentUser.organizationId);
        if (company) {
          const assignedUser = assignedTo ? await storage.getUser(assignedTo) : null;
          const assignedToName = assignedUser 
            ? `${assignedUser.firstName || ''} ${assignedUser.lastName || ''}`.trim() || assignedUser.email
            : undefined;
          
          await ActivityLogService.logLeadAssigned(
            currentUser.organizationId,
            assignedBy,
            lead.id,
            lead.companyId,
            company.name,
            assignedTo || null,
            assignedToName || undefined
          );
        }
      }
    } catch (logError) {
      console.error('Error logging assignment activity:', logError);
    }
    
    // Check if lead can auto-progress after assignment
    try {
      const currentUserForProgress = (req as any).verifiedUser || await storage.getUser(assignedBy);
      if (currentUserForProgress && currentUserForProgress.organizationId) {
        const autoProgress = await stageProgressionService.autoProgressLead(leadId, currentUserForProgress.organizationId);
        return { 
          success: true, 
          autoProgressed: autoProgress.progressed,
          newStage: autoProgress.newStage 
        };
      } else {
        return { success: true, autoProgressed: false };
      }
    } catch (progressError) {
      console.log('Auto-progression check failed:', progressError);
      return { success: true, autoProgressed: false };
    }
  },

  assignInternsToLead: async (leadId: number, assignmentData: any, req: Request) => {
    const { internIds, notes } = assignmentData;
    const assignedBy = (req as any).user?.claims?.sub;
    
    if (!internIds || !Array.isArray(internIds)) {
      throw new Error('Intern IDs array is required');
    }
    
    await storage.assignInternsToLead(leadId, (req as any).verifiedUser.organizationId, internIds, assignedBy, notes);
    
    // Log the assignment activity
    try {
      const currentUser = (req as any).verifiedUser || await storage.getUser(assignedBy);
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
  },

  bulkAssignLeads: async (assignmentData: any, req: Request) => {
    const { leadIds, assignedTo } = assignmentData;
    const assignedBy = (req as any).user?.claims?.sub;
    const organizationId = (req as any).user?.organizationId;

    if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
      throw new Error('Lead IDs array is required');
    }

    if (!assignedTo) {
      throw new Error('Assigned user is required');
    }

    // Verify the user being assigned to exists and belongs to the same organization
    const assignedUser = await storage.getUser(assignedTo);
    if (!assignedUser) {
      throw new Error('Assigned user not found');
    }

    if (assignedUser.organizationId !== organizationId) {
      throw new Error('Cannot assign leads to users outside your organization');
    }

    // Verify all leads exist and belong to the organization
    for (const leadId of leadIds) {
      const lead = await storage.getLead(leadId, organizationId);
      if (!lead) {
        throw new Error(`Lead ${leadId} not found`);
      }
    }

    // Perform bulk assignment
    for (const leadId of leadIds) {
      await storage.assignLead(leadId, organizationId, assignedTo, assignedBy, 'Bulk assignment');
    }

    return { 
      success: true, 
      message: `Successfully assigned ${leadIds.length} leads to ${assignedUser.firstName} ${assignedUser.lastName}`,
      assignedCount: leadIds.length 
    };
  },

  assignInternToLead: async (leadId: number, assignmentData: any, req: Request) => {
    const currentUser = (req as any).verifiedUser || await storage.getUser((req as any).user?.claims?.sub);
    if (!currentUser || !currentUser.organizationId) {
      throw new Error('User organization not found');
    }

    let { internId, internIds, notes } = assignmentData;

    // Normalize to array format
    if (internId && !internIds) {
      internIds = [internId];
    }

    if (!internIds || internIds.length === 0) {
      throw new Error('At least one intern ID is required');
    }

    const lead = (req as any).resource;

    // Validate all interns exist, have correct role, and belong to organization
    const interns = [];
    for (const id of internIds) {
      const intern = await storage.getUser(id);
      if (!intern || intern.organizationId !== currentUser.organizationId) {
        throw new Error(`Intern ${id} not found`);
      }

      if (intern.role !== 'intern') {
        throw new Error(`User ${id} is not an intern`);
      }

      interns.push(intern);
    }

    // Role-based validation
    if (currentUser.role === 'analyst') {
      if (lead.ownerAnalystId && lead.ownerAnalystId !== currentUser.id) {
        throw new Error('You can only assign your own leads to interns');
      }
      
      if (!lead.ownerAnalystId) {
        await storage.updateLead(leadId, currentUser.organizationId, {
          ownerAnalystId: currentUser.id
        });
      }
    }

    if (currentUser.role === 'partner') {
      if (!lead.ownerAnalystId) {
        throw new Error('Lead must have an owner analyst before assigning to intern');
      }

      const managesOwner = await storage.validatePartnerOf(currentUser.id, lead.ownerAnalystId, currentUser.organizationId);
      if (!managesOwner) {
        throw new Error('You can only manage leads owned by analysts you supervise');
      }
    }

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
  },

  createIndividualLead: async (formData: any, req: Request) => {
    const currentUser = (req as any).verifiedUser;
    if (!currentUser || !currentUser.organizationId) {
      throw new Error('User organization not found');
    }

    const validatedData = individualLeadFormSchema.parse(formData);
    
    // Create company with deduplication
    const companyResult = await storage.createCompanyWithDeduplication({
      name: validatedData.companyName,
      sector: validatedData.sector,
      location: validatedData.location,
      businessDescription: validatedData.businessDescription,
      website: validatedData.website,
      revenueInrCr: validatedData.revenueInrCr ? validatedData.revenueInrCr.toString() : undefined,
      ebitdaInrCr: validatedData.ebitdaInrCr ? validatedData.ebitdaInrCr.toString() : undefined,
      patInrCr: validatedData.patInrCr ? validatedData.patInrCr.toString() : undefined,
    }, currentUser.organizationId);

    const universeStatus = validatedData.assignedTo ? 'assigned' : 'open';
    const ownerAnalystId = currentUser.role === 'analyst' ? currentUser.id : null;
    
    // Auto-assign & auto-stage for analysts
    const assignedTo =
      validatedData.assignedTo ??
      (currentUser.role === 'analyst' ? currentUser.id : null);

    const stage = currentUser.role === 'analyst' ? 'qualified' : 'universe';
    // Create lead for the company
    const lead = await storage.createLead({
      organizationId: currentUser.organizationId,
      companyId: Number(companyResult.company.id),
      stage,
      universeStatus,
      ownerAnalystId,
      assignedTo: validatedData.assignedTo || null,
      pocCount: 0,
      pocCompletionStatus: 'red',
      pipelineValue: null,
      probability: '0',
      notes: null,
    });

    // Log activities (best effort)
    if (!companyResult.isExisting) {
      try {
        await ActivityLogService.logCompanyCreated(
          currentUser.organizationId,
          currentUser.id,
          companyResult.company.id,
          validatedData.companyName
        );
      } catch (logError) {
        console.error('Error logging company creation (non-fatal):', logError);
      }
    }

    try {
      await ActivityLogService.logLeadCreated(
        currentUser.organizationId,
        currentUser.id,
        lead.id,
        companyResult.company.id,
        validatedData.companyName,
        'universe'
      );
    } catch (logError) {
      console.error('Error logging lead creation (non-fatal):', logError);
    }

    if (validatedData.assignedTo) {
      try {
        const assignedUser = await storage.getUser(validatedData.assignedTo);
        const assignedToName = assignedUser 
          ? `${assignedUser.firstName || ''} ${assignedUser.lastName || ''}`.trim() || assignedUser.email
          : undefined;
        
        await ActivityLogService.logLeadAssigned(
          currentUser.organizationId,
          currentUser.id,
          lead.id,
          companyResult.company.id,
          validatedData.companyName,
          validatedData.assignedTo,
          assignedToName || undefined
        );
      } catch (logError) {
        console.error('Error logging lead assignment (non-fatal):', logError);
      }
    }

    return {
      success: true,
      company: companyResult.company,
      lead,
      isExistingCompany: companyResult.isExisting,
      message: companyResult.isExisting 
        ? `Lead created for existing company "${validatedData.companyName}"`
        : `New company "${validatedData.companyName}" and lead created successfully`
    };
  }
};