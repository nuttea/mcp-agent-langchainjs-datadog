/**
 * IAP Authentication Middleware
 *
 * Extracts and validates Identity-Aware Proxy (IAP) authentication headers
 * and provides user context from Google Cloud IAP.
 *
 * IAP Headers:
 * - X-Goog-Authenticated-User-Email: User's email (format: accounts.google.com:user@domain.com)
 * - X-Goog-Authenticated-User-Id: User's unique ID (format: accounts.google.com:123456789)
 * - X-Goog-IAP-JWT-Assertion: Signed JWT with user claims
 *
 * Documentation: /docs/deployment/iap-setup.md
 */

import type { Request, Response, NextFunction } from 'express';
import tracer from 'dd-trace';

/**
 * IAP User information extracted from headers
 */
export interface IAPUser {
  email: string;
  userId: string;
  sub: string;
  rawEmail?: string;
  rawUserId?: string;
}

/**
 * Extract IAP user information from request headers
 *
 * @param req - Express request object
 * @returns IAPUser object or null if headers are not present
 */
export function extractIAPHeaders(req: Request): IAPUser | null {
  // Extract headers (case-insensitive)
  const rawEmail = req.get('X-Goog-Authenticated-User-Email') || req.get('x-goog-authenticated-user-email');
  const rawUserId = req.get('X-Goog-Authenticated-User-Id') || req.get('x-goog-authenticated-user-id');

  if (!rawEmail || !rawUserId) {
    return null;
  }

  // Remove "accounts.google.com:" prefix from email and userId
  // IAP prefixes the values with the identity provider
  const email = rawEmail.replace(/^accounts\.google\.com:/, '');
  const userId = rawUserId.replace(/^accounts\.google\.com:/, '');

  return {
    email,
    userId,
    sub: userId, // Subject claim (unique identifier)
    rawEmail,
    rawUserId,
  };
}

/**
 * Middleware to extract IAP user and attach to request
 * Does not enforce authentication, just extracts if present
 *
 * @param req - Express request
 * @param _res - Express response (unused)
 * @param next - Next middleware function
 */
export function extractIAPUser(req: Request, _res: Response, next: NextFunction): void {
  const iapUser = extractIAPHeaders(req);

  if (iapUser) {
    // Attach user to request for downstream handlers
    (req as any).iapUser = iapUser;

    // Add user context to Datadog APM trace
    const span = tracer.scope().active();
    if (span) {
      span.setTag('iap.user.email', iapUser.email);
      span.setTag('iap.user.id', iapUser.userId);
      span.setTag('usr.email', iapUser.email);
      span.setTag('usr.id', iapUser.userId);
    }

    // Log IAP user for debugging (if enabled)
    if (process.env.LOG_IAP_HEADERS === 'true') {
      console.log('IAP User:', {
        email: iapUser.email,
        userId: iapUser.userId,
        path: req.path,
        method: req.method,
      });
    }
  }

  next();
}

/**
 * Middleware to require IAP authentication
 * Returns 401 if IAP headers are not present
 *
 * @param req - Express request
 * @param res - Express response
 * @param next - Next middleware function
 */
export function requireIAPAuth(req: Request, res: Response, next: NextFunction): void {
  const iapUser = extractIAPHeaders(req);

  if (!iapUser) {
    // No IAP headers present - user is not authenticated
    res.status(401).json({
      error: 'Unauthorized',
      message: 'IAP authentication required',
    });
    return;
  }

  // Attach user to request
  (req as any).iapUser = iapUser;

  // Add user context to Datadog APM trace
  const span = tracer.scope().active();
  if (span) {
    span.setTag('iap.user.email', iapUser.email);
    span.setTag('iap.user.id', iapUser.userId);
    span.setTag('usr.email', iapUser.email);
    span.setTag('usr.id', iapUser.userId);
  }

  next();
}

/**
 * Middleware to require IAP authentication for specific domains
 * Returns 403 if user's email domain doesn't match allowed domains
 *
 * @param allowedDomains - Array of allowed email domains (e.g., ['example.com', 'company.com'])
 * @returns Express middleware function
 */
export function requireIAPDomain(allowedDomains: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const iapUser = extractIAPHeaders(req);

    if (!iapUser) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'IAP authentication required',
      });
      return;
    }

    // Extract domain from email
    const emailDomain = iapUser.email.split('@')[1];

    if (!emailDomain || !allowedDomains.includes(emailDomain)) {
      // Log unauthorized domain access attempt
      console.warn('IAP Domain access denied:', {
        email: iapUser.email,
        domain: emailDomain,
        allowedDomains,
        path: req.path,
      });

      res.status(403).json({
        error: 'Forbidden',
        message: 'Access denied - unauthorized domain',
      });
      return;
    }

    // Attach user to request
    (req as any).iapUser = iapUser;

    // Add user context to Datadog APM trace
    const span = tracer.scope().active();
    if (span) {
      span.setTag('iap.user.email', iapUser.email);
      span.setTag('iap.user.id', iapUser.userId);
      span.setTag('iap.user.domain', emailDomain);
      span.setTag('usr.email', iapUser.email);
      span.setTag('usr.id', iapUser.userId);
    }

    next();
  };
}

/**
 * Get IAP user from request (if present)
 *
 * @param req - Express request
 * @returns IAPUser or null
 */
export function getIAPUser(req: Request): IAPUser | null {
  return (req as any).iapUser || extractIAPHeaders(req);
}

/**
 * Check if IAP is enabled in the environment
 *
 * @returns true if IAP is enabled
 */
export function isIAPEnabled(): boolean {
  return process.env.ENABLE_IAP === 'true';
}
