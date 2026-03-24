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
      stage,

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
    }

    if (userRole === 'partner') {
      return await storage.getLeadsByPartner(userId, user.organizationId);
    }

    // admin
    return await storage.getAllLeads(user.organizationId);

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
    
    if (user.role === 'partner') {
      return await storage.getLeadsByPartner(userId, user.organizationId);
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
    return stage === 'universe'
      ? allAssignedLeads
      : allAssignedLeads.filter(lead => lead.stage === stage);
  }

  if (userRole === 'partner') {
    const partnerLeads = await storage.getLeadsByPartner(userId, user.organizationId);
    return stage === 'universe'
      ? partnerLeads
      : partnerLeads.filter(lead => lead.stage === stage);
  }

  // admin
  return stage === 'universe'
    ? await storage.getAllLeads(user.organizationId)
    : await storage.getLeadsByStage(stage, user.organizationId);

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
    
const { stage, defaultPocId, backupPocId, note } = stageData;
if (!stage) {
  throw new Error('Stage is required');
}

const validStages = [
  'universe',
  'qualified',
  'outreach',
  'pitching',
  'mandates',
  'completed_mandate',
  'won',
  'lost',
  'hold',
  'dropped',
  'rejected'
];
if (!validStages.includes(stage)) {
  throw new Error('Invalid stage value');
}

    // Force rejected to go through /reject endpoint (needs reason)
    if (stage === 'rejected') {
      throw new Error('Use the Reject action (PATCH /leads/:id/reject) to move to Rejected with a reason');
    }

    const currentLead = (req as any).resource;

    // Block terminal stages
    if (['won', 'lost'].includes(currentLead.stage)) {
      throw new Error(`Lead is in terminal stage (${currentLead.stage}) and cannot be moved`);
    }

    // ✅ Validate transition + requirements using StageProgressionService
const normalizedNote =
  typeof note === 'string' && note.trim().length > 0 ? note.trim() : undefined;

const validation = await stageProgressionService.validateStageTransition(
  leadId,
  currentUser.organizationId,
  stage,
  normalizedNote ? { notes: normalizedNote } : {}
);
if (!validation.isValid) {
  throw new Error(validation.errors.join(', '));
}

    // Extra rule: moving into Pitching requires meeting + selecting POCs
    // Pitching: allow move even without meeting and without POCs.
    // If POCs are provided, validate they belong to the same company/org.
    const isMovingToPitching = stage === 'pitching';
    if (isMovingToPitching) {
      // Validate default POC only if provided
      if (defaultPocId) {
        const defaultContact = await storage.getContact(defaultPocId, currentUser.organizationId);
        if (!defaultContact) throw new Error('Default POC not found');

        if (defaultContact.companyId !== currentLead.companyId) {
          throw new Error('Invalid Default POC: must belong to the same company');
        }
      }

      // Validate backup POC only if provided
      if (backupPocId) {
        if (!defaultPocId) throw new Error('Backup POC requires a Default POC');
        if (backupPocId === defaultPocId) throw new Error('Backup POC must be different from Default POC');

        const backupContact = await storage.getContact(backupPocId, currentUser.organizationId);
        if (!backupContact) throw new Error('Backup POC not found');

        if (backupContact.companyId !== currentLead.companyId) {
          throw new Error('Invalid Backup POC: must belong to the same company');
        }
      }
    }


    
// Build updates object with POC IDs / note where needed
const updates: any = { stage };

if (stage === 'pitching') {
  if (defaultPocId) updates.defaultPocId = defaultPocId;
  if (backupPocId) updates.backupPocId = backupPocId;
}

if (stage === 'completed_mandate') {
  if (!normalizedNote) {
    throw new Error('Completion note is required');
  }
  updates.notes = normalizedNote;
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
    
    const lead = await storage.updateLead(leadId, currentUser.organizationId, {
      stage: 'rejected',
      notes: rejectionReason
    });

    
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
    const { assignedTo, assignedPartnerId, notes, challengeToken } = assignmentData;

    const currentUser =
      (req as any).verifiedUser || await storage.getUser((req as any).user?.claims?.sub);

    if (!currentUser || !currentUser.organizationId) {
      throw new Error('User organization not found');
    }

    const assignedBy = currentUser.id;
    const orgId = currentUser.organizationId;

    const currentLead = await storage.getLead(leadId, orgId);
    if (!currentLead) throw new Error('Lead not found');

    // ✅ undefined = keep existing; null = unassign
    const nextAssignedTo =
      assignedTo === undefined ? currentLead.assignedTo : assignedTo;

    const nextAssignedPartnerId =
      assignedPartnerId === undefined ? (currentLead as any).assignedPartnerId : assignedPartnerId;

    // ✅ Partner restrictions
    if (currentUser.role === 'partner') {
      const currentPartnerId = (currentLead as any).assignedPartnerId;

      if (!currentPartnerId || currentPartnerId !== currentUser.id) {
        throw new Error('Access denied: lead not assigned to this partner');
      }

      if (assignedPartnerId !== undefined && assignedPartnerId !== currentPartnerId) {
        throw new Error('Partners cannot change assignedPartnerId');
      }
    }

    // ✅ Reassignment detection (analyst or partner assignment change)
    const analystWasSet = !!currentLead.assignedTo;
    const partnerWasSet = !!(currentLead as any).assignedPartnerId;

    const analystChangingExisting =
      analystWasSet && currentLead.assignedTo !== nextAssignedTo;

    const partnerChangingExisting =
      partnerWasSet && (currentLead as any).assignedPartnerId !== nextAssignedPartnerId;

    const isReassignment = analystChangingExisting || partnerChangingExisting;


    if (isReassignment) {
      if (!challengeToken) throw new Error('Challenge token required for reassignments');

      const isValidToken = await storage.validateChallengeToken(
        challengeToken,
        assignedBy,
        orgId,
        leadId,
        'reassignment'
      );

      if (!isValidToken) throw new Error('Invalid or expired challenge token');
    }

    // Validate analyst
    if (nextAssignedTo !== null && nextAssignedTo !== undefined) {
      const u = await storage.getUser(nextAssignedTo);
      if (!u) throw new Error('Assigned analyst not found');
      if (u.role !== 'analyst') throw new Error('assignedTo must be an analyst user');
    }

    // Validate partner
    if (nextAssignedPartnerId !== null && nextAssignedPartnerId !== undefined) {
      const p = await storage.getUser(nextAssignedPartnerId);
      if (!p) throw new Error('Assigned partner not found');
      if (p.role !== 'partner') throw new Error('assignedPartnerId must be a partner user');
    }

    // ✅ NEW signature: pass both
    await storage.assignLead(
      leadId,
      orgId,
      nextAssignedTo ?? null,
      nextAssignedPartnerId ?? null,
      assignedBy,
      notes
    );

    // ✅ keep your current auto-progress behavior
   return { success: true };

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

  const currentUser =
    (req as any).verifiedUser || await storage.getUser((req as any).user?.claims?.sub);

  if (!currentUser || !currentUser.organizationId) {
    throw new Error("User organization not found");
  }

  // ✅ allow admin + partner (route already allows both)
  if (!["admin", "partner"].includes(currentUser.role)) {
    throw new Error("Only admin or partner can bulk assign");
  }

  const organizationId = currentUser.organizationId;
  const assignedBy = currentUser.id;

  if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
    throw new Error("Lead IDs array is required");
  }

  if (!assignedTo) {
    throw new Error("Assigned user is required");
  }

  // ✅ Normalize leadIds (frontend can send strings)
  const leadIdsNum = leadIds
    .map((id: any) => Number(id))
    .filter((n: number) => Number.isFinite(n));

  if (leadIdsNum.length !== leadIds.length) {
    throw new Error("Invalid leadIds: must be numbers");
  }

  // Verify assignee exists + org match
  const assignedUser = await storage.getUser(assignedTo);
  if (!assignedUser) throw new Error("Assigned user not found");

  if (Number(assignedUser.organizationId) !== Number(organizationId)) {
    throw new Error("Cannot assign leads to users outside your organization");
  }

  const isAnalystAssignee = assignedUser.role === "analyst";
  const isPartnerAssignee = assignedUser.role === "partner";

  if (!isAnalystAssignee && !isPartnerAssignee) {
    throw new Error("Assigned user must be an analyst or partner");
  }

  // ✅ Partner can bulk-assign only their own leads
  // (Admin bypasses this)
  for (const leadId of leadIdsNum) {
    const lead = await storage.getLead(leadId, organizationId);
    if (!lead) throw new Error(`Lead ${leadId} not found`);

    if (currentUser.role === "partner") {
      const partnerId = (lead as any).assignedPartnerId;
      if (!partnerId || partnerId !== currentUser.id) {
        throw new Error(`Access denied for lead ${leadId}`);
      }
    }
  }

  let autoQualifiedCount = 0;

  for (const leadId of leadIdsNum) {
    if (isAnalystAssignee) {
      // ✅ Assign to analyst (assignedTo)
      await storage.assignLead(
        leadId,
        organizationId,
        assignedTo,   // analyst id
        undefined,    // don't touch assignedPartnerId
        assignedBy,
        "Bulk assignment"
      );

      // ✅ auto progression only when analyst assigned
      try {
        await stageProgressionService.autoProgressLead(leadId, organizationId);
      } catch (e) {
        console.error(`Auto-progression failed for lead ${leadId}:`, e);
      }

      // ✅ fallback Universe -> Qualified
      const updatedLead = await storage.getLead(leadId, organizationId);
      if (updatedLead && updatedLead.stage === "universe") {
        await storage.updateLead(leadId, organizationId, { stage: "qualified" });
      }

      const finalLead = await storage.getLead(leadId, organizationId);
      if (finalLead?.stage === "qualified") autoQualifiedCount++;
    } else {
      // ✅ Assign to partner (assignedPartnerId)
      await storage.assignLead(
        leadId,
        organizationId,
        undefined,   // IMPORTANT: do NOT set assignedTo
        assignedTo,  // partner id goes here
        assignedBy,
        "Bulk assignment"
      );

      // ❌ do NOT auto-progress / do NOT force Universe->Qualified for partner assignment
    }
  }

  return {
    success: true,
    message: `Successfully assigned ${leadIdsNum.length} leads to ${assignedUser.firstName} ${assignedUser.lastName}`,
    assignedCount: leadIdsNum.length,
    autoQualifiedCount,
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

      createdBy: currentUser.id,   // ⭐ REQUIRED
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