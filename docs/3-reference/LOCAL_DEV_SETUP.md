# Local Development Setup Guide

This document describes how to fix the local development environment so that the DPR.ai app runs fully locally, login works end-to-end, and you can authenticate and navigate the app as a real logged-in user.

## Exact Root Cause of Login Failure

The login failure was due to the email verification flag not being set for the seeded test user. Specifically:

- In `scripts/seed_dev.py`, the test user is created with `email_verified_at=_now()` but the `is_email_verified` column is left at its default value of `False`.
- The login function in `backend/routers/auth_secure.py` (line ~750) checks `if not user.is_email_verified:` and raises a generic login error if the email is not verified.
- As a result, even with correct credentials, the login attempt failed with `{"success":false,"error":{"code":"error","message":"Invalid credentials."}}`.

## Exact Fix Applied

Update the seeded test user to have `is_email_verified = true`. This can be done by either:

1. **Permanent fix**: Edit `scripts/seed_dev.py` and add `is_email_verified=True` to the `User` constructor call (around the line where the user is created). For example:

   ```python
   user = User(
       org_id=org_id,
       user_code=next_user_code(db, org_id=org_id),
       name="Test Owner", email=TEST_EMAIL,
       password_hash=hash_password(TEST_PASSWORD),
       role=UserRole.OWNER, factory_name=TEST_FACTORY,
       factory_code="QA001", phone_number="+919999999999",
       phone_e164="+919999999999", is_active=True,
       email_verified_at=_now(),
       is_email_verified=True,   # <-- Add this line
       auth_provider="local",
   )
   ```

2. **One-time fix**: After seeding, run the following SQL command to update the user:
   ```sql
   UPDATE users SET is_email_verified = 1 WHERE email = 'owner@example.com';
   ```

We applied the one-time fix via the SQLite command line, which resolved the login failure.

## One Command to Start the Full App Locally

To start both the backend and frontend with a fresh seed (recommended for a clean state), run:

```bash
python scripts/start_dev.py --with-frontend --seed
```

This will:
- Seed the database (creating the test user and sample data).
- Start the backend server at `http://127.0.0.1:8765`.
- Start the frontend server at `http://127.0.0.1:3000`.

If the database is already seeded and you just want to start the servers, you can omit `--seed`:

```bash
python scripts/start_dev.py --with-frontend
```

## Seeded Test Credentials for Local Login

- **Email**: `owner@example.com`
- **Password**: `TestOwner@123456`

Use these credentials on the login page at `http://127.0.0.1:3000/access` (or via the "Get started" link on the homepage).

## Limitations of Local Testing

- **OAuth login (Google)**: Cannot be tested locally unless a localhost redirect URI is added in the Google Cloud Console. The redirect URI configured is `http://127.0.0.1:8765/auth/google/callback`. You must add this exact URI to the authorized redirect URIs for your Google OAuth client ID in the Google Cloud Console.
- **Email sending**: SMTP is in dry-run mode (`SMTP_DRY_RUN=1`), so no actual emails are sent. This is fine for local testing; email verification links are logged to the console.
- **OCR functionality**: The OCR provider is set to `anthropic` with a test API key, which will use mock responses. To test with real OCR, you would need to configure a valid Anthropic API key and enable OCR. Tesseract is also available if installed locally.
- **Payments**: Razorpay is not configured (see billing page), so actual payments cannot be processed locally. The billing page shows "Razorpay must be configured before checkout can start."

## Verification

After applying the fix and starting the servers with the command above, you can:

1. Visit `http://127.0.0.1:3000/access`.
2. Log in with the seeded credentials.
3. Verify that the sidebar shows your user context (OWNER, TEST ORGANIZATION, QA Steel Plant).
4. Navigate to authenticated pages such as `/desk`, `/work-queue`, and `/billing` to confirm the session persists.

This confirms that the local development environment is fully functional for end-to-end login and navigation.
