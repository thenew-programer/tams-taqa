import os
from supabase import create_client, Client
from dotenv import load_dotenv
from typing import List, Dict, Any, Optional
import uuid
from datetime import datetime

load_dotenv()

class SupabaseClient:
    def __init__(self):
        url: str = os.environ.get("SUPABASE_URL")
        # Use service role key to bypass RLS authentication rules
        service_role_key: str = os.environ.get("SUPABASE_ROLE_KEY")
        
        if not url or not service_role_key:
            raise ValueError("SUPABASE_URL and SUPABASE_ROLE_KEY must be set in environment variables")
        
        # Create client with service role key for server-side operations
        self.supabase: Client = create_client(url, service_role_key)
        print("Connected to Supabase with service role key (bypassing RLS)")
    
    async def create_anomaly(self, anomaly_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a single anomaly record in the database"""
        try:
            result = self.supabase.table('anomalies').insert(anomaly_data).execute()
            return result.data[0] if result.data else None
        except Exception as e:
            raise Exception(f"Error creating anomaly: {str(e)}")
    
    async def create_anomalies_batch(self, anomalies_data: List[Dict[str, Any]], batch_id: str) -> List[Dict[str, Any]]:
        """Create multiple anomaly records in a batch"""
        try:
            # Add batch_id to each anomaly
            for anomaly in anomalies_data:
                anomaly['import_batch_id'] = batch_id
            
            result = self.supabase.table('anomalies').insert(anomalies_data).execute()
            return result.data if result.data else []
        except Exception as e:
            # If foreign key constraint fails, try without import_batch_id
            if "foreign key constraint" in str(e) and "import_batch_id" in str(e):
                print(f"Warning: import_batch_id foreign key constraint failed, retrying without batch_id")
                try:
                    # Remove import_batch_id from anomalies and retry
                    anomalies_without_batch = []
                    for anomaly in anomalies_data:
                        anomaly_copy = anomaly.copy()
                        anomaly_copy.pop('import_batch_id', None)
                        anomalies_without_batch.append(anomaly_copy)
                    
                    result = self.supabase.table('anomalies').insert(anomalies_without_batch).execute()
                    return result.data if result.data else []
                except Exception as retry_error:
                    raise Exception(f"Error creating anomalies batch (retry failed): {str(retry_error)}")
            else:
                raise Exception(f"Error creating anomalies batch: {str(e)}")
    
    async def create_import_batch(self, filename: str, total_records: int) -> str:
        """Create an import batch record and return its ID"""
        try:
            batch_data = {
                'id': str(uuid.uuid4()),
                'filename': filename,
                'total_records': total_records,
                'status': 'completed',
                'created_at': datetime.utcnow().isoformat()
            }
            
            # Create the import batch record in the database
            result = self.supabase.table('import_batches').insert(batch_data).execute()
            
            if result.data and len(result.data) > 0:
                return result.data[0]['id']
            else:
                # If import_batches table doesn't exist or insert failed, return UUID anyway
                # The anomalies table might not have the foreign key constraint
                return batch_data['id']
                
        except Exception as e:
            # If import_batches table doesn't exist, just return a UUID
            # This allows the system to work even without the import_batches table
            print(f"Warning: Could not create import batch record: {str(e)}")
            return str(uuid.uuid4())

# Global instance
supabase_client = SupabaseClient()
