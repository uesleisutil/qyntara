"""
Data Encryption Utilities

Implements:
- Requirement 82.10: Encrypt sensitive data at rest in S3
"""

import base64
import json
import logging
import os
from typing import Any, Dict

import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# AWS clients
s3 = boto3.client("s3")
kms = boto3.client("kms")

# Environment variables
KMS_KEY_ID = os.environ.get("KMS_KEY_ID", "")


def encrypt_data(data: bytes, key_id: str = KMS_KEY_ID) -> Dict[str, str]:
    """
    Encrypt data using AWS KMS.
    
    Args:
        data: Data to encrypt
        key_id: KMS key ID
        
    Returns:
        Dictionary with encrypted data and metadata
    """
    try:
        response = kms.encrypt(
            KeyId=key_id,
            Plaintext=data
        )
        
        return {
            "ciphertext": base64.b64encode(response["CiphertextBlob"]).decode("utf-8"),
            "keyId": response["KeyId"]
        }
        
    except ClientError as e:
        logger.error(f"Error encrypting data: {e}")
        raise


def decrypt_data(ciphertext: str) -> bytes:
    """
    Decrypt data using AWS KMS.
    
    Args:
        ciphertext: Base64-encoded encrypted data
        
    Returns:
        Decrypted data
    """
    try:
        ciphertext_blob = base64.b64decode(ciphertext)
        
        response = kms.decrypt(
            CiphertextBlob=ciphertext_blob
        )
        
        return response["Plaintext"]
        
    except ClientError as e:
        logger.error(f"Error decrypting data: {e}")
        raise


def upload_encrypted_to_s3(
    bucket: str,
    key: str,
    data: Any,
    kms_key_id: str = KMS_KEY_ID,
    metadata: Dict[str, str] = None
) -> None:
    """
    Upload data to S3 with server-side encryption using KMS.
    Implements Requirement 82.10.
    
    Args:
        bucket: S3 bucket name
        key: S3 object key
        data: Data to upload (will be JSON serialized if not bytes)
        kms_key_id: KMS key ID for encryption
        metadata: Optional metadata to attach
    """
    try:
        # Convert data to bytes if needed
        if isinstance(data, (dict, list)):
            data_bytes = json.dumps(data).encode("utf-8")
        elif isinstance(data, str):
            data_bytes = data.encode("utf-8")
        else:
            data_bytes = data
        
        # Upload with server-side encryption
        put_args = {
            "Bucket": bucket,
            "Key": key,
            "Body": data_bytes,
            "ServerSideEncryption": "aws:kms",
            "SSEKMSKeyId": kms_key_id
        }
        
        if metadata:
            put_args["Metadata"] = metadata
        
        s3.put_object(**put_args)
        
        logger.info(f"Uploaded encrypted data to s3://{bucket}/{key}")
        
    except ClientError as e:
        logger.error(f"Error uploading encrypted data to S3: {e}")
        raise


def download_encrypted_from_s3(bucket: str, key: str) -> bytes:
    """
    Download and decrypt data from S3.
    
    Args:
        bucket: S3 bucket name
        key: S3 object key
        
    Returns:
        Decrypted data
    """
    try:
        response = s3.get_object(Bucket=bucket, Key=key)
        
        # Data is automatically decrypted by S3 if it was encrypted with KMS
        data = response["Body"].read()
        
        logger.info(f"Downloaded encrypted data from s3://{bucket}/{key}")
        
        return data
        
    except ClientError as e:
        logger.error(f"Error downloading encrypted data from S3: {e}")
        raise


def enable_bucket_encryption(bucket: str, kms_key_id: str = KMS_KEY_ID) -> None:
    """
    Enable default encryption for an S3 bucket.
    
    Args:
        bucket: S3 bucket name
        kms_key_id: KMS key ID for encryption
    """
    try:
        s3.put_bucket_encryption(
            Bucket=bucket,
            ServerSideEncryptionConfiguration={
                "Rules": [
                    {
                        "ApplyServerSideEncryptionByDefault": {
                            "SSEAlgorithm": "aws:kms",
                            "KMSMasterKeyID": kms_key_id
                        },
                        "BucketKeyEnabled": True
                    }
                ]
            }
        )
        
        logger.info(f"Enabled encryption for bucket {bucket}")
        
    except ClientError as e:
        logger.error(f"Error enabling bucket encryption: {e}")
        raise


def verify_bucket_encryption(bucket: str) -> Dict[str, Any]:
    """
    Verify that a bucket has encryption enabled.
    
    Args:
        bucket: S3 bucket name
        
    Returns:
        Encryption configuration
    """
    try:
        response = s3.get_bucket_encryption(Bucket=bucket)
        
        rules = response.get("ServerSideEncryptionConfiguration", {}).get("Rules", [])
        
        if not rules:
            logger.warning(f"Bucket {bucket} has no encryption rules")
            return {"encrypted": False}
        
        rule = rules[0]
        sse_config = rule.get("ApplyServerSideEncryptionByDefault", {})
        
        return {
            "encrypted": True,
            "algorithm": sse_config.get("SSEAlgorithm"),
            "kmsKeyId": sse_config.get("KMSMasterKeyID"),
            "bucketKeyEnabled": rule.get("BucketKeyEnabled", False)
        }
        
    except ClientError as e:
        if e.response["Error"]["Code"] == "ServerSideEncryptionConfigurationNotFoundError":
            logger.warning(f"Bucket {bucket} has no encryption configuration")
            return {"encrypted": False}
        else:
            logger.error(f"Error verifying bucket encryption: {e}")
            raise


def classify_data_sensitivity(data: Dict[str, Any]) -> str:
    """
    Classify data sensitivity level.
    
    Args:
        data: Data to classify
        
    Returns:
        Sensitivity level: "public", "internal", "confidential", "restricted"
    """
    # Define sensitive field patterns
    sensitive_patterns = [
        "password", "secret", "token", "key", "credential",
        "ssn", "tax_id", "credit_card", "bank_account",
        "api_key", "private_key", "access_token"
    ]
    
    # Check for sensitive fields
    data_str = json.dumps(data).lower()
    
    for pattern in sensitive_patterns:
        if pattern in data_str:
            return "restricted"
    
    # Check for PII
    pii_patterns = ["email", "phone", "address", "name", "dob", "birth"]
    for pattern in pii_patterns:
        if pattern in data_str:
            return "confidential"
    
    # Default to internal
    return "internal"


def mask_sensitive_data(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Mask sensitive data for logging or display.
    
    Args:
        data: Data to mask
        
    Returns:
        Data with sensitive fields masked
    """
    sensitive_keys = [
        "password", "secret", "token", "api_key", "access_token",
        "private_key", "ssn", "tax_id", "credit_card"
    ]
    
    def mask_value(value: str) -> str:
        """Mask a value, showing only first and last 4 characters"""
        if len(value) <= 8:
            return "*" * len(value)
        return value[:4] + "*" * (len(value) - 8) + value[-4:]
    
    def mask_dict(d: Dict[str, Any]) -> Dict[str, Any]:
        """Recursively mask sensitive fields in dictionary"""
        masked = {}
        for key, value in d.items():
            # Check if key contains sensitive pattern
            is_sensitive = any(sensitive in key.lower() for sensitive in sensitive_keys)
            
            if is_sensitive and isinstance(value, str):
                # Only mask string values, not nested dicts
                masked[key] = mask_value(value)
            elif isinstance(value, dict):
                # Recursively process nested dictionaries
                masked[key] = mask_dict(value)
            elif isinstance(value, list):
                masked[key] = [
                    mask_dict(item) if isinstance(item, dict) else item 
                    for item in value
                ]
            else:
                masked[key] = value
        return masked
    
    return mask_dict(data)
