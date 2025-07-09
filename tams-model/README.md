# TAMS Anomaly Storage API

A FastAPI-based service for storing anomaly data with AI-generated criticality predictions in Supabase database.

## Overview

This API processes anomaly data, generates AI-powered criticality scores, and stores everything in a Supabase database. The service focuses on **data storage** rather than returning predictions, making it perfect for frontend integrations that need confirmation of successful storage.

## Features

- **Single Anomaly Storage**: Store individual anomalies with instant AI analysis
- **Batch Processing**: Handle multiple anomalies efficiently  
- **File Upload Support**: Process CSV and Excel files
- **AI-Powered Scoring**: Automatic prediction of criticality scores
- **Database Integration**: Seamless Supabase storage with error handling
- **Storage Confirmation**: Simple success/failure responses for easy frontend integration

## AI Scoring System

Each anomaly receives AI-generated scores for:

- **Fiabilité Intégrité** (Reliability/Integrity): 1-5 scale
- **Disponibilité** (Availability): 1-5 scale  
- **Process Safety**: 1-5 scale
- **Criticité** (Criticality): Sum of above scores (3-15)

## API Endpoints

### Storage Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/store/single` | Store single anomaly |
| `POST` | `/store/batch` | Store multiple anomalies |
| `POST` | `/store/file/csv` | Upload & store CSV file |
| `POST` | `/store/file/excel` | Upload & store Excel file |

### Data Retrieval

Data retrieval is handled directly through your Supabase client, providing you with full control and flexibility.

### Documentation

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/docs` | Swagger UI documentation |
| `GET` | `/redoc` | ReDoc documentation |
| `GET` | `/api-docs` | Custom HTML documentation |

## Quick Start

### 1. Setup Environment

```bash
# Clone or copy the project files
cd tams-model

# Create environment file
cp .env.example .env

# Edit .env with your Supabase credentials
```

### 2. Database Setup

Follow the instructions in [`DATABASE_SETUP.md`](DATABASE_SETUP.md) to set up your Supabase database.

### 3. Run with Docker (Recommended)

```bash
# Start the service
docker-compose up --build

# API will be available at http://localhost:8000
```

### 4. Run Locally

```bash
# Install dependencies
pip install -r requirements.txt

# Start the service
python main.py

# Or with uvicorn
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

## Frontend Integration

For complete frontend integration examples, see [`FRONTEND_INTEGRATION.md`](FRONTEND_INTEGRATION.md).

### Quick Example

```javascript
// Store a single anomaly
const response = await fetch('http://localhost:8000/store/single', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        num_equipement: "EQ001",
        systeme: "Hydraulic", 
        description: "Pressure drop detected"
    })
});

const result = await response.json();
console.log(result); // { success: true, message: "...", anomaly_id: "..." }
```

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

## API Endpoints

### Health Check
- `GET /` - Check if the API is running

### Predictions
- `POST /predict/single` - Predict scores for a single anomaly
- `POST /predict/batch` - Predict scores for multiple anomalies
- `POST /predict/file/csv` - Upload and process a CSV file
- `POST /predict/file/excel` - Upload and process an Excel file

### Data Retrieval
- `GET /anomalies` - Get list of anomalies (with pagination)
- `GET /anomalies/{anomaly_id}` - Get specific anomaly by ID

## Input Data Format

The API expects the following fields for each anomaly:

**Required fields:**
- `num_equipement`: Equipment number (string)
- `systeme`: System name (string)  
- `description`: Anomaly description (string)

**Optional fields:**
- `date_detection`: Detection date
- `description_equipement`: Equipment description
- `section_proprietaire`: Owner section

## File Upload Format

For CSV/Excel files, use these column headers:
- `Num_equipement`
- `Systeme`
- `Description`
- `Date de détéction de l'anomalie` (optional)
- `Description de l'équipement` (optional)
- `Section propriétaire` (optional)

## Response Format

The API returns predictions with scores from 1-5 for each metric:
- `ai_fiabilite_integrite_score`: Reliability/Integrity score
- `ai_disponibilite_score`: Availability score
- `ai_process_safety_score`: Process Safety score
- `ai_criticality_level`: Overall criticality (sum of the three scores)

## Example Usage

### Single Prediction

```bash
curl -X POST "http://localhost:8000/predict/single" \
  -H "Content-Type: application/json" \
  -d '{
    "num_equipement": "EQ001",
    "systeme": "Hydraulic",
    "description": "Pressure drop detected in main valve"
  }'
```

### File Upload

```bash
curl -X POST "http://localhost:8000/predict/file/csv" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@anomalies.csv"
```

## API Documentation

Once the server is running, visit:
- `http://localhost:8000/docs` - Interactive API documentation (Swagger UI)
- `http://localhost:8000/redoc` - Alternative API documentation

## Database Schema

The API stores predictions in the `anomalies` table with the following AI prediction fields:
- `ai_fiabilite_integrite_score` (1-5)
- `ai_disponibilite_score` (1-5)  
- `ai_process_safety_score` (1-5)
- `ai_criticality_level` (1-15, sum of the three scores)

## Error Handling

The API includes comprehensive error handling for:
- Invalid input data
- File processing errors
- Model prediction failures
- Database connection issues

## Development

To run in development mode with auto-reload:

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```
