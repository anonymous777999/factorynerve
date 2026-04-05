# Auth Email Setup

This file is the practical setup guide for making these flows send real mail:

- register email verification
- resend verification
- forgot password

## Current Reality

The current local `.env` does **not** have SMTP configured, so the app cannot send real inbox mail yet.

Because of that:

- register verification will stay in preview/local-link mode
- forgot password will stay in preview/local-link mode

## Required Environment Variables

For a real deployed environment, add these to `.env`:

```env
APP_ENV=production

SMTP_HOST=your-smtp-host
SMTP_PORT=587
SMTP_USER=your-smtp-username
SMTP_PASSWORD=your-smtp-password
SMTP_FROM=no-reply@yourdomain.com
SMTP_USE_TLS=true
SMTP_USE_SSL=false
SMTP_DRY_RUN=false

EMAIL_VERIFICATION_BASE_URL=http://127.0.0.1:3000/verify-email?token=
EMAIL_VERIFICATION_EXPOSE_LINK=false
EMAIL_VERIFICATION_EMAIL_SUBJECT=Verify your DPR.ai email

PASSWORD_RESET_BASE_URL=http://127.0.0.1:3000/reset-password?token=
PASSWORD_RESET_EXPOSE_LINK=false
PASSWORD_RESET_EMAIL_SUBJECT=Reset your DPR.ai password
```

## Local Testing Note

Do **not** switch local development to `APP_ENV=production` if you are still using SQLite.
This project blocks SQLite in production mode.

For local inbox testing, keep your normal local setup and force real email mode with:

```env
EMAIL_VERIFICATION_EXPOSE_LINK=false
PASSWORD_RESET_EXPOSE_LINK=false
```

That lets you test real inbox delivery locally without pretending the entire backend is running in production.

## Recommended Provider

For a real production-style setup, the best recommendation here is **Resend**.

Why:

- simpler than Gmail for app mail
- better for transactional auth flows
- cleaner deliverability setup
- good fit for verify-email and password-reset flows

Important official Resend rules:

- SMTP host is `smtp.resend.com`
- SMTP username is `resend`
- SMTP password is your Resend API key
- to send to arbitrary real recipients, you must verify your own domain
- the default `onboarding@resend.dev` sender is testing-only and can only send to your own account email

Sources:

- https://resend.com/docs/send-with-smtp
- https://resend.com/docs/knowledge-base/403-error-resend-dev-domain
- https://resend.com/docs/knowledge-base/how-do-I-create-an-email-address-or-sender-in-resend
- https://resend.com/docs/dashboard/domains/introduction

## Provider Presets

### Gmail

Use an App Password, not your normal Gmail password.

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=yourgmail@gmail.com
SMTP_PASSWORD=your-16-char-app-password
SMTP_FROM=yourgmail@gmail.com
SMTP_USE_TLS=true
SMTP_USE_SSL=false
```

### Zoho

Use your Zoho mailbox SMTP credentials.

India region usually:

```env
SMTP_HOST=smtp.zoho.in
SMTP_PORT=587
SMTP_USER=you@yourdomain.com
SMTP_PASSWORD=your-zoho-password-or-app-password
SMTP_FROM=you@yourdomain.com
SMTP_USE_TLS=true
SMTP_USE_SSL=false
```

Global region often:

```env
SMTP_HOST=smtp.zoho.com
```

### Resend SMTP

Use the SMTP credentials from Resend.

Official SMTP settings:

- Host: `smtp.resend.com`
- Username: `resend`
- Ports: `465` for implicit SSL/TLS, or `587` for STARTTLS
- Resend recommends `465` if you are unsure which port to use

Important:

- `SMTP_PASSWORD` must be your Resend API key
- `SMTP_FROM` must use your verified domain
- if you use `onboarding@resend.dev`, Resend only allows sending to your own account email for testing

```env
SMTP_HOST=smtp.resend.com
SMTP_PORT=465
SMTP_USER=resend
SMTP_PASSWORD=re_your_resend_api_key
SMTP_FROM=no-reply@yourdomain.com
SMTP_USE_TLS=false
SMTP_USE_SSL=true
```

## Smoke Test Command

After saving `.env`, run:

```powershell
python scripts/test_auth_email.py --to yourinbox@example.com --kind verification
```

For password reset:

```powershell
python scripts/test_auth_email.py --to yourinbox@example.com --kind reset
```

The script will:

- validate SMTP config
- send a real auth email
- print whether it was sent
- print the generated verification/reset link

## End-to-End Manual Test

1. Start backend and web app
2. Register with a real inbox
3. Open the verification email
4. Click the `/verify-email` link
5. Confirm the app shows success
6. Log in with the same account
7. Open `Forgot password`
8. Request reset
9. Open reset email
10. Reset password and log in again

## Success Criteria

Real auth email is working when all of these are true:

- register does not expose preview link in UI
- inbox receives verification email
- `/verify-email` confirms successfully
- login is blocked before verification and allowed after verification
- forgot-password sends real inbox mail
- reset link works once and cannot be reused
