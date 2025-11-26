import { Request, Response } from 'express';
import { contactService } from '../services/contactService.js';

export const contactController = {
  createContact: async (req: Request, res: Response) => {
    try {
      const contact = await contactService.createContact(req.body, req);
      res.json(contact);
    } catch (error) {
      console.error('Error creating contact:', error);
      res.status(400).json({ message: 'Failed to create contact', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  },

  getContact: async (req: Request, res: Response) => {
    try {
      // Contact already validated by middleware
      res.json((req as any).resource);
    } catch (error) {
      console.error('Error fetching contact:', error);
      res.status(500).json({ message: 'Failed to fetch contact' });
    }
  },

  getContactsByCompany: async (req: Request, res: Response) => {
    try {
      const contacts = await contactService.getContactsByCompany(parseInt(req.params.companyId), req);
      res.json(contacts);
    } catch (error) {
      console.error('Error fetching contacts:', error);
      res.status(500).json({ message: 'Failed to fetch contacts' });
    }
  },

  updateContact: async (req: Request, res: Response) => {
    try {
      const contact = await contactService.updateContact(parseInt(req.params.id), req.body, req);
      res.json(contact);
    } catch (error) {
      console.error('Error updating contact:', error);
      res.status(400).json({ message: 'Failed to update contact', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  },

  deleteContact: async (req: Request, res: Response) => {
    try {
      const result = await contactService.deleteContact(parseInt(req.params.id), req);
      res.json(result);
    } catch (error) {
      console.error('Error deleting contact:', error);
      res.status(400).json({ message: 'Failed to delete contact', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }
};