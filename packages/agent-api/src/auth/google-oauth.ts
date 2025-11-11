/**
 * Google OAuth Authentication Service
 *
 * Cloud-agnostic Google OAuth implementation using Google Identity Services.
 * Verifies Google ID tokens and manages JWT session tokens.
 *
 * This replaces GCP IAP with application-level authentication that works
 * with any cloud provider and existing infrastructure (including Cloudflare).
 */

import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import tracer from 'dd-trace';
import { logger } from '../logger.js';

// Google OAuth client for token verification
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// JWT secret for session tokens
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';

/**
 * User information extracted from Google ID token
 */
export interface GoogleUser {
  email: string;
  userId: string;
  name: string;
  picture?: string;
  emailVerified?: boolean;
}

/**
 * JWT payload for session tokens
 */
interface JWTPayload extends GoogleUser {
  iat: number;
  exp: number;
  iss: string;
}

/**
 * Verify Google ID token and extract user information
 *
 * @param token - Google ID token from frontend
 * @returns GoogleUser object with verified user information
 * @throws Error if token is invalid or domain is unauthorized
 */
export async function verifyGoogleToken(token: string): Promise<GoogleUser> {
  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    if (!payload || !payload.email || !payload.sub) {
      throw new Error('Invalid token payload');
    }

    // Optional: Verify email domain (restrict to specific domains)
    const allowedDomains = process.env.ALLOWED_EMAIL_DOMAINS?.split(',') || ['datadoghq.com'];
    const emailDomain = payload.email.split('@')[1];

    if (!allowedDomains.includes(emailDomain)) {
      logger.warn(`Unauthorized domain attempted login: ${emailDomain}`);
      throw new Error(`Unauthorized domain: ${emailDomain}`);
    }

    return {
      email: payload.email,
      userId: payload.sub,
      name: payload.name || payload.email,
      picture: payload.picture,
      emailVerified: payload.email_verified || false,
    };
  } catch (error) {
    logger.error({ error }, 'Google token verification failed');
    throw new Error('Invalid Google token');
  }
}

/**
 * Create JWT session token for authenticated user
 *
 * @param user - Verified Google user
 * @returns Signed JWT token
 */
export function createSessionToken(user: GoogleUser): string {
  return jwt.sign(
    {
      email: user.email,
      userId: user.userId,
      name: user.name,
      picture: user.picture,
      emailVerified: user.emailVerified,
      iss: 'mcp-agent-api',
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

/**
 * Verify JWT session token and extract user information
 *
 * @param token - JWT session token
 * @returns GoogleUser object or null if invalid
 */
export function verifySessionToken(token: string): GoogleUser | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: 'mcp-agent-api',
    }) as JWTPayload;

    return {
      email: decoded.email,
      userId: decoded.userId,
      name: decoded.name,
      picture: decoded.picture,
      emailVerified: decoded.emailVerified,
    };
  } catch (error) {
    logger.debug({ error }, 'JWT verification failed');
    return null;
  }
}

/**
 * Express middleware to require JWT authentication
 * Extracts and verifies JWT token from Authorization header
 * Attaches user to request and adds Datadog tags
 *
 * @param req - Express request
 * @param res - Express response
 * @param next - Next middleware function
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized - Missing or invalid Authorization header' });
    return;
  }

  const token = authHeader.substring(7);
  const user = verifySessionToken(token);

  if (!user) {
    res.status(401).json({ error: 'Unauthorized - Invalid or expired token' });
    return;
  }

  // Attach user to request for downstream handlers
  (req as any).user = user;

  // Add Datadog APM tags (same pattern as IAP!)
  const span = tracer.scope().active();
  if (span) {
    span.setTag('usr.email', user.email);
    span.setTag('usr.id', user.userId);
    span.setTag('usr.name', user.name);
    span.setTag('auth.provider', 'google-oauth');
    span.setTag('auth.method', 'jwt');
  }

  next();
}

/**
 * Express middleware to optionally extract JWT user if present
 * Does not enforce authentication, just extracts if available
 *
 * @param req - Express request
 * @param _res - Express response (unused)
 * @param next - Next middleware function
 */
export function extractAuthUser(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const user = verifySessionToken(token);

    if (user) {
      (req as any).user = user;

      // Add Datadog tags
      const span = tracer.scope().active();
      if (span) {
        span.setTag('usr.email', user.email);
        span.setTag('usr.id', user.userId);
        span.setTag('auth.provider', 'google-oauth');
      }
    }
  }

  next();
}

/**
 * Get authenticated user from request
 *
 * @param req - Express request
 * @returns GoogleUser or null
 */
export function getAuthUser(req: Request): GoogleUser | null {
  return (req as any).user || null;
}

/**
 * Check if Google OAuth is enabled
 *
 * @returns true if Google OAuth is enabled
 */
export function isGoogleAuthEnabled(): boolean {
  return process.env.ENABLE_GOOGLE_AUTH === 'true' && !!process.env.GOOGLE_CLIENT_ID;
}
