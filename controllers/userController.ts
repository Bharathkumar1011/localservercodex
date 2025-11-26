import { Request, Response } from 'express';
import { userService } from '../services/userService.js';

export const userController = {
  getUsers: async (req: Request, res: Response) => {
    try {
      const users = await userService.getUsers(req);
      res.json(users);
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ message: 'Failed to fetch users' });
    }
  },

  getUserAnalytics: async (req: Request, res: Response) => {
    try {
      const analytics = await userService.getUserAnalytics(req);
      res.json(analytics);
    } catch (error) {
      console.error('Error fetching user analytics:', error);
      res.status(500).json({ message: 'Failed to fetch user analytics' });
    }
  },

  createUser: async (req: Request, res: Response) => {
    try {
      const newUser = await userService.createUser(req.body, req);
      res.status(201).json(newUser);
    } catch (error) {
      console.error('Error creating user:', error);
      
      if (error && typeof error === 'object' && 'message' in error) {
        const errorMessage = (error as Error).message;
        if (errorMessage.includes('unique constraint') && errorMessage.includes('email')) {
          return res.status(400).json({ message: 'Email already exists' });
        }
        if (errorMessage.includes('unique constraint') && errorMessage.includes('id')) {
          return res.status(409).json({ message: 'User ID already exists' });
        }
      }
      
      res.status(500).json({ message: 'Failed to create user' });
    }
  },

  updateUserRole: async (req: Request, res: Response) => {
    try {
      const updatedUser = await userService.updateUserRole(req.params.id, req.body.role, req);
      res.json(updatedUser);
    } catch (error) {
      console.error('Error updating user role:', error);
      res.status(500).json({ message: 'Failed to update user role' });
    }
  },

  deleteUser: async (req: Request, res: Response) => {
    try {
      await userService.deleteUser(req.params.id, req);
      res.json({ message: 'User deleted successfully' });
    } catch (error) {
      console.error('Error deleting user:', error);
      res.status(500).json({ message: 'Failed to delete user' });
    }
  },

  transferLeads: async (req: Request, res: Response) => {
    try {
      const result = await userService.transferLeads(req.params.fromUserId, req.body.toUserId, req);
      res.json(result);
    } catch (error) {
      console.error('Error transferring leads:', error);
      res.status(500).json({ message: 'Failed to transfer leads' });
    }
  }
};