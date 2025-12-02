import { Request } from 'express';
import { storage } from '../storage.js';

export const authService = {
  getUser: async (req: Request) => {
    const userId = (req as any).verifiedUser?.id || (req as any).user?.claims?.sub;
    if (!userId) {
      throw new Error('User not authenticated');
    }

    const user = await storage.getUser(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const testRole = (req.session as any)?.testRole;
    const hasSelectedTestRole = (req.session as any)?.hasSelectedTestRole;

    return {
      ...user,
      testRole,
      hasSelectedTestRole,
      effectiveRole: testRole || user.role
    };
  },

  setTestRole: async (role: string, req: Request) => {
    if (!role || !['admin', 'analyst', 'intern'].includes(role)) {
      throw new Error('Invalid role. Must be admin, analyst, or intern');
    }

    const userId = (req as any).verifiedUser?.id || (req as any).user?.claims?.sub;
    if (!userId) {
      throw new Error('User not authenticated');
    }

    const user = await storage.getUser(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (user.role !== 'admin' && user.role !== 'partner') {
      throw new Error('Only admin and partner users can use test roles');
    }

    if (user.role === 'partner' && role === 'admin') {
      throw new Error('Partners cannot test as admin role');
    }

    (req.session as any).testRole = role;
    (req.session as any).hasSelectedTestRole = true;

    await new Promise<void>((resolve, reject) => {
      req.session.save((err: any) => {
        if (err) reject(err);
        else resolve();
      });
    });

    return { success: true, testRole: role };
  },

  clearTestRole: async (req: Request) => {
    delete (req.session as any).testRole;
    delete (req.session as any).hasSelectedTestRole;

    await new Promise<void>((resolve, reject) => {
      req.session.save((err: any) => {
        if (err) reject(err);
        else resolve();
      });
    });
  },

  setupOrganization: async (name: string, req: Request) => {
    if (!name || !name.trim()) {
      throw new Error('Organization name is required');
    }

    const userId = (req as any).verifiedUser?.id || (req as any).user?.claims?.sub;
    const userEmail = (req as any).verifiedUser?.email || (req as any).user?.claims?.email;

    if (!userId || !userEmail) {
      throw new Error('User not authenticated');
    }

    const currentUser = await storage.getUser(userId);
    if (!currentUser) {
      throw new Error('User not found');
    }

    if (currentUser.organizationId) {
      throw new Error('User already belongs to an organization');
    }

    const organization = await storage.createOrganization({
      name: name.trim(),
      adminEmail: userEmail
    });

    await storage.upsertUser({
      ...currentUser,
      organizationId: organization.id,
      role: 'admin'
    });

    return {
      message: 'Organization created successfully',
      organization: {
        id: organization.id,
        name: organization.name
      }
    };
  }
};
