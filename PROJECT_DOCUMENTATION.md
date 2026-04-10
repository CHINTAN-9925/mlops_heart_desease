# CardioScan — MLOps Heart Disease Prediction System
## Complete Project Documentation

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture Overview](#2-architecture-overview)
3. [Directory Structure](#3-directory-structure)
4. [Technologies & Dependencies](#4-technologies--dependencies)
5. [Machine Learning Pipeline](#5-machine-learning-pipeline)
6. [Backend API Service](#6-backend-api-service)
7. [Frontend Web Application](#7-frontend-web-application)
8. [Nginx Reverse Proxy](#8-nginx-reverse-proxy)
9. [Docker Containerization](#9-docker-containerization)
10. [Docker Compose Orchestration](#10-docker-compose-orchestration)
11. [CI/CD with Jenkins](#11-cicd-with-jenkins)
12. [Environment Variables](#12-environment-variables)
13. [How to Run & Deploy](#13-how-to-run--deploy)
14. [API Reference](#14-api-reference)
15. [Monitoring & Troubleshooting](#15-monitoring--troubleshooting)

---

## 1. Project Overview

**CardioScan** is a production-grade MLOps application for heart disease risk prediction. It demonstrates a complete end-to-end machine learning system — from model training to a fully deployed, containerized web application — built on enterprise-grade DevOps patterns.

The system takes 13 clinical features (age, cholesterol, ECG results, etc.) as input, runs them through a trained Gaussian Naive Bayes classifier, and returns a risk prediction (Low / Moderate / High / Critical) along with a probability score.

**Core Goals:**
- Demonstrate MLOps principles in a real-world healthcare scenario
- Show how to containerize and orchestrate microservices (Flask + Next.js + MongoDB + Nginx)
- Automate build, test, and deployment using Jenkins CI/CD
- Implement horizontal scalability and reverse proxying with Nginx

---

## 2. Architecture Overview

```
                          ┌────────────────────────────────┐
                          │           Browser               │
                          │   http://localhost (port 80)    │
                          └────────────────┬───────────────┘
                                           │
                          ┌────────────────▼───────────────┐
                          │          Nginx Proxy            │
                          │      (nginx:1.27-alpine)        │
                          │                                 │
                          │  /api/*  →  backend:5001        │
                          │  /_next/ →  shared volume       │
                          │  /*      →  frontend:3000       │
                          └──────┬─────────────┬───────────┘
                                 │             │
              ┌──────────────────▼──┐    ┌─────▼──────────────┐
              │   Backend (Flask)   │    │ Frontend (Next.js)  │
              │    Python 3.10      │    │   Node.js 20        │
              │    port 5001        │    │   port 3000         │
              │                     │    │   TypeScript/React  │
              │  /health            │    └────────────────────-┘
              │  /predict           │
              │  /history           │
              └────────┬────────────┘
                       │
              ┌────────▼────────────┐
              │  MongoDB (v7)       │
              │  port 27017         │
              │  prediction history │
              └─────────────────────┘

              ┌─────────────────────┐
              │  Jenkins CI/CD      │
              │  port 8080 / 50000  │
              │  Builds & Deploys   │
              └─────────────────────┘
```

**Request Flow:**
1. User opens `http://localhost` — Nginx receives the request
2. Page requests (`/*`) are proxied to the Next.js frontend (port 3000)
3. Static assets (`/_next/static/`) are served directly from a shared Docker volume
4. API calls (`/api/*`) are proxied to the Flask backend (port 5001, `/api` prefix stripped)
5. Backend runs inference, optionally logs to MongoDB, and returns the result

---

## 3. Directory Structure

```
mlops_heart_desease/
│
├── Jenkinsfile                   # Declarative CI/CD pipeline definition
├── docker-compose.yml            # Multi-service container orchestration
├── PROJECT_DOCUMENTATION.md      # This file
│
├── backend/
│   ├── app.py                    # Flask REST API (endpoints + CORS + MongoDB)
│   ├── model.py                  # ML training script (GNB + GridSearchCV)
│   ├── pipeline.pkl              # Pre-trained serialized sklearn pipeline
│   ├── heart.csv                 # UCI Heart Disease dataset (1026 records)
│   ├── requirements.txt          # Python package dependencies
│   └── Dockerfile                # Multi-stage backend container build
│
├── frontend/
│   ├── app/                      # Next.js app router pages and layouts
│   │   ├── layout.tsx            # Root layout with metadata
│   │   └── page.tsx              # Main prediction form UI
│   ├── lib/
│   │   └── api.ts                # Axios API client (predict + history)
│   ├── types/
│   │   └── prediction.ts         # TypeScript interfaces for API payloads
│   ├── public/                   # Static public assets
│   ├── package.json              # Node.js dependencies
│   ├── next.config.ts            # Next.js config + API proxy rewrites
│   ├── docker-entrypoint.sh      # Entrypoint: sync static files to shared volume
│   ├── tsconfig.json             # TypeScript compiler configuration
│   ├── tailwind.config.ts        # Tailwind CSS configuration
│   └── Dockerfile                # Multi-stage frontend container build
│
├── nginx/
│   └── nginx.conf                # Reverse proxy + load balancer config
│
└── jenkins/
    └── Dockerfile                # Jenkins LTS + Docker CLI + pre-installed plugins
```

---

## 4. Technologies & Dependencies

### Backend

| Package | Version | Purpose |
|---------|---------|---------|
| Python | 3.10-slim | Runtime |
| Flask | 3.1.0 | REST API framework |
| flask-cors | 5.0.0 | Cross-Origin Resource Sharing |
| scikit-learn | 1.6.1 | ML pipeline (GaussianNB + StandardScaler) |
| pandas | 2.2.3 | Data loading and manipulation |
| numpy | 2.2.3 | Numerical operations |
| pymongo | 4.10.1 | MongoDB driver for prediction history |
| waitress | 3.0.2 | Production WSGI server (4 threads) |
| joblib | 1.4.2 | Parallel processing (used by sklearn) |

### Frontend

| Package | Version | Purpose |
|---------|---------|---------|
| Next.js | 16.2.3 | React SSR framework |
| React | 19.2.4 | UI library |
| TypeScript | 5 | Type-safe development |
| Tailwind CSS | 4 | Utility-first CSS |
| axios | 1.15.0 | HTTP client for API calls |

### Infrastructure

| Tool | Version | Purpose |
|------|---------|---------|
| Docker | Latest | Containerization |
| Docker Compose | v2 | Multi-container orchestration |
| Nginx | 1.27-alpine | Reverse proxy + static serving |
| MongoDB | 7 | NoSQL database for audit logs |
| Jenkins | LTS + JDK17 | CI/CD automation |

---

## 5. Machine Learning Pipeline

### Dataset

- **Source:** UCI Heart Disease Dataset
- **File:** `backend/heart.csv`
- **Records:** 1026 rows
- **Target column:** `target` (0 = no disease, 1 = disease present)

### Features (13 Clinical Inputs)

| Feature Name in Dataset | Full Name Used in API | Type |
|--------------------------|----------------------|------|
| `age` | `age` | int |
| `sex` | `sex` | int (0=F, 1=M) |
| `cp` | `chest pain type` | int (0–3) |
| `trestbps` | `resting blood pressure` | int |
| `chol` | `serum cholestoral in mg/dl` | int |
| `fbs` | `fasting blood sugar > 120 mg/dl` | int (0/1) |
| `restecg` | `resting electrocardiographic results` | int (0–2) |
| `thalach` | `maximum heart rate achieved` | int |
| `exang` | `exercise induced angina` | int (0/1) |
| `oldpeak` | `oldpeak = ST depression induced by exercise relative to rest` | float |
| `slope` | `the slope of the peak exercise ST segment` | int (0–2) |
| `ca` | `number of major vessels (0-3) colored by flourosopy` | int |
| `thal` | `thal` | int (0–3) |

### Model Training (`backend/model.py`)

```
1. Load heart.csv with pandas
2. Separate features (X) and target (y)
3. Train/test split (80/20)
4. Build sklearn Pipeline:
   └── Step 1: StandardScaler  (normalize all features)
   └── Step 2: GaussianNB      (probabilistic classifier)
5. GridSearchCV (5-fold CV) on var_smoothing:
   [1e-12, 1e-11, 1e-10, 1e-9, 1e-8, 1e-7, 1e-6, 1e-5]
6. Evaluate best model on test set
7. Serialize to pipeline.pkl with pickle
```

**Output during training:**
```
Best parameters: {'gaussiannb__var_smoothing': 1e-9}
Test accuracy: 0.84 (approx.)
Model saved as pipeline.pkl
```

### Risk Classification Thresholds

| Probability | Risk Level |
|-------------|------------|
| < 0.30 | Low Risk |
| 0.30 – 0.55 | Moderate Risk |
| 0.55 – 0.75 | High Risk |
| >= 0.75 | Critical Risk |

### Re-training the Model

```bash
cd backend
python model.py
# Outputs best params, accuracy, writes pipeline.pkl
docker compose restart backend   # Reload with new model
```

---

## 6. Backend API Service

**File:** `backend/app.py`  
**Framework:** Flask 3.1  
**Server:** Waitress (4 threads, port 5001)

### Startup Behavior

1. Load `pipeline.pkl` from disk at startup
2. Connect to MongoDB (`MONGO_URI` env var, default `mongodb://mongo:27017`)
3. Start Waitress WSGI server on `0.0.0.0:5001`

MongoDB connection is non-fatal — if unavailable, predictions still work but history is not stored.

### Endpoints

#### `GET /health`

Returns service health status. Used by Jenkins pipeline and Docker health probes.

**Response:**
```json
{ "status": "ok" }
```

---

#### `POST /predict`

Runs heart disease risk prediction on provided clinical data.

**Request Body** (all fields required, all numeric):
```json
{
  "age": 54,
  "sex": 1,
  "chest pain type": 0,
  "resting blood pressure": 130,
  "serum cholestoral in mg/dl": 250,
  "fasting blood sugar > 120 mg/dl": 0,
  "resting electrocardiographic results": 0,
  "maximum heart rate achieved": 150,
  "exercise induced angina": 0,
  "oldpeak = ST depression induced by exercise relative to rest": 1.5,
  "the slope of the peak exercise ST segment": 1,
  "number of major vessels (0-3) colored by flourosopy": 0,
  "thal": 2
}
```

**Success Response (200):**
```json
{
  "prediction": 1,
  "probability": 0.856420,
  "label": "Critical Risk"
}
```

**Error Response (400):**
```json
{
  "error": "Missing required fields",
  "details": ["age", "sex"]
}
```

**Side effect:** If MongoDB is available, the prediction (inputs + outputs + timestamp) is stored in the `predictions` collection of `heart_disease_db`.

---

#### `GET /history`

Returns the last 100 stored predictions from MongoDB.

**Response (200):**
```json
[
  {
    "timestamp": "2024-01-15T10:30:00Z",
    "inputs": { ... },
    "prediction": 1,
    "probability": 0.856420,
    "label": "Critical Risk"
  },
  ...
]
```

Returns an empty list `[]` if MongoDB is unavailable.

---

## 7. Frontend Web Application

**Framework:** Next.js 16 with React 19  
**Language:** TypeScript  
**Styling:** Tailwind CSS 4  
**Port:** 3000

### Pages

| Route | File | Description |
|-------|------|-------------|
| `/` | `app/page.tsx` | Main prediction form and results |

### UI Layout

```
┌─────────────────────────────────────────────────────┐
│  CardioScan Header (dark themed)                    │
├──────────────────────────┬──────────────────────────┤
│  Input Form (left)       │  Results Panel (right)   │
│                          │                          │
│  Demographics            │  Risk Assessment Card    │
│  ├── Age                 │  ├── Label (color coded) │
│  └── Sex                 │  ├── Probability %       │
│                          │  └── Prediction (0/1)    │
│  Vitals                  │                          │
│  ├── Blood Pressure      │  Patient Name Input      │
│  ├── Cholesterol         │                          │
│  ├── Max Heart Rate      │  View History Button     │
│  └── Fasting Blood Sugar │                          │
│                          │                          │
│  Cardiac Symptoms        │                          │
│  ├── Chest Pain Type     │                          │
│  ├── Resting ECG         │                          │
│  └── Exercise Angina     │                          │
│                          │                          │
│  Diagnostic Tests        │                          │
│  ├── ST Depression       │                          │
│  ├── ST Slope            │                          │
│  ├── Vessels (0-3)       │                          │
│  └── Thalassemia         │                          │
│                          │                          │
│  [Predict] button        │                          │
└──────────────────────────┴──────────────────────────┘
```

### Risk Color Coding

| Risk Level | Color |
|------------|-------|
| Low Risk | Green |
| Moderate Risk | Yellow |
| High Risk | Orange/Red |
| Critical Risk | Dark Red |

### API Client (`lib/api.ts`)

```typescript
// Base URL is /api (proxied by Next.js to backend)
predict(inputs: PredictionInput): Promise<PredictionResult>
getHistory(): Promise<PredictionRecord[]>
```

### API Proxy (`next.config.ts`)

All `/api/*` requests from the browser are rewritten to `http://backend:5001/*` at build time, so the frontend never exposes the backend URL directly.

---

## 8. Nginx Reverse Proxy

**File:** `nginx/nginx.conf`  
**Image:** `nginx:1.27-alpine`  
**Public port:** 80

### Routing Rules

| Path Pattern | Destination | Notes |
|--------------|-------------|-------|
| `/_next/static/` | Shared Docker volume | Served directly, 1-year cache |
| `/api/*` | `http://backend_pool/` | `/api` prefix stripped, ip_hash LB |
| `/*` | `http://frontend:3000` | Proxied with WebSocket upgrade headers |

### Load Balancing

```nginx
upstream backend_pool {
    ip_hash;          # Sticky sessions — each client IP pins to one backend
    server backend:5001;
    # When scaled: server backend_2:5001; automatically added by Docker
}
```

With `docker compose up --scale backend=2`, both backend replicas register in DNS and Nginx distributes traffic using ip_hash.

### Static Asset Optimization

`/_next/static/` files are stored in a Docker volume shared between the frontend and Nginx. Nginx serves them directly (bypassing the Node.js process) with `Cache-Control: public, max-age=31536000, immutable` — significantly reducing load.

---

## 9. Docker Containerization

### Backend (`backend/Dockerfile`) — Multi-stage

```
Stage 1 — builder (python:3.10-slim)
  - Install system build tools (gcc, etc.)
  - pip wheel all dependencies into /wheels

Stage 2 — runner (python:3.10-slim)
  - Copy pre-built wheels
  - pip install from /wheels (no internet needed)
  - COPY app.py, model.py, pipeline.pkl, heart.csv
  - EXPOSE 5001
  - CMD: waitress-serve --host=0.0.0.0 --port=5001 --threads=4 app:app
```

**Why multi-stage?** The builder stage includes compilers and build tools (large). The runner stage only has runtime binaries, producing a smaller, more secure image.

### Frontend (`frontend/Dockerfile`) — Multi-stage

```
Stage 1 — deps (node:20-slim)
  - npm ci (installs exact locked dependencies)

Stage 2 — builder (node:20-alpine)
  - Copy node_modules from stage 1
  - ARG BACKEND_URL (injected at build time)
  - npm run build → produces .next/ and public/

Stage 3 — runner (node:20-alpine)
  - Copy .next/, public/, package.json
  - COPY docker-entrypoint.sh
  - ENTRYPOINT: sync /_next/static to /shared volume, then npm start
  - EXPOSE 3000
```

**`docker-entrypoint.sh`** copies the built static files (`_next/static`) into a Docker volume at `/shared/static/` so Nginx can serve them directly.

### Jenkins (`jenkins/Dockerfile`)

```
Base: jenkins/jenkins:lts-jdk17
- Add Docker's apt repo and install docker-ce-cli + docker-compose-plugin
- Add jenkins user to docker group
- Create /var/run/docker.sock with correct permissions (macOS Docker Desktop compat)
- Pre-install plugins: git, workflow-aggregator, docker-workflow,
  blueocean, credentials-binding, pipeline-stage-view
- Switch to root user (required for Docker socket access)
```

**Note:** Jenkins is configured as root to ensure it can communicate with the host Docker daemon via the mounted socket at `/var/run/docker.sock`.

---

## 10. Docker Compose Orchestration

**File:** `docker-compose.yml`

### Services Summary

| Service | Image | Internal Port | Public Port | Depends On |
|---------|-------|--------------|-------------|------------|
| `mongo` | `mongo:7` | 27017 | — | — |
| `backend` | `./backend` (custom) | 5001 | — | mongo |
| `frontend` | `./frontend` (custom) | 3000 | — | backend |
| `nginx` | `nginx:1.27-alpine` | 80 | **80** | frontend, backend |
| `jenkins` | `./jenkins` (custom) | 8080, 50000 | **8080, 50000** | — |

### Volumes

| Volume | Used By | Purpose |
|--------|---------|---------|
| `mongo_data` | mongo | Persistent MongoDB data |
| `nextjs_static` | frontend, nginx | Shared Next.js static assets |
| `jenkins_home` | jenkins | Persistent Jenkins config and jobs |
| `/var/run/docker.sock` | jenkins | Docker-in-Docker via host socket |

### Networks

All services share a single bridge network (`mlops_network`). Services communicate using their service name as DNS hostname (e.g., `http://backend:5001`).

### Scaling

```bash
# Scale backend to 2 replicas
docker compose up --scale backend=2 -d

# Nginx backend_pool upstream will automatically pick up both replicas
# via Docker's internal DNS round-robin, then ip_hash sticks clients
```

---

## 11. CI/CD with Jenkins

**File:** `Jenkinsfile`

### Pipeline Stages

```
1. Checkout
   └── Git clone / pull latest code

2. Build (parallel)
   ├── Build Backend
   │     docker compose build --no-cache backend
   └── Build Frontend
         docker compose build --no-cache frontend

3. Test Backend
   ├── Start: mongo + backend containers
   ├── Poll /health endpoint (15 attempts × 3s = 45s max)
   └── Assert: HTTP 200 with {"status":"ok"}

4. Test Frontend
   ├── Start: full stack (mongo, backend, frontend)
   ├── Poll http://localhost:3000 (20 attempts × 5s = 100s max)
   └── Assert: HTTP 200 response

5. Deploy  [main branch only]
   └── docker compose up -d --remove-orphans

Post (on failure):
   └── docker compose down  (cleanup all containers)
```

### Jenkins Configuration

- **Jenkins URL:** `http://localhost:8080`
- **Agent JNLP port:** 50000
- **Docker access:** Host socket mounted at `/var/run/docker.sock`
- **Workspace:** Project directory mounted in container
- **PATH fix:** Adds Docker Desktop binary paths for macOS compatibility

### Setting Up Jenkins Pipeline

1. Open `http://localhost:8080`
2. Create a new **Pipeline** job
3. Set SCM to your Git repository URL
4. Set script path to `Jenkinsfile`
5. Enable **Build when a change is pushed** (webhook or polling)
6. Save and trigger the first build

### Deployment Behavior

- Deployments only happen on the `main` branch
- On failure: containers are brought down to avoid partial state
- On success: containers are updated with zero-downtime (`--remove-orphans` cleans stale services)

---

## 12. Environment Variables

| Variable | Service | Default | Description |
|----------|---------|---------|-------------|
| `MONGO_URI` | backend | `mongodb://mongo:27017` | MongoDB connection string |
| `PORT` | backend | `5001` | Backend listen port |
| `BACKEND_URL` | frontend (build arg) | `http://localhost:5001` | Backend URL for Next.js rewrites |
| `NODE_ENV` | frontend | `production` | Next.js runtime mode |
| `COMPOSE_PROJECT_NAME` | Jenkins env | `mlops_heart` | Docker Compose project prefix |

All variables can be overridden in `docker-compose.yml` under the `environment:` key of each service.

---

## 13. How to Run & Deploy

### Prerequisites

- Docker Desktop (or Docker Engine + Docker Compose v2) installed
- Port 80 available on the host
- Port 8080 available on the host (for Jenkins)
- Git installed

### Quick Start

```bash
# 1. Clone the repository
git clone <repo-url>
cd mlops_heart_desease

# 2. Build all containers
docker compose build

# 3. Start all services in background
docker compose up -d

# 4. Verify all containers are running
docker compose ps

# 5. Open the web app
open http://localhost

# 6. Open Jenkins
open http://localhost:8080
```

### Check Services are Healthy

```bash
# Backend health
curl http://localhost/api/health
# Expected: {"status":"ok"}

# Prediction test
curl -X POST http://localhost/api/predict \
  -H "Content-Type: application/json" \
  -d '{
    "age": 54, "sex": 1,
    "chest pain type": 0,
    "resting blood pressure": 130,
    "serum cholestoral in mg/dl": 250,
    "fasting blood sugar > 120 mg/dl": 0,
    "resting electrocardiographic results": 0,
    "maximum heart rate achieved": 150,
    "exercise induced angina": 0,
    "oldpeak = ST depression induced by exercise relative to rest": 1.5,
    "the slope of the peak exercise ST segment": 1,
    "number of major vessels (0-3) colored by flourosopy": 0,
    "thal": 2
  }'
```

### Stop All Services

```bash
docker compose down
```

### Stop and Remove Volumes (full reset)

```bash
docker compose down -v
```

### View Logs

```bash
docker compose logs -f backend     # Backend API logs
docker compose logs -f frontend    # Frontend logs
docker compose logs -f nginx       # Nginx access/error logs
docker compose logs -f jenkins     # Jenkins build logs
docker compose logs -f mongo       # MongoDB logs
```

### Re-train the ML Model

```bash
# Retrain locally
cd backend
python model.py
# Outputs: best params, accuracy, overwrites pipeline.pkl

# Rebuild and restart the backend to pick up new model
docker compose build backend
docker compose up -d backend
```

### Scale the Backend

```bash
docker compose up --scale backend=2 -d
# Nginx will load-balance between both backend replicas using ip_hash
```

---

## 14. API Reference

Base URL (via Nginx): `http://localhost`  
Direct backend URL: `http://localhost:5001` (if port exposed)

### `GET /api/health`

Returns OK if backend is running.

```
Status: 200 OK
Body: {"status": "ok"}
```

---

### `POST /api/predict`

Predicts heart disease risk from clinical features.

**Request Headers:**
```
Content-Type: application/json
```

**Request Body:**

| Field | Type | Range | Description |
|-------|------|-------|-------------|
| `age` | int | 1–120 | Patient age in years |
| `sex` | int | 0 or 1 | 0 = Female, 1 = Male |
| `chest pain type` | int | 0–3 | 0=typical angina, 1=atypical, 2=non-anginal, 3=asymptomatic |
| `resting blood pressure` | int | 80–200 | mm Hg |
| `serum cholestoral in mg/dl` | int | 100–600 | Cholesterol in mg/dL |
| `fasting blood sugar > 120 mg/dl` | int | 0 or 1 | 1 if > 120 mg/dL |
| `resting electrocardiographic results` | int | 0–2 | 0=normal, 1=ST-T abnormality, 2=LV hypertrophy |
| `maximum heart rate achieved` | int | 60–220 | bpm |
| `exercise induced angina` | int | 0 or 1 | 1 = yes |
| `oldpeak = ST depression induced by exercise relative to rest` | float | 0.0–6.2 | ST depression |
| `the slope of the peak exercise ST segment` | int | 0–2 | 0=upsloping, 1=flat, 2=downsloping |
| `number of major vessels (0-3) colored by flourosopy` | int | 0–3 | Number of vessels |
| `thal` | int | 0–3 | Thalassemia type |

**Success Response (200):**
```json
{
  "prediction": 1,
  "probability": 0.856420,
  "label": "Critical Risk"
}
```

**Error Response (400):**
```json
{
  "error": "Missing required fields",
  "details": ["age", "sex"]
}
```

**Error Response (500):**
```json
{
  "error": "Prediction failed",
  "details": "..."
}
```

---

### `GET /api/history`

Returns last 100 predictions stored in MongoDB.

**Response (200):**
```json
[
  {
    "_id": "...",
    "timestamp": "2024-01-15T10:30:00Z",
    "inputs": { ... all 13 features ... },
    "prediction": 1,
    "probability": 0.856420,
    "label": "Critical Risk"
  }
]
```

Returns `[]` if MongoDB is unavailable.

---

## 15. Monitoring & Troubleshooting

### Common Issues

**Backend can't connect to MongoDB:**
```bash
docker compose logs backend | grep -i mongo
# Check MONGO_URI is set to mongodb://mongo:27017
# Ensure mongo service is healthy: docker compose ps mongo
```

**Frontend shows blank page or API errors:**
```bash
docker compose logs frontend
# Check next.config.ts rewrites point to correct backend URL
# Verify: curl http://localhost/api/health returns 200
```

**Jenkins can't build Docker images:**
```bash
docker compose logs jenkins | grep -i docker
# Ensure /var/run/docker.sock is mounted in docker-compose.yml
# Check Jenkins container runs as root or has docker group access
```

**Port 80 already in use:**
```bash
# Find what's using port 80
lsof -i :80
# Change nginx port in docker-compose.yml:
# ports: - "8090:80"   # Use 8090 instead
```

**Containers failing health checks:**
```bash
docker compose ps                       # Check STATUS column
docker inspect <container_id>           # Check Health section
docker compose up --force-recreate -d   # Force recreate containers
```

### Inspecting the MongoDB Database

```bash
# Enter MongoDB shell
docker compose exec mongo mongosh

# Switch to app database
use heart_disease_db

# Count predictions
db.predictions.countDocuments()

# View last 5 predictions
db.predictions.find().sort({timestamp: -1}).limit(5).pretty()

# Clear all predictions
db.predictions.deleteMany({})
```

### Rebuilding from Scratch

```bash
# Stop everything and remove containers, networks, volumes
docker compose down -v --remove-orphans

# Remove built images
docker compose rm -f
docker rmi $(docker images 'mlops_heart*' -q) 2>/dev/null

# Full rebuild
docker compose build --no-cache
docker compose up -d
```

### Jenkins Pipeline Debugging

1. Open `http://localhost:8080`
2. Navigate to your Pipeline job
3. Click on the failed build number
4. Click **Console Output** to see full logs
5. Or click **Blue Ocean** for a visual stage view

---

*This document covers the complete CardioScan MLOps system as of the project's current state. For questions or contributions, refer to the repository's git history and commit messages for change context.*
