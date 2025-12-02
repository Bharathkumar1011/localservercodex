import { Request, Response, NextFunction } from 'express';
import { storage } from '../storage.js';

// Role-based access control middleware - verifies role from storage, not claims
export const requireRole = (roles: string[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).verifiedUser?.id || (req as any).user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: 'User ID not found' });
      }
      
      // Verify role from storage, don't trust JWT claims
      const user = (req as any).verifiedUser || await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ message: 'User not found' });
      }
      
      // Use test role from session if available, but validate it against actual role
      const testRole = (req.session as any)?.testRole;
      let userRole = user.role || 'analyst';
      
      console.log('[requireRole] User:', userId, 'DB Role:', user.role, 'Test Role:', testRole, 'Required:', roles);
      
      // Security: Validate test role doesn't exceed actual role (prevent privilege escalation via session)
      if (testRole) {
        // Partners cannot use admin test role
        if (user.role === 'partner' && testRole === 'admin') {
          // Clear invalid test role from session
          delete (req.session as any).testRole;
          delete (req.session as any).hasSelectedTestRole;
        }
        // Analysts cannot use any test role
        else if (user.role === 'analyst') {
          // Clear invalid test role from session
          delete (req.session as any).testRole;
          delete (req.session as any).hasSelectedTestRole;
        }
        // Valid test role - use it
        else {
          userRole = testRole;
        }
      }
      
      if (!roles.includes(userRole)) {
        console.log('[requireRole] DENIED - User role:', userRole, 'Required:', roles);
        return res.status(403).json({ message: 'Insufficient permissions' });
      }
      
      console.log('[requireRole] ALLOWED - User role:', userRole);
      
      // Add verified user and role to request for later use
      (req as any).verifiedUser = user;
      (req as any).userRole = userRole;
      next();
    } catch (error) {
      console.error('Authorization error:', error);
      res.status(500).json({ message: 'Authorization error' });
    }
  };
};