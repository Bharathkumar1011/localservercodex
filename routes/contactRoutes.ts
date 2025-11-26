import { Router } from 'express';
import { contactController } from '../controllers/contactController.js';
import { validateIntParam, validateResourceExists } from '../middleware/validation.js';

const router = Router();

// Contact CRUD routes
router.post('/', contactController.createContact);
router.get('/:id', validateIntParam('id'), validateResourceExists('contact'), contactController.getContact);
router.get('/company/:companyId', validateIntParam('companyId'), contactController.getContactsByCompany);
router.put('/:id', validateIntParam('id'), validateResourceExists('contact'), contactController.updateContact);
router.delete('/:id', validateIntParam('id'), validateResourceExists('contact'), contactController.deleteContact);

export { router as contactRoutes };