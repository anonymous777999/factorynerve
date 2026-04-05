# Cookie-Based JWT Auth (Web Frontend)

The backend now supports **optional** cookie-based JWT auth for the new web frontend.
Existing Streamlit clients continue using `Authorization: Bearer <token>` unchanged.

## How to Enable Cookies
Send one of these on auth calls:

- Header: `X-Use-Cookies: 1`
- Query: `?use_cookies=1`

On success, the API sets:

- `JWT_ACCESS_COOKIE` (HttpOnly)
- `JWT_REFRESH_COOKIE` (HttpOnly)
- `JWT_CSRF_COOKIE` (readable by JS)

The response also includes `X-CSRF-Token` for convenience.

## CSRF Rules
If a request uses cookies (no `Authorization` header), then **POST/PUT/PATCH/DELETE**
must include `X-CSRF-Token` matching the `JWT_CSRF_COOKIE`.

## Refresh Flow
`POST /auth/refresh` works with:

- JSON body: `{ "refresh_token": "..." }` (legacy)
- Cookie: `JWT_REFRESH_COOKIE` (web frontend)

When cookie refresh is used, new cookies are set automatically.

## Environment Variables
See `.env.example` for `JWT_*` cookie settings.

