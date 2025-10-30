import { Buffer } from 'node:buffer';
import { HttpRequest } from '@azure/functions';
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

export function getAuthenticationUserId(request: HttpRequest): string | undefined {
  let userId: string | undefined;

  // Get the user ID from Azure easy auth
  try {
    const token = Buffer.from(request.headers.get('x-ms-client-principal') ?? '', 'base64').toString('ascii');
    const infos = token && JSON.parse(token);
    userId = infos?.userId;
  } catch {}

  return userId;
}

export async function getInternalUserId(request: HttpRequest, body?: any): Promise<string | undefined> {
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
  const providedUserId = body?.context?.userId ?? request.query.get('userId');
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
