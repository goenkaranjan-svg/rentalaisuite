# Quick OIDC Setup Guide

## Fastest Option: Auth0 (5 minutes)

### Step 1: Create Auth0 Account
1. Go to [auth0.com](https://auth0.com) and sign up (free)
2. Choose "Developer" account type

### Step 2: Create Application
1. In Auth0 Dashboard, go to **Applications** → **Applications**
2. Click **Create Application**
3. Name: `Rental AI Suite`
4. Type: **Regular Web Application**
5. Click **Create**

### Step 3: Configure Application
1. Scroll to **Application URIs** section
2. **Allowed Callback URLs:** Add:
   ```
   http://localhost:5000/api/callback
   ```
3. **Allowed Logout URLs:** Add:
   ```
   http://localhost:5000
   ```
4. **Allowed Web Origins:** Add:
   ```
   http://localhost:5000
   ```
5. Click **Save Changes**

### Step 4: Get Your Credentials
1. Copy your **Domain** (looks like: `your-tenant.us.auth0.com`)
2. Copy your **Client ID** (found in the same page)

### Step 5: Update `.env` File

Edit your `.env` file:

```env
ISSUER_URL=https://your-tenant.us.auth0.com/
CLIENT_ID=your-client-id-from-auth0
```

**Important:** 
- The `ISSUER_URL` should end with `/` (trailing slash)
- Replace `your-tenant` with your actual Auth0 tenant name
- Replace `your-client-id-from-auth0` with your actual Client ID

### Step 6: Test It!

```bash
npm run dev
```

Visit `http://localhost:5000` and click "Sign In" - you should be redirected to Auth0!

---

## Alternative: Google OAuth (Also Quick)

### Step 1: Google Cloud Console
1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create or select a project

### Step 2: Enable APIs
1. Go to **APIs & Services** → **Library**
2. Search for "Google+ API" and enable it

### Step 3: Create OAuth Credentials
1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth client ID**
3. If prompted, configure OAuth consent screen first
4. Application type: **Web application**
5. **Authorized redirect URIs:** Add `http://localhost:5000/api/callback`
6. Click **Create**
7. Copy your **Client ID**

### Step 4: Update `.env` File

```env
ISSUER_URL=https://accounts.google.com
CLIENT_ID=your-google-client-id.apps.googleusercontent.com
```

### Step 5: Test It!

```bash
npm run dev
```

---

## Need Help?

- Check `OIDC_SETUP.md` for detailed instructions
- Verify your callback URL matches exactly: `http://localhost:5000/api/callback`
- Make sure `.env` file has no extra spaces or quotes
- Check terminal for error messages

## Production Setup

When deploying:
1. Update callback URLs in your OIDC provider to your production domain
2. Use HTTPS (required for secure cookies)
3. Update `.env` with production URLs
