import { Request } from 'express';
import { storage } from '../storage.js';
import ActivityLogService from '../activityLogService.js';
import { contactFormSchema, updateContactSchema } from '../shared/schema.js';

export const contactService = {
  createContact: async (contactData: any, req: Request) => {
    const currentUser = (req as any).verifiedUser || await storage.getUser((req as any).user?.claims?.sub);
    if (!currentUser || !currentUser.organizationId) {
      throw new Error('User organization not found');
    }
    
    const validatedData = contactFormSchema.parse(contactData);
    const contact = await storage.createContact({ ...validatedData, organizationId: currentUser.organizationId });
    
    // Update lead POC count and status after creating contact
    if (validatedData.companyId) {
      try {
        const companyLeads = await storage.getLeadsByCompany(validatedData.companyId, currentUser.organizationId);
        
        for (const lead of companyLeads) {
          const companyContacts = await storage.getContactsByCompany(validatedData.companyId, currentUser.organizationId);
          const pocCount = companyContacts.length;
          
          let pocCompletionStatus = 'red';
          if (pocCount > 0) {
            const completeContacts = companyContacts.filter(c => c.isComplete);
            if (completeContacts.length >= 1) {
              pocCompletionStatus = pocCount >= 3 ? 'green' : 'amber';
            }
          }
          
          await storage.updateLead(lead.id, currentUser.organizationId, {
            pocCount,
            pocCompletionStatus
          });
          
          // Auto-qualify lead if primary contact has Name + Designation + LinkedIn URL
          if (lead.stage === 'universe') {
            const primaryContact = companyContacts.find(c => c.isPrimary);
            if (primaryContact && 
                primaryContact.name && 
                primaryContact.designation && 
                primaryContact.linkedinProfile) {
              await storage.updateLead(lead.id, currentUser.organizationId, {
                // stage: 'qualified'
                stage: 'outreach'
              });
              
              await ActivityLogService.logActivity({
                organizationId: currentUser.organizationId,
                leadId: lead.id,
                companyId: validatedData.companyId,
                userId: currentUser.id,
                action: 'lead_auto_outreach',
                entityType: 'lead',
                entityId: lead.id,
                description: `Lead auto-outreach: Primary contact ${primaryContact.name} has complete required information`
              });
            }
          }
        }
      } catch (updateError) {
        console.error('Error updating lead POC status:', updateError);
      }
    }
    
    return contact;
  },

  getContactsByCompany: async (companyId: number, req: Request) => {
    const currentUser = (req as any).verifiedUser || await storage.getUser((req as any).user?.claims?.sub);
    if (!currentUser || !currentUser.organizationId) {
      throw new Error('User organization not found');
    }
    return await storage.getContactsByCompany(companyId, currentUser.organizationId);
  },

  updateContact: async (contactId: number, updates: any, req: Request) => {
    const currentUser = (req as any).verifiedUser;
    if (!currentUser || !currentUser.organizationId) {
      throw new Error('User organization not found');
    }
    
    const validatedUpdates = updateContactSchema.parse(updates);
    const contact = await storage.updateContact(contactId, currentUser.organizationId, validatedUpdates);
    
    // After updating contact, check for auto-qualification
    if (contact && contact.companyId) {
      try {
        const companyLeads = await storage.getLeadsByCompany(contact.companyId, currentUser.organizationId);
        
        for (const lead of companyLeads) {
          const companyContacts = await storage.getContactsByCompany(contact.companyId, currentUser.organizationId);
          const pocCount = companyContacts.length;
          
          let pocCompletionStatus = 'red';
          if (pocCount > 0) {
            const completeContacts = companyContacts.filter(c => c.isComplete);
            if (completeContacts.length >= 1) {
              pocCompletionStatus = pocCount >= 3 ? 'green' : 'amber';
            }
          }
          
          await storage.updateLead(lead.id, currentUser.organizationId, {
            pocCount,
            pocCompletionStatus
          });
          
          // Auto-qualify lead if primary contact has Name + Designation + LinkedIn URL
          if (lead.stage === 'universe') {
            const primaryContact = companyContacts.find(c => c.isPrimary);
            if (primaryContact && 
                primaryContact.name && 
                primaryContact.designation && 
                primaryContact.linkedinProfile) {
              await storage.updateLead(lead.id, currentUser.organizationId, {
                // stage: 'qualified'
                stage: 'outreach'
              });
              
              await ActivityLogService.logActivity({
                organizationId: currentUser.organizationId,
                leadId: lead.id,
                companyId: contact.companyId,
                userId: currentUser.id,
                action: 'lead_auto_outreach',
                entityType: 'lead',
                entityId: lead.id,
                description: `Lead auto-outreach: Primary contact ${primaryContact.name} has complete required information`
              });
            }
          }
        }
      } catch (updateError) {
        console.error('Error updating lead after contact update:', updateError);
      }
    }
    
    return contact;
  },

  deleteContact: async (contactId: number, req: Request) => {
    const currentUser = (req as any).verifiedUser;
    if (!currentUser || !currentUser.organizationId) {
      throw new Error('User organization not found');
    }
    
    const contact = (req as any).resource;
    const companyId = contact.companyId;
    
    const deletedContact = await storage.deleteContact(contactId, currentUser.organizationId);
    
    if (!deletedContact) {
      throw new Error('Contact not found');
    }
    
    // Update lead POC count and status after deleting contact
    try {
      const companyLeads = await storage.getLeadsByCompany(companyId, currentUser.organizationId);
      
      for (const lead of companyLeads) {
        const companyContacts = await storage.getContactsByCompany(companyId, currentUser.organizationId);
        const pocCount = companyContacts.length;
        
        let pocCompletionStatus = 'red';
        if (pocCount > 0) {
          const completeContacts = companyContacts.filter(c => c.isComplete);
          if (completeContacts.length >= 1) {
            pocCompletionStatus = pocCount >= 3 ? 'green' : 'amber';
          }
        }
        
        await storage.updateLead(lead.id, currentUser.organizationId, {
          pocCount,
          pocCompletionStatus
        });
      }
    } catch (updateError) {
      console.error('Error updating lead POC status after deletion:', updateError);
    }
    
    return { message: 'Contact deleted successfully', deletedContact };
  }
};