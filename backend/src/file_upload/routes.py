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
        if not file.filename.endswith((".csv", ".xlsx")):
            raise HTTPException(status_code=400, detail=f"{file.filename} is not supported")

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


# --- NEW ENDPOINTS FOR REACT FILE BAR ---

@router.get("/api/chats/{chat_id}/files")
async def get_chat_files(
    chat_id: str,
    user_id: str = Depends(get_current_user),
    conn = Depends(get_db_connection)
):
    """
    Returns the lightweight metadata so the React File Bar can display names & sizes.
    """
    # Fetch files associated with this chat AND this user (security check)
    records = await conn.fetch('''
        SELECT id, original_filename 
        FROM user_datasets 
        WHERE chat_id = $1 AND tenant_id = $2
    ''', chat_id, user_id)
    
    # Map DB records to the format the React frontend expects
    frontend_files = [
        {
            "file_id": str(record["id"]),
            "file_name": record["original_filename"],
            "file_size": 0 # (If you add a file_size column to user_datasets later, map it here)
        }
        for record in records
    ]
    
    return {"files": frontend_files}


@router.get("/api/chats/{chat_id}/files/{file_id}/download")
async def generate_download_link(
    chat_id: str, 
    file_id: str,
    user_id: str = Depends(get_current_user),
    conn = Depends(get_db_connection)
):
    """
    Generates a secure, 15-minute Backblaze download link directly to the user's browser.
    """
    # 1. Verify ownership and get the S3 URL
    record = await conn.fetchrow('''
        SELECT s3_url 
        FROM user_datasets 
        WHERE id = $1 AND chat_id = $2 AND tenant_id = $3
    ''', file_id, chat_id, user_id)
    
    if not record:
        raise HTTPException(status_code=404, detail="File not found or access denied")
        
    s3_url = record["s3_url"]
    BUCKET_NAME = os.environ.get("B2_BUCKET_NAME") 
    
    # 2. Extract the actual B2 object key from the s3_url
    # e.g. "s3://my-bucket/tenant_1/chat_1/uuid_name.csv" -> "tenant_1/chat_1/uuid_name.csv"
    prefix_to_remove = f"s3://{BUCKET_NAME}/"
    if s3_url.startswith(prefix_to_remove):
        b2_key = s3_url[len(prefix_to_remove):]
    else:
        b2_key = s3_url # Fallback if URL format differs

    # 3. Generate the presigned URL
    s3_client = get_s3_client()
    try:
        presigned_url = s3_client.generate_presigned_url(
            'get_object',
            Params={
                'Bucket': BUCKET_NAME,
                'Key': b2_key
            },
            ExpiresIn=900 # 15 minutes
        )
        return {"download_url": presigned_url}
    except Exception as e:
        logger.error(f"Failed to generate presigned URL: {str(e)}")
        raise HTTPException(status_code=500, detail="Could not generate download link")