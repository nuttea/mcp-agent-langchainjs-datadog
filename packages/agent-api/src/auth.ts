import { Buffer } from 'node:buffer';
import { HttpRequest } from '@azure/functions';
import type { Request } from 'express';
import { DefaultAzureCredential, getBearerTokenProvider } from '@azure/identity';
import { UserDbService } from './user-db-service.js';

const azureOpenAiScope = 'https://cognitiveservices.azure.com/.default';

let credentials: DefaultAzureCredential | undefined;

export function getCredentials(): DefaultAzureCredential {
  // Use the current user identity to authenticate.
  // No secrets needed, it uses `az login` or `azd auth login` locally,
  // and managed identity when deployed on Azure.
  credentials ||= new DefaultAzureCredential();
  return credentials;
}

export function getAzureOpenAiTokenProvider() {
  return getBearerTokenProvider(getCredentials(), azureOpenAiScope);
}

export function getAuthenticationUserId(request: HttpRequest | Request): string | undefined {
  let userId: string | undefined;

  // First, check for simple x-user-id header (for non-Azure deployments)
  try {
    if ('headers' in request && typeof request.headers === 'object') {
      // Express Request
      userId = (request as Request).get?.('x-user-id') ??
               (request.headers as any)['x-user-id'];
    } else {
      // Azure Functions HttpRequest
      userId = (request as HttpRequest).headers.get('x-user-id') ?? undefined;
    }

    if (userId) {
      return userId;
    }
  } catch {}

  // Fall back to Azure easy auth
  try {
    // Support both Azure Functions HttpRequest and Express Request
    let principalHeader: string | undefined;
    if ('headers' in request && typeof request.headers === 'object') {
      // Express Request
      principalHeader = (request as Request).get?.('x-ms-client-principal') ??
                        (request.headers as any)['x-ms-client-principal'];
    } else {
      // Azure Functions HttpRequest
      principalHeader = (request as HttpRequest).headers.get('x-ms-client-principal') ?? undefined;
    }

    const token = Buffer.from(principalHeader ?? '', 'base64').toString('ascii');
    const infos = token && JSON.parse(token);
    userId = infos?.userId;
  } catch {}

  return userId;
}

export async function getInternalUserId(request: HttpRequest | Request, body?: any): Promise<string | undefined> {
  const db = await UserDbService.getInstance();

  // Get the user ID from Azure easy auth if it's available
  const authUserId = getAuthenticationUserId(request);
  if (authUserId) {
    // Exchange the auth user ID to the internal user ID
    const user = await db.getUserById(authUserId);
    if (user) {
      return user.id;
    }
  }

  // Get the user ID from the request body/query as a fallback
  // Support both Azure Functions HttpRequest and Express Request
  let queryUserId: string | undefined;
  if ('query' in request && typeof request.query === 'object') {
    // Express Request - query is a plain object
    queryUserId = (request as Request).query.userId as string | undefined;
  } else {
    // Azure Functions HttpRequest - query has a get method
    queryUserId = (request as HttpRequest).query.get('userId') ?? undefined;
  }

  const providedUserId = body?.context?.userId ?? queryUserId;
  if (providedUserId) {
    return providedUserId;
  }

  // Fall back to anonymous user for Kubernetes/development environments
  const allowAnonymous = process.env.ALLOW_ANONYMOUS_AUTH === 'true' || !process.env.AZURE_COSMOSDB_NOSQL_ENDPOINT;
  if (allowAnonymous) {
    // Use the same anonymous user ID as /api/me endpoint
    const anonymousAuthId = 'anonymous-user';
    const id = require('node:crypto').createHash('sha256').update(anonymousAuthId).digest('hex').slice(0, 32);

    // Ensure user exists in DB
    let user = await db.getUserById(id);
    if (!user) {
      user = await db.createUser(id);
    }
    return id;
  }

  return undefined;
}
