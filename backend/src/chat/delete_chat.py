import os
import logging
import boto3
from fastapi import APIRouter, Depends, HTTPException
from auth.routes import get_current_user
from database import get_db_connection

# Prefix /api handled by main.py
router = APIRouter(tags=["Chat Deletion"])
logger = logging.getLogger(__name__)

# Re-creating the S3 client here so we don't have to touch routes.py at all
def get_s3_client():
    return boto3.client(
        's3', 
        endpoint_url=os.environ.get('AWS_ENDPOINT_URL_S3'), 
        aws_access_key_id=os.environ.get('AWS_ACCESS_KEY_ID'), 
        aws_secret_access_key=os.environ.get('AWS_SECRET_ACCESS_KEY'), 
        region_name=os.environ.get('AWS_REGION')
    )

@router.delete("/chats/{chat_id}")
async def delete_chat_endpoint(
    chat_id: str, 
    user_id: str = Depends(get_current_user), 
    conn = Depends(get_db_connection)
):
    try:
        # 1. Fetch uploaded datasets for this chat so we can delete the physical files from S3 bucket
        datasets = await conn.fetch(
            "SELECT s3_url FROM user_datasets WHERE chat_id = $1::uuid AND tenant_id = $2", 
            chat_id, user_id
        )
        
        # 2. Delete the actual files from the S3 bucket
        if datasets:
            s3_client = get_s3_client()
            BUCKET_NAME = os.environ.get("B2_BUCKET_NAME")
            for dataset in datasets:
                s3_url = dataset.get("s3_url")
                if s3_url and s3_url.startswith(f"s3://{BUCKET_NAME}/"):
                    b2_key = s3_url[len(f"s3://{BUCKET_NAME}/"):]
                    try:
                        s3_client.delete_object(Bucket=BUCKET_NAME, Key=b2_key)
                    except Exception as e:
                        logger.error(f"Failed to delete S3 object {b2_key}: {e}")

        # 3. Delete records from database
        # We wrap this in a transaction so if one fails, nothing gets half-deleted
        async with conn.transaction():
            # Delete children records first (to prevent foreign key errors if cascade isn't set up)
            await conn.execute("DELETE FROM messages WHERE chat_id = $1::uuid AND tenant_id = $2", chat_id, user_id)
            await conn.execute("DELETE FROM user_datasets WHERE chat_id = $1::uuid AND tenant_id = $2", chat_id, user_id)
            await conn.execute("DELETE FROM business_context_embeddings WHERE chat_id = $1::uuid AND tenant_id = $2", chat_id, user_id)
            
            # Finally, delete the parent chat record
            result = await conn.execute("DELETE FROM chats WHERE chat_id = $1::uuid AND tenant_id = $2", chat_id, user_id)
        
        if result == "DELETE 0":
            raise HTTPException(status_code=404, detail="Chat not found or already deleted.")

        return {"message": "Chat successfully deleted"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting chat {chat_id}: {e}")
        raise HTTPException(status_code=500, detail="An error occurred while deleting the chat.")