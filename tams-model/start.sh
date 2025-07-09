#!/bin/bash

source .env
echo "Starting TAMS Anomaly Prediction API..."
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
