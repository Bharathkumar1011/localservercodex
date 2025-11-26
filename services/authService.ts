import { Request } from 'express';
import { storage } from '../storage.js';

// Mock user configurations
const MOCK_USERS = {
  admin: {
    id: 'mock_admin_1',
    organizationId: 1,
    email: 'admin@mockcompany.com',
    firstName: 'Admin',
    lastName: 'User',
    role: 'admin' as const,
    profileImageUrl: null
  },
  analyst: {
    id: 'mock_analyst_1',
    organizationId: 1,
    email: 'analyst@mockcompany.com',
    firstName: 'Analyst',
    lastName: 'User',
    role: 'analyst' as const,
    profileImageUrl: null
  },
  partner: {
    id: 'mock_partner_1',
    organizationId: 1,
    email: 'partner@mockcompany.com',
    firstName: 'Partner',
    lastName: 'User',
    role: 'partner' as const,
    profileImageUrl: null
  },
  intern: {
    id: 'mock_intern_1',
    organizationId: 1,
    email: 'intern@mockcompany.com',
    firstName: 'Intern',
    lastName: 'User',
    role: 'intern' as const,
    analystId: 'mock_analyst_1',
    profileImageUrl: null
  }
};

export const authService = {
  getMockRoles: () => {
    return Object.keys(MOCK_USERS).map(role => ({
      ...MOCK_USERS[role as keyof typeof MOCK_USERS]
    }));
  },

  mockLogin: async (role: string, req: Request) => {
    if (!role || !MOCK_USERS[role as keyof typeof MOCK_USERS]) {
      throw new Error('Invalid role');
    }

    const mockUser = MOCK_USERS[role as keyof typeof MOCK_USERS];

    // Store role in session
    (req.session as any).mockRole = role;

    // Ensure user exists in database
    await storage.upsertUser(mockUser);

    // Save session
    await new Promise<void>((resolve, reject) => {
      req.session.save((err: any) => {
        if (err) reject(err);
        else resolve();
      });
    });

    return {
      success: true,
      user: mockUser,
      message: `Logged in as ${role}`
    };
  },

  mockLogout: (req: Request) => {
    delete (req.session as any).mockRole;
    req.session.save((err: any) => {
      if (err) {
        console.error('Session save error:', err);
      }
    });
  },

  getMockStatus: (req: Request) => {
    const role = (req.session as any)?.mockRole;
    if (role) {
      const mockUser = MOCK_USERS[role as keyof typeof MOCK_USERS];
      return { authenticated: true, role, user: mockUser };
    } else {
      return { authenticated: false };
    }
  },

  getUser: async (req: Request) => {
    const userId = (req as any).user.claims.sub;
    const user = await storage.getUser(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Include test role info if set
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

    const userId = (req as any).user.claims.sub;

    // Get actual user role from database
    const user = await storage.getUser(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Security: Only allow setting a test role if user's actual role is admin or partner
    if (user.role !== 'admin' && user.role !== 'partner') {
      throw new Error('Only admin and partner users can use test roles');
    }

    // Prevent privilege escalation: partners cannot elevate to admin
    if (user.role === 'partner' && role === 'admin') {
      throw new Error('Partners cannot test as admin role');
    }

    // Store test role in session
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

    const userId = (req as any).user.claims.sub;
    const userEmail = (req as any).user.claims.email;

    // Get current user to check if they already have an organization
    const currentUser = await storage.getUser(userId);
    if (!currentUser) {
      throw new Error('User not found');
    }

    if (currentUser.organizationId) {
      throw new Error('User already belongs to an organization');
    }

    // Create organization for the user
    const organization = await storage.createOrganization({
      name: name.trim(),
      adminEmail: userEmail
    });

    // Update user to be associated with the organization and make them admin
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