import os
from b2sdk.v2 import InMemoryAccountInfo, B2Api

def _get_b2_bucket():
    """Initializes and authenticates the Backblaze B2 client."""
    info = InMemoryAccountInfo()
    b2_api = B2Api(info)
    
    # Get credentials from your .env file
    application_key_id = os.environ.get("B2_KEY_ID")
    application_key = os.environ.get("B2_APPLICATION_KEY")
    bucket_name = os.environ.get("B2_BUCKET_NAME")
    
    # Authorize and return the bucket object
    b2_api.authorize_account("production", application_key_id, application_key)
    return b2_api.get_bucket_by_name(bucket_name)