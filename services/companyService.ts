import { Request } from 'express';
import { storage } from '../storage.js';
import { insertCompanySchema, updateCompanySchema } from '../shared/schema.js';
import { parse } from "csv-parse/sync";


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
    // ✅ Parse CSV robustly (handles commas + newlines inside cells)
    const rows = parse(csvData, {
      columns: (headers) => headers.map((h) => String(h).trim()), // trims header spaces
      skip_empty_lines: true,
      bom: true,
      relax_quotes: true,
      relax_column_count: true,
    }) as Record<string, any>[];

    if (rows.length === 0) {
      throw new Error("CSV must contain header row and at least one data row");
    }

   const results = {
      totalRows: rows.length,
      successfulCompanies: 0,
      successfulContacts: 0,
      successfulLeads: 0,
      warnings: [] as Array<{ row: number; warning: string }>,
      errors: [] as Array<{ row: number; error: string }>
    };


    // helper: try multiple header names (your system has multiple templates)
    const pick = (row: any, keys: string[]) => {
      for (const k of keys) {
        const v = row?.[k];
        const s = v === undefined || v === null ? "" : String(v).trim();
        if (s) return s;
      }
      return null;
    };

    const orgUsers = await storage.getUsers(organizationId);

    const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

    const userByEmail = new Map<string, string>();
    const userByName = new Map<string, string>();

    for (const u of orgUsers) {
      if (u.email) userByEmail.set(norm(u.email), u.id);

      const fullName = norm(`${u.firstName || ""} ${u.lastName || ""}`.trim());
      if (fullName) userByName.set(fullName, u.id);
    }


    // ✅ Process each data row (rows already excludes header)
    for (let i = 0; i < rows.length; i++) {
      const rowNum = i + 2; // header is row 1
      const row = rows[i] || {};

      try {
        // --- Company
        const companyName =
          pick(row, ["Company Name", "Company Name*", "Company", "Name"]) || "";

        if (!companyName) {
          results.errors.push({ row: rowNum, error: "Company name is required" });
          continue;
        }

        const sector = pick(row, ["Sector"]);
        if (!sector) {
          results.errors.push({ row: rowNum, error: "Sector is required" });
          continue;
        }

        const companyData = {
          name: companyName,
          sector,
          subSector: pick(row, ["Sub-Sector", "Sub Sector"]),
          location: pick(row, ["Location", "City"]),
          foundedYear: (() => {
            const v = pick(row, ["Founded Year"]);
            return v ? parseInt(v) : null;
          })(),
          businessDescription: pick(row, ["Business Description"]),
          products: pick(row, ["Products"]),
          website: pick(row, ["Website"]),
          industry: pick(row, ["Industry"]),

          // Financials (your real CSV uses these)
          financialYear: pick(row, ["Financial Year"]) || null,
          revenueInrCr: pick(row, ["Revenue (INR Cr)"]),
          ebitdaInrCr: pick(row, ["EBITDA (INR Cr)"]),
          patInrCr: pick(row, ["PAT (INR Cr)"]),
        };

        // Create company with deduplication
        const { company, isExisting } = await storage.createCompanyWithDeduplication(
          companyData,
          organizationId
        );
        if (!isExisting) results.successfulCompanies++;

        // Create lead if none exists
        const existingLeads = await storage.getLeadsByCompany(company.id, organizationId);
        if (!existingLeads || existingLeads.length === 0) {
          // Try both templates
          const analystCell = pick(row, ["Analyst PoC SFCA", "Assigned Analyst"]); // CSV value: name/email
          let assignedTo: string | null = null;

          if (analystCell && !["na", "n/a"].includes(norm(analystCell))) {
            assignedTo =
              userByEmail.get(norm(analystCell)) ||
              userByName.get(norm(analystCell)) ||
              null;

            if (!assignedTo) {
              results.warnings.push({
                row: rowNum,
                warning: `Assignee not found in CRM users: "${analystCell}". Lead will be created unassigned.`,
              });
            }
          }

          const universeStatus = assignedTo ? "assigned" : "open";

          await storage.createLead({
            organizationId,
            companyId: company.id,
            stage: "universe",
            universeStatus,
            assignedTo,
            createdBy: currentUser.id,
          });
        }
        results.successfulLeads++;


        // --- Primary contact (supports BOTH templates)
        const contactData = {
          organizationId,
          companyId: company.id,
          name: pick(row, ["Primary Contact Name", "POC 1 Name"]),
          designation: pick(row, ["Primary Contact Designation", "Designation 1", "POC 1 Designation"]),
          email: pick(row, ["Primary Contact Email", "Email ID 1", "POC 1 Email"]),
          phone: pick(row, ["Primary Contact Phone", "Phone Number 1", "POC 1 Phone Number"]),
          linkedinProfile: pick(row, ["Primary Contact LinkedIn", "LinkedIn 1", "POC 1 Linkedin"]),
          isPrimary: true,
        };

        if (contactData.name || contactData.email || contactData.phone) {
          await storage.createContact(contactData);
          results.successfulContacts++;

          // keep your POC status update logic (unchanged)
          try {
            const companyLeads = await storage.getLeadsByCompany(company.id, organizationId);

            for (const lead of companyLeads) {
              const companyContacts = await storage.getContactsByCompany(company.id, organizationId);
              const pocCount = companyContacts.length;

              let pocCompletionStatus = "red";
              if (pocCount > 0) {
                const completeContacts = companyContacts.filter((c: any) => c.isComplete);
                if (completeContacts.length >= 1) {
                  pocCompletionStatus = pocCount >= 3 ? "green" : "amber";
                }
              }

              await storage.updateLead(lead.id, organizationId, {
                pocCount,
                pocCompletionStatus,
              });
            }
          } catch (updateError) {
            console.error("Error updating lead POC status for CSV row:", rowNum, updateError);
          }
        }
      } catch (error: any) {
        results.errors.push({
          row: rowNum,
          error: error.message || "Failed to process row",
        });
      }
    }


    return {
      success: true,
      message: `Upload completed: ${results.successfulCompanies} companies, ${results.successfulLeads} leads, ${results.successfulContacts} contacts`,
      results
    };
  }
};