import { Request, Response } from 'express';
import { companyService } from '../services/companyService.js';

export const companyController = {
  createCompany: async (req: Request, res: Response) => {
    try {
      const company = await companyService.createCompany(req.body, req);
      res.json(company);
    } catch (error) {
      console.error('Error creating company:', error);
      res.status(400).json({ message: 'Failed to create company', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  },

  getCompanies: async (req: Request, res: Response) => {
    try {
      const companies = await companyService.getCompanies(req);
      res.json(companies);
    } catch (error) {
      console.error('Error fetching companies:', error);
      res.status(500).json({ message: 'Failed to fetch companies' });
    }
  },

  getCompany: async (req: Request, res: Response) => {
    try {
      // Company already validated by middleware
      res.json((req as any).resource);
    } catch (error) {
      console.error('Error fetching company:', error);
      res.status(500).json({ message: 'Failed to fetch company' });
    }
  },

  updateCompany: async (req: Request, res: Response) => {
    try {
      const company = await companyService.updateCompany(parseInt(req.params.id), req.body, req);
      res.json(company);
    } catch (error) {
      console.error('Error updating company:', error);
      res.status(400).json({ message: 'Failed to update company', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  },

  generateCsvSample: async (req: Request, res: Response) => {
    try {
      const csvContent = await companyService.generateCsvSample();
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="company_upload_sample.csv"');
      res.send(csvContent);
    } catch (error) {
      console.error('Error generating CSV sample:', error);
      res.status(500).json({ message: 'Failed to generate CSV sample' });
    }
  },

  uploadCsv: async (req: Request, res: Response) => {
    try {
      const result = await companyService.uploadCsv(req.body.csvData, req);
      res.json(result);
    } catch (error: any) {
      console.error('Error processing CSV upload:', error);
      res.status(500).json({ message: error.message || 'Failed to process CSV upload' });
    }
  }
};