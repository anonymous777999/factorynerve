# API Response Envelope (Optional)

This project supports an **optional** JSON response envelope for consistent API handling.
It is **opt-in**, so existing Streamlit clients are unaffected.

## How to Enable
Send one of the following:

- Header: `X-Response-Envelope: v1`
- Query param: `?envelope=1`

If enabled, JSON responses are wrapped in a consistent shape.
Non-JSON responses (PDF/Excel downloads) are **not** wrapped.

## Envelope Format

```json
{
  "ok": true,
  "status": 200,
  "data": { },
  "error": null,
  "request_id": "uuid-string"
}
```

### Error Example

```json
{
  "ok": false,
  "status": 403,
  "data": null,
  "error": {
    "detail": "Access denied."
  },
  "request_id": "uuid-string"
}
```

## Notes
- `request_id` matches the `X-Request-ID` response header.
- This is designed for the new web frontend and AI-assisted client codegen.
- Existing clients can continue using the raw responses without change.

