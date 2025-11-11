import { ChatComponent } from '../components/chat.js';
import { HistoryComponent } from '../components/history.js';
import { setDatadogUser } from '../datadog-rum.js';
import { getUserInfo } from './auth.service.js';

// Chat and History components are defined in index.html
// with their respective ids so we can access them here
declare global {
  interface Window {
    chatHistory: HistoryComponent;
    chat: ChatComponent;
  }
}

let userIdPromise: Promise<string | undefined> | undefined;

export function clearUserSession() {
  // Clear the cached user ID promise so next getUserId() will fetch fresh data
  userIdPromise = undefined;
}

export async function getUserId(refresh = false): Promise<string | undefined> {
  if (!refresh && userIdPromise) return userIdPromise;
  userIdPromise = (async () => {
    // Get the username from localStorage (set during login)
    const userInfo = await getUserInfo();
    const username = userInfo?.userId;

    const headers: HeadersInit = { 'Content-Type': 'application/json' };

    // Add JWT token if available (Google OAuth)
    const authToken = localStorage.getItem('auth_token');
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    } else if (username) {
      // Fallback: Send username in x-user-id header for simple auth
      headers['x-user-id'] = username;
    }

    const response = await fetch(`/api/me`, { headers });
    const payload = await response.json();
    return payload?.id;
  })();
  return userIdPromise;
}

export async function initUserSession() {
  try {
    // Force refresh to get the current user's ID (not cached from previous user)
    const userId = await getUserId(true);
    if (!userId) {
      throw new Error('User not authenticated');
    }

    // Get user information for Datadog RUM
    const userInfo = await getUserInfo();
    const userName = userInfo?.userDetails; // Email for Google OAuth, or username for simple auth
    const userEmail = userInfo?.identityProvider === 'google-oauth' ? userInfo.userDetails : undefined;

    // Decode JWT to get full user info if available
    const authToken = localStorage.getItem('auth_token');
    let fullName = userName;
    if (authToken) {
      try {
        const payload = JSON.parse(atob(authToken.split('.')[1]));
        fullName = payload.name || payload.email;
        // Set user context in Datadog RUM with email and name from JWT
        setDatadogUser(userId, payload.email, fullName);
      } catch (error) {
        // Fallback to basic info
        setDatadogUser(userId, userEmail, userName);
      }
    } else {
      // Simple auth - use username
      setDatadogUser(userId, userEmail, userName);
    }

    // Set up user ID for chat history and chat components
    window.chatHistory.userId = userId;
    window.chatHistory.addEventListener('loadSession', (event) => {
      const { id, messages } = (event as CustomEvent).detail;
      window.chat.sessionId = id;
      window.chat.messages = messages;
    });

    window.chat.userId = userId;
    window.chat.addEventListener('messagesUpdated', () => {
      window.chatHistory.refresh();
    });
  } catch (error) {
    console.log('Error initializing user session:', error);
  }
}
