import { Router } from 'express';
import { userController } from '../controllers/userController.js';
import { requireRole } from '../middleware/auth.js';

const router = Router();

// Users routes - Partners, admins, and analysts can list users
router.get('/', userController.getUsers);

// User analytics - for admin dashboard
router.get('/analytics', requireRole(['partner', 'admin']), userController.getUserAnalytics);

// Create new user - admin only
router.post('/', requireRole(['admin']), userController.createUser);

// Update user role - admins can update any role, partners can only update analysts
router.put('/:id/role', requireRole(['partner', 'admin']), userController.updateUserRole);

// Delete/deactivate user - admin only  
router.delete('/:id', requireRole(['admin']), userController.deleteUser);

// Transfer all leads from one user to another - admin/partner
router.post('/:fromUserId/transfer-leads', requireRole(['partner', 'admin']), userController.transferLeads);

export { router as userRoutes };