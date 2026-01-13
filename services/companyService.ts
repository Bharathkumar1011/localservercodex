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
          results.successfulLeads++;
        }


        // --- Primary contact (supports BOTH templates)
        // --- Contacts (POC1 / POC2 / POC3) with UPSERT (no duplicates on re-upload)

        // treat NA/N-A/blank as empty
        const isEmpty = (v: any) => {
          if (v === undefined || v === null) return true;
          const s = String(v).trim();
          if (!s) return true;
          const n = norm(s);
          return n === "na" || n === "n/a" || n === "null" || n === "-";
        };

        // normalize phone (handles Excel scientific notation like 9.17962E+12)
        const normalizePhone = (v: any) => {
          if (isEmpty(v)) return null;
          const s = String(v).trim();
          if (/[eE]/.test(s)) {
            const num = Number(s);
            if (!Number.isNaN(num)) return BigInt(Math.round(num)).toString();
          }
          // keep digits + plus
          return s.replace(/[^\d+]/g, "");
        };

        const pocsFromCsv = [
          // POC 1 (Primary)
          {
            isPrimary: true,
            name: pick(row, ["Primary Contact Name", "POC 1 Name"]),
            designation: pick(row, ["Primary Contact Designation", "Designation 1", "POC 1 Designation"]),
            email: pick(row, ["Primary Contact Email", "Email ID 1", "POC 1 Email"]),
            phone: pick(row, ["Primary Contact Phone", "Phone Number 1", "POC 1 Phone Number"]),
            linkedinProfile: pick(row, ["Primary Contact LinkedIn", "LinkedIn 1", "POC 1 Linkedin"]),
          },

          // POC 2
          {
            isPrimary: false,
            name: pick(row, ["POC Name 2", "POC 2 Name"]),
            designation: pick(row, ["Designation 2", "POC 2 Designation"]),
            email: pick(row, ["Email ID 2", "POC 2 Email"]),
            phone: pick(row, ["POC 2 Number", "Phone Number 2", "POC 2 Phone Number"]),
            linkedinProfile: pick(row, ["LinkedIn 2", "POC 2 Linkedin"]),
          },

          // POC 3
          {
            isPrimary: false,
            name: pick(row, ["POC Name 3", "POC 3 Name"]),
            designation: pick(row, ["Designation 3", "POC 3 Designation"]),
            email: pick(row, ["Email ID 3", "POC 3 Email"]),
            phone: pick(row, ["POC 3 Number", "Phone Number 3", "POC 3 Phone Number"]),
            linkedinProfile: pick(row, ["LinkedIn 3", "POC 3 Linkedin"]),
          },
        ]
          // keep only rows where at least something exists
          .filter(p => !isEmpty(p.name) || !isEmpty(p.email) || !isEmpty(p.phone) || !isEmpty(p.linkedinProfile) || !isEmpty(p.designation))
          // clean values
          .map(p => ({
            ...p,
            name: isEmpty(p.name) ? null : String(p.name).trim(),
            designation: isEmpty(p.designation) ? null : String(p.designation).trim(),
            email: isEmpty(p.email) ? null : String(p.email).trim(),
            phone: normalizePhone(p.phone),
            linkedinProfile: isEmpty(p.linkedinProfile) ? null : String(p.linkedinProfile).trim(),
          }));

        if (pocsFromCsv.length > 0) {
          const existingContacts = await storage.getContactsByCompany(company.id, organizationId);

          const byEmail = new Map<string, any>();
          const byPhone = new Map<string, any>();
          const byNameDesig = new Map<string, any>();

          for (const c of existingContacts) {
            if (c.email) byEmail.set(norm(c.email), c);
            if (c.phone) byPhone.set(norm(c.phone), c);
            const key = `${norm(c.name || "")}|${norm(c.designation || "")}`;
            if (c.name || c.designation) byNameDesig.set(key, c);
          }

          const findMatch = (p: any) => {
            if (p.email && byEmail.has(norm(p.email))) return byEmail.get(norm(p.email));
            if (p.phone && byPhone.has(norm(p.phone))) return byPhone.get(norm(p.phone));
            const key = `${norm(p.name || "")}|${norm(p.designation || "")}`;
            if ((p.name || p.designation) && byNameDesig.has(key)) return byNameDesig.get(key);
            return null;
          };

          for (const poc of pocsFromCsv) {
            const match = findMatch(poc);

            if (match) {
              // update ONLY missing fields (no overwriting good data)
              const patch: any = {};

              if (!match.name && poc.name) patch.name = poc.name;
              if (!match.designation && poc.designation) patch.designation = poc.designation;
              if (!match.email && poc.email) patch.email = poc.email;
              if (!match.phone && poc.phone) patch.phone = poc.phone;
              if (!match.linkedinProfile && poc.linkedinProfile) patch.linkedinProfile = poc.linkedinProfile;

              // if CSV says primary, allow setting it true (do not force others false)
              if (poc.isPrimary && !match.isPrimary) patch.isPrimary = true;

              if (Object.keys(patch).length > 0) {
                await storage.updateContact(match.id, organizationId, patch);
              }
            } else {
              await storage.createContact({
                organizationId,
                companyId: company.id,
                name: poc.name,
                designation: poc.designation,
                email: poc.email,
                phone: poc.phone,
                linkedinProfile: poc.linkedinProfile,
                isPrimary: poc.isPrimary,
              });

              results.successfulContacts++;
            }
          }

          // ✅ Update lead POC count/status once after all POCs processed
          try {
            const companyLeads = await storage.getLeadsByCompany(company.id, organizationId);
            const companyContacts = await storage.getContactsByCompany(company.id, organizationId);

            const pocCount = companyContacts.length;

            let pocCompletionStatus = "red";
            if (pocCount > 0) {
              const completeContacts = companyContacts.filter((c: any) => c.isComplete);
              if (completeContacts.length >= 1) {
                pocCompletionStatus = pocCount >= 3 ? "green" : "amber";
              }
            }

            for (const lead of companyLeads) {
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