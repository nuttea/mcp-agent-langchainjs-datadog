# IAP Redirect Loop - Quick Fix (2 Minutes)

## 🔴 Problem
Redirect loop when accessing `https://www.platform-engineering-demo.dev/`

## ✅ Solution
Add missing OAuth redirect URIs

## 🚀 Quick Fix Steps

### 1. Open OAuth Client (30 seconds)

Go to: https://console.cloud.google.com/apis/credentials?project=datadog-ese-sandbox

Find OAuth client: `449012790678-o4n20ce420kjuao68mciclp915dlrubj.apps.googleusercontent.com`

Click **Edit** (pencil icon)

### 2. Add Redirect URIs (60 seconds)

In the "Authorized redirect URIs" section, add these **TWO** URLs:

```
https://iap.googleapis.com/v1/oauth/clientIds/449012790678-o4n20ce420kjuao68mciclp915dlrubj.apps.googleusercontent.com:handleRedirect
```

```
https://www.platform-engineering-demo.dev/_gcp_gatekeeper/authenticate
```

**⚠️ Important**:
- Copy-paste exactly (case-sensitive!)
- No trailing slashes
- Both URLs are required

### 3. Save (5 seconds)

Click **Save** button

### 4. Wait & Test (2-5 minutes)

Wait 2-5 minutes for propagation

Then test in **incognito window**:
1. Go to: `https://www.platform-engineering-demo.dev`
2. Should redirect to Google OAuth login
3. Login with `@datadoghq.com` email
4. Should redirect back to working application

## ✅ Success Indicators

- Redirected to `accounts.google.com` (not looping to itself)
- Can login with Google account
- Application loads successfully
- No more 302 loops

## 📝 Why This Fixes It

The `/_gcp_gatekeeper/authenticate` URL is where Google OAuth redirects users after authentication. Without this URL in the authorized list, Google OAuth doesn't know where to send users back, causing the redirect loop.

## 🔍 Detailed Explanation

See: [IAP-REDIRECT-LOOP-TROUBLESHOOTING.md](IAP-REDIRECT-LOOP-TROUBLESHOOTING.md)

---

**That's it!** Just add those 2 redirect URIs and IAP will work. 🎉
