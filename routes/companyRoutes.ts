import { Router } from 'express';
import { companyController } from '../controllers/companyController.js';
import { requireRole } from '../middleware/auth.js';
import { validateIntParam, validateResourceExists } from '../middleware/validation.js';

const router = Router();

// Generate CSV sample file
router.get('/csv-sample', companyController.generateCsvSample);

// Upload and process CSV file
router.post('/csv-upload', requireRole(['partner', 'admin','analyst']), companyController.uploadCsv);

// Company CRUD routes
router.post('/', companyController.createCompany);
router.get('/', companyController.getCompanies);
router.get('/:id', validateIntParam('id'), validateResourceExists('company'), companyController.getCompany);
router.put('/:id', validateIntParam('id'), validateResourceExists('company'), companyController.updateCompany);
router.patch('/:id', validateIntParam('id'), validateResourceExists('company'), companyController.updateCompany);

export { router as companyRoutes };