import { Request, Response } from 'express';
import { authService } from '../services/authService.js';

export const authController = {
  // Mock auth endpoints now disabled
  getMockRoles: (_req: Request, res: Response) => {
    res.status(410).json({
      message: 'Mock authentication has been removed. Authenticate with Supabase instead.'
    });
  },

  mockLogin: (_req: Request, res: Response) => {
    res.status(410).json({
      message: 'Mock authentication has been removed. Authenticate with Supabase instead.'
    });
  },

  mockLogout: (_req: Request, res: Response) => {
    res.status(410).json({
      message: 'Mock authentication has been removed. Authenticate with Supabase instead.'
    });
  },

  getMockStatus: (_req: Request, res: Response) => {
    res.status(410).json({
      message: 'Mock authentication has been removed. Authenticate with Supabase instead.'
    });
  },

  // Real auth endpoints
  getUser: async (req: Request, res: Response) => {
    try {
      const user = await authService.getUser(req);
      res.json(user);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch user" });
    }
  },

  setTestRole: async (req: Request, res: Response) => {
    try {
      const { role } = req.body;
      const result = await authService.setTestRole(role, req);
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Failed to set test role" });
    }
  },

  clearTestRole: async (req: Request, res: Response) => {
    try {
      await authService.clearTestRole(req);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to clear test role" });
    }
  },

  setupOrganization: async (req: Request, res: Response) => {
    try {
      const { name } = req.body;
      const result = await authService.setupOrganization(name, req);
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: 'Failed to create organization' });
    }
  }
};
