# ---- Stage 1: Build dependencies (Builder Stage) ----
FROM python:3.10-slim AS builder
WORKDIR /app
# RUN apt-get update && apt-get install -y --no-install-recommends gcc && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip wheel --no-cache-dir --wheel-dir /app/wheels -r requirements.txt

# ---- Stage 2: Final image (Final Runtime Stage) ----
FROM python:3.10-slim
WORKDIR /app
COPY --from=builder /app/wheels /wheels
RUN pip install --no-cache-dir /wheels/*
COPY app.py model.py pipeline.pkl ./

# ENV PYTHONUNBUFFERED=1 PORT=5001

EXPOSE 5001
CMD ["waitress-serve", "--host=0.0.0.0", "--port=5001", "--threads=4", "app:app"]
