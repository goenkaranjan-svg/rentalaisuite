# Public Launch Security Checklist

## Required Before Public Launch

- Set `NODE_ENV=production`.
- Set strong `SESSION_SECRET` (32+ chars random).
- Ensure `DEV_AUTH_BYPASS` is not `"true"` in production.
- Ensure `DATABASE_URL` is production-grade and encrypted in transit.
- Configure HTTPS at the edge (Vercel/Load Balancer) and force HTTPS redirects.
- Verify session cookies are `Secure`, `HttpOnly`, and `SameSite=Lax` in production.
- Rotate API keys/secrets and store them in environment variables only.
- Disable verbose debug logs in production.

### Optional but Recommended Auth Security Env Vars

- `REQUIRE_EMAIL_VERIFICATION=true`
- `ENABLE_RISK_STEP_UP=true`
- `REQUIRE_CAPTCHA_ON_AUTH=true` (requires gateway/provider integration)
- `AUTH_ALLOW_COUNTRIES=US,CA` (optional allowlist)
- `AUTH_DENY_COUNTRIES=` (optional denylist)
- `SESSION_IDLE_TIMEOUT_MS=1800000` (30m)
- `ENABLE_PASSKEYS=true` (once full WebAuthn ceremony wiring is complete)

### Email Delivery for Auth Tokens

- `AUTH_EMAIL_PROVIDER=resend`
- `RESEND_API_KEY=...`
- `AUTH_EMAIL_FROM="PropMan Security <security@yourdomain.com>"`
- `PUBLIC_APP_URL=https://your-domain.com`

Auth flows now send real emails for:
- Email verification
- Magic-link sign-in
- Password reset
- Account recovery

## Authentication & Access

- Enforce role checks on sensitive routes (manager-only actions).
- Keep login/signup/reset endpoints rate-limited.
- Configure real password reset email delivery (do not expose reset tokens in production responses).
- Enable MFA on identity provider (OIDC/Auth0) for admin/manager users.

## Data Protection

- Enable automated DB backups and verify restore procedure.
- Apply DB migrations in production and lock schema drift.
- Restrict DB network access to app/runtime IPs only.
- Review PII fields and avoid logging user-sensitive payloads.

## App Hardening

- Verify security headers are present:
  - `Strict-Transport-Security`
  - `X-Content-Type-Options`
  - `X-Frame-Options`
  - `Referrer-Policy`
  - `Permissions-Policy`
- Keep request size limits active to reduce abuse risk.
- Keep global API rate limiting and route-level auth throttling active.

## Monitoring & Operations

- Configure uptime monitoring and error alerting (5xx and auth failures).
- Add log retention policy and redaction policy.
- Run a smoke test post-deploy:
  - Auth login/signup/reset
  - Property/lease/payment CRUD
  - Investor STR sync/listing pages
- Verify `/api/security/readiness` reports all checks passing for production.

## Post-Launch

- Schedule dependency security updates.
- Enable periodic secret rotation.
- Run quarterly access review for manager accounts.
