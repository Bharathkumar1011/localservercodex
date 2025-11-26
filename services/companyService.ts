import { Request } from 'express';
import { storage } from '../storage.js';
import { insertCompanySchema, updateCompanySchema } from '../shared/schema.js';

export const companyService = {
  createCompany: async (companyData: any, req: Request) => {
    const currentUser = (req as any).verifiedUser;
    if (!currentUser || !currentUser.organizationId) {
      throw new Error('User organization not found');
    }
    const validatedData = insertCompanySchema.parse(companyData);
    return await storage.createCompany({ ...validatedData, organizationId: currentUser.organizationId });
  },

  getCompanies: async (req: Request) => {
    const currentUser = (req as any).verifiedUser;
    if (!currentUser || !currentUser.organizationId) {
      throw new Error('User organization not found');
    }
    return await storage.getCompanies(currentUser.organizationId);
  },

  updateCompany: async (companyId: number, updates: any, req: Request) => {
    const currentUser = (req as any).verifiedUser;
    if (!currentUser || !currentUser.organizationId) {
      throw new Error('User organization not found');
    }
    const validatedUpdates = updateCompanySchema.parse(updates);
    return await storage.updateCompany(companyId, currentUser.organizationId, validatedUpdates);
  },

  generateCsvSample: async () => {
    const csvHeaders = [
      'Company Name*',
      'Sector',
      'Sub Sector', 
      'Location',
      'Founded Year',
      'Business Description',
      'Products',
      'Website',
      'Industry',
      'Financial Year',
      'Revenue (INR Cr)',
      'EBITDA (INR Cr)',
      'PAT (INR Cr)',
      'Primary Contact Name',
      'Primary Contact Designation',
      'Primary Contact Email',
      'Primary Contact Phone',
      'Primary Contact LinkedIn',
      'Channel Partner',
      'Assigned Analyst',
      'Assigned Intern ',
      'Assigned Partner'
    ];

    const sampleData = [
      [
        'Tech Innovations Pvt Ltd',
        'Technology',
        'Software Development',
        'Bangalore, India',
        '2015',
        'Leading software development company specializing in enterprise solutions',
        'ERP Software, Mobile Apps, Cloud Solutions',
        'https://techinnovations.com',
        'Information Technology',
        'FY2024',
        '50.25',
        '12.50',
        '8.75',
        'Rajesh Kumar',
        'Chief Technology Officer',
        'rajesh.kumar@techinnovations.com',
        '+91-9876543210',
        'https://linkedin.com/in/rajeshkumar'
      ],
      [
        'Green Energy Solutions',
        'Energy',
        'Renewable Energy',
        'Mumbai, India',
        '2018',
        'Renewable energy solutions provider for commercial and residential sectors',
        'Solar Panels, Wind Turbines, Energy Storage',
        'https://greenenergy.in',
        'Energy & Utilities',
        'FY2024',
        '75.80',
        '18.90',
        '12.45',
        'Priya Sharma',
        'Head of Business Development',
        'priya.sharma@greenenergy.in',
        '+91-8765432109',
        'https://linkedin.com/in/priyasharma'
      ]
    ];

    return [csvHeaders, ...sampleData]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');
  },

  uploadCsv: async (csvData: string, req: Request) => {
    const currentUser = (req as any).verifiedUser;
    if (!currentUser || !currentUser.organizationId) {
      throw new Error('User organization not found');
    }

    if (!csvData || typeof csvData !== 'string') {
      throw new Error('CSV data is required');
    }

    const organizationId = currentUser.organizationId;

    // Parse CSV data
    const lines = csvData.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
      throw new Error('CSV must contain header row and at least one data row');
    }

    const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
    const results = {
      totalRows: lines.length - 1,
      successfulCompanies: 0,
      successfulContacts: 0,
      errors: [] as Array<{ row: number; error: string }>
    };

    // Process each data row
    for (let i = 1; i < lines.length; i++) {
      try {
        const values = lines[i].split(',').map(v => v.replace(/"/g, '').trim());
        
        if (values.length !== headers.length) {
          results.errors.push({ row: i + 1, error: 'Column count mismatch' });
          continue;
        }

        // Extract company data
        const companyData = {
          name: values[0] || '',
          sector: values[1] || null,
          subSector: values[2] || null,
          location: values[3] || null,
          foundedYear: values[4] ? parseInt(values[4]) : null,
          businessDescription: values[5] || null,
          products: values[6] || null,
          website: values[7] || null,
          industry: values[8] || null,
          financialYear: values[9] || null,
          revenueInrCr: values[10] || null,
          ebitdaInrCr: values[11] || null,
          patInrCr: values[12] || null
        };

        // Validate required fields
        if (!companyData.name) {
          results.errors.push({ row: i + 1, error: 'Company name is required' });
          continue;
        }
        if (!companyData.sector) {
          results.errors.push({ row: i + 1, error: 'Sector is required' });
          continue;
        }

        // Create company with deduplication
        const { company, isExisting } = await storage.createCompanyWithDeduplication(companyData, organizationId);
        if (!isExisting) {
          results.successfulCompanies++;
        }

        // Create lead for the company (only if company is new or no existing lead)
        const existingLeads = await storage.getLeadsByCompany(company.id, organizationId);
        if (existingLeads.length === 0) {
          const assignedTo = values[18] || null;
          const universeStatus = assignedTo ? 'assigned' : 'open';
          
          await storage.createLead({
            organizationId,
            companyId: company.id,
            stage: 'universe',
            universeStatus,
            assignedTo
          });
        }

        // Extract contact data if provided
        const contactData = {
          organizationId,
          companyId: company.id,
          name: values[13] || null,
          designation: values[14] || null,
          email: values[15] || null,
          phone: values[16] || null,
          linkedinProfile: values[17] || null,
          isPrimary: true
        };

        // Create contact if any contact data is provided
        if (contactData.name || contactData.email || contactData.phone) {
          await storage.createContact(contactData);
          results.successfulContacts++;
          
          // Update lead POC count and status after creating contact
          try {
            const companyLeads = await storage.getLeadsByCompany(company.id, organizationId);
            
            for (const lead of companyLeads) {
              const companyContacts = await storage.getContactsByCompany(company.id, organizationId);
              const pocCount = companyContacts.length;
              
              let pocCompletionStatus = 'red';
              if (pocCount > 0) {
                const completeContacts = companyContacts.filter(c => c.isComplete);
                if (completeContacts.length >= 1) {
                  pocCompletionStatus = pocCount >= 3 ? 'green' : 'amber';
                }
              }
              
              await storage.updateLead(lead.id, organizationId, {
                pocCount,
                pocCompletionStatus
              });
            }
          } catch (updateError) {
            console.error('Error updating lead POC status for CSV row:', i + 1, updateError);
          }
        }

      } catch (error: any) {
        results.errors.push({ 
          row: i + 1, 
          error: error.message || 'Failed to process row' 
        });
      }
    }

    return {
      success: true,
      message: `Upload completed: ${results.successfulCompanies} companies created, ${results.successfulContacts} contacts created`,
      results
    };
  }
};