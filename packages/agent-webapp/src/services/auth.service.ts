export type AuthDetails = {
  identityProvider: string;
  userId: string;
  userDetails: string;
  userRoles: string[];
  claims: Array<{ typ: string; val: string }>;
};

const USER_ID_STORAGE_KEY = 'user_id';
const AUTH_TOKEN_STORAGE_KEY = 'auth_token';

export async function getUserInfo(_refresh = false): Promise<AuthDetails | undefined> {
  // Check for JWT token first (Google OAuth)
  const authToken = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
  if (authToken) {
    // Decode JWT to get user info (don't verify, just extract)
    try {
      const payload = JSON.parse(atob(authToken.split('.')[1]));
      return {
        identityProvider: 'google-oauth',
        userId: payload.userId,
        userDetails: payload.email,
        userRoles: [],
        claims: [],
      };
    } catch (error) {
      console.error('Failed to decode JWT token:', error);
      // Clear invalid token
      localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    }
  }

  // Fallback to simple userId
  const userId = localStorage.getItem(USER_ID_STORAGE_KEY);
  if (!userId) {
    return undefined;
  }

  return {
    identityProvider: 'simple',
    userId: userId,
    userDetails: userId,
    userRoles: [],
    claims: []
  };
}

export function setUserId(userId: string): void {
  localStorage.setItem(USER_ID_STORAGE_KEY, userId);
}

export function clearUserId(): void {
  localStorage.removeItem(USER_ID_STORAGE_KEY);
  localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
}
