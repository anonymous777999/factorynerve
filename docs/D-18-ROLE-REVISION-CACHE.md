# D-18: Redis-Backed Role Revision Cache

## Status
**Implemented** — July 2026

## Context
The `User` model has a `role_revision` column that tracks role change versions. Previously, an in-memory `dict` with `threading.Lock()` was used to cache this value, but the cache functions were **dead code** — defined in `main.py` but never called from any authorization flow.

## Decision
Replace the in-memory dict cache with the existing `backend.cache` Redis-backed cache layer:

1. **`main.py`**: `_get_cached_role_revision` / `_set_cached_role_revision` now use `get_json(build_cache_key("role_revision", user_id))` / `set_json(...)` from `cache.py`. This provides:
   - Redis persistence when available (survives restarts/deploys)
   - Automatic in-memory fallback when Redis is unavailable
   - Process-level namespace to prevent cross-restart cache pollution

2. **`security.py`**: `get_current_user()` caches `role_revision` after loading the User, using `set_json(build_cache_key("role_revision", user.id), user.role_revision, 300)`.

3. **`pdp.py`**: `require_permission()` performs a freshness check — logs if cached role_revision differs from current (detects external role changes).

## Consequences
- **Positive**: Cache survives server restarts (Redis); dead code is now wired into auth flow
- **Positive**: Automatic fallback to in-memory when Redis is unavailable
- **Negative**: Hardcoded TTL of 300s in `security.py` (minor consistency issue with `main.py`'s `_ROLE_REVISION_CACHE_TTL`)
