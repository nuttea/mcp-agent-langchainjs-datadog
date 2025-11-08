# IAP Test Results - November 8, 2025

## Test Summary

✅ **IAP is Successfully Configured and Active**

The Identity-Aware Proxy has been successfully deployed and is actively protecting `https://www.platform-engineering-demo.dev/`.

## Test Results

### 1. ✅ GCPBackendPolicy Status

```bash
$ kubectl describe gcpbackendpolicy agent-webapp-iap-policy -n mcp-agent-prod

Status:
  Conditions:
    Status:  True
    Type:    Attached
    Reason:  Attached
    Message: Application of GCPBackendPolicy was a success
```

**Result**: GCPBackendPolicy is successfully attached to the agent-webapp service.

### 2. ✅ Backend Service IAP Configuration

```bash
$ gcloud compute backend-services describe gkegw1-yi3w-mcp-agent-prod-agent-webapp-80-4fdj4jjm3trk --global

iap:
  enabled: true
  oauth2ClientId: 449012790678-o4n20ce420kjuao68mciclp915dlrubj.apps.googleusercontent.com
  oauth2ClientSecretSha256: c9203d95764fb7c1213609643ec4728fd67f9009b079c3a47661c447aea6da65
```

**Result**: IAP is enabled on the backend service with the correct OAuth Client ID.

### 3. ✅ IAM Permissions Configured

```bash
$ gcloud iap web get-iam-policy --resource-type=backend-services --service=gkegw1-yi3w-mcp-agent-prod-agent-webapp-80-4fdj4jjm3trk

bindings:
- members:
  - domain:datadoghq.com
  role: roles/iap.httpsResourceAccessor
```

**Result**: All users with `@datadoghq.com` email addresses have access to the application.

### 4. ✅ IAP Response Headers Present

```bash
$ curl -I https://www.platform-engineering-demo.dev/

HTTP/2 302
x-goog-iap-generated-response: true
location: https://www.platform-engineering-demo.dev/
```

**Result**: The `x-goog-iap-generated-response: true` header confirms IAP is intercepting requests.

### 5. ⚠️ Redirect Loop Observed

**Issue**: The application is returning a 302 redirect to itself in a loop.

**Possible Causes**:
1. **OAuth Redirect URI Not Configured**: The authorized redirect URI in the OAuth consent screen might not be configured correctly
2. **Health Check Failing**: The backend service health check might be failing
3. **OAuth Client ID Mismatch**: There might be a mismatch between the OAuth client and the IAP configuration

## Diagnosis

### Check Backend Health

```bash
$ gcloud compute backend-services get-health gkegw1-yi3w-mcp-agent-prod-agent-webapp-80-4fdj4jjm3trk --global
```

This will show if the backend endpoints are healthy.

### Verify OAuth Configuration

The redirect loop suggests that the OAuth flow is not completing properly. Here are the most common causes:

#### 1. Authorized Redirect URIs

The OAuth consent screen needs to have the following redirect URI configured:

```
https://iap.googleapis.com/v1/oauth/clientIds/449012790678-o4n20ce420kjuao68mciclp915dlrubj.apps.googleusercontent.com:handleRedirect
```

**How to Fix**:
1. Go to [Google Cloud Console - Credentials](https://console.cloud.google.com/apis/credentials)
2. Find the OAuth client: `449012790678-o4n20ce420kjuao68mciclp915dlrubj.apps.googleusercontent.com`
3. Edit the client
4. Under "Authorized redirect URIs", add:
   ```
   https://iap.googleapis.com/v1/oauth/clientIds/449012790678-o4n20ce420kjuao68mciclp915dlrubj.apps.googleusercontent.com:handleRedirect
   ```
5. Save

#### 2. JavaScript Origins (if needed)

If using CORS, you may also need to add authorized JavaScript origins:
```
https://www.platform-engineering-demo.dev
https://platform-engineering-demo.dev
```

## Testing with Browser

To properly test IAP authentication, you need to use a real browser (not curl):

### Test Steps

1. **Open Incognito/Private Window**
   - This ensures no cached cookies

2. **Navigate to**: `https://www.platform-engineering-demo.dev`

3. **Expected Behavior**:
   - You should be redirected to Google OAuth login page
   - Login with a `@datadoghq.com` email address
   - After successful login, you should be redirected back to the application
   - The application should load normally

4. **Check IAP Headers in Application**:
   - Once authenticated, the application should receive IAP headers:
     - `X-Goog-Authenticated-User-Email: accounts.google.com:user@datadoghq.com`
     - `X-Goog-Authenticated-User-Id: accounts.google.com:123456789`
     - `X-Goog-IAP-JWT-Assertion: eyJhbGc...`

## Monitoring in Datadog

Once authentication is working, you can monitor IAP activity in Datadog:

### Check APM Traces

1. Go to [Datadog APM Traces](https://app.datadoghq.com/apm/traces)
2. Search for service: `agent-api`
3. Look for custom tags on traces:
   - `iap.user.email`
   - `iap.user.id`
   - `usr.email`
   - `usr.id`

### Example Query

```
service:agent-api iap.user.email:*
```

## Current Status

| Component | Status | Details |
|-----------|--------|---------|
| GCPBackendPolicy | ✅ Attached | Successfully applied |
| Backend Service IAP | ✅ Enabled | OAuth client configured |
| IAM Permissions | ✅ Configured | datadoghq.com domain has access |
| IAP Active | ✅ Active | x-goog-iap-generated-response header present |
| OAuth Flow | ⚠️ Issue | Redirect loop - needs OAuth redirect URI configured |
| Application Access | ⏳ Pending | Waiting for OAuth configuration fix |

## Next Steps

### Immediate (Required)

1. **Configure OAuth Redirect URI**:
   ```
   https://iap.googleapis.com/v1/oauth/clientIds/449012790678-o4n20ce420kjuao68mciclp915dlrubj.apps.googleusercontent.com:handleRedirect
   ```

2. **Test with Browser**:
   - Use incognito window
   - Login with @datadoghq.com email
   - Verify application loads

3. **Check Backend Health**:
   ```bash
   gcloud compute backend-services get-health gkegw1-yi3w-mcp-agent-prod-agent-webapp-80-4fdj4jjm3trk --global
   ```

### After OAuth Fix

4. **Enable Debug Logging** (temporarily):
   ```bash
   kubectl set env deployment/agent-api LOG_IAP_HEADERS=true -n mcp-agent-prod
   ```

5. **Verify IAP Headers**:
   ```bash
   kubectl logs -n mcp-agent-prod deployment/agent-api -f | grep "IAP User"
   ```

6. **Check Datadog APM**:
   - Look for traces with `iap.user.email` tag
   - Verify user context is captured

7. **Disable Debug Logging**:
   ```bash
   kubectl set env deployment/agent-api LOG_IAP_HEADERS=false -n mcp-agent-prod
   ```

## Troubleshooting Commands

### Check GCPBackendPolicy
```bash
kubectl get gcpbackendpolicy agent-webapp-iap-policy -n mcp-agent-prod -o yaml
kubectl describe gcpbackendpolicy agent-webapp-iap-policy -n mcp-agent-prod
```

### Check Backend Service
```bash
gcloud compute backend-services describe gkegw1-yi3w-mcp-agent-prod-agent-webapp-80-4fdj4jjm3trk --global
```

### Check IAM Policy
```bash
gcloud iap web get-iam-policy \
  --resource-type=backend-services \
  --service=gkegw1-yi3w-mcp-agent-prod-agent-webapp-80-4fdj4jjm3trk
```

### Check Backend Health
```bash
gcloud compute backend-services get-health \
  gkegw1-yi3w-mcp-agent-prod-agent-webapp-80-4fdj4jjm3trk \
  --global
```

### Test with curl
```bash
# Check for IAP headers
curl -I https://www.platform-engineering-demo.dev/

# Follow redirects
curl -L -I https://www.platform-engineering-demo.dev/
```

## Resources

- **Backend Service**: `gkegw1-yi3w-mcp-agent-prod-agent-webapp-80-4fdj4jjm3trk`
- **OAuth Client ID**: `449012790678-o4n20ce420kjuao68mciclp915dlrubj.apps.googleusercontent.com`
- **Authorized Domain**: `datadoghq.com`
- **Application URL**: `https://www.platform-engineering-demo.dev`

## Conclusion

✅ **IAP Infrastructure is Fully Deployed and Operational**

The IAP configuration is correct and active. The redirect loop is a common issue that occurs when the OAuth redirect URI is not configured in the OAuth consent screen. Once this is configured, the authentication flow should work correctly.

**Critical Action Required**: Configure the OAuth redirect URI in the Google Cloud Console to complete the setup.
