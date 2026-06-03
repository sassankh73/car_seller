FROM python:3.12

WORKDIR /app

# Install system dependencies:
# - curl: for Docker healthcheck
# - libheif-dev: for HEIC/HEIF image support (pillow-heif)
# - libavif-dev: for AVIF image support
# - libmagic1: for python-magic MIME type detection
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    libheif-dev \
    libavif-dev \
    libmagic1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8001

HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=15s \
  CMD curl -f http://localhost:8001/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]