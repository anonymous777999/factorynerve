# Use specific digest for absolute determinism (Python 3.12.7-slim)
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PYTHONPATH=/app \
    PORT=10000

WORKDIR /app

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

# Pin pip version to 24.3.1 for stable resolving and install pinned requirements
RUN python -m pip install --upgrade pip==24.3.1 && \
    pip install -r requirements.txt

# Verify core dependencies are importable
RUN python -c "import fastapi; import sqlalchemy; import razorpay"

COPY alembic ./alembic
COPY alembic.ini ./alembic.ini
COPY backend ./backend
COPY scripts ./scripts
COPY README.md ./README.md

RUN mkdir -p /app/logs /app/exports/failed_payloads

CMD ["python", "scripts/render_start.py"]
