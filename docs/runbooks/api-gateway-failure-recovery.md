# API Gateway Failure Recovery Runbook

## Overview
Procedures for recovering from API Gateway failures, including endpoint unavailability, throttling, and configuration issues.

**RTO:** 2 hours  
**RPO:** N/A (stateless)  
**Severity:** HIGH

## API Gateway Details

- **API Name:** B3TR Dashboard API
- **Stage:** prod
- **Endpoints:** `/api/recommendations/*`, `/api/monitoring/*`, `/api/data-quality/*`
- **Authentication:** API Key

## Failure Scenarios

### Scenario 1: API Gateway Unavailable

**Symptoms:**
- 503 Service Unavailable errors
- Timeout errors
- Dashboard cannot load data

**Recovery Steps:**

1. **Check API Status**
   ```bash
   # Get API details
   aws apigateway get-rest-apis \
     --query 'items[?name==`B3TR Dashboard API`]'
   
   # Check deployment status
   aws apigateway get-deployments \
     --rest-api-id <api-id> \
     --query 'items[0]'
   ```

2. **Check AWS Service Health**
   - Visit AWS Service Health Dashboard
   - Check API Gateway service status

3. **Test Endpoints**
   ```bash
   # Test health endpoint
   curl -v https://<api-id>.execute-api.us-east-1.amazonaws.com/prod/health
   
   # Test with API key
   curl -H "X-Api-Key: <api-key>" \
     https://<api-id>.execute-api.us-east-1.amazonaws.com/prod/api/recommendations/latest
   ```

4. **Redeploy API**
   ```bash
   # Create new deployment
   aws apigateway create-deployment \
     --rest-api-id <api-id> \
     --stage-name prod \
     --description "Emergency redeployment"
   ```

### Scenario 2: Throttling Issues

**Symptoms:**
- 429 Too Many Requests errors
- Slow response times
- Intermittent failures

**Recovery Steps:**

1. **Check Throttling Metrics**
   ```bash
   # Check throttle count
   aws cloudwatch get-metric-statistics \
     --namespace AWS/ApiGateway \
     --metric-name Count \
     --dimensions Name=ApiName,Value="B3TR Dashboard API" \
     --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
     --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
     --period 300 \
     --statistics Sum
   
   # Check 4xx errors
   aws cloudwatch get-metric-statistics \
     --namespace AWS/ApiGateway \
     --metric-name 4XXError \
     --dimensions Name=ApiName,Value="B3TR Dashboard API" \
     --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
     --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
     --period 300 \
     --statistics Sum
   ```

2. **Increase Throttle Limits**
   ```bash
   # Update stage throttle settings
   aws apigateway update-stage \
     --rest-api-id <api-id> \
     --stage-name prod \
     --patch-operations \
       op=replace,path=/throttle/rateLimit,value=1000 \
       op=replace,path=/throttle/burstLimit,value=2000
   ```

3. **Update Usage Plan**
   ```bash
   # Get usage plan ID
   aws apigateway get-usage-plans \
     --query 'items[?name==`B3TR Dashboard Usage Plan`].id'
   
   # Update usage plan limits
   aws apigateway update-usage-plan \
     --usage-plan-id <plan-id> \
     --patch-operations \
       op=replace,path=/throttle/rateLimit,value=1000 \
       op=replace,path=/throttle/burstLimit,value=2000
   ```

### Scenario 3: Lambda Integration Failures

**Symptoms:**
- 502 Bad Gateway errors
- 504 Gateway Timeout errors
- Inconsistent responses

**Recovery Steps:**

1. **Check Lambda Integration**
   ```bash
   # Get integration details
   aws apigateway get-integration \
     --rest-api-id <api-id> \
     --resource-id <resource-id> \
     --http-method GET
   ```

2. **Test Lambda Directly**
   ```bash
   # Invoke Lambda function
   aws lambda invoke \
     --function-name B3Dashboard-DashboardAPI \
     --payload '{"httpMethod":"GET","path":"/api/recommendations/latest"}' \
     response.json
   
   cat response.json
   ```

3. **Update Integration**
   ```bash
   # Re-create integration
   aws apigateway put-integration \
     --rest-api-id <api-id> \
     --resource-id <resource-id> \
     --http-method GET \
     --type AWS_PROXY \
     --integration-http-method POST \
     --uri arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/arn:aws:lambda:us-east-1:<account>:function:B3Dashboard-DashboardAPI/invocations
   
   # Redeploy
   aws apigateway create-deployment \
     --rest-api-id <api-id> \
     --stage-name prod
   ```

### Scenario 4: API Key Issues

**Symptoms:**
- 403 Forbidden errors
- "Missing Authentication Token" errors
- API key validation failures

**Recovery Steps:**

1. **Verify API Key**
   ```bash
   # List API keys
   aws apigateway get-api-keys \
     --include-values
   
   # Check usage plan association
   aws apigateway get-usage-plan-keys \
     --usage-plan-id <plan-id>
   ```

2. **Create New API Key**
   ```bash
   # Create new key
   aws apigateway create-api-key \
     --name "B3TR-Emergency-Key" \
     --enabled \
     --generate-distinct-id
   
   # Associate with usage plan
   aws apigateway create-usage-plan-key \
     --usage-plan-id <plan-id> \
     --key-id <new-key-id> \
     --key-type API_KEY
   ```

3. **Update Dashboard Configuration**
   - Update API key in dashboard environment
   - Redeploy dashboard if needed

## Complete API Rebuild

If API Gateway is completely broken:

```bash
# Redeploy entire stack
cd infra
npm run build
cdk deploy B3TacticalRankingStackV2

# Get new API endpoint
aws cloudformation describe-stacks \
  --stack-name B3TacticalRankingStackV2 \
  --query 'Stacks[0].Outputs[?OutputKey==`APIEndpoint`].OutputValue' \
  --output text
```

## Monitoring and Validation

### Check API Health

```bash
# Monitor API metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/ApiGateway \
  --metric-name Count \
  --dimensions Name=ApiName,Value="B3TR Dashboard API" \
  --start-time $(date -u -d '5 minutes ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 60 \
  --statistics Sum

# Check latency
aws cloudwatch get-metric-statistics \
  --namespace AWS/ApiGateway \
  --metric-name Latency \
  --dimensions Name=ApiName,Value="B3TR Dashboard API" \
  --start-time $(date -u -d '5 minutes ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 60 \
  --statistics Average,Maximum
```

### Test All Endpoints

```bash
#!/bin/bash
API_KEY="<your-api-key>"
API_URL="https://<api-id>.execute-api.us-east-1.amazonaws.com/prod"

# Test recommendations endpoint
echo "Testing recommendations..."
curl -s -H "X-Api-Key: $API_KEY" "$API_URL/api/recommendations/latest" | jq .

# Test monitoring endpoint
echo "Testing monitoring..."
curl -s -H "X-Api-Key: $API_KEY" "$API_URL/api/monitoring/data-quality" | jq .

# Test data quality endpoint
echo "Testing data quality..."
curl -s -H "X-Api-Key: $API_KEY" "$API_URL/api/data-quality/completeness" | jq .
```

## Rollback Procedures

If new deployment causes issues:

```bash
# List deployments
aws apigateway get-deployments \
  --rest-api-id <api-id> \
  --query 'items[*].{id:id,created:createdDate,description:description}'

# Rollback to previous deployment
aws apigateway update-stage \
  --rest-api-id <api-id> \
  --stage-name prod \
  --patch-operations op=replace,path=/deploymentId,value=<previous-deployment-id>
```

## Emergency Workarounds

### Enable CORS for Direct Lambda Access

If API Gateway is down, temporarily allow direct Lambda access:

```bash
# Update Lambda function URL (if configured)
aws lambda update-function-url-config \
  --function-name B3Dashboard-DashboardAPI \
  --cors AllowOrigins="*",AllowMethods="GET,POST",AllowHeaders="*"
```

### Use CloudFront Failover

Configure CloudFront to failover to backup API:

```bash
# Update CloudFront origin
aws cloudfront update-distribution \
  --id <distribution-id> \
  --distribution-config file://cloudfront-config.json
```

## Post-Recovery Actions

1. **Review API Logs**
   ```bash
   # Enable CloudWatch logging if not enabled
   aws apigateway update-stage \
     --rest-api-id <api-id> \
     --stage-name prod \
     --patch-operations \
       op=replace,path=/accessLogSettings/destinationArn,value=arn:aws:logs:us-east-1:<account>:log-group:/aws/apigateway/b3tr-api \
       op=replace,path=/accessLogSettings/format,value='$context.requestId'
   ```

2. **Update Monitoring**
   - Add CloudWatch alarms for API errors
   - Set up latency alerts
   - Monitor throttling

3. **Document Incident**
   - Record what failed
   - Document recovery steps taken
   - Note recovery time

4. **Improve Resilience**
   - Implement caching
   - Add retry logic in dashboard
   - Consider multi-region setup

## Prevention Measures

1. **Enable CloudWatch Logging**
2. **Set Up Comprehensive Alarms**
3. **Implement Rate Limiting**
4. **Use WAF for Protection**
5. **Regular Load Testing**
6. **Automated Health Checks**

## Contact Information

- **DevOps Lead:** [Contact Info]
- **On-Call Engineer:** [PagerDuty]
- **AWS Support:** [Support Portal]

## Related Runbooks

- [Lambda Failure Recovery](./lambda-failure-recovery.md)
- [S3 Failure Recovery](./s3-failure-recovery.md)
- [Complete Region Failure](./complete-region-failure.md)
