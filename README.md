# TAMS Project

>This repository contains two main projects: **tams-model** (backend API) and **taqa-project** (frontend web app) for anomaly management, AI-powered criticality prediction, and intelligent planning in industrial asset management.

---

## tams-model (Backend API)

**A FastAPI-based service for storing anomaly data with AI-generated criticality predictions in Supabase.**

### Features
- AI-powered scoring: reliability, availability, process safety, and overall criticality
- Store single, batch, or file (CSV/Excel) anomalies
- Supabase integration for storage and retrieval
- API docs at `/docs` and `/redoc`
- Robust error handling

### Main Endpoints
| Method | Endpoint                | Purpose                        |
|--------|-------------------------|--------------------------------|
| POST   | `/store/single`         | Store a single anomaly         |
| POST   | `/store/batch`          | Store multiple anomalies       |
| POST   | `/store/file/csv`       | Upload and store CSV file      |
| POST   | `/store/file/excel`     | Upload and store Excel file    |
| GET    | `/anomalies`            | List anomalies                 |
| GET    | `/anomalies/{id}`       | Get anomaly by ID              |
| POST   | `/predict/single`       | Predict for a single anomaly   |
| POST   | `/predict/batch`        | Predict for multiple anomalies |
| GET    | `/`                     | Health check                   |

### Quick Start
```bash
cd tams-model
cp .env.example .env  # Edit with Supabase credentials
docker-compose up --build
# or run locally:
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Input/Output
- **Input:** `num_equipement`, `systeme`, `description` (required), plus optional fields
- **Output:** AI scores (1-5) for reliability, availability, process safety, and overall criticality (3-15)

### Docs
- [Swagger UI](http://localhost:8000/docs)
- [ReDoc](http://localhost:8000/redoc)

---

## taqa-project (Frontend Web App)

**A modern React + TypeScript web app for anomaly visualization, planning, and collaboration.**

### Features
- Authentication and user management
- Anomaly dashboard: view, filter, analyze
- Action plan creation and tracking
- AI-driven criticality and planning
- File import (CSV/Excel)
- Chat and collaboration tools
- Modern UI (Tailwind CSS, Vite)

### Tech Stack
- React 18, TypeScript, Vite
- Supabase (database & auth)
- Tailwind CSS, React Query, React Router
- OpenAI, ChromaDB (AI features)

### Quick Start
```bash
cd taqa-project
npm install
npm run dev
# or build for production:
npm run build
```

### Structure
- `src/components/` – UI components
- `src/services/` – API/data services
- `src/pages/` – Main app pages
- `src/contexts/` – React context providers
- `src/hooks/` – Custom hooks

### Environment
Copy `.env.example` to `.env` and configure Supabase/API endpoints.

---

For more details, see the individual `README.md` files in each project directory.
