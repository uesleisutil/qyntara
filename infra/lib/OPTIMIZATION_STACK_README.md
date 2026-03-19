# Optimization Stack

This stack implements infrastructure optimizations for the B3 Tactical Ranking Dashboard, including S3 lifecycle policies, ElastiCache caching, and CloudFront CDN.

## Components

### 1. S3 Lifecycle Policies

Automatically manages data lifecycle to reduce storage costs:

- **quotes_5m/**: Archive to Glacier after 90 days
- **recommendations/**: Transition to IA after 90 days, Glacier after 365 days
- **monitoring/**: Delete after 365 days
- **All data**: Delete after 1095 days (3 years)

### 2. ElastiCache Redis Cluster

Provides caching layer for Lambda functions:

- **Instance Type**: cache.t3.micro (cost-optimized)
- **Engine**: Redis 7.0
- **Availability**: Single-node (can upgrade to multi-AZ)
- **Backup**: 5-day snapshot retention
- **Maintenance**: Sunday 05:00-06:00 UTC

### 3. CloudFront CDN

Delivers static assets and API responses with caching:

- **Static Assets**: 24-hour cache
- **API Responses**: 5-minute cache
- **Compression**: Gzip + Brotli
- **Security**: HTTPS-only, TLS 1.2+
- **Protocol**: HTTP/2 and HTTP/3

## Deployment

### Prerequisites

1. AWS CDK installed: `npm install -g aws-cdk`
2. AWS credentials configured
3. Existing main infrastructure stack deployed

### Deploy Stack

```bash
cd infra

# Install dependencies
npm install

# Bootstrap CDK (first time only)
cdk bootstrap

# Deploy optimization stack
cdk deploy OptimizationStack

# Note the outputs for configuration
```

### Stack Outputs

After deployment, note these outputs:

- `CacheClusterEndpoint`: Redis endpoint for Lambda configuration
- `CacheClusterPort`: Redis port (default: 6379)
- `CloudFrontDomainName`: CDN domain for frontend
- `CloudFrontDistributionId`: For cache invalidation
- `VpcId`: VPC ID for Lambda configuration

## Configuration

### 1. Update Lambda Environment Variables

Add to all Lambda functions that need caching:

```typescript
environment: {
  CACHE_ENDPOINT: "<CacheClusterEndpoint>",
  CACHE_PORT: "6379",
}
```

### 2. Update Lambda VPC Configuration

Lambda functions need VPC access to reach ElastiCache:

```typescript
vpc: vpc,
vpcSubnets: {
  subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
},
securityGroups: [lambdaSecurityGroup],
```

### 3. Install Redis Client

Add redis-py to Lambda layer:

```bash
# Create layer
mkdir -p lambda-layer/python
pip install redis -t lambda-layer/python/
cd lambda-layer
zip -r ../redis-layer.zip .

# Upload layer
aws lambda publish-layer-version \
  --layer-name redis-client \
  --zip-file fileb://../redis-layer.zip \
  --compatible-runtimes python3.11
```

### 4. Update Frontend Configuration

Point frontend to CloudFront domain:

```javascript
const API_BASE_URL = process.env.REACT_APP_CLOUDFRONT_DOMAIN || 
                     process.env.REACT_APP_API_URL;
```

## Usage

### Using Cache in Lambda Functions

```python
from cache_helper import cache_response, CACHE_TTL_MEDIUM

@cache_response(ttl=CACHE_TTL_MEDIUM)
def get_recommendations(date: str):
    # This function's results will be cached for 5 minutes
    return load_recommendations_from_s3(date)
```

### Using Lambda Optimizer

```python
from lambda_optimizer import lambda_handler_wrapper

@lambda_handler_wrapper(
    cache_ttl=300,  # 5 minutes
    required_params=["date"],
    log_request=True
)
def handler(event, context):
    # Automatic caching, validation, error handling
    return {"data": "response"}
```

### Invalidating Cache

```python
from cache_helper import invalidate_cache

# Invalidate specific pattern
invalidate_cache("lambda:get_recommendations:*")

# Invalidate all
invalidate_cache("*")
```

### CloudFront Cache Invalidation

```bash
# Invalidate all
aws cloudfront create-invalidation \
  --distribution-id <CloudFrontDistributionId> \
  --paths "/*"

# Invalidate specific paths
aws cloudfront create-invalidation \
  --distribution-id <CloudFrontDistributionId> \
  --paths "/api/*" "/static/*"
```

## Monitoring

### CloudWatch Metrics

**ElastiCache Metrics:**
- `AWS/ElastiCache/CPUUtilization`
- `AWS/ElastiCache/DatabaseMemoryUsagePercentage`
- `AWS/ElastiCache/CacheHitRate`
- `AWS/ElastiCache/NetworkBytesIn`
- `AWS/ElastiCache/NetworkBytesOut`

**CloudFront Metrics:**
- `AWS/CloudFront/Requests`
- `AWS/CloudFront/BytesDownloaded`
- `AWS/CloudFront/4xxErrorRate`
- `AWS/CloudFront/5xxErrorRate`

**Custom Metrics:**
- `B3Dashboard/Cache/CacheHit`
- `B3Dashboard/Cache/CacheMiss`
- `B3Dashboard/Storage/StorageSizeGB`
- `B3Dashboard/Storage/EstimatedMonthlyCost`

### CloudWatch Alarms

The stack creates these alarms:

1. **CacheCPUAlarm**: CPU > 75%
2. **CacheMemoryAlarm**: Memory > 80%
3. **CacheHitRateAlarm**: Hit rate < 70%

### Viewing Metrics

```bash
# Cache hit rate
aws cloudwatch get-metric-statistics \
  --namespace AWS/ElastiCache \
  --metric-name CacheHitRate \
  --dimensions Name=CacheClusterId,Value=b3-dashboard-cache \
  --start-time $(date -u -d '1 day ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 3600 \
  --statistics Average

# CloudFront requests
aws cloudwatch get-metric-statistics \
  --namespace AWS/CloudFront \
  --metric-name Requests \
  --dimensions Name=DistributionId,Value=<DistributionId> \
  --start-time $(date -u -d '1 day ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 3600 \
  --statistics Sum
```

## Cost Optimization

### Expected Costs

**ElastiCache (cache.t3.micro):**
- On-Demand: ~$15/month
- Reserved (1-year): ~$10/month

**CloudFront:**
- First 10 TB: $0.085/GB
- Estimated: $10-20/month (depends on traffic)

**Data Transfer:**
- Reduced by 70% with CloudFront caching
- Savings: $15-30/month

**Net Cost Impact:**
- New costs: $25-35/month
- Savings: $50-80/month (Lambda + S3 + transfer)
- **Net savings: $25-45/month**

### Cost Optimization Tips

1. **Right-size ElastiCache:**
   - Start with t3.micro
   - Monitor CPU and memory
   - Upgrade only if needed

2. **Optimize Cache TTLs:**
   - Longer TTLs = fewer Lambda invocations
   - Balance freshness vs. cost
   - Monitor cache hit rates

3. **CloudFront Price Class:**
   - Use PRICE_CLASS_100 for US/EU only
   - Upgrade to PRICE_CLASS_200 if needed
   - Monitor geographic distribution

4. **S3 Lifecycle:**
   - Review transition rules quarterly
   - Adjust based on access patterns
   - Monitor storage class distribution

## Troubleshooting

### Cache Connection Issues

**Symptom**: Lambda can't connect to Redis

**Solutions**:
1. Check Lambda is in same VPC as ElastiCache
2. Verify security group allows port 6379
3. Check subnet routing to ElastiCache
4. Verify CACHE_ENDPOINT environment variable

```bash
# Test connection
aws lambda invoke \
  --function-name <function-name> \
  --payload '{"test": "cache"}' \
  response.json
```

### Low Cache Hit Rate

**Symptom**: Cache hit rate < 70%

**Solutions**:
1. Increase cache TTLs
2. Review cache key generation
3. Check if data is too dynamic
4. Increase cache memory size

```bash
# Check hit rate
aws cloudwatch get-metric-statistics \
  --namespace AWS/ElastiCache \
  --metric-name CacheHitRate \
  --dimensions Name=CacheClusterId,Value=b3-dashboard-cache \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average
```

### High CloudFront Costs

**Symptom**: CloudFront costs higher than expected

**Solutions**:
1. Review cache hit ratio
2. Check for cache invalidations
3. Optimize cache policies
4. Consider price class adjustment

```bash
# Check CloudFront metrics
aws cloudfront get-distribution-config \
  --id <DistributionId>
```

### S3 Lifecycle Not Working

**Symptom**: Old data not transitioning/deleting

**Solutions**:
1. Verify lifecycle rules are enabled
2. Check rule filters match data structure
3. Wait 24-48 hours for transitions
4. Review CloudWatch metrics

```bash
# Check lifecycle configuration
aws s3api get-bucket-lifecycle-configuration \
  --bucket <bucket-name>

# Check S3 storage metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/S3 \
  --metric-name BucketSizeBytes \
  --dimensions Name=BucketName,Value=<bucket-name> Name=StorageType,Value=StandardStorage \
  --start-time $(date -u -d '30 days ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 86400 \
  --statistics Average
```

## Maintenance

### Daily

- Monitor CloudWatch alarms
- Check cache hit rates
- Review error logs

### Weekly

- Review cost trends
- Analyze cache performance
- Check CloudFront metrics

### Monthly

- Review and adjust cache TTLs
- Optimize Lambda memory
- Review lifecycle effectiveness
- Analyze cost optimization opportunities

## Cleanup

To remove the optimization stack:

```bash
# Delete CloudFront distribution (takes 15-20 minutes)
aws cloudfront delete-distribution \
  --id <DistributionId> \
  --if-match <ETag>

# Delete stack
cdk destroy OptimizationStack
```

**Note**: ElastiCache snapshots are retained for 5 days after deletion.

## Support

For issues or questions:

1. Check CloudWatch Logs
2. Review CloudWatch Alarms
3. Check AWS Service Health Dashboard
4. Review this documentation
5. Contact DevOps team

## References

- [AWS ElastiCache Best Practices](https://docs.aws.amazon.com/AmazonElastiCache/latest/red-ug/BestPractices.html)
- [CloudFront Developer Guide](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/)
- [S3 Lifecycle Configuration](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lifecycle-mgmt.html)
- [Lambda VPC Configuration](https://docs.aws.amazon.com/lambda/latest/dg/configuration-vpc.html)
