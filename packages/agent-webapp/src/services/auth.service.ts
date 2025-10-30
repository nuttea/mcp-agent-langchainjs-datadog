export type AuthDetails = {
  identityProvider: string;
  userId: string;
  userDetails: string;
  userRoles: string[];
  claims: Array<{ typ: string; val: string }>;
};

const USER_ID_STORAGE_KEY = 'user_id';

export async function getUserInfo(_refresh = false): Promise<AuthDetails | undefined> {
  // Get userId from localStorage
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
}
