import { Request, Response } from 'express';
import { leadService } from '../services/leadService.js';

export const leadController = {
  createLead: async (req: Request, res: Response) => {
    try {
      const lead = await leadService.createLead(req.body, req);
      res.json(lead);
    } catch (error) {
      console.error('Error creating lead:', error);
      res.status(400).json({ message: 'Failed to create lead', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  },

  getAllLeads: async (req: Request, res: Response) => {
    try {
      const leads = await leadService.getAllLeads(req);
      res.json(leads);
    } catch (error) {
      console.error('Error fetching all leads:', error);
      res.status(500).json({ message: 'Failed to fetch all leads' });
    }
  },

  getMyLeads: async (req: Request, res: Response) => {
    try {
      const leads = await leadService.getMyLeads(req);
      res.json(leads);
    } catch (error) {
      console.error('Error fetching my leads:', error);
      res.status(500).json({ message: 'Failed to fetch leads' });
    }
  },

  getLeadsByStage: async (req: Request, res: Response) => {
    try {
      const leads = await leadService.getLeadsByStage(req.params.stage, req);
      res.json(leads);
    } catch (error) {
      console.error('Error fetching leads by stage:', error);
      res.status(500).json({ message: 'Failed to fetch leads' });
    }
  },

  getAssignedLeads: async (req: Request, res: Response) => {
    try {
      const leads = await leadService.getAssignedLeads(req);
      res.json(leads);
    } catch (error) {
      console.error('Error fetching assigned leads for intern:', error);
      res.status(500).json({ message: 'Failed to fetch assigned leads' });
    }
  },

  getLeadsByAssignee: async (req: Request, res: Response) => {
    try {
      const leads = await leadService.getLeadsByAssignee(req.params.userId, req);
      res.json(leads);
    } catch (error) {
      console.error('Error fetching assigned leads:', error);
      res.status(500).json({ message: 'Failed to fetch assigned leads' });
    }
  },

  getLead: async (req: Request, res: Response) => {
    try {
      // Lead already validated by middleware
      res.json((req as any).resource);
    } catch (error) {
      console.error('Error fetching lead:', error);
      res.status(500).json({ message: 'Failed to fetch lead' });
    }
  },

  updateLead: async (req: Request, res: Response) => {
    try {
      const lead = await leadService.updateLead(parseInt(req.params.id), req.body, req);
      res.json(lead);
    } catch (error) {
      console.error('Error updating lead:', error);
      res.status(400).json({ message: 'Failed to update lead', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  },

  updateLeadStage: async (req: Request, res: Response) => {
    try {
      const lead = await leadService.updateLeadStage(parseInt(req.params.id), req.body, req);
      res.json(lead);
    } catch (error) {
      console.error('Error updating lead stage:', error);
      res.status(400).json({ message: 'Failed to update lead stage', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  },

  rejectLead: async (req: Request, res: Response) => {
    try {
      const lead = await leadService.rejectLead(parseInt(req.params.id), req.body.rejectionReason, req);
      res.json(lead);
    } catch (error) {
      console.error('Error rejecting lead:', error);
      res.status(400).json({ message: 'Failed to reject lead', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  },

  assignLead: async (req: Request, res: Response) => {
    try {
      const result = await leadService.assignLead(parseInt(req.params.id), req.body, req);
      res.json(result);
    } catch (error) {
      console.error('Error assigning lead:', error);
      res.status(400).json({ message: 'Failed to assign lead', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  },

  assignInternsToLead: async (req: Request, res: Response) => {
    try {
      await leadService.assignInternsToLead(parseInt(req.params.id), req.body, req);
      res.json({ success: true });
    } catch (error) {
      console.error('Error assigning interns to lead:', error);
      res.status(400).json({ message: 'Failed to assign interns', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  },

  bulkAssignLeads: async (req: Request, res: Response) => {
    try {
      const result = await leadService.bulkAssignLeads(req.body, req);
      res.json(result);
    } catch (error) {
      console.error('Error bulk assigning leads:', error);
      res.status(400).json({ message: 'Failed to bulk assign leads', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  },

  assignInternToLead: async (req: Request, res: Response) => {
    try {
      await leadService.assignInternToLead(parseInt(req.params.id), req.body, req);
      res.json({ success: true, message: 'Lead assigned to intern(s) successfully' });
    } catch (error) {
      console.error('Error assigning lead to intern:', error);
      res.status(400).json({ message: 'Failed to assign lead to intern', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  },

  createIndividualLead: async (req: Request, res: Response) => {
    try {
      const result = await leadService.createIndividualLead(req.body, req);
      res.json(result);
    } catch (error) {
      console.error('Error creating individual lead:', error);
      
      if (error instanceof Error && error.message.includes('already exists')) {
        return res.status(409).json({ message: error.message });
      }
      
      res.status(400).json({ 
        message: 'Failed to create lead', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }
};