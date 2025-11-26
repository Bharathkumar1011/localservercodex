import { Request, Response } from 'express';
import { authService } from '../services/authService.js';

export const authController = {
  // Mock auth endpoints
  getMockRoles: (req: Request, res: Response) => {
    const roles = authService.getMockRoles();
    res.json({ roles });
  },

  mockLogin: async (req: Request, res: Response) => {
    try {
      const { role } = req.body;
      const result = await authService.mockLogin(role, req);
      res.json(result);
    } catch (error) {
      res.status(500).json({
        message: 'Login failed: ' + (error as Error).message
      });
    }
  },

  mockLogout: (req: Request, res: Response) => {
    authService.mockLogout(req);
    res.json({ success: true });
  },

  getMockStatus: (req: Request, res: Response) => {
    const status = authService.getMockStatus(req);
    res.json(status);
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