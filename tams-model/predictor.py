import warnings
import os
from typing import List, Dict, Any, Union

# Suppress scikit-learn version warnings
warnings.filterwarnings('ignore', category=UserWarning, module='sklearn')

# Try to import dependencies with graceful fallback
try:
    import pandas as pd
    import numpy as np
    import joblib
    from sklearn.preprocessing import LabelEncoder
    from sklearn.feature_extraction.text import CountVectorizer
    DEPENDENCIES_AVAILABLE = True
    print("All ML dependencies loaded successfully")
except ImportError as e:
    print(f"ML dependencies not fully available: {e}")
    print("Using simplified prediction logic")
    DEPENDENCIES_AVAILABLE = False
    
    # Create minimal fallback classes
    class pd:
        @staticmethod
        def DataFrame(data):
            return data
    
    class np:
        @staticmethod
        def array(data):
            return data

class TAMSPredictor:
    def __init__(self, model_path: str = None):
        if model_path is None:
            model_path = os.path.join(os.path.dirname(__file__), "ml_models", "multi_output_model.pkl")
        
        self.model = None
        self.model_loaded = False
        
        # Additional model components (if available)
        self.label_encoders = {}
        self.vectorizer = None
        self.target_columns = []
        self.categorical_columns = []
        
        try:
            # Load the trained model with warnings suppressed
            if os.path.exists(model_path):
                with warnings.catch_warnings():
                    warnings.simplefilter("ignore")
                    loaded_object = joblib.load(model_path)
                    
                # Handle different model storage formats
                model_to_validate = self._extract_model_from_loaded_object(loaded_object)
                
                if model_to_validate and self._validate_model(model_to_validate):
                    self.model = model_to_validate
                    self.model_loaded = True
                    print(f"Model loaded and validated successfully from {model_path}")
                    print(f"Model type: {type(self.model)}")
                    
                    # Store additional components if available
                    if isinstance(loaded_object, dict):
                        self.label_encoders = loaded_object.get('label_encoders', {})
                        self.vectorizer = loaded_object.get('vectorizer', None)
                        self.target_columns = loaded_object.get('target_columns', [])
                        self.categorical_columns = loaded_object.get('categorical_columns', [])
                        print(f"Additional components loaded: encoders={len(self.label_encoders)}, vectorizer={self.vectorizer is not None}")
                else:
                    print(f"Warning: Could not extract valid model from loaded object")
                    print(f"Object type: {type(loaded_object)}")
                    print("Using rule-based prediction logic")
            else:
                print(f"Warning: Model file not found at {model_path}")
                print("Using rule-based prediction logic")
                
        except Exception as e:
            print(f"Warning: Error loading model: {str(e)}")
            print("Using rule-based prediction logic")
            self.model = None
            self.model_loaded = False
    
    def _validate_model(self, model) -> bool:
        """Validate that the loaded object is a proper scikit-learn model"""
        try:
            # Check if it's a dictionary (common error case)
            if isinstance(model, dict):
                print("DEBUG: Loaded object is a dictionary, not a model")
                return False
            
            # Check if it has a predict method
            if not hasattr(model, 'predict'):
                print("DEBUG: Loaded object does not have a predict method")
                return False
            
            # Check if predict is callable
            if not callable(getattr(model, 'predict')):
                print("DEBUG: predict attribute is not callable")
                return False
            
            # Try to inspect the model further
            if hasattr(model, '__class__'):
                class_name = model.__class__.__name__
                print(f"DEBUG: Model class: {class_name}")
                
                # Check if it looks like a scikit-learn model
                valid_sklearn_bases = ['BaseEstimator', 'ClassifierMixin', 'RegressorMixin']
                if hasattr(model, '__class__') and hasattr(model.__class__, '__mro__'):
                    base_classes = [cls.__name__ for cls in model.__class__.__mro__]
                    print(f"DEBUG: Model inheritance chain: {base_classes}")
                    
                    # If it has sklearn-like inheritance, it's probably valid
                    if any(base in base_classes for base in valid_sklearn_bases):
                        print("DEBUG: Model appears to be a valid scikit-learn estimator")
                        return True
                
                # Check for common sklearn model classes
                sklearn_models = [
                    'RandomForestRegressor', 'RandomForestClassifier',
                    'LinearRegression', 'LogisticRegression',
                    'SVC', 'SVR', 'DecisionTreeRegressor', 'DecisionTreeClassifier',
                    'GradientBoostingRegressor', 'GradientBoostingClassifier',
                    'XGBRegressor', 'XGBClassifier',
                    'LGBMRegressor', 'LGBMClassifier'
                ]
                
                if class_name in sklearn_models:
                    print(f"DEBUG: Recognized sklearn model: {class_name}")
                    return True
                
                # If it has predict method and is not a dict, give it a chance
                print(f"DEBUG: Unknown model type {class_name}, but has predict method - allowing")
                return True
            
            print("DEBUG: Could not determine model type, but has predict method - allowing")
            return True
            
        except Exception as e:
            print(f"DEBUG: Error validating model: {e}")
            return False
    
    def _prepare_features(self, data: Union[Dict[str, Any], List[Dict[str, Any]]]) -> Any:
        """Prepare features for prediction using the saved encoders and vectorizer"""
        if not DEPENDENCIES_AVAILABLE:
            print("ML dependencies not available, using rule-based prediction logic only")
            return data  # Return raw data if dependencies not available
            
        if isinstance(data, dict):
            data = [data]
        
        print(f"DEBUG: Preparing features for {len(data)} samples")
        
        try:
            df = pd.DataFrame(data)
            print(f"DEBUG: DataFrame columns: {df.columns.tolist()}")
            print(f"DEBUG: DataFrame shape: {df.shape}")
            
            # Fill missing values
            df = df.fillna("unknown")
            
            # If we have the original encoders and vectorizer, use them
            if hasattr(self, 'label_encoders') and hasattr(self, 'vectorizer') and self.label_encoders and self.vectorizer:
                print("DEBUG: Using saved encoders and vectorizer")
                return self._prepare_features_with_saved_components(df)
            else:
                print("DEBUG: Using fallback feature preparation")
                return self._prepare_features_fallback(df)
                
        except Exception as e:
            print(f"Feature preparation error: {e}")
            print(f"DEBUG: Returning basic features due to error")
            return self._prepare_features_fallback(data)
    
    def _prepare_features_with_saved_components(self, df):
        """Prepare features using the saved label encoders and vectorizer"""
        try:
            feature_arrays = []
            
            # Map column names (handle different naming conventions)
            column_mapping = {
                'num_equipement': 'Num_equipement',
                'systeme': 'Systeme',
                'description': "Description de l'équipement",
                'section_proprietaire': 'Section propriétaire'
            }
            
            # Process categorical columns with label encoders
            for col_key, encoder in self.label_encoders.items():
                # Find the corresponding column in the dataframe
                df_col = None
                for df_col_name in df.columns:
                    if (df_col_name.lower() == col_key.lower() or 
                        df_col_name == col_key or
                        column_mapping.get(df_col_name, df_col_name) == col_key):
                        df_col = df_col_name
                        break
                
                if df_col and df_col in df.columns:
                    print(f"DEBUG: Processing column {df_col} with encoder for {col_key}")
                    
                    # Handle unseen categories
                    values = df[df_col].fillna("unknown").astype(str)
                    encoded_values = []
                    
                    for value in values:
                        try:
                            # Try to encode with the saved encoder
                            encoded = encoder.transform([value])[0]
                            encoded_values.append(encoded)
                        except ValueError:
                            # Handle unseen categories by assigning a default value
                            print(f"DEBUG: Unseen category '{value}' for column {col_key}, using default")
                            encoded_values.append(0)  # or use len(encoder.classes_) for a new category
                    
                    feature_arrays.append(np.array(encoded_values).reshape(-1, 1))
                    print(f"DEBUG: Encoded {col_key} shape: {np.array(encoded_values).reshape(-1, 1).shape}")
                else:
                    print(f"DEBUG: Column {col_key} not found in dataframe, using zeros")
                    feature_arrays.append(np.zeros((len(df), 1)))
            
            # Process text features with the saved vectorizer
            if self.vectorizer:
                # Find description column
                desc_col = None
                for col in df.columns:
                    if 'description' in col.lower() or 'desc' in col.lower():
                        desc_col = col
                        break
                
                if desc_col:
                    print(f"DEBUG: Processing text column {desc_col} with saved vectorizer")
                    descriptions = df[desc_col].fillna("").astype(str)
                    
                    # Transform using the saved vectorizer
                    text_features = self.vectorizer.transform(descriptions)
                    
                    # Convert to dense array if sparse
                    if hasattr(text_features, 'toarray'):
                        text_features = text_features.toarray()
                    
                    feature_arrays.append(text_features)
                    print(f"DEBUG: Text features shape: {text_features.shape}")
                else:
                    print("DEBUG: No description column found, using zeros for text features")
                    feature_arrays.append(np.zeros((len(df), 100)))  # Default size
            
            # Combine all features
            if feature_arrays:
                X = np.concatenate(feature_arrays, axis=1)
                print(f"DEBUG: Combined features shape: {X.shape}")
                return X
            else:
                print("DEBUG: No features prepared, using fallback")
                return self._prepare_features_fallback(df)
                
        except Exception as e:
            print(f"DEBUG: Error in saved components feature preparation: {e}")
            return self._prepare_features_fallback(df)
    
    def _prepare_features_fallback(self, data):
        """Fallback feature preparation when encoders are not available"""
        try:
            if isinstance(data, dict):
                data = [data]
            
            df = pd.DataFrame(data)
            print(f"DEBUG: Fallback preparation for shape: {df.shape}")
            
            # Fill missing values
            df = df.fillna("unknown")
            
            # Simple encoding for demo - in production, use saved encoders
            numeric_features = []
            for col in ["systeme", "num_equipement"]:
                if col in df.columns:
                    print(f"DEBUG: Processing column {col}")
                    # Simple hash-based encoding for unseen categories
                    encoded = df[col].apply(lambda x: hash(str(x)) % 1000)
                    numeric_features.append(encoded.values.reshape(-1, 1))
                    print(f"DEBUG: Encoded {col} shape: {encoded.values.reshape(-1, 1).shape}")
            
            # Text vectorization for description
            if "description" in df.columns:
                print("DEBUG: Processing description column")
                # For demo, use simple bag of words
                descriptions = df["description"].fillna("").astype(str)
                
                # Create a simple vectorization
                vocab_size = 100
                text_features = np.zeros((len(descriptions), vocab_size))
                
                for i, desc in enumerate(descriptions):
                    words = desc.lower().split()[:vocab_size]
                    for j, word in enumerate(words):
                        if j < vocab_size:
                            text_features[i, j] = hash(word) % 100
                            
                print(f"DEBUG: Text features shape: {text_features.shape}")
            else:
                print("DEBUG: No description column, using zero features")
                text_features = np.zeros((len(df), 100))
            
            # Combine features
            if numeric_features:
                X = np.concatenate([np.hstack(numeric_features), text_features], axis=1)
                print(f"DEBUG: Combined features shape: {X.shape}")
            else:
                X = text_features
                print(f"DEBUG: Using only text features shape: {X.shape}")
            
            return X
        except Exception as e:
            print(f"Fallback feature preparation error: {e}")
            # Return a default feature array if everything fails
            return np.zeros((1, 104))  # Match expected model input size
    
    def _fallback_prediction(self, anomaly_data: Dict[str, Any]) -> Dict[str, int]:
        """Fallback prediction when model is not available"""
        description = str(anomaly_data.get('description', '')).lower()
        
        # Initialize with medium scores
        fiabilite_score = 3
        disponibilite_score = 3
        process_safety_score = 3
        
        # Adjust scores based on keywords
        critical_keywords = ['failure', 'broken', 'leak', 'fire', 'explosion', 'pressure', 'overheat']
        medium_keywords = ['wear', 'drift', 'irregularities', 'drop', 'issue']
        low_keywords = ['calibration', 'maintenance', 'check']
        
        if any(keyword in description for keyword in critical_keywords):
            fiabilite_score = 4
            disponibilite_score = 4
            process_safety_score = 5
        elif any(keyword in description for keyword in medium_keywords):
            fiabilite_score = 3
            disponibilite_score = 3
            process_safety_score = 3
        elif any(keyword in description for keyword in low_keywords):
            fiabilite_score = 2
            disponibilite_score = 2
            process_safety_score = 2
        
        # Adjust based on system type
        system = str(anomaly_data.get('systeme', '')).lower()
        if 'electrical' in system:
            process_safety_score = min(5, process_safety_score + 1)
        elif 'hydraulic' in system or 'pneumatic' in system:
            disponibilite_score = min(5, disponibilite_score + 1)
        
        criticality_level = fiabilite_score + disponibilite_score + process_safety_score
        
        return {
            "ai_fiabilite_integrite_score": fiabilite_score,
            "ai_disponibilite_score": disponibilite_score,
            "ai_process_safety_score": process_safety_score,
            "ai_criticality_level": criticality_level
        }
    
    def predict_single(self, anomaly_data: Dict[str, Any]) -> Dict[str, int]:
        """Predict scores for a single anomaly"""
        print(f"DEBUG: Starting prediction for anomaly: {anomaly_data.get('num_equipement', 'unknown')}")
        print(f"DEBUG: DEPENDENCIES_AVAILABLE: {DEPENDENCIES_AVAILABLE}")
        print(f"DEBUG: model_loaded: {self.model_loaded}")
        print(f"DEBUG: model is not None: {self.model is not None}")
        
        try:
            if DEPENDENCIES_AVAILABLE and self.model_loaded and self.model is not None and self._validate_model(self.model):
                print("DEBUG: Using ML model for prediction")
                X = self._prepare_features(anomaly_data)
                print(f"DEBUG: Features prepared, shape: {X.shape if hasattr(X, 'shape') else 'unknown'}")
                
                # Make prediction
                prediction = self.model.predict(X)
                print(f"DEBUG: Raw model prediction: {prediction}")
                print(f"DEBUG: Prediction shape: {prediction.shape if hasattr(prediction, 'shape') else 'unknown'}")
                
                # Handle different model output formats
                if len(prediction.shape) == 2 and prediction.shape[1] >= 3:
                    # Multi-output model: [[fiabilite, disponibilite, process_safety, ...]]
                    fiabilite_score = max(1, min(5, int(round(prediction[0][0]))))
                    disponibilite_score = max(1, min(5, int(round(prediction[0][1]))))
                    process_safety_score = max(1, min(5, int(round(prediction[0][2]))))
                    
                    # Check if criticality is predicted directly or calculate it
                    if prediction.shape[1] >= 4:
                        # Model predicts criticality directly
                        criticality_predicted = max(3, min(15, int(round(prediction[0][3]))))
                        print(f"DEBUG: Model predicted criticality: {criticality_predicted}")
                        # Use calculated sum for consistency unless the predicted one is very different
                        calculated_criticality = fiabilite_score + disponibilite_score + process_safety_score
                        # Use the calculated sum (more logical)
                        criticality_level = calculated_criticality
                    else:
                        # Calculate criticality as sum of the three scores
                        criticality_level = fiabilite_score + disponibilite_score + process_safety_score
                        
                elif len(prediction.shape) == 1 and len(prediction) >= 3:
                    # Single row output: [fiabilite, disponibilite, process_safety]
                    fiabilite_score = max(1, min(5, int(round(prediction[0]))))
                    disponibilite_score = max(1, min(5, int(round(prediction[1]))))
                    process_safety_score = max(1, min(5, int(round(prediction[2]))))
                    
                    # Check if criticality is provided directly
                    if len(prediction) >= 4:
                        criticality_predicted = max(3, min(15, int(round(prediction[3]))))
                        print(f"DEBUG: Model predicted criticality: {criticality_predicted}")
                        calculated_criticality = fiabilite_score + disponibilite_score + process_safety_score
                        criticality_level = calculated_criticality
                    else:
                        criticality_level = fiabilite_score + disponibilite_score + process_safety_score
                else:
                    print(f"DEBUG: Unexpected prediction format, falling back to rule-based")
                    return self._fallback_prediction(anomaly_data)
                
                result = {
                    "ai_fiabilite_integrite_score": fiabilite_score,
                    "ai_disponibilite_score": disponibilite_score,
                    "ai_process_safety_score": process_safety_score,
                    "ai_criticality_level": criticality_level
                }
                print(f"DEBUG: ML prediction result: {result}")
                return result
            else:
                print("DEBUG: Using fallback prediction")
                print(f"DEBUG: Conditions - DEPENDENCIES_AVAILABLE: {DEPENDENCIES_AVAILABLE}, model_loaded: {self.model_loaded}, model is not None: {self.model is not None}, model valid: {self._validate_model(self.model) if self.model else False}")
                # Use fallback prediction
                return self._fallback_prediction(anomaly_data)
        except Exception as e:
            print(f"Prediction error: {e}")
            print(f"DEBUG: Exception in prediction, using fallback")
            # Return fallback prediction on error
            return self._fallback_prediction(anomaly_data)
    
    def predict_batch(self, anomalies_data: List[Dict[str, Any]]) -> List[Dict[str, int]]:
        """Predict scores for multiple anomalies"""
        print(f"DEBUG: Starting batch prediction for {len(anomalies_data)} anomalies")
        
        try:
            if DEPENDENCIES_AVAILABLE and self.model_loaded and self.model is not None and self._validate_model(self.model):
                print("DEBUG: Using ML model for batch prediction")
                X = self._prepare_features(anomalies_data)
                print(f"DEBUG: Features prepared for batch, shape: {X.shape if hasattr(X, 'shape') else 'unknown'}")
                
                # Make predictions
                predictions = self.model.predict(X)
                print(f"DEBUG: Raw batch predictions shape: {predictions.shape if hasattr(predictions, 'shape') else 'unknown'}")
                
                results = []
                for i, prediction in enumerate(predictions):
                    print(f"DEBUG: Processing prediction {i}: {prediction}")
                    
                    # Handle different prediction formats
                    if len(prediction.shape) == 1 and len(prediction) >= 3:
                        # Single prediction: [fiabilite, disponibilite, process_safety, ...]
                        fiabilite_score = max(1, min(5, int(round(prediction[0]))))
                        disponibilite_score = max(1, min(5, int(round(prediction[1]))))
                        process_safety_score = max(1, min(5, int(round(prediction[2]))))
                        
                        # Check if criticality is provided directly
                        if len(prediction) >= 4:
                            criticality_predicted = max(3, min(15, int(round(prediction[3]))))
                            print(f"DEBUG: Model predicted criticality for item {i}: {criticality_predicted}")
                            calculated_criticality = fiabilite_score + disponibilite_score + process_safety_score
                            criticality_level = calculated_criticality
                        else:
                            criticality_level = fiabilite_score + disponibilite_score + process_safety_score
                            
                    elif hasattr(prediction, '__len__') and len(prediction) >= 3:
                        # Array-like with at least 3 elements
                        fiabilite_score = max(1, min(5, int(round(prediction[0]))))
                        disponibilite_score = max(1, min(5, int(round(prediction[1]))))
                        process_safety_score = max(1, min(5, int(round(prediction[2]))))
                        
                        # Check if criticality is provided directly
                        if len(prediction) >= 4:
                            criticality_predicted = max(3, min(15, int(round(prediction[3]))))
                            print(f"DEBUG: Model predicted criticality for item {i}: {criticality_predicted}")
                            calculated_criticality = fiabilite_score + disponibilite_score + process_safety_score
                            criticality_level = calculated_criticality
                        else:
                            criticality_level = fiabilite_score + disponibilite_score + process_safety_score
                    else:
                        print(f"DEBUG: Unexpected prediction format for item {i}, using fallback")
                        results.append(self._fallback_prediction(anomalies_data[i]))
                        continue
                    
                    result = {
                        "ai_fiabilite_integrite_score": fiabilite_score,
                        "ai_disponibilite_score": disponibilite_score,
                        "ai_process_safety_score": process_safety_score,
                        "ai_criticality_level": criticality_level
                    }
                    print(f"DEBUG: ML prediction result {i}: {result}")
                    results.append(result)
                
                return results
            else:
                print("DEBUG: Using fallback predictions for batch")
                # Use fallback predictions
                return [self._fallback_prediction(anomaly) for anomaly in anomalies_data]
        except Exception as e:
            print(f"Batch prediction error: {e}")
            print(f"DEBUG: Exception in batch prediction, using fallback")
            # Return fallback predictions for all items if prediction fails
            return [self._fallback_prediction(anomaly) for anomaly in anomalies_data]
    
    def _extract_model_from_loaded_object(self, loaded_object):
        """Extract the actual model from different storage formats"""
        try:
            # If it's already a model object
            if self._validate_model(loaded_object):
                print("DEBUG: Loaded object is directly a model")
                return loaded_object
            
            # If it's a dictionary (common format for saving model + metadata)
            if isinstance(loaded_object, dict):
                print("DEBUG: Loaded object is a dictionary, looking for model")
                
                # Common keys where the model might be stored
                model_keys = ['model', 'estimator', 'classifier', 'regressor', 'predictor']
                
                for key in model_keys:
                    if key in loaded_object:
                        potential_model = loaded_object[key]
                        print(f"DEBUG: Found potential model under key '{key}': {type(potential_model)}")
                        
                        if self._validate_model(potential_model):
                            print(f"DEBUG: Valid model found under key '{key}'")
                            return potential_model
                
                # If no standard key found, check all values
                print("DEBUG: No standard model key found, checking all dictionary values")
                for key, value in loaded_object.items():
                    if self._validate_model(value):
                        print(f"DEBUG: Valid model found under key '{key}'")
                        return value
                
                print("DEBUG: No valid model found in dictionary")
                return None
            
            # If it's a list or tuple, check elements
            if isinstance(loaded_object, (list, tuple)):
                print("DEBUG: Loaded object is a list/tuple, checking elements")
                for i, item in enumerate(loaded_object):
                    if self._validate_model(item):
                        print(f"DEBUG: Valid model found at index {i}")
                        return item
                
                print("DEBUG: No valid model found in list/tuple")
                return None
            
            print(f"DEBUG: Unknown object type: {type(loaded_object)}")
            return None
            
        except Exception as e:
            print(f"DEBUG: Error extracting model: {e}")
            return None

# Global predictor instance
predictor = TAMSPredictor()
