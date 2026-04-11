# ── Stage 1: Install dependencies ────────────────────────────────────────────
FROM python:3.10-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends gcc && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# ── Stage 2: Production runner ────────────────────────────────────────────────
FROM python:3.10-slim AS runner
WORKDIR /app
COPY --from=builder /install /usr/local
COPY app.py model.py pipeline.pkl ./

ENV PYTHONUNBUFFERED=1 PORT=5001

EXPOSE 5001
CMD ["waitress-serve", "--host=0.0.0.0", "--port=5001", "--threads=4", "app:app"]
