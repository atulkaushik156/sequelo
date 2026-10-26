import os
import re
import uuid
import logging
import boto3
from typing import List
from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
from fastapi.concurrency import run_in_threadpool

# Ensure these import paths match your project structure
from auth.routes import get_current_user 
from database import get_db_connection

router = APIRouter()
logger = logging.getLogger(__name__)

def get_s3_client():
    """Initializes the boto3 client pointing to Backblaze B2's S3 API."""
    return boto3.client(
        's3',
        endpoint_url=os.environ.get('AWS_ENDPOINT_URL_S3'),
        aws_access_key_id=os.environ.get('AWS_ACCESS_KEY_ID'),
        aws_secret_access_key=os.environ.get('AWS_SECRET_ACCESS_KEY'),
        region_name=os.environ.get('AWS_REGION')
    )

def create_table_alias(filename: str) -> str:
    """Generates a SQL-safe table alias from the uploaded file name."""
    name = filename.rsplit('.csv', 1)[0]
    clean_name = re.sub(r'[^a-zA-Z0-9]', '_', name.lower())
    clean_name = re.sub(r'^[0-9]+', '', clean_name).strip('_')
    return clean_name or "dataset"

@router.post("/upload_documents")
async def upload_document(
    files: List[UploadFile] = File(...), 
    chat_id: str = Form(...),
    user_id: str = Depends(get_current_user),
    conn = Depends(get_db_connection) 
) -> list[dict]:
    
    s3_client = get_s3_client()
    BUCKET_NAME = os.environ.get("B2_BUCKET_NAME") 
    upload_results = []

    for file in files:
        if not file.filename.endswith(".csv"):
            raise HTTPException(status_code=400, detail=f"{file.filename} is not a CSV")

        clean_alias = create_table_alias(file.filename)
        file_uuid = str(uuid.uuid4())
        
        # Structure: tenant_id/chat_id/uuid_alias.csv
        b2_file_name = f"{user_id}/{chat_id}/{file_uuid}_{clean_alias}.csv"
        s3_url = f"s3://{BUCKET_NAME}/{b2_file_name}"
        
        try:
            file_bytes = await file.read()
            
            # Run the synchronous boto3 upload in a background thread to prevent server freeze
            await run_in_threadpool(
                s3_client.put_object,
                Bucket=BUCKET_NAME,
                Key=b2_file_name,
                Body=file_bytes
            )
            
            # Save the file metadata and S3 location to Neon DB
            await conn.execute('''
                INSERT INTO user_datasets 
                (id, chat_id, tenant_id, original_filename, table_alias, s3_url)
                VALUES ($1, $2, $3, $4, $5, $6)
            ''', file_uuid, chat_id, user_id, file.filename, clean_alias, s3_url)
            
            upload_results.append({
                "original_filename": file.filename,
                "table_alias": clean_alias,
                "s3_url": s3_url
            })
            
        except Exception as e:
            logger.error(f"Failed to process {file.filename}: {str(e)}")
            raise HTTPException(
                status_code=500, 
                detail=f"Failed to process {file.filename}. Please try again."
            )
        finally:
            await file.close()
            
    return upload_results