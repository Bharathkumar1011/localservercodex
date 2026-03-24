
import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../supabaseClient.js';
import { storage } from '../storage.js';

const extractTokenFromCookie = (cookieHeader?: string): string | null => {
  if (!cookieHeader) return null;
  const cookies = Object.fromEntries(
    cookieHeader.split(';').map(cookie => {
      const [key, ...rest] = cookie.trim().split('=');
      return [key, rest.join('=')];
    })
  );
  return cookies['sb-access-token'] || cookies['access_token'] || null;
};

const extractAccessToken = (req: Request): string | null => {
  const authHeader = req.headers.authorization as string | undefined;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring('Bearer '.length);
  }
  const cookieToken = extractTokenFromCookie(req.headers.cookie);
  if (cookieToken) return cookieToken;

  const headerToken = req.headers['x-supabase-access-token'];
  if (typeof headerToken === 'string' && headerToken.trim()) {
    return headerToken.trim();
  }

  return null;
};

export async function requireSupabaseAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const token = extractAccessToken(req);
    if (!token) {
      return res.status(401).json({ message: 'Missing Supabase access token' });
    }

    const { data, error } = await supabaseAdmin.auth.getUser(token);
    
    if (error || !data.user) {
      // 🚨 ADD THIS CONSOLE.LOG TO SEE THE REAL ERROR 🚨
      console.error('Supabase Auth Reject Reason:', error?.message || error);
      return res.status(401).json({ message: 'Invalid or expired Supabase token' });
    }

    const supabaseUser = data.user;
    const metadata = supabaseUser.user_metadata || {};
    const appMetadata = supabaseUser.app_metadata || {};

    // -------------------------------
    // 🔍 Look up user in local DB
    // -------------------------------
    let appUser = await storage.getUser(supabaseUser.id);

    // -------------------------------
    // 🆕 If first login → create user
    // -------------------------------
    if (!appUser) {
      appUser = await storage.upsertUser({
        id: supabaseUser.id,
        email: supabaseUser.email,
        firstName: metadata.first_name || metadata.firstName || null,
        lastName: metadata.last_name || metadata.lastName || null,
        profileImageUrl: metadata.avatar_url || null,
        role: appMetadata.role || metadata.role || 'analyst',
        organizationId: metadata.organization_id ?? null,
        analystId: metadata.analyst_id ?? null,
        partnerId: metadata.manager_id ?? null
      });
    }

    // -------------------------------
    // Attach safe identity to request
    // -------------------------------
    (req as any).verifiedUser = appUser;
    (req as any).authUserId = appUser.id;

    (req as any).user = {
      claims: {
        sub: appUser.id,
        email: appUser.email
      },
      organizationId: appUser.organizationId,
      role: appUser.role
    };

    next();
  } catch (err) {
    console.error('Supabase auth error:', err);
    res.status(500).json({ message: 'Authentication error' });
  }
}
