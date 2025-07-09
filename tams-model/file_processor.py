import pandas as pd
import io
from typing import List, Dict, Any, Union
from fastapi import UploadFile

class FileProcessor:
    @staticmethod
    async def process_csv_file(file: UploadFile) -> List[Dict[str, Any]]:
        """Process uploaded CSV file and return list of anomaly data"""
        try:
            content = await file.read()
            df = pd.read_csv(io.StringIO(content.decode('utf-8')))
            return FileProcessor._process_dataframe(df)
        except Exception as e:
            raise Exception(f"Error processing CSV file: {str(e)}")
    
    @staticmethod
    async def process_excel_file(file: UploadFile) -> List[Dict[str, Any]]:
        """Process uploaded Excel file and return list of anomaly data"""
        try:
            content = await file.read()
            df = pd.read_excel(io.BytesIO(content))
            return FileProcessor._process_dataframe(df)
        except Exception as e:
            raise Exception(f"Error processing Excel file: {str(e)}")
    
    @staticmethod
    def _process_dataframe(df: pd.DataFrame) -> List[Dict[str, Any]]:
        """Process pandas DataFrame and extract relevant columns"""
        # Map column names to our expected format
        column_mapping = {
            'Num_equipement': 'num_equipement',
            'Systeme': 'systeme',
            'Description': 'description',
            'Date de détéction de l\'anomalie': 'date_detection',
            'Description de l\'équipement': 'description_equipement',
            'Section propriétaire': 'section_proprietaire'
        }
        
        # Rename columns
        df_renamed = df.rename(columns=column_mapping)
        
        # Select only the columns we need for prediction
        required_columns = ['num_equipement', 'systeme', 'description']
        optional_columns = ['date_detection', 'description_equipement', 'section_proprietaire']
        
        # Check if required columns exist
        missing_columns = [col for col in required_columns if col not in df_renamed.columns]
        if missing_columns:
            raise ValueError(f"Missing required columns: {missing_columns}")
        
        # Select available columns
        available_columns = required_columns + [col for col in optional_columns if col in df_renamed.columns]
        df_selected = df_renamed[available_columns]
        
        # Fill NaN values
        df_selected = df_selected.fillna("")
        
        # Convert to list of dictionaries
        return df_selected.to_dict('records')
    
    @staticmethod
    def validate_anomaly_data(data: Dict[str, Any]) -> Dict[str, Any]:
        """Validate and clean single anomaly data"""
        required_fields = ['num_equipement', 'systeme', 'description']
        
        # Check required fields
        for field in required_fields:
            if field not in data or not data[field]:
                raise ValueError(f"Missing required field: {field}")
        
        # Clean and return validated data
        return {
            'num_equipement': str(data['num_equipement']).strip(),
            'systeme': str(data['systeme']).strip(),
            'description': str(data['description']).strip(),
            'date_detection': data.get('date_detection', ''),
            'description_equipement': data.get('description_equipement', ''),
            'section_proprietaire': data.get('section_proprietaire', '')
        }
    
    @staticmethod
    def prepare_for_database(anomaly_data: Dict[str, Any], predictions: Dict[str, int]) -> Dict[str, Any]:
        """Prepare anomaly data for database insertion"""
        return {
            # Map fields to correct database column names
            'equipement_id': anomaly_data['num_equipement'],  # num_equipement -> equipement_id
            'description': anomaly_data['description'],
            'service': anomaly_data.get('section_proprietaire', ''),  # section_proprietaire -> service
            'system_id': anomaly_data.get('systeme', ''),  # systeme -> system_id
            'status': 'nouvelle',
            'source_origine': 'api',
            'ai_fiabilite_integrite_score': predictions['ai_fiabilite_integrite_score'],
            'ai_disponibilite_score': predictions['ai_disponibilite_score'],
            'ai_process_safety_score': predictions['ai_process_safety_score'],
            'ai_criticality_level': predictions['ai_criticality_level']
        }
