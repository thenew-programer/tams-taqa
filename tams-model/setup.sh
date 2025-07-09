#!/bin/bash

echo "Setting up TAMS Anomaly Prediction API..."

# Check if Python 3 is installed
if ! command -v python3 &> /dev/null; then
    echo "Error: Python 3 is not installed. Please install Python 3.8+ first."
    exit 1
fi

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Upgrade pip
echo "Upgrading pip..."
pip install --upgrade pip

# Install dependencies
echo "Installing dependencies..."
pip install -r requirements.txt

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "Warning: .env file not found. Please create it with your Supabase credentials:"
    echo "SUPABASE_URL=your_supabase_url_here"
    echo "SUPABASE_KEY=your_supabase_anon_key_here"
    echo "SUPABASE_ROLE_KEY=your_supabase_service_role_key_here"
    echo ""
    echo "Note: SUPABASE_ROLE_KEY is used to bypass RLS for server-side operations."
    echo "You can copy .env.example to .env and update the values."
fi

# Check if model file exists
if [ ! -f "ml_models/tams-prediction-model.pkl" ]; then
    echo "Warning: Model file not found at ml_models/tams-prediction-model.pkl"
    echo "The API will use fallback prediction logic instead."
fi

echo "Setup complete!"
echo ""
echo "To start the API server:"
echo "1. Make sure your .env file is configured with Supabase credentials"
echo "2. Run: source venv/bin/activate"
echo "3. Run: uvicorn main:app --reload"
echo ""
echo "The API will be available at: http://localhost:8000"
echo "API Documentation: http://localhost:8000/docs"
