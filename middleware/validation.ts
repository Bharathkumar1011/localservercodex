import { Request, Response, NextFunction } from 'express';
import { storage } from '../storage.js';

// Parameter validation middleware
export const validateIntParam = (paramName: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const value = parseInt((req.params as any)[paramName]);
    if (isNaN(value) || value <= 0) {
      return res.status(400).json({ message: `Invalid ${paramName}` });
    }
    (req.params as any)[paramName] = value;
    next();
  };
};

// Resource existence validation middleware
export const validateResourceExists = (resourceType: 'lead' | 'company' | 'contact') => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseInt((req.params as any).id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid ID format' });
      }
      
      // Get current user's organization ID for secure resource access
      let currentUser = (req as any).verifiedUser;
      if (!currentUser) {
        // If verifiedUser not set by requireRole middleware, fetch directly
        const userId = (req as any).user?.claims?.sub;
        if (!userId) {
          return res.status(401).json({ message: 'User ID not found' });
        }
        currentUser = await storage.getUser(userId);
      }
      
      if (!currentUser || !currentUser.organizationId) {
        return res.status(401).json({ message: 'User organization not found' });
      }
      
      let resource;
      switch (resourceType) {
        case 'lead':
          resource = await storage.getLead(id, currentUser.organizationId);
          break;
        case 'company':
          resource = await storage.getCompany(id, currentUser.organizationId);
          break;
        case 'contact':
          resource = await storage.getContact(id, currentUser.organizationId);
          break;
      }
      
      if (!resource) {
        return res.status(404).json({ message: `${resourceType} not found` });
      }
      
      (req as any).resource = resource;
      next();
    } catch (error) {
      res.status(500).json({ message: `Error validating ${resourceType}` });
    }
  };
};

// Valid stage validation
const validStages = ['universe', 'qualified', 'outreach', 'pitching', 'mandates', 'won', 'lost', 'rejected'];
export const validateStage = (req: Request, res: Response, next: NextFunction) => {
  if (!validStages.includes((req.params as any).stage)) {
    return res.status(400).json({ message: 'Invalid stage' });
  }
  next();
};