import { Router } from 'express';
import { authRoutes } from './authRoutes.js';
import { userRoutes } from './userRoutes.js';
import { companyRoutes } from './companyRoutes.js';
import { leadRoutes } from './leadRoutes.js';
import { contactRoutes } from './contactRoutes.js';

// Import middleware
import { requireRole } from '../middleware/auth.js';
import { validateIntParam, validateResourceExists, validateStage } from '../middleware/validation.js';

const router = Router();

// Auth routes (no auth middleware needed)
router.use('/auth', authRoutes);

// Protected routes with auth middleware applied in main routes.ts
router.use('/users', requireRole(['partner', 'admin', 'analyst']), userRoutes);
router.use('/companies', requireRole(['partner', 'admin']), companyRoutes);
router.use('/leads', requireRole(['analyst', 'partner', 'admin']), leadRoutes);
router.use('/contacts', contactRoutes);

export { router as apiRoutes };