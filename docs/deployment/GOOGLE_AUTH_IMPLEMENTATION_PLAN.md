# Google Authentication Implementation Plan - Cloud-Agnostic

Complete implementation plan for adding Google OAuth authentication to your Lit-based webapp, keeping the solution cloud-agnostic and compatible with Cloudflare.

## 🎯 Current State Analysis

### Webapp Framework: Lit (Web Components)
- ✅ Not React - uses **Lit** framework
- ✅ Already has auth component: `azc-auth`
- ✅ Already has auth service
- ✅ **Google provider already defined** (commented out!)
- ✅ Simple text-based auth currently active

### Current Auth Flow (Simple)
```
User enters username → Stored in localStorage → Used as userId
```

### Target Auth Flow (Google OAuth)
```
User clicks "Sign in with Google" →
Google OAuth popup →
User authenticates →
Callback with ID token →
Backend verifies token →
Create session/JWT →
Store user in PostgreSQL →
Add Datadog tags →
Return to frontend
```

## 📊 Implementation Options

### Option 1: Google Identity Services (Recommended)

**Best for**: Modern, cloud-agnostic Google authentication

**Libraries**:
- Frontend: Direct Google Identity Services SDK (no npm package needed!)
- Backend: `google-auth-library`

**Why Recommended**:
- ✅ Official Google solution
- ✅ No external dependencies on frontend
- ✅ Works with any framework (including Lit)
- ✅ Google One Tap support
- ✅ Most up-to-date

**Implementation**: 2-3 hours

### Option 2: @react-oauth/google Adapted for Lit

**Best for**: Using existing React OAuth libraries

**Problem**: `@react-oauth/google` is React-specific

**Solution**: Use the underlying `gsi-client` directly

**Implementation**: Similar to Option 1

### Option 3: Passport.js with Google Strategy

**Best for**: Backend-focused OAuth flow

**Libraries**:
- Backend: `passport`, `passport-google-oauth20`

**Why**:
- ✅ Industry standard
- ✅ Well-documented
- ✅ Session management included

**Implementation**: 3-4 hours

## 🥇 Recommended: Google Identity Services

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ agent-webapp (Lit Web Components)                           │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ <azc-auth> Component                                    │ │
│ │ ┌─────────────────────────────────────────────────────┐ │ │
│ │ │ Google Sign-In Button                               │ │ │
│ │ │   ├─ Loads Google Identity Services SDK             │ │ │
│ │ │   ├─ Renders "Sign in with Google" button          │ │ │
│ │ │   └─ Handles OAuth callback                        │ │ │
│ │ └─────────────────────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────────┘ │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ POST /api/auth/google
                         │ { credential: "eyJhbGc..." }
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ agent-api (Express)                                         │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ POST /api/auth/google                                   │ │
│ │ ┌─────────────────────────────────────────────────────┐ │ │
│ │ │ 1. Verify Google ID token                           │ │ │
│ │ │ 2. Extract user info (email, name, picture)         │ │ │
│ │ │ 3. Create/get user from PostgreSQL                  │ │ │
│ │ │ 4. Generate JWT session token                       │ │ │
│ │ │ 5. Add Datadog APM tags                             │ │ │
│ │ │ 6. Return session token + user info                 │ │ │
│ │ └─────────────────────────────────────────────────────┘ │ │
│ │                                                         │ │
│ │ Subsequent Requests with Authorization Header          │ │
│ │ ┌─────────────────────────────────────────────────────┐ │ │
│ │ │ verifyJWT middleware                                │ │ │
│ │ │   ├─ Extract JWT from Authorization header          │ │ │
│ │ │   ├─ Verify signature                               │ │ │
│ │ │   ├─ Attach user to request                         │ │ │
│ │ │   └─ Add Datadog tags                               │ │ │
│ │ └─────────────────────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Implementation Steps

#### Step 1: Frontend - Add Google Identity Services (30 min)

**File**: `packages/agent-webapp/index.html`

Add Google Identity Services SDK:

```html
<head>
  <!-- ... existing head content ... -->

  <!-- Google Identity Services SDK -->
  <script src="https://accounts.google.com/gsi/client" async defer></script>
</head>
```

**File**: `packages/agent-webapp/src/components/auth.ts`

Update to add Google Sign-In:

```typescript
import { LitElement, html } from 'lit';

protected renderLoginOptions = () => html`
  <section class="auth-login">
    <!-- Google Sign-In Button -->
    <div
      id="g_id_onload"
      data-client_id="449012790678-o4n20ce420kjuao68mciclp915dlrubj.apps.googleusercontent.com"
      data-callback="handleGoogleCallback"
      data-auto_prompt="false">
    </div>
    <div class="g_id_signin"
         data-type="standard"
         data-size="large"
         data-theme="outline"
         data-text="sign_in_with"
         data-shape="rectangular"
         data-logo_alignment="left">
    </div>

    <div class="divider">OR</div>

    <!-- Existing simple auth form -->
    <form class="login-form" @submit=${this.onLoginSubmit}>
      <!-- ... existing form ... -->
    </form>
  </section>
`;

// Add callback handler
protected async handleGoogleCallback(response: any) {
  // Send credential to backend
  const result = await fetch('/api/auth/google', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credential: response.credential })
  });

  const data = await result.json();

  // Store session token
  localStorage.setItem('auth_token', data.token);
  localStorage.setItem(USER_ID_STORAGE_KEY, data.user.userId);

  // Update UI
  this._userDetails = await getUserInfo(true);
  this.requestUpdate();
  window.dispatchEvent(new CustomEvent('auth-state-changed', {
    detail: { userDetails: this._userDetails }
  }));
}
```

#### Step 2: Backend - Google Token Verification (1 hour)

**File**: `packages/agent-api/package.json`

Add dependencies:

```json
{
  "dependencies": {
    "google-auth-library": "^9.0.0",
    "jsonwebtoken": "^9.0.2"
  },
  "devDependencies": {
    "@types/jsonwebtoken": "^9.0.7"
  }
}
```

**File**: `packages/agent-api/src/auth/google-oauth.ts`

```typescript
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import tracer from 'dd-trace';

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export interface GoogleUser {
  email: string;
  userId: string;
  name: string;
  picture: string;
}

/**
 * Verify Google ID token and extract user information
 */
export async function verifyGoogleToken(token: string): Promise<GoogleUser> {
  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    if (!payload) {
      throw new Error('Invalid token payload');
    }

    // Verify email domain (optional - restrict to datadoghq.com)
    const emailDomain = payload.email?.split('@')[1];
    if (emailDomain !== 'datadoghq.com') {
      throw new Error('Unauthorized domain');
    }

    return {
      email: payload.email!,
      userId: payload.sub,
      name: payload.name || payload.email!,
      picture: payload.picture || '',
    };
  } catch (error) {
    console.error('Google token verification failed:', error);
    throw new Error('Invalid Google token');
  }
}

/**
 * Create JWT session token for authenticated user
 */
export function createSessionToken(user: GoogleUser): string {
  return jwt.sign(
    {
      email: user.email,
      userId: user.userId,
      name: user.name,
    },
    JWT_SECRET,
    {
      expiresIn: '7d', // 7 days
      issuer: 'mcp-agent-api',
    }
  );
}

/**
 * Verify JWT session token
 */
export function verifySessionToken(token: string): GoogleUser | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as GoogleUser;
    return decoded;
  } catch (error) {
    return null;
  }
}

/**
 * Middleware to verify JWT and attach user to request
 */
export function requireAuth(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const token = authHeader.substring(7);
  const user = verifySessionToken(token);

  if (!user) {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }

  // Attach user to request
  req.user = user;

  // Add Datadog tags (same as IAP!)
  const span = tracer.scope().active();
  if (span) {
    span.setTag('usr.email', user.email);
    span.setTag('usr.id', user.userId);
    span.setTag('auth.provider', 'google-oauth');
  }

  next();
}
```

**File**: `packages/agent-api/src/express-server.ts`

Add Google OAuth endpoint:

```typescript
import { verifyGoogleToken, createSessionToken } from './auth/google-oauth.js';

// Google OAuth login endpoint
app.post('/api/auth/google', async (req, res) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      res.status(400).json({ error: 'Missing credential' });
      return;
    }

    // Verify Google ID token
    const user = await verifyGoogleToken(credential);

    // Create session token
    const sessionToken = createSessionToken(user);

    // Create/get user in database
    const userId = createHash('sha256').update(user.email).digest('hex').slice(0, 32);
    const db = await UserDbService.getInstance();
    let dbUser = await db.getUserById(userId);

    if (!dbUser) {
      dbUser = await db.createUser(userId);
      logger.info(`Created new user from Google OAuth: ${user.email}`);
    }

    // Add Datadog tags
    const span = tracer.scope().active();
    if (span) {
      span.setTag('usr.email', user.email);
      span.setTag('usr.id', user.userId);
      span.setTag('auth.provider', 'google-oauth');
      span.setTag('auth.method', 'oauth2');
    }

    res.json({
      token: sessionToken,
      user: {
        userId: dbUser.id,
        email: user.email,
        name: user.name,
        picture: user.picture,
      },
    });
  } catch (error) {
    logger.error('Google OAuth error:', error);
    res.status(401).json({ error: 'Authentication failed' });
  }
});
```

### Comparison with Current IAP Implementation

| Feature | GCP IAP (Current) | Google OAuth (Proposed) |
|---------|-------------------|-------------------------|
| **Cloud-Agnostic** | ❌ GCP-specific | ✅ Yes |
| **Works with Cloudflare** | ❌ Needs changes | ✅ Yes |
| **Authentication** | IAP headers | JWT tokens |
| **User Context** | `req.iapUser` | `req.user` |
| **Datadog Tags** | `iap.user.email` | `usr.email` |
| **Session Management** | IAP cookies | JWT tokens |
| **Code Reuse** | 50% | 70% |
| **Migration Effort** | N/A | Replace IAP middleware |

## 🔄 Migration from IAP to Google OAuth

### What Stays the Same ✅
- User database integration
- Datadog tagging
- Session concept
- Protected routes

### What Changes
- IAP headers → JWT tokens
- IAP middleware → JWT verification middleware
- Server-side auth → Client-side OAuth flow
- IAP cookies → JWT in localStorage

## 📝 Detailed Implementation Files

I can create:

### Frontend (Lit/TypeScript)
1. ✅ Updated `auth.ts` component with Google Sign-In button
2. ✅ Google OAuth callback handler
3. ✅ Session token management
4. ✅ API service with Authorization header

### Backend (Express/TypeScript)
1. ✅ `google-oauth.ts` - Token verification and session management
2. ✅ Updated `express-server.ts` - Add Google auth endpoint
3. ✅ JWT middleware - Replace IAP middleware
4. ✅ Datadog integration - Same tags as IAP

### Configuration
1. ✅ Environment variables
2. ✅ TypeScript types
3. ✅ Testing guide

## 💰 Cost Comparison

| Solution | Monthly Cost | Setup Time | Maintenance |
|----------|--------------|------------|-------------|
| **Google OAuth (App-level)** | **$0** | 2-3 hours | Low |
| Cloudflare Access | $350+ | 1-2 hours | None |
| GCP IAP | $0 | 30-45 min | None |
| Auth0 | $0-35 | 2-3 hours | Low |

## 🎯 Recommendation

**Implement Google OAuth at application level** because:

1. ✅ **Cloud-agnostic** - Can deploy anywhere
2. ✅ **Free** - No ongoing costs
3. ✅ **Works with Cloudflare** - No infrastructure changes
4. ✅ **Moderate effort** - 2-3 hours
5. ✅ **Full control** - You own the authentication
6. ✅ **Reuses existing code** - Auth component already exists
7. ✅ **Datadog integration** - Same pattern as IAP

### Comparison with Keeping GCP IAP

| Aspect | Google OAuth (App-level) | GCP IAP |
|--------|-------------------------|---------|
| Requires disabling Cloudflare | ❌ No | ✅ Yes |
| Cloud-agnostic | ✅ Yes | ❌ No |
| Setup time | 2-3 hours | 30-45 min |
| Code to write | Medium | ✅ Already done |
| Works anywhere | ✅ Yes | ❌ GCP only |
| Portability | ✅ High | ❌ Low |

## 🚀 Next Steps

Would you like me to:

1. ✅ Create the complete Google OAuth implementation (Option 1)
   - Frontend: Updated auth component with Google Sign-In
   - Backend: Token verification + JWT management
   - Datadog integration
   - Testing guide

2. ⏸️ Stick with GCP IAP
   - Requires disabling Cloudflare proxy
   - Add HTTPS to Gateway
   - 30-45 min to complete

3. 📋 Explore Cloudflare Access
   - Keeps Cloudflare
   - $350/month
   - Simpler integration

Let me know which direction and I'll create the full implementation!
