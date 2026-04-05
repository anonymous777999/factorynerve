# Phase 1 - Initial Migration (Manual Step)

Alembic is now scaffolded but not yet run in this environment.

## Quick start (Windows)
1. Install deps:
   pip install -r requirements.txt
2. Generate initial migration:
   powershell -ExecutionPolicy Bypass -File scripts/init_migration.ps1

## Quick start (Linux/Mac)
1. Install deps:
   pip install -r requirements.txt
2. Generate initial migration:
   bash scripts/init_migration.sh

## Notes
- This will create a new revision in `alembic/versions/`.
- For a clean database, you can point DATABASE_URL to a local SQLite file or your Postgres instance.
- After migration is generated, run `alembic upgrade head`.
- If you are upgrading an older database (pre-Alembic), run `python scripts/legacy_schema_patch.py` once.
- To pin dependencies, run `scripts/pin_requirements.ps1` (Windows) or `scripts/pin_requirements.sh` (Linux/Mac).
