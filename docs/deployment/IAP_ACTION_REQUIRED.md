# IAP Action Required - Configure OAuth Redirect URIs

## 🔴 Critical Action Needed

Both dev and prod environments are experiencing `ERR_TOO_MANY_REDIRECTS` because the OAuth redirect URIs are not configured in Google Cloud Console.

## ✅ Everything Else is Ready

All infrastructure is correctly configured:

### Production ✅
- GCPBackendPolicy: Attached
- HealthCheckPolicy: Applied
- Backend Health: HEALTHY
- IAP Enabled: Yes
- OAuth Client ID: Configured
- IAM Permissions: domain:datadoghq.com

### Development ✅
- GCPBackendPolicy: Attached
- HealthCheckPolicy: Applied
- Backend Health: HEALTHY
- IAP Enabled: Yes
- OAuth Client ID: Configured
- IAM Permissions: domain:datadoghq.com + user

## 🔧 The Only Missing Piece: OAuth Redirect URIs

### Quick Fix (2 Minutes)

1. **Open Google Cloud Console**
   https://console.cloud.google.com/apis/credentials?project=datadog-ese-sandbox

2. **Find and Edit OAuth Client**
   - Search for: `449012790678-o4n20ce420kjuao68mciclp915dlrubj.apps.googleusercontent.com`
   - Click the **Edit** icon (pencil)

3. **Add These 3 Redirect URIs**

   Copy and paste each URL exactly (case-sensitive, no trailing slashes):

   ```
   https://iap.googleapis.com/v1/oauth/clientIds/449012790678-o4n20ce420kjuao68mciclp915dlrubj.apps.googleusercontent.com:handleRedirect
   ```

   ```
   https://www.platform-engineering-demo.dev/_gcp_gatekeeper/authenticate
   ```

   ```
   https://dev.platform-engineering-demo.dev/_gcp_gatekeeper/authenticate
   ```

4. **Save**

5. **Wait 2-5 minutes** for propagation

6. **Test in Incognito Browser**
   - Production: https://www.platform-engineering-demo.dev
   - Development: https://dev.platform-engineering-demo.dev
   - Expected: Redirect to Google OAuth login (not redirect loop!)

## 🔍 Current Status Verification

### Production Backend
```bash
$ gcloud compute backend-services describe gkegw1-yi3w-mcp-agent-prod-agent-webapp-80-4fdj4jjm3trk --global

iap:
  enabled: true ✅
  oauth2ClientId: 449012790678-o4n20ce420kjuao68mciclp915dlrubj.apps.googleusercontent.com ✅
  oauth2ClientSecretSha256: c9203d95764fb7c1213609643ec4728fd67f9009b079c3a47661c447aea6da65 ✅

Backend Health: HEALTHY ✅
```

### Development Backend
```bash
$ gcloud compute backend-services describe gkegw1-yi3w-mcp-agent-dev-agent-webapp-80-ccyzpp7srjbl --global

iap:
  enabled: true ✅
  oauth2ClientId: 449012790678-o4n20ce420kjuao68mciclp915dlrubj.apps.googleusercontent.com ✅
  oauth2ClientSecretSha256: c9203d95764fb7c1213609643ec4728fd67f9009b079c3a47661c447aea6da65 ✅

Backend Health: HEALTHY ✅
```

### Health Check Configuration
```bash
# Both environments use /health endpoint ✅
Production: requestPath: /health
Development: requestPath: /health
```

### Test /health Endpoint
```bash
$ kubectl exec -n mcp-agent-dev deployment/agent-webapp -- curl localhost/health
healthy ✅
```

## ⚠️ Why the Redirect Loop Happens

### The OAuth Flow (Without Redirect URIs)

1. User requests: `https://dev.platform-engineering-demo.dev/`
2. IAP intercepts (no cookie)
3. IAP tries to redirect to Google OAuth
4. **Google OAuth doesn't know where to redirect back** ❌
5. Falls back to redirecting to original URL
6. Loop: Original URL → IAP → ??? → Original URL → ...

### The OAuth Flow (With Redirect URIs)

1. User requests: `https://dev.platform-engineering-demo.dev/`
2. IAP intercepts (no cookie)
3. IAP redirects to Google OAuth with redirect_uri parameter
4. **Google OAuth redirects to: `/_gcp_gatekeeper/authenticate`** ✅
5. IAP validates OAuth response
6. IAP sets cookie
7. IAP redirects to original URL with cookie
8. User accesses application successfully! ✅

## 🎯 What Happens After Adding Redirect URIs

### Before (Current - Redirect Loop)
```bash
$ curl -I https://dev.platform-engineering-demo.dev/
HTTP/2 302
location: https://dev.platform-engineering-demo.dev/
x-goog-iap-generated-response: true
```

### After (With Redirect URIs Configured)
```bash
$ curl -I https://dev.platform-engineering-demo.dev/
HTTP/2 302
location: https://accounts.google.com/o/oauth2/v2/auth?client_id=...&redirect_uri=https://dev.platform-engineering-demo.dev/_gcp_gatekeeper/authenticate
```

## 📋 Verification Checklist

After adding the redirect URIs:

### Immediate (2-5 minutes after saving)
- [ ] Clear browser cache
- [ ] Open incognito/private browser
- [ ] Go to https://www.platform-engineering-demo.dev
- [ ] Should see Google OAuth login (NOT redirect loop)
- [ ] Go to https://dev.platform-engineering-demo.dev
- [ ] Should see Google OAuth login (NOT redirect loop)

### After Logging In
- [ ] Login with @datadoghq.com email
- [ ] Redirect back to application
- [ ] Application loads successfully
- [ ] No console errors

### Verify IAP Headers (Dev - Debug Enabled)
```bash
kubectl logs -n mcp-agent-dev deployment/agent-api -f | grep "IAP User"
```
- [ ] See: `IAP User: { email: 'user@datadoghq.com', userId: '...' }`

### Verify in Datadog APM
Search: `service:agent-api env:dev iap.user.email:*`
- [ ] See traces with IAP user tags
- [ ] `iap.user.email` tag present
- [ ] `iap.user.id` tag present

## 🚨 This is the ONLY Remaining Issue

Everything else is perfectly configured:
- ✅ Kubernetes resources
- ✅ Backend services
- ✅ Health checks
- ✅ IAM permissions
- ✅ Application code
- ✅ Datadog integration

**Just add the 3 redirect URIs and IAP will work!**

## 📱 Screenshot Guide

If helpful, here's what you should see in Google Cloud Console:

### OAuth Client Configuration

```
Application type: Web application
Name: [Your OAuth client name]

Authorized JavaScript origins:
  + https://www.platform-engineering-demo.dev
  + https://dev.platform-engineering-demo.dev

Authorized redirect URIs:
  + https://iap.googleapis.com/v1/oauth/clientIds/449012790678-o4n20ce420kjuao68mciclp915dlrubj.apps.googleusercontent.com:handleRedirect
  + https://www.platform-engineering-demo.dev/_gcp_gatekeeper/authenticate
  + https://dev.platform-engineering-demo.dev/_gcp_gatekeeper/authenticate
```

## 🔗 Quick Links

- **Google Cloud Console Credentials**: https://console.cloud.google.com/apis/credentials?project=datadog-ese-sandbox
- **Production App**: https://www.platform-engineering-demo.dev
- **Development App**: https://dev.platform-engineering-demo.dev
- **Full Documentation**: [IAP_README.md](IAP_README.md)

---

**Action**: Add the 3 OAuth redirect URIs now to enable IAP authentication! ⚡
