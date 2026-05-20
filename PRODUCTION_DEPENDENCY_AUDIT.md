# Production Dependency Stabilization Audit: DPR.ai

## 1. Executive Summary

The current dependency management for DPR.ai is **nondeterministic**, posing a high risk to production stability. Almost all dependencies in `requirements.txt` are floating (unpinned), meaning every deployment could potentially pull different versions of both direct and transitive dependencies. This "dependency drift" is a leading cause of "it works on my machine" failures and unexpected production outages.

## 2. Identified Risks

| Risk Category | Severity | Description |
| :--- | :--- | :--- |
| **Floating Versions** | CRITICAL | Direct dependencies (FastAPI, Anthropic, etc.) are unpinned. New releases of these packages could break the application without warning. |
| **Transitive Drift** | CRITICAL | Sub-dependencies (e.g., `pydantic-core`, `starlette`) are unpinned. These often move faster than main packages and can introduce subtle bugs. |
| **Nondeterminism** | HIGH | The Docker build process pulls the "latest" version of everything on every build, making rollback and debugging extremely difficult. |
| **Python 3.12 Compatibility** | MEDIUM | `python-jose` and `passlib` are unmaintained. While currently working, they use deprecated APIs that may break in future Python minor releases. |
| **SDK Gaps** | HIGH | `razorpay` is listed as `1.4.2` in requirements but was missing from the audit environment. This suggests the current requirement file is out of sync with actual runtime needs. |
| **Dev Dependencies** | LOW | `google-auth` was found to be running a `.dev0` version in the audit environment, which is unsuitable for production. |

## 3. Recommended Dependency Corrections (requirements.txt)

The following versions are recommended for **hard pinning**. These reflect the current stable environment state validated during the audit.

```text
# --- CORE INFRASTRUCTURE ---
fastapi==0.135.2
uvicorn==0.41.0
starlette==1.0.0
pydantic==2.12.5
pydantic_core==2.41.5

# --- DATABASE & MIGRATIONS ---
SQLAlchemy==2.0.48
alembic==1.18.4
psycopg2-binary==2.9.11
redis==7.4.0
fakeredis==2.35.1

# --- AI & LLM PROVIDERS ---
anthropic==0.84.0
groq==1.0.0
google-generativeai==0.8.6
openai==2.24.0
google-auth==2.35.0

# --- SECURITY & AUTH ---
python-jose==3.5.0
passlib[argon2]==1.7.4
argon2-cffi==25.1.0
bcrypt==5.0.0
cryptography==46.0.5
python-multipart==0.0.22
PyJWT==2.12.1
pyotp==2.9.0
itsdangerous==2.2.0

# --- COMMUNICATION & UTILS ---
twilio==9.10.4
python-dotenv==1.2.2
requests==2.32.5
httpx==0.28.1
structlog==25.5.0
email-validator==2.3.0
phonenumbers==9.0.28

# --- DATA PROCESSING & OCR ---
pandas==2.3.3
numpy==2.4.2
openpyxl==3.1.5
Pillow==12.1.1
reportlab==4.4.10
plotly==6.6.0
pytesseract==0.3.13
opencv-python-headless==4.13.0.92

# --- BILLING (PINNED HARD) ---
razorpay==1.4.2

# --- TELEMETRY & TESTING ---
sentry-sdk==2.56.0
pytest==9.0.2

# --- SYSTEM ---
setuptools==75.1.0
qrcode[pil]==8.2
```

## 4. Dockerfile Hardening

The Dockerfile should be modified to use specific image digests and ensure `pip` itself is pinned to avoid resolver changes.

```dockerfile
# Use specific digest for absolute determinism (Python 3.12.7-slim)
FROM python:3.12-slim@sha256:d878fd831622383822f360773f8476a60e0a969b4c023d8cf634e2c88f28c506

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PYTHONPATH=/app \
    PORT=10000

WORKDIR /app

# Install system dependencies with fixed versions where possible
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    tesseract-ocr \
    tesseract-ocr-eng \
    tesseract-ocr-hin \
    tesseract-ocr-mar \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./requirements.txt

# Pin pip version to 24.x for stable resolving
RUN python -m pip install --upgrade pip==24.3.1 && \
    pip install --no-deps -r requirements.txt

# Verify installation (Optional but recommended for stability)
RUN python -c "import fastapi; import sqlalchemy; import razorpay"

COPY alembic ./alembic
COPY alembic.ini ./alembic.ini
COPY backend ./backend
COPY scripts ./scripts
COPY README.md ./README.md
COPY PROJECT_CONTEXT.md ./PROJECT_CONTEXT.md

RUN mkdir -p /app/logs /app/exports/failed_payloads

CMD ["python", "scripts/render_start.py"]
```

## 5. Dependency Governance Strategy

1.  **Freeze-and-Lock:** Adopt a "Lockfile" approach. Use `pip-compile` (from `pip-tools`) to generate a `requirements.txt` from a high-level `requirements.in`. This separates your *intent* (direct dependencies) from the *reality* (transitive dependencies).
2.  **Audit Cycles:** Run a dependency vulnerability scan (e.g., `pip-audit`) once a month.
3.  **Cautious Modernization:** Plan a migration from `python-jose` to `PyJWT` and `passlib` to direct `argon2-cffi` usage in the next major release, as these packages are nearing end-of-life compatibility.
4.  **Razorpay Stability:** Keep `razorpay==1.4.2` until a full regression test of the billing flow can be performed. The risk of breaking payment logic outweighs the benefits of a newer SDK version unless a security patch is required.
