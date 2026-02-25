# OIDC Authentication Setup Guide

This guide will help you set up OIDC (OpenID Connect) authentication for the Rental AI Suite application.

## What is OIDC?

OpenID Connect (OIDC) is an authentication layer built on top of OAuth 2.0. It allows users to authenticate using an identity provider (like Google, Auth0, Okta, etc.) instead of managing passwords directly.

## Popular OIDC Providers

### Option 1: Auth0 (Recommended for Quick Setup)

**Free Tier:** 7,000 free monthly active users

1. **Sign up** at [auth0.com](https://auth0.com)
2. **Create an Application:**
   - Go to Applications → Create Application
   - Choose "Regular Web Application"
   - Name it "Rental AI Suite"

3. **Configure Application Settings:**
   - **Allowed Callback URLs:** `http://localhost:5001/api/callback`
   - **Allowed Logout URLs:** `http://localhost:5001`
   - **Allowed Web Origins:** `http://localhost:5001`

4. **Get Your Credentials:**
   - **Domain:** Found in your Auth0 dashboard (e.g., `your-tenant.auth0.com`)
   - **Client ID:** Found in your Application settings
   - **Client Secret:** (Not needed for this setup)

5. **Update `.env` file:**
   ```env
   ISSUER_URL=https://your-tenant.auth0.com/
   CLIENT_ID=your-client-id-here
   ```

### Option 2: Google OAuth 2.0

1. **Go to Google Cloud Console:** [console.cloud.google.com](https://console.cloud.google.com)
2. **Create a Project** (or select existing)
3. **Enable Google+ API:**
   - APIs & Services → Library → Search "Google+ API" → Enable
4. **Create OAuth 2.0 Credentials:**
   - APIs & Services → Credentials → Create Credentials → OAuth client ID
   - Application type: "Web application"
   - **Authorized redirect URIs:** `http://localhost:5001/api/callback`
5. **Get Your Credentials:**
   - **Client ID:** From the credentials page
   - **Issuer URL:** `https://accounts.google.com`

6. **Update `.env` file:**
   ```env
   ISSUER_URL=https://accounts.google.com
   CLIENT_ID=your-google-client-id.apps.googleusercontent.com
   ```

### Option 3: Okta

**Free Tier:** Up to 1,000 monthly active users

1. **Sign up** at [okta.com](https://www.okta.com/free-trial/)
2. **Create an Application:**
   - Applications → Create App Integration
   - Choose "OIDC - OpenID Connect"
   - Choose "Web Application"
3. **Configure Application:**
   - **Sign-in redirect URIs:** `http://localhost:5001/api/callback`
   - **Sign-out redirect URIs:** `http://localhost:5001`
4. **Get Your Credentials:**
   - **Issuer URL:** Found in Settings → General (e.g., `https://dev-xxxxx.okta.com/oauth2/default`)
   - **Client ID:** Found in your Application settings

5. **Update `.env` file:**
   ```env
   ISSUER_URL=https://dev-xxxxx.okta.com/oauth2/default
   CLIENT_ID=your-okta-client-id
   ```

### Option 4: Keycloak (Self-Hosted)

If you want to host your own identity provider:

1. **Install Keycloak:**
   ```bash
   docker run -p 8080:8080 -e KEYCLOAK_ADMIN=admin -e KEYCLOAK_ADMIN_PASSWORD=admin quay.io/keycloak/keycloak:latest start-dev
   ```

2. **Create a Realm and Client:**
   - Access admin console at `http://localhost:8080`
   - Create a realm
   - Create a client with:
     - **Valid Redirect URIs:** `http://localhost:5001/api/callback`
     - **Web Origins:** `http://localhost:5001`

3. **Update `.env` file:**
   ```env
   ISSUER_URL=http://localhost:8080/realms/your-realm
   CLIENT_ID=your-keycloak-client-id
   ```

## Configuration Steps

### 1. Choose Your Provider

Select one of the options above based on your needs:
- **Auth0:** Easiest setup, great free tier
- **Google:** Good if users already have Google accounts
- **Okta:** Enterprise-focused, good free tier
- **Keycloak:** Self-hosted, full control

### 2. Get Your Credentials

After setting up your provider, you'll need:
- **ISSUER_URL:** The OIDC issuer URL (well-known endpoint)
- **CLIENT_ID:** Your application's client identifier

### 3. Update `.env` File

Edit your `.env` file and update:

```env
# OIDC Authentication Configuration
ISSUER_URL=https://your-provider.com/oidc
CLIENT_ID=your-client-id-here
```

### 4. Configure Callback URLs

Make sure your OIDC provider has these URLs configured:

- **Callback URL:** `http://localhost:5001/api/callback` (for development)
- **Logout URL:** `http://localhost:5001` (for development)

For production, update these to your production domain:
- **Callback URL:** `https://yourdomain.com/api/callback`
- **Logout URL:** `https://yourdomain.com`

### 5. Test the Configuration

Start your application:

```bash
npm run dev
```

Visit `http://localhost:5001` and click "Sign In". You should be redirected to your OIDC provider's login page.

## Production Deployment

When deploying to production:

1. **Update Callback URLs** in your OIDC provider to your production domain
2. **Update `.env`** with production URLs:
   ```env
   ISSUER_URL=https://your-provider.com/oidc
   CLIENT_ID=your-production-client-id
   ```
3. **Ensure HTTPS** is enabled (required for OIDC)
4. **Set secure cookies** (already configured in the code)

## Troubleshooting

### Error: "Cannot read property 'discovery' of undefined"

- Check that `ISSUER_URL` is correct and accessible
- Verify the URL format (should end with `/` or `/oidc`)

### Error: "Invalid client_id"

- Verify `CLIENT_ID` matches your OIDC provider configuration
- Check for typos or extra spaces

### Redirect URI Mismatch

- Ensure callback URL in provider matches: `http://localhost:5001/api/callback`
- Check for trailing slashes or protocol mismatches (http vs https)

### Session Issues

- Verify `SESSION_SECRET` is set in `.env`
- Check that database sessions table exists: `npm run db:push`

## Security Notes

- Never commit your `.env` file to version control
- Use different `CLIENT_ID` values for development and production
- Rotate `SESSION_SECRET` regularly in production
- Enable HTTPS in production (required for secure cookies)
