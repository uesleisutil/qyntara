"""
Lambda para fazer proxy de dados do S3 para o dashboard
Permite acesso aos dados via API Gateway sem expor credenciais AWS
"""
import json
import boto3
import os
from datetime import datetime

s3 = boto3.client('s3')
BUCKET = os.environ['BUCKET']

ALLOWED_ORIGINS = os.environ.get(
    'ALLOWED_ORIGINS',
    'https://qyntara.tech,https://www.qyntara.tech'
).split(',')

# Prefixes allowed for read access (prevent arbitrary S3 traversal)
ALLOWED_PREFIXES = (
    'recommendations/', 'monitoring/', 'curated/',
    'config/', 'models/', 'processed/', 'feature_store/',
)

SECURITY_HEADERS = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Cache-Control': 'no-store',
}


def _get_cors_origin(event):
    """Return the request Origin if it is in the allow-list, else the first allowed origin."""
    headers = event.get('headers') or {}
    origin = headers.get('origin') or headers.get('Origin') or ''
    if origin in ALLOWED_ORIGINS:
        return origin
    return ALLOWED_ORIGINS[0]


def _validate_path(key: str) -> bool:
    """Reject path traversal and keys outside allowed prefixes."""
    if not key:
        return False
    if '..' in key or key.startswith('/'):
        return False
    return key.startswith(ALLOWED_PREFIXES)


def handler(event, context):
    """
    Proxy para acessar dados do S3 via API Gateway
    
    Endpoints:
    - GET /s3-proxy?key=path/to/file.json - Retorna conteúdo de um arquivo
    - GET /s3-proxy/list?prefix=path/ - Lista objetos com prefixo
    """
    cors_origin = _get_cors_origin(event)

    try:
        # Parse query parameters
        params = event.get('queryStringParameters', {}) or {}
        path = event.get('path', '')
        
        # List objects
        if '/list' in path:
            prefix = params.get('prefix', '')
            
            if not _validate_path(prefix):
                return {
                    'statusCode': 403,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': cors_origin,
                        **SECURITY_HEADERS,
                    },
                    'body': json.dumps({'error': 'Access denied'})
                }
            
            response = s3.list_objects_v2(
                Bucket=BUCKET,
                Prefix=prefix,
                MaxKeys=100
            )
            
            objects = []
            if 'Contents' in response:
                for obj in response['Contents']:
                    objects.append({
                        'Key': obj['Key'],
                        'LastModified': obj['LastModified'].isoformat(),
                        'Size': obj['Size']
                    })
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': cors_origin,
                    'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
                    'Access-Control-Allow-Methods': 'GET,OPTIONS',
                    **SECURITY_HEADERS,
                },
                'body': json.dumps({
                    'objects': objects,
                    'count': len(objects),
                    'prefix': prefix
                })
            }
        
        # Get object
        else:
            key = params.get('key', '')
            
            if not _validate_path(key):
                return {
                    'statusCode': 403,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': cors_origin,
                        **SECURITY_HEADERS,
                    },
                    'body': json.dumps({'error': 'Access denied'})
                }
            
            try:
                response = s3.get_object(Bucket=BUCKET, Key=key)
                content = response['Body'].read().decode('utf-8')
                
                # CSV files: convert to JSON array of objects
                if key.endswith('.csv'):
                    import csv
                    import io
                    reader = csv.DictReader(io.StringIO(content))
                    data = list(reader)
                else:
                    data = json.loads(content)
                
                return {
                    'statusCode': 200,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': cors_origin,
                        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
                        'Access-Control-Allow-Methods': 'GET,OPTIONS',
                        **SECURITY_HEADERS,
                    },
                    'body': json.dumps(data)
                }
            
            except s3.exceptions.NoSuchKey:
                return {
                    'statusCode': 404,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': cors_origin,
                        **SECURITY_HEADERS,
                    },
                    'body': json.dumps({'error': 'Object not found'})
                }
    
    except Exception as e:
        print(f"Error in s3_proxy: {str(e)}")
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': cors_origin,
                **SECURITY_HEADERS,
            },
            'body': json.dumps({'error': 'Internal server error'})
        }
