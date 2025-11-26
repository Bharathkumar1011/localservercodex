import { Request } from 'express';
import { storage } from '../storage.js';

export const userService = {
  getUsers: async (req: Request) => {
    const currentUser = (req as any).verifiedUser;
    if (!currentUser?.organizationId) {
      throw new Error('User not associated with an organization');
    }
    
    return await storage.getUsers(currentUser.organizationId);
  },

  getUserAnalytics: async (req: Request) => {
    const currentUser = (req as any).verifiedUser;
    if (!currentUser?.organizationId) {
      throw new Error('User not associated with an organization');
    }
    
    return await storage.getUserAnalytics(currentUser.organizationId);
  },

  createUser: async (userData: any, req: Request) => {
    const { id, email, firstName, lastName, role = 'analyst', analystId } = userData;
    const currentUser = (req as any).verifiedUser;
    
    if (!currentUser?.organizationId) {
      throw new Error('User not associated with an organization');
    }
    
    if (!id || !email || !firstName || !lastName) {
      throw new Error('Missing required fields: id, email, firstName, lastName');
    }
    
    if (!['analyst', 'partner', 'admin', 'intern'].includes(role)) {
      throw new Error('Invalid role');
    }
    
    // For interns, analystId is required
    if (role === 'intern' && !analystId) {
      throw new Error('Intern must be assigned to an analyst');
    }
    
    // Validate analyst exists and belongs to same organization
    if (role === 'intern' && analystId) {
      const analyst = await storage.getUser(analystId);
      if (!analyst || analyst.organizationId !== currentUser.organizationId || analyst.role !== 'analyst') {
        throw new Error('Invalid analyst assignment');
      }
    }

    // Check if user already exists by ID
    const existingUser = await storage.getUser(id);
    if (existingUser) {
      throw new Error('User already exists');
    }

    // Check if email already exists within the organization
    const existingUsers = await storage.getUsers(currentUser.organizationId);
    const userWithEmail = existingUsers.find(u => u.email === email);
    if (userWithEmail) {
      throw new Error('Email already exists');
    }

    const newUserData = {
      id,
      organizationId: currentUser.organizationId,
      email,
      firstName,
      lastName,
      role,
      profileImageUrl: null,
      ...(role === 'intern' && analystId ? { analystId } : {})
    };

    await storage.upsertUser(newUserData);
    return await storage.getUser(id);
  },

  updateUserRole: async (userId: string, role: string, req: Request) => {
    const currentUser = (req as any).verifiedUser;
    const currentUserRole = (req as any).userRole;
    
    if (!currentUser?.organizationId) {
      throw new Error('User not associated with an organization');
    }
    
    if (!['analyst', 'partner', 'admin'].includes(role)) {
      throw new Error('Invalid role');
    }

    // Get the target user to check their current role and organization
    const targetUser = await storage.getUser(userId);
    if (!targetUser) {
      throw new Error('User not found');
    }

    // Ensure target user is in the same organization
    if (targetUser.organizationId !== currentUser.organizationId) {
      throw new Error('Cannot modify users from other organizations');
    }

    // Role-based permissions:
    // - Admins can change any role
    // - Partners can only change analyst roles to analyst/partner (not admin)
    if (currentUserRole === 'partner') {
      if (targetUser.role === 'admin') {
        throw new Error('Partners cannot modify admin users');
      }
      if (role === 'admin') {
        throw new Error('Partners cannot assign admin role');
      }
    }

    return await storage.updateUserRole(userId, role);
  },

  deleteUser: async (userId: string, req: Request) => {
    const currentUser = (req as any).verifiedUser;
    const currentUserId = (req as any).user?.claims?.sub;
    
    if (!currentUser?.organizationId) {
      throw new Error('User not associated with an organization');
    }
    
    // Prevent self-deletion
    if (userId === currentUserId) {
      throw new Error('Cannot delete your own account');
    }

    const user = await storage.getUser(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Ensure target user is in the same organization
    if (user.organizationId !== currentUser.organizationId) {
      throw new Error('Cannot delete users from other organizations');
    }

    // Check if user has assigned leads
    const assignedLeads = await storage.getLeadsByAssignee(userId, currentUser.organizationId);
    if (assignedLeads.length > 0) {
      throw new Error(`Cannot delete user with assigned leads. Transfer leads first. Assigned leads count: ${assignedLeads.length}`);
    }

    await storage.deleteUser(userId);
    return { message: 'User deleted successfully' };
  },

  transferLeads: async (fromUserId: string, toUserId: string, req: Request) => {
    const currentUser = (req as any).verifiedUser;
    
    if (!currentUser?.organizationId) {
      throw new Error('User not associated with an organization');
    }
    
    if (!toUserId) {
      throw new Error('Target user ID (toUserId) is required');
    }

    // Verify both users exist
    const fromUser = await storage.getUser(fromUserId);
    const toUser = await storage.getUser(toUserId);
    
    if (!fromUser) {
      throw new Error('Source user not found');
    }
    if (!toUser) {
      throw new Error('Target user not found');
    }

    // Ensure both users are in the same organization as the current user
    if (fromUser.organizationId !== currentUser.organizationId) {
      throw new Error('Source user is not in your organization');
    }
    if (toUser.organizationId !== currentUser.organizationId) {
      throw new Error('Target user is not in your organization');
    }

    // Get all leads assigned to the source user
    const leadsToTransfer = await storage.getLeadsByAssignee(fromUserId, currentUser.organizationId);
    
    if (leadsToTransfer.length === 0) {
      return { 
        message: 'No leads to transfer',
        transferredCount: 0
      };
    }

    // Transfer all leads
    const leadIds = leadsToTransfer.map(lead => lead.id);
    await storage.bulkAssignLeads(leadIds, toUserId);
    
    return { 
      message: `Successfully transferred ${leadIds.length} leads from ${fromUser.firstName} ${fromUser.lastName} to ${toUser.firstName} ${toUser.lastName}`,
      transferredCount: leadIds.length,
      fromUser: { id: fromUser.id, name: `${fromUser.firstName} ${fromUser.lastName}` },
      toUser: { id: toUser.id, name: `${toUser.firstName} ${toUser.lastName}` }
    };
  }
};