"""
Lambda para fazer proxy de dados do S3 para o dashboard
Permite acesso aos dados via API Gateway sem expor credenciais AWS
"""
import json
import boto3
import os
from datetime import datetime

s3 = boto3.client('s3')
BUCKET = os.environ['S3_BUCKET']

def handler(event, context):
    """
    Proxy para acessar dados do S3 via API Gateway
    
    Endpoints:
    - GET /s3-proxy?key=path/to/file.json - Retorna conteúdo de um arquivo
    - GET /s3-proxy/list?prefix=path/ - Lista objetos com prefixo
    """
    try:
        # Parse query parameters
        params = event.get('queryStringParameters', {}) or {}
        path = event.get('path', '')
        
        # List objects
        if '/list' in path:
            prefix = params.get('prefix', '')
            
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
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
                    'Access-Control-Allow-Methods': 'GET,OPTIONS'
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
            
            if not key:
                return {
                    'statusCode': 400,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'body': json.dumps({'error': 'Missing key parameter'})
                }
            
            try:
                response = s3.get_object(Bucket=BUCKET, Key=key)
                content = response['Body'].read().decode('utf-8')
                data = json.loads(content)
                
                return {
                    'statusCode': 200,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
                        'Access-Control-Allow-Methods': 'GET,OPTIONS'
                    },
                    'body': json.dumps(data)
                }
            
            except s3.exceptions.NoSuchKey:
                return {
                    'statusCode': 404,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'body': json.dumps({'error': f'Object not found: {key}'})
                }
    
    except Exception as e:
        print(f"Error in s3_proxy: {str(e)}")
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'error': str(e)})
        }
