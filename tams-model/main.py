from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from typing import List
import uuid
import os
import warnings

warnings.filterwarnings('ignore', category=UserWarning)

from models import AnomalyInput, StorageResponse, BatchStorageResponse
from predictor import predictor
from database import supabase_client
from file_processor import FileProcessor

app = FastAPI(
    title="TAMS Anomaly Storage API",
    description="""
    ## TAMS Anomaly Storage API
    
    A machine learning-powered API for storing anomaly data with AI-generated criticality predictions.
    
    ### Main Features:
    * **Single Anomaly Storage**: Store individual anomalies with AI predictions
    * **Batch Storage**: Process multiple anomalies at once
    * **File Upload**: Support for CSV and Excel file processing
    * **Database Integration**: Automatic storage in Supabase
    * **AI Scoring**: Predicts Fiabilité Intégrité, Disponibilité, and Process Safety scores
    
    ### Storage Workflow:
    1. Submit anomaly data via API
    2. AI automatically generates criticality scores
    3. Data is stored in database with predictions
    4. Receive confirmation of successful storage
    
    ### Scoring System:
    * Each metric is scored from 1-5 (1=low risk, 5=high risk)
    * Criticality level is the sum of all three scores (3-15)
    * All anomalies are stored with status 'nouvelle'
    
    ### Data Retrieval:
    Use your Supabase client directly to retrieve stored data and predictions.
    """,
    version="1.0.0",
    contact={
        "name": "TAMS Team",
        "email": "support@tams.com",
    },
    license_info={
        "name": "MIT",
    },
    docs_url="/docs",  # Swagger UI
    redoc_url="/redoc",  # ReDoc
    openapi_url="/openapi.json",  # OpenAPI schema
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files
static_dir = os.path.join(os.path.dirname(__file__), "static")
if os.path.exists(static_dir):
    app.mount("/static", StaticFiles(directory=static_dir), name="static")

@app.get("/", tags=["Health"])
async def root():
    """
    Health check endpoint
    
    Returns the API status and version information.
    """
    return {"message": "TAMS Anomaly Storage API is running", "version": "1.0.0"}

@app.post("/store/single", response_model=StorageResponse, tags=["Data Storage"])
async def store_single_anomaly(anomaly: AnomalyInput):
    try:
        # Validate input data
        anomaly_data = FileProcessor.validate_anomaly_data(anomaly.dict())
        
        # Make prediction
        predictions = predictor.predict_single(anomaly_data)
        
        # Prepare data for database
        db_data = FileProcessor.prepare_for_database(anomaly_data, predictions)
        
        # Store in database
        stored_anomaly = await supabase_client.create_anomaly(db_data)
        
        if not stored_anomaly:
            raise HTTPException(status_code=500, detail="Failed to store anomaly in database")
        
        # Return simple confirmation
        return StorageResponse(
            success=True,
            message="Anomaly successfully stored",
            anomaly_id=stored_anomaly['id']
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.post("/store/batch", response_model=BatchStorageResponse, tags=["Data Storage"])
async def store_batch_anomalies(anomalies: List[AnomalyInput]):
    """
    Store multiple anomalies with AI predictions in batch
    
    Process multiple anomalies at once, generate predictions, and store them efficiently.
    All anomalies are processed and stored with the same import batch ID.
    Returns only confirmation without prediction results.
    
    ### Input:
    Array of anomaly objects, each containing the same fields as single storage.
    
    ### Output:
    Simple confirmation with total count and batch information.
    
    ### Use Cases:
    - Bulk processing of maintenance reports
    - Historical data import
    - System-wide anomaly assessment
    - Frontend batch operations
    """
    try:
        if not anomalies:
            raise HTTPException(status_code=400, detail="No anomalies provided")
        
        # Validate input data
        validated_data = []
        for anomaly in anomalies:
            validated_data.append(FileProcessor.validate_anomaly_data(anomaly.dict()))
        
        # Make predictions
        predictions_list = predictor.predict_batch(validated_data)
        
        # Prepare data for database
        db_data_list = []
        for anomaly_data, predictions in zip(validated_data, predictions_list):
            db_data = FileProcessor.prepare_for_database(anomaly_data, predictions)
            db_data_list.append(db_data)
        
        # Create batch ID
        batch_id = str(uuid.uuid4())
        
        # Store in database
        stored_anomalies = await supabase_client.create_anomalies_batch(db_data_list, batch_id)
        
        if not stored_anomalies:
            raise HTTPException(status_code=500, detail="Failed to store anomalies in database")
        
        # Return simple confirmation
        return BatchStorageResponse(
            success=True,
            message=f"{len(stored_anomalies)} anomalies successfully stored",
            total_stored=len(stored_anomalies)
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.post("/store/file/csv", response_model=BatchStorageResponse, tags=["File Upload"])
async def store_from_csv_file(file: UploadFile = File(...)):
    """
    Process and store anomalies from CSV file
    
    Upload a CSV file containing multiple anomaly records for batch processing and storage.
    Returns only confirmation without prediction results.
    
    ### CSV Format:
    The CSV file should contain these columns:
    - `Num_equipement` (required)
    - `Systeme` (required) 
    - `Description` (required)
    - `Date de détéction de l'anomalie` (optional)
    - `Description de l'équipement` (optional)
    - `Section propriétaire` (optional)
    
    ### Features:
    - Automatic data validation and cleaning
    - Batch processing for efficiency
    - Import tracking with unique batch ID
    - Error handling for malformed data
    
    ### Response:
    Simple confirmation with total count and batch ID for tracking.
    """
    try:
        if not file.filename.endswith('.csv'):
            raise HTTPException(status_code=400, detail="File must be a CSV file")
        
        # Process file
        anomalies_data = await FileProcessor.process_csv_file(file)
        
        if not anomalies_data:
            raise HTTPException(status_code=400, detail="No valid anomaly data found in file")
        
        # Make predictions
        predictions_list = predictor.predict_batch(anomalies_data)
        
        # Prepare data for database
        db_data_list = []
        for anomaly_data, predictions in zip(anomalies_data, predictions_list):
            db_data = FileProcessor.prepare_for_database(anomaly_data, predictions)
            db_data_list.append(db_data)
        
        # Create batch ID
        batch_id = await supabase_client.create_import_batch(file.filename, len(anomalies_data))
        
        # Store in database
        stored_anomalies = await supabase_client.create_anomalies_batch(db_data_list, batch_id)
        
        if not stored_anomalies:
            raise HTTPException(status_code=500, detail="Failed to store anomalies in database")
        
        # Return simple confirmation
        return BatchStorageResponse(
            success=True,
            message=f"{len(stored_anomalies)} anomalies successfully stored from CSV file",
            total_stored=len(stored_anomalies),
            import_batch_id=batch_id
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing CSV file: {str(e)}")

@app.post("/store/file/excel", response_model=BatchStorageResponse, tags=["File Upload"])
async def store_from_excel_file(file: UploadFile = File(...)):
    """
    Process and store anomalies from Excel file
    
    Upload an Excel file (.xlsx or .xls) containing multiple anomaly records for processing and storage.
    Returns only confirmation without prediction results.
    
    ### Excel Format:
    Same column structure as CSV format. Supports both .xlsx and .xls files.
    
    ### Features:
    - Supports multiple Excel formats
    - Automatic data type detection
    - Sheet processing (uses first sheet)
    - Header row detection
    """
    try:
        if not (file.filename.endswith('.xlsx') or file.filename.endswith('.xls')):
            raise HTTPException(status_code=400, detail="File must be an Excel file (.xlsx or .xls)")
        
        # Process file
        anomalies_data = await FileProcessor.process_excel_file(file)
        
        if not anomalies_data:
            raise HTTPException(status_code=400, detail="No valid anomaly data found in file")
        
        # Make predictions
        predictions_list = predictor.predict_batch(anomalies_data)
        
        # Prepare data for database
        db_data_list = []
        for anomaly_data, predictions in zip(anomalies_data, predictions_list):
            db_data = FileProcessor.prepare_for_database(anomaly_data, predictions)
            db_data_list.append(db_data)
        
        # Create batch ID
        batch_id = await supabase_client.create_import_batch(file.filename, len(anomalies_data))
        
        # Store in database
        stored_anomalies = await supabase_client.create_anomalies_batch(db_data_list, batch_id)
        
        if not stored_anomalies:
            raise HTTPException(status_code=500, detail="Failed to store anomalies in database")
        
        # Return simple confirmation
        return BatchStorageResponse(
            success=True,
            message=f"{len(stored_anomalies)} anomalies successfully stored from Excel file",
            total_stored=len(stored_anomalies),
            import_batch_id=batch_id
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing Excel file: {str(e)}")

if __name__ == "__main__":
    try:
        import uvicorn
        uvicorn.run(app, host="0.0.0.0", port=8000)
    except ImportError:
        print("uvicorn not available. Install with: pip install uvicorn")
        print("Or run with: python -m uvicorn main:app --host 0.0.0.0 --port 8000")
