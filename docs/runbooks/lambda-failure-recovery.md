# Lambda Failure Recovery Runbook

## Overview
Procedures for recovering from Lambda function failures, including code errors, timeout issues, and permission problems.

**RTO:** 2 hours  
**RPO:** N/A (stateless)  
**Severity:** MEDIUM to HIGH

## Critical Lambda Functions

| Function | Purpose | Impact if Down |
|----------|---------|----------------|
| `ingest_quotes` | Ingest market data | No new data, stale recommendations |
| `rank_sagemaker` | Generate recommendations | No new recommendations |
| `dashboard_api` | Serve dashboard data | Dashboard unavailable |
| `backup_configuration` | DR backups | Backup failures, RPO risk |
| `monitor_model_performance` | Model monitoring | No performance alerts |

## Failure Scenarios

### Scenario 1: Lambda Function Errors

**Symptoms:**
- CloudWatch errors in function logs
- API Gateway 5xx errors
- Failed EventBridge invocations

**Recovery Steps:**

1. **Identify Failed Function**
   ```bash
   # Check recent errors
   aws logs filter-log-events \
     --log-group-name /aws/lambda/B3Dashboard-IngestQuotes \
     --start-time $(date -d '1 hour ago' +%s)000 \
     --filter-pattern "ERROR"
   
   # Check function metrics
   aws cloudwatch get-metric-statistics \
     --namespace AWS/Lambda \
     --metric-name Errors \
     --dimensions Name=FunctionName,Value=B3Dashboard-IngestQuotes \
     --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
     --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
     --period 300 \
     --statistics Sum
   ```

2. **Analyze Error Logs**
   ```bash
   # Get detailed error logs
   aws logs tail /aws/lambda/B3Dashboard-IngestQuotes --follow --format short
   ```

3. **Common Error Fixes**

   **Permission Errors:**
   ```bash
   # Check function role
   aws lambda get-function --function-name B3Dashboard-IngestQuotes \
     --query 'Configuration.Role'
   
   # Verify IAM permissions
   aws iam get-role-policy \
     --role-name <role-name> \
     --policy-name <policy-name>
   ```

   **Timeout Errors:**
   ```bash
   # Increase timeout
   aws lambda update-function-configuration \
     --function-name B3Dashboard-IngestQuotes \
     --timeout 600  # 10 minutes
   ```

   **Memory Errors:**
   ```bash
   # Increase memory
   aws lambda update-function-configuration \
     --function-name B3Dashboard-IngestQuotes \
     --memory-size 2048
   ```

### Scenario 2: Code Deployment Issues

**Symptoms:**
- Function works in test but fails in production
- Recent deployment caused errors
- Version mismatch

**Recovery Steps:**

1. **Rollback to Previous Version**
   ```bash
   # List function versions
   aws lambda list-versions-by-function \
     --function-name B3Dashboard-IngestQuotes
   
   # Update alias to previous version
   aws lambda update-alias \
     --function-name B3Dashboard-IngestQuotes \
     --name prod \
     --function-version <previous-version>
   ```

2. **Redeploy from CDK**
   ```bash
   cd infra
   npm run build
   cdk deploy --all
   ```

### Scenario 3: Dependency Issues

**Symptoms:**
- Import errors in logs
- Missing module errors
- Layer compatibility issues

**Recovery Steps:**

1. **Check Lambda Layers**
   ```bash
   # List function layers
   aws lambda get-function-configuration \
     --function-name B3Dashboard-IngestQuotes \
     --query 'Layers'
   ```

2. **Update or Rebuild Layer**
   ```bash
   # If using custom layer, rebuild and update
   cd lambda-layer
   pip install -r requirements.txt -t python/
   zip -r layer.zip python/
   
   aws lambda publish-layer-version \
     --layer-name b3tr-dependencies \
     --zip-file fileb://layer.zip \
     --compatible-runtimes python3.11
   ```

### Scenario 4: Concurrent Execution Limits

**Symptoms:**
- Throttling errors
- `TooManyRequestsException`
- Delayed processing

**Recovery Steps:**

1. **Check Concurrent Executions**
   ```bash
   # Check current concurrency
   aws lambda get-function-concurrency \
     --function-name B3Dashboard-IngestQuotes
   
   # Check account limits
   aws lambda get-account-settings
   ```

2. **Increase Reserved Concurrency**
   ```bash
   # Set reserved concurrency
   aws lambda put-function-concurrency \
     --function-name B3Dashboard-IngestQuotes \
     --reserved-concurrent-executions 100
   ```

3. **Request Limit Increase**
   - Open AWS Support case
   - Request concurrent execution limit increase

## Manual Function Invocation

If automated triggers fail, invoke manually:

```bash
# Invoke ingest function
aws lambda invoke \
  --function-name B3Dashboard-IngestQuotes \
  --payload '{}' \
  response.json

# Invoke ranking function
aws lambda invoke \
  --function-name B3Dashboard-RankSageMaker \
  --payload '{}' \
  response.json

# Check response
cat response.json | jq .
```

## Monitoring and Validation

### Check Function Health

```bash
# Get function status
aws lambda get-function \
  --function-name B3Dashboard-IngestQuotes \
  --query 'Configuration.State'

# Check recent invocations
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value=B3Dashboard-IngestQuotes \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum
```

### Validate Function Output

```bash
# Check S3 for output
aws s3 ls s3://b3tr-<account>-<region>/quotes_5m/dt=$(date +%Y-%m-%d)/

# Check CloudWatch metrics
aws cloudwatch get-metric-statistics \
  --namespace B3Dashboard \
  --metric-name DataIngested \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum
```

## Emergency Procedures

### Disable Failing Function

```bash
# Remove EventBridge trigger
aws events disable-rule --name B3Dashboard-IngestDuringB3

# Or update function to return immediately
aws lambda update-function-configuration \
  --function-name B3Dashboard-IngestQuotes \
  --environment Variables={ENABLED=false}
```

### Enable Backup Function

If primary function fails, switch to backup:

```bash
# Update EventBridge target
aws events put-targets \
  --rule B3Dashboard-IngestDuringB3 \
  --targets "Id"="1","Arn"="arn:aws:lambda:us-east-1:<account>:function:B3Dashboard-IngestQuotes-Backup"
```

## Post-Recovery Actions

1. **Root Cause Analysis**
   - Review error logs
   - Identify code or configuration issue
   - Document findings

2. **Implement Fix**
   - Update code if needed
   - Adjust configuration
   - Add error handling

3. **Update Monitoring**
   - Add CloudWatch alarms if missing
   - Improve error detection
   - Set up better alerting

4. **Test Thoroughly**
   - Test in dev environment
   - Run integration tests
   - Verify in production

## Prevention Measures

1. **Implement Proper Error Handling**
   ```python
   try:
       # Function logic
       result = process_data()
   except Exception as e:
       logger.error(f"Error: {str(e)}", exc_info=True)
       # Send alert
       sns.publish(TopicArn=ALERT_TOPIC, Message=str(e))
       raise
   ```

2. **Add Retry Logic**
   ```python
   from tenacity import retry, stop_after_attempt, wait_exponential
   
   @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=4, max=10))
   def fetch_data():
       # API call with retry
       pass
   ```

3. **Set Up Dead Letter Queues**
   ```bash
   # Configure DLQ
   aws lambda update-function-configuration \
     --function-name B3Dashboard-IngestQuotes \
     --dead-letter-config TargetArn=arn:aws:sqs:us-east-1:<account>:lambda-dlq
   ```

4. **Regular Testing**
   - Weekly smoke tests
   - Monthly DR drills
   - Automated integration tests

## Contact Information

- **DevOps Lead:** [Contact Info]
- **On-Call Engineer:** [PagerDuty]
- **AWS Support:** [Support Portal]

## Related Runbooks

- [S3 Failure Recovery](./s3-failure-recovery.md)
- [API Gateway Failure Recovery](./api-gateway-failure-recovery.md)
- [Complete Region Failure](./complete-region-failure.md)
