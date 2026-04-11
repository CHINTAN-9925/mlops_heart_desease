# ---- Stage 1: Build dependencies (Builder Stage) ----
FROM python:3.12-slim AS builder
WORKDIR /app
#  --no-install-recommends gcc && rm -rf /var/lib/apt/lists/*
#   - Updates the package list, installs gcc (C compiler needed
#    by some Python packages like numpy)                       
#   - --no-install-recommends skips optional packages to keep
#   image lean                                                 
#   - rm -rf /var/lib/apt/lists/* deletes the apt cache to     
#   reduce layer size
RUN apt-get update && apt-get install -y --no-install-recommends gcc && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip wheel --no-cache-dir --wheel-dir /app/wheels -r requirements.txt

# ---- Stage 2: Final image (Final Runtime Stage) ----
FROM python:3.12-slim
WORKDIR /app
COPY --from=builder /app/wheels /wheels
RUN pip install --no-cache-dir /wheels/*
COPY app.py model.py pipeline.pkl ./

ENV PYTHONUNBUFFERED=1 PORT=5001

EXPOSE 5001
CMD ["waitress-serve", "--host=0.0.0.0", "--port=5001", "--threads=4", "app:app"]
