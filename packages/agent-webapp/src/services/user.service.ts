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
    if (username) {
      // Send the username in x-user-id header so backend can hash it
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

    // Get the username that the user entered during login
    // It's stored in localStorage via auth.service.ts
    const userInfo = await getUserInfo();
    const userName = userInfo?.userId; // This is the username they entered

    // Set user context in Datadog RUM for session tracking
    // userId: internal hash ID from /api/me
    // userName: the friendly name the user entered at login
    setDatadogUser(userId, undefined, userName);

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
