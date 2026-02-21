# Auth0 Setup - Alternative Instructions

If you don't see "Regular Web Application" option, here are alternatives:

## Option 1: Use "Single Page Application" Type

Even though your app has a backend, Auth0's "Single Page Application" type works fine for this setup:

1. **Create Application:**
   - Applications → Create Application
   - Name: `Rental AI Suite`
   - **Type: Single Page Application** ← Choose this
   - Click **Create**

2. **Configure Settings:**
   - Scroll to **Application URIs**
   - **Allowed Callback URLs:** `http://localhost:5000/api/callback`
   - **Allowed Logout URLs:** `http://localhost:5000`
   - **Allowed Web Origins:** `http://localhost:5000`
   - Click **Save Changes**

3. **Get Credentials:**
   - Copy **Domain** (e.g., `your-tenant.us.auth0.com`)
   - Copy **Client ID**

4. **Update `.env`:**
   ```env
   ISSUER_URL=https://your-tenant.us.auth0.com/
   CLIENT_ID=your-client-id-here
   ```

## Option 2: Use "Native" Type (if available)

1. **Create Application:**
   - Type: **Native**
   - Configure the same callback URLs as above

## Option 3: Manual Configuration

If you've already created an application:

1. Go to your application settings
2. Scroll to **Application URIs** section
3. Add these URLs:
   - **Allowed Callback URLs:** `http://localhost:5000/api/callback`
   - **Allowed Logout URLs:** `http://localhost:5000`
   - **Allowed Web Origins:** `http://localhost:5000`
4. Make sure **OIDC Conformant** is enabled (usually is by default)
5. Save changes

## What Application Type Should I Use?

For this application (Express.js backend with React frontend), any of these work:
- ✅ **Single Page Application** - Recommended if "Regular Web Application" isn't available
- ✅ **Native** - Also works fine
- ✅ **Regular Web Application** - Best if available
- ❌ **Machine to Machine** - Don't use this (for API-to-API auth)

The key is configuring the callback URLs correctly, not the application type.

## Still Having Issues?

If Auth0's interface looks different:
1. Look for any option that mentions "Web" or "Application"
2. Avoid "API" or "Machine to Machine" types
3. The callback URL configuration is more important than the type
