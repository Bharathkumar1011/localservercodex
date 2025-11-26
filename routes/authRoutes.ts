import { Router } from 'express';
import { authController } from '../controllers/authController.js';

const router = Router();

// Mock auth routes for development (no auth middleware needed)
router.get('/mock/roles', authController.getMockRoles);
router.post('/mock/login', authController.mockLogin);
router.post('/mock/logout', authController.mockLogout);
router.get('/mock/status', authController.getMockStatus);

// Real auth routes (auth middleware applied in main routes.ts)
router.get('/user', authController.getUser);
router.post('/set-test-role', authController.setTestRole);
router.post('/clear-test-role', authController.clearTestRole);

// Organization setup
router.post('/organizations/setup', authController.setupOrganization);

export { router as authRoutes };