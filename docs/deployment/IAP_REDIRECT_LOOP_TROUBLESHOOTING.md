# IAP Redirect Loop - Root Cause Analysis & Fix

## Problem

IAP is active and configured correctly, but users experience a redirect loop when accessing `https://www.platform-engineering-demo.dev/`.

## Observed Behavior

```bash
$ curl -I https://www.platform-engineering-demo.dev/

HTTP/2 302
location: https://www.platform-engineering-demo.dev/
x-goog-iap-generated-response: true
```

The response is a 302 redirect to the same URL, creating an infinite loop.

## Root Cause

The redirect loop occurs because the **OAuth redirect URI** is not properly configured in the OAuth consent screen. When IAP tries to authenticate users, it redirects them to Google OAuth, but the OAuth flow cannot complete because the redirect back to IAP fails.

## Required OAuth Redirect URIs

For IAP to work correctly with GCP Gateway API and URL maps, you need **TWO redirect URIs**:

### 1. Standard IAP Redirect URI

```
https://iap.googleapis.com/v1/oauth/clientIds/449012790678-o4n20ce420kjuao68mciclp915dlrubj.apps.googleusercontent.com:handleRedirect
```

This is the standard IAP redirect URI that handles the OAuth flow.

### 2. GCP Gatekeeper Redirect URI (Critical for URL Maps)

```
https://www.platform-engineering-demo.dev/_gcp_gatekeeper/authenticate
```

This is **REQUIRED** when using Gateway API / URL Maps / Backend Services. Without this, IAP will redirect in a loop.

## Fix Instructions

### Step 1: Navigate to OAuth Client

1. Go to [Google Cloud Console - Credentials](https://console.cloud.google.com/apis/credentials?project=datadog-ese-sandbox)
2. Find the OAuth client with ID: `449012790678-o4n20ce420kjuao68mciclp915dlrubj.apps.googleusercontent.com`
3. Click **Edit** (pencil icon)

### Step 2: Add Authorized Redirect URIs

In the "Authorized redirect URIs" section, add **BOTH** of these URIs:

```
https://iap.googleapis.com/v1/oauth/clientIds/449012790678-o4n20ce420kjuao68mciclp915dlrubj.apps.googleusercontent.com:handleRedirect

https://www.platform-engineering-demo.dev/_gcp_gatekeeper/authenticate
```

**Important Notes**:
- URLs are case-sensitive
- No trailing slashes
- Must be exact matches
- Order doesn't matter

### Step 3: Add Authorized JavaScript Origins (Optional but Recommended)

If your application uses AJAX/fetch requests, also add these JavaScript origins:

```
https://www.platform-engineering-demo.dev
https://platform-engineering-demo.dev
```

### Step 4: Save and Wait

1. Click **Save**
2. Wait **2-5 minutes** for the changes to propagate
3. Clear browser cache and cookies (or use incognito mode)

## Testing After Fix

### Test 1: Check for OAuth Redirect

```bash
curl -I https://www.platform-engineering-demo.dev/
```

**Expected**: Should see a redirect to `accounts.google.com` instead of redirecting to itself.

**Before Fix** (wrong):
```
HTTP/2 302
location: https://www.platform-engineering-demo.dev/
```

**After Fix** (correct):
```
HTTP/2 302
location: https://accounts.google.com/o/oauth2/...
```

### Test 2: Browser Test

1. Open **incognito/private** browser window
2. Navigate to: `https://www.platform-engineering-demo.dev`
3. **Expected**: Redirected to Google OAuth login page
4. Login with `@datadoghq.com` email
5. **Expected**: Redirected back to application (successfully loaded)

### Test 3: Verify IAP Headers

After successful login, the application should receive these headers:

```
X-Goog-Authenticated-User-Email: accounts.google.com:user@datadoghq.com
X-Goog-Authenticated-User-Id: accounts.google.com:123456789
X-Goog-IAP-JWT-Assertion: eyJhbGc...
```

Enable debug logging to verify:

```bash
kubectl set env deployment/agent-api LOG_IAP_HEADERS=true -n mcp-agent-prod
kubectl logs -n mcp-agent-prod deployment/agent-api -f | grep "IAP User"
```

## Why This Happens

### IAP Authentication Flow

1. User requests `https://www.platform-engineering-demo.dev/`
2. IAP intercepts the request
3. IAP checks if user has valid cookie
4. No cookie → IAP redirects to Google OAuth
5. User authenticates with Google
6. **Google OAuth redirects back to the redirect URI** ← This is where it fails!
7. IAP validates the OAuth response
8. IAP sets cookie and forwards user to original URL

### Without Proper Redirect URIs

When the redirect URIs are not configured:
- Step 6 fails because Google OAuth doesn't know where to redirect
- IAP falls back to redirecting to the original URL
- This creates a loop: original URL → IAP → Google OAuth → ??? → original URL → ...

### With Proper Redirect URIs

When redirect URIs are configured correctly:
- Step 6 succeeds: Google OAuth → `/_gcp_gatekeeper/authenticate`
- IAP handles the callback, validates the OAuth token
- IAP sets a session cookie
- IAP redirects to the original URL with the cookie
- User accesses the application successfully

## Additional Domains

If you also want to enable IAP for other domains in your HTTPRoute, add redirect URIs for each:

```
https://platform-engineering-demo.dev/_gcp_gatekeeper/authenticate
https://burgers.platform-engineering-demo.dev/_gcp_gatekeeper/authenticate
https://api.platform-engineering-demo.dev/_gcp_gatekeeper/authenticate
https://burger-api.platform-engineering-demo.dev/_gcp_gatekeeper/authenticate
```

## Common Mistakes

### ❌ Wrong: Missing /_gcp_gatekeeper/authenticate

```
https://iap.googleapis.com/v1/oauth/clientIds/CLIENT_ID:handleRedirect
# Missing the gatekeeper URL!
```

### ❌ Wrong: Incorrect domain

```
https://platform-engineering-demo.dev/_gcp_gatekeeper/authenticate  # Wrong: missing www
```

### ❌ Wrong: Trailing slash

```
https://www.platform-engineering-demo.dev/_gcp_gatekeeper/authenticate/  # Wrong: has trailing slash
```

### ✅ Correct: Both URIs

```
https://iap.googleapis.com/v1/oauth/clientIds/449012790678-o4n20ce420kjuao68mciclp915dlrubj.apps.googleusercontent.com:handleRedirect
https://www.platform-engineering-demo.dev/_gcp_gatekeeper/authenticate
```

## Verification Checklist

After configuring the redirect URIs:

- [ ] Both redirect URIs added to OAuth client
- [ ] No typos in URLs (case-sensitive!)
- [ ] No trailing slashes
- [ ] Saved configuration in Google Cloud Console
- [ ] Waited 2-5 minutes for propagation
- [ ] Cleared browser cache/cookies
- [ ] Tested in incognito window
- [ ] Successfully redirected to Google OAuth login
- [ ] Successfully redirected back to application after login
- [ ] IAP headers present in application logs
- [ ] User context showing in Datadog APM traces

## Datadog Monitoring

Once IAP is working, verify in Datadog:

### APM Traces

Search for: `service:agent-api iap.user.email:*`

You should see traces with:
- `iap.user.email: user@datadoghq.com`
- `iap.user.id: 123456789`
- `usr.email: user@datadoghq.com`
- `usr.id: 123456789`

### Create Monitor

Alert if IAP headers are missing:

```
avg(last_5m):sum:trace.express.request{service:agent-api,!iap.user.email:*} > 10
```

## References

- **OAuth Client ID**: `449012790678-o4n20ce420kjuao68mciclp915dlrubj.apps.googleusercontent.com`
- **Project**: `datadog-ese-sandbox`
- **Backend Service**: `gkegw1-yi3w-mcp-agent-prod-agent-webapp-80-4fdj4jjm3trk`
- **Primary Domain**: `www.platform-engineering-demo.dev`

## Support Resources

- [GCP IAP Documentation](https://cloud.google.com/iap/docs)
- [GCP IAP FAQ - Redirect Issues](https://cloud.google.com/iap/docs/faq)
- [OAuth 2.0 Configuration](https://cloud.google.com/iap/docs/custom-oauth-configuration)
- [GCP Gateway API with IAP](https://cloud.google.com/kubernetes-engine/docs/how-to/configure-gateway-resources)

## Summary

The redirect loop is caused by missing the `/_gcp_gatekeeper/authenticate` redirect URI in the OAuth consent screen configuration. This is **required** for IAP to work with GCP Gateway API and URL maps. Adding both the standard IAP redirect URI and the gatekeeper redirect URI will resolve the issue.

**Critical Action**: Add both redirect URIs to the OAuth client in Google Cloud Console.
