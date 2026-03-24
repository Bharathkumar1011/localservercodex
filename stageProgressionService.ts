import type { Lead, Contact, OutreachActivity } from "@shared/schema.js";
import type { IStorage } from "./storage.js";

export interface StageProgression {
  currentStage: string;
  nextStage: string | null;
  canProgress: boolean;
  requiredFields: string[];
  missingFields: string[];
  validationErrors: string[];
}

export interface StageValidationResult {
  isValid: boolean;
  errors: string[];
  missingFields: string[];
}

export class StageProgressionService {
  constructor(private storage: IStorage) {}

  private validStages = ['universe', 'qualified', 'outreach', 'pitching', 'mandates', 'completed_mandate', 'won', 'lost', 'rejected', 'hold', 'dropped'];

  
  private stageProgression = {
    'universe': ['qualified'],
    'qualified': ['outreach', 'rejected'],
    'outreach': ['pitching', 'rejected'],
    'pitching': ['mandates', 'lost', 'rejected'],
    'mandates': ['completed_mandate', 'won', 'lost', 'rejected'],
    'completed_mandate': ['won', 'lost', 'rejected'],
    'won': [],
    'lost': [],
    'rejected': []
  };

  /**
   * Get all valid next stages for a given current stage
   */
getValidNextStages(currentStage: string): string[] {
  // Terminal + Hold: no "auto" next stages
  if (['won', 'lost', 'rejected', 'hold', 'dropped'].includes(currentStage)) return [];

  const base = this.stageProgression[currentStage as keyof typeof this.stageProgression] || [];
  // From any non-terminal stage you can go to Hold or Rejected
  return Array.from(new Set([...base, 'hold', 'dropped','rejected']));
}


  /**
   * Check if a stage transition is valid
   */
isValidTransition(fromStage: string, toStage: string): boolean {
  if (fromStage === toStage) return true;

  // ❌ Universe is intake-only: never allow moving back INTO universe
  if (toStage === "universe") return false;

  // ✅ Won/Lost are terminal: cannot move out
  if (["won", "lost"].includes(fromStage)) return false;

  // ✅ Universe lead can be moved to any stage (except universe)
  if (fromStage === "universe") {
    return ["qualified", "outreach", "pitching", "mandates", "completed_mandate", "hold", "dropped", "rejected"].includes(toStage);
  }

  // ✅ Always allow moving INTO hold/dropped (from any non-terminal)
  if (toStage === "hold" || toStage === "dropped") return true;

  // ✅ Hold/Dropped can move back to any non-terminal stage (except universe)
  if (fromStage === "hold" || fromStage === "dropped") {
    return !["won", "lost"].includes(toStage);
  }

  // ✅ Rejected can move back to any non-terminal stage (except universe)
  if (fromStage === "rejected") {
    return !["won", "lost"].includes(toStage);
  }

  // ✅ Allow backwards/forwards moves across the main pipeline stages
  const pipelineStages = ["qualified", "outreach", "pitching", "mandates", "completed_mandate"];
  if (pipelineStages.includes(fromStage) && pipelineStages.includes(toStage)) return true;

  // ✅ Allow reject from anywhere (note: your /stage endpoint blocks rejected; reject uses /reject)
  if (toStage === "rejected") return true;

  // ✅ Keep existing business outcomes logic
  if (toStage === "won") return fromStage === "mandates";
  if (toStage === "lost") return fromStage === "pitching" || fromStage === "mandates";

  // fallback to old forward-progression logic (safe)
  const validNextStages = this.getValidNextStages(fromStage);
  return validNextStages.includes(toStage);
}



  /**
   * Validate if lead meets requirements for a specific stage
   */
  async validateStageRequirements(lead: Lead, targetStage: string, contact?: Contact, outreachActivities?: OutreachActivity[]): Promise<StageValidationResult> {
    const errors: string[] = [];
    const missingFields: string[] = [];

    switch (targetStage) {
      case 'universe':
        // Universe stage has no requirements
        break;

      case 'qualified':
        // Requires complete contact information
        if (!contact) {
          errors.push('Contact information is required for qualified stage');
          missingFields.push('contact');
        } else {
          if (!contact.name) {
            errors.push('Contact name is required');
            missingFields.push('contact.name');
          }
          if (!contact.designation) {
            errors.push('Contact designation is required');
            missingFields.push('contact.designation');
          }
          if (!contact.linkedinProfile) {
            errors.push('LinkedIn profile is required');
            missingFields.push('contact.linkedinProfile');
          }
        }
        break;

      case 'outreach':
        // Requires qualified stage requirements PLUS lead must be assigned
        const qualifiedValidation = await this.validateStageRequirements(lead, 'qualified', contact, outreachActivities);
        if (!qualifiedValidation.isValid) {
          errors.push(...qualifiedValidation.errors);
          missingFields.push(...qualifiedValidation.missingFields);
        }
        
        if (!lead.assignedTo) {
          errors.push('Lead must be assigned to a team member before outreach');
          missingFields.push('assignedTo');
        }
        break;

      case 'pitching': {
        // Pitching now requires only outreach-stage base requirements (no mandatory meeting/outreach activity).
        const outreachValidation = await this.validateStageRequirements(lead, 'outreach', contact, outreachActivities);

        if (!outreachValidation.isValid) {
          errors.push(...outreachValidation.errors);
          missingFields.push(...outreachValidation.missingFields);
        }

        break;
      }


      case 'mandates':
        const pitchingValidation = await this.validateStageRequirements(
          lead,
          'pitching',
          contact,
          outreachActivities
        );

        if (!pitchingValidation.isValid) {
          errors.push(...pitchingValidation.errors);
          missingFields.push(...pitchingValidation.missingFields);
        }

        break;

      case 'completed_mandate':
        const mandatesValidationForCompleted = await this.validateStageRequirements(
          lead,
          'mandates',
          contact,
          outreachActivities
        );

        if (!mandatesValidationForCompleted.isValid) {
          errors.push(...mandatesValidationForCompleted.errors);
          missingFields.push(...mandatesValidationForCompleted.missingFields);
        }

        if (!lead.notes || lead.notes.trim() === '') {
          errors.push('Completion note is required');
          missingFields.push('notes');
        }

        break;

      case 'won':
        // Check if coming from mandates stage - if so, requires Contract document
        if (lead.stage === 'mandates' || lead.stage === 'completed_mandate') {
          const mandatesValidation = await this.validateStageRequirements(lead, 'mandates', contact, outreachActivities);
          if (!mandatesValidation.isValid) {
            errors.push(...mandatesValidation.errors);
            missingFields.push(...mandatesValidation.missingFields);
          }

          // Check for Contract document
          const interventionsForWon = await this.storage.getInterventions(lead.id, lead.organizationId);
          const hasContract = interventionsForWon.some((i: any) =>
            i.type === "document" && normalizeDocName(i.documentName) === "contract"
          );
          if (!hasContract) {
            errors.push('Contract document is required to move from Mandates to Won');
            missingFields.push('Contract');
          }
        } else {
          // Coming from pitching stage (old path, maintaining backward compatibility)
          const pitchingValidationForWon = await this.validateStageRequirements(lead, 'pitching', contact, outreachActivities);
          if (!pitchingValidationForWon.isValid) {
            errors.push(...pitchingValidationForWon.errors);
            missingFields.push(...pitchingValidationForWon.missingFields);
          }
        }

        if (!lead.notes || lead.notes.trim() === '') {
          errors.push('Deal outcome notes are required when closing a lead');
          missingFields.push('notes');
        }
        break;

      case 'lost':
        // Lost can come from either pitching or mandates
        if (lead.stage === 'mandates' || lead.stage === 'completed_mandate') {
          const mandatesValidationForLost = await this.validateStageRequirements(lead, 'mandates', contact, outreachActivities);
          if (!mandatesValidationForLost.isValid) {
            errors.push(...mandatesValidationForLost.errors);
            missingFields.push(...mandatesValidationForLost.missingFields);
          }
        } else {
          const pitchingValidationForLost = await this.validateStageRequirements(lead, 'pitching', contact, outreachActivities);
          if (!pitchingValidationForLost.isValid) {
            errors.push(...pitchingValidationForLost.errors);
            missingFields.push(...pitchingValidationForLost.missingFields);
          }
        }

        if (!lead.notes || lead.notes.trim() === '') {
          errors.push('Deal outcome notes are required when closing a lead');
          missingFields.push('notes');
        }
        break;
      case 'hold':
        // Hold has no requirements
        break;  

      case 'dropped':
        // Dropped has no requirements (same as Hold)
        break;

      case 'rejected':
        // Rejected can happen at any stage, but requires a reason
        if (!lead.notes || lead.notes.trim() === '') {
          errors.push('Rejection reason is required in notes');
          missingFields.push('notes');
        }
        break;

      default:
        errors.push(`Unknown stage: ${targetStage}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      missingFields
    };
  }

  /**
   * Get comprehensive stage progression analysis for a lead
   */
  async analyzeStageProgression(leadId: number, organizationId: number): Promise<StageProgression> {
    const lead = await this.storage.getLead(leadId, organizationId);
    if (!lead) {
      throw new Error('Lead not found');
    }

    // Get lead details
    const leadDetails = await this.storage.getLeadsByStage(lead.stage, organizationId);
    const fullLead = leadDetails.find(l => l.id === leadId);
    const contact = fullLead?.contact;
    const outreachActivities = await this.storage.getOutreachActivities(leadId, organizationId);

    const currentStage = lead.stage;
    const validNextStages = this.getValidNextStages(currentStage);
    
    // Find the next logical stage (first valid next stage)
    const nextStage = validNextStages.length > 0 ? validNextStages[0] : null;

    if (!nextStage) {
      return {
        currentStage,
        nextStage: null,
        canProgress: false,
        requiredFields: [],
        missingFields: [],
        validationErrors: ['Lead is in a terminal stage']
      };
    }

    // Validate requirements for next stage
    const validation = await this.validateStageRequirements(lead, nextStage, contact, outreachActivities);

    return {
      currentStage,
      nextStage,
      canProgress: validation.isValid,
      requiredFields: this.getRequiredFieldsForStage(nextStage),
      missingFields: validation.missingFields,
      validationErrors: validation.errors
    };
  }

  /**
   * Attempt to automatically progress a lead to the next stage if requirements are met
   */
  async autoProgressLead(leadId: number, organizationId: number): Promise<{ progressed: boolean; newStage?: string; errors?: string[] }> {
    const analysis = await this.analyzeStageProgression(leadId, organizationId);
    
    if (!analysis.canProgress || !analysis.nextStage) {
      return {
        progressed: false,
        errors: analysis.validationErrors
      };
    }

    // Update lead to next stage
    const updatedLead = await this.storage.updateLead(leadId, organizationId, {
      stage: analysis.nextStage
    });

    if (updatedLead) {
      return {
        progressed: true,
        newStage: analysis.nextStage
      };
    } else {
      return {
        progressed: false,
        errors: ['Failed to update lead stage']
      };
    }
  }

  /**
   * Validate a manual stage transition
   */
async validateStageTransition(
  leadId: number,
  organizationId: number,
  targetStage: string,
  leadOverrides: Partial<Lead> = {}
): Promise<StageValidationResult> {
  const lead = await this.storage.getLead(leadId, organizationId);
  if (!lead) {
    return {
      isValid: false,
      errors: ['Lead not found'],
      missingFields: []
    };
  }

  // Check if transition is valid using the current stored stage
  if (!this.isValidTransition(lead.stage, targetStage)) {
    return {
      isValid: false,
      errors: [`Invalid stage transition from ${lead.stage} to ${targetStage}`],
      missingFields: []
    };
  }

  // Get lead details for validation
  const leadDetails = await this.storage.getLeadsByStage(lead.stage, organizationId);
  const fullLead = leadDetails.find(l => l.id === leadId);
  const contact = fullLead?.contact;
  const outreachActivities = await this.storage.getOutreachActivities(leadId, organizationId);

  // Allow caller to temporarily override fields like notes during validation
  const effectiveLead = { ...lead, ...leadOverrides } as Lead;

  return this.validateStageRequirements(effectiveLead, targetStage, contact, outreachActivities);
}

  /**
   * Get required fields for a specific stage
   */
  private getRequiredFieldsForStage(stage: string): string[] {
    switch (stage) {
      case 'universe':
        return [];
      case 'qualified':
        return ['contact.name', 'contact.designation', 'contact.linkedinProfile'];
      case 'outreach':
        return ['contact.name', 'contact.designation', 'contact.linkedinProfile', 'assignedTo'];
      case 'pitching':
        return ['contact.name', 'contact.designation', 'contact.linkedinProfile', 'assignedTo', 'outreachActivitiesOrMeeting'];
      case 'mandates':
        return ['contact.name', 'contact.designation', 'contact.linkedinProfile', 'assignedTo', 'outreachActivities'];
      case 'won':
        return ['contact.name', 'contact.designation', 'contact.linkedinProfile', 'assignedTo', 'outreachActivities', 'Contract', 'notes'];
      case 'lost':
        return ['contact.name', 'contact.designation', 'contact.linkedinProfile', 'assignedTo', 'outreachActivities', 'notes'];
      case 'hold':
        return [];
      case 'dropped':
        return [];
      case 'rejected':
        return ['notes'];
      default:
        return [];
    }
  }
}