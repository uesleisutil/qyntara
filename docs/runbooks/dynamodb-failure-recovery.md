# DynamoDB Failure Recovery Runbook

## Overview
This runbook provides procedures for recovering from DynamoDB table failures, corruption, or data loss.

**RTO:** 4 hours  
**RPO:** 24 hours  
**Severity:** HIGH

## Prerequisites
- AWS CLI configured with appropriate credentials
- Access to DynamoDB backups
- Point-in-time recovery enabled on tables

## Affected Tables
- `B3Dashboard-APIKeys` - API key management
- `B3Dashboard-AuthLogs` - Authentication audit logs
- `B3Dashboard-RateLimits` - Rate limiting data

## Failure Scenarios

### Scenario 1: Table Unavailable or Throttled

**Symptoms:**
- API errors: `ProvisionedThroughputExceededException`
- CloudWatch alarms for DynamoDB errors
- Dashboard authentication failures

**Recovery Steps:**

1. **Check Table Status**
   ```bash
   # Check table status
   aws dynamodb describe-table \
     --table-name B3Dashboard-APIKeys \
     --region us-east-1 | jq '.Table.TableStatus'
   
   # Check consumed capacity
   aws cloudwatch get-metric-statistics \
     --namespace AWS/DynamoDB \
     --metric-name ConsumedReadCapacityUnits \
     --dimensions Name=TableName,Value=B3Dashboard-APIKeys \
     --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
     --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
     --period 300 \
     --statistics Sum
   ```

2. **Increase Capacity (if throttled)**
   ```bash
   # Update table capacity (if using provisioned mode)
   aws dynamodb update-table \
     --table-name B3Dashboard-APIKeys \
     --provisioned-throughput ReadCapacityUnits=100,WriteCapacityUnits=50
   ```

3. **Check for AWS Service Issues**
   - Visit AWS Service Health Dashboard
   - Check DynamoDB service status in us-east-1

### Scenario 2: Data Corruption or Accidental Deletion

**Symptoms:**
- Missing or incorrect data in tables
- Authentication failures
- API key validation errors

**Recovery Steps:**

1. **Assess Damage**
   ```bash
   # Scan table to check data
   aws dynamodb scan \
     --table-name B3Dashboard-APIKeys \
     --max-items 10 \
     --region us-east-1
   
   # Check item count
   aws dynamodb describe-table \
     --table-name B3Dashboard-APIKeys \
     --query 'Table.ItemCount'
   ```

2. **Choose Recovery Method**
   - **Option A:** Point-in-time recovery (fastest, up to 35 days)
   - **Option B:** Restore from on-demand backup (slower, up to 1 year)

## Point-in-Time Recovery (PITR)

### Step 1: Verify PITR is Enabled

```bash
# Check PITR status
aws dynamodb describe-continuous-backups \
  --table-name B3Dashboard-APIKeys \
  --region us-east-1 | jq '.ContinuousBackupsDescription.PointInTimeRecoveryDescription'
```

### Step 2: Determine Recovery Point

```bash
# Get earliest and latest restorable times
aws dynamodb describe-continuous-backups \
  --table-name B3Dashboard-APIKeys \
  --region us-east-1 | jq '.ContinuousBackupsDescription.PointInTimeRecoveryDescription | {earliest: .EarliestRestorableDateTime, latest: .LatestRestorableDateTime}'
```

### Step 3: Restore Using Lambda

```bash
# Restore to specific point in time
aws lambda invoke \
  --function-name B3Dashboard-RestoreFromBackup \
  --payload '{
    "restore_type": "point_in_time",
    "point_in_time": "2024-01-15T10:30:00Z",
    "tables": ["B3Dashboard-APIKeys"]
  }' \
  --region us-east-1 \
  pitr-response.json

# Check response
cat pitr-response.json | jq .
```

### Step 4: Verify Restored Table

```bash
# Wait for table to be active
aws dynamodb wait table-exists \
  --table-name B3Dashboard-APIKeys-pitr-<timestamp>

# Verify data
aws dynamodb scan \
  --table-name B3Dashboard-APIKeys-pitr-<timestamp> \
  --max-items 10
```

### Step 5: Switch to Restored Table

**Manual Steps Required:**

1. Update application configuration to use new table name
2. Or rename tables (requires downtime):
   ```bash
   # Backup current table
   aws dynamodb create-backup \
     --table-name B3Dashboard-APIKeys \
     --backup-name APIKeys-before-swap-$(date +%Y%m%d%H%M%S)
   
   # Delete corrupted table (CAUTION!)
   aws dynamodb delete-table --table-name B3Dashboard-APIKeys
   
   # Wait for deletion
   aws dynamodb wait table-not-exists --table-name B3Dashboard-APIKeys
   
   # Restore with original name
   aws dynamodb restore-table-to-point-in-time \
     --source-table-name B3Dashboard-APIKeys-pitr-<timestamp> \
     --target-table-name B3Dashboard-APIKeys \
     --restore-date-time "2024-01-15T10:30:00Z"
   ```

## Restore from On-Demand Backup

### Step 1: List Available Backups

```bash
# List backups for table
aws dynamodb list-backups \
  --table-name B3Dashboard-APIKeys \
  --region us-east-1 | jq '.BackupSummaries[] | {name: .BackupName, created: .BackupCreationDateTime, arn: .BackupArn}'
```

### Step 2: Restore Using Lambda

```bash
# Restore from specific backup
aws lambda invoke \
  --function-name B3Dashboard-RestoreFromBackup \
  --payload '{
    "restore_type": "full",
    "backup_timestamp": "2024-01-15T02:00:00Z",
    "tables": ["B3Dashboard-APIKeys"]
  }' \
  --region us-east-1 \
  backup-response.json

# Check response
cat backup-response.json | jq .
```

### Step 3: Verify and Switch

Follow Step 4 and 5 from PITR section above.

## Restore All Tables

For complete recovery of all DynamoDB tables:

```bash
# Full restoration
aws lambda invoke \
  --function-name B3Dashboard-RestoreFromBackup \
  --payload '{"restore_type": "full"}' \
  --region us-east-1 \
  full-restore.json

# Monitor progress
watch -n 10 'aws dynamodb list-tables | jq ".TableNames[] | select(contains(\"restored\"))"'
```

## Validation Steps

### 1. Verify Table Structure

```bash
# Check table schema
aws dynamodb describe-table \
  --table-name B3Dashboard-APIKeys \
  --query 'Table.{Keys: KeySchema, Attributes: AttributeDefinitions, GSI: GlobalSecondaryIndexes}'
```

### 2. Verify Data Integrity

```bash
# Count items
aws dynamodb describe-table \
  --table-name B3Dashboard-APIKeys \
  --query 'Table.ItemCount'

# Sample data
aws dynamodb scan \
  --table-name B3Dashboard-APIKeys \
  --max-items 5
```

### 3. Test Application Functionality

```bash
# Test API key validation
curl -H "X-Api-Key: <test-key>" \
  https://<api-id>.execute-api.us-east-1.amazonaws.com/prod/api/recommendations/latest

# Check authentication logs
aws dynamodb query \
  --table-name B3Dashboard-AuthLogs \
  --key-condition-expression "userId = :uid" \
  --expression-attribute-values '{":uid":{"S":"test-user"}}' \
  --limit 5
```

## Post-Recovery Actions

1. **Enable PITR on Restored Tables**
   ```bash
   aws dynamodb update-continuous-backups \
     --table-name B3Dashboard-APIKeys \
     --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true
   ```

2. **Update Monitoring**
   - Verify CloudWatch alarms are active
   - Check metric collection is working

3. **Document Incident**
   - Record recovery time
   - Document root cause
   - Update incident log

4. **Notify Stakeholders**
   - Send recovery completion email
   - Update status page

## Rollback Procedures

If restored data is incorrect:

```bash
# Restore to earlier point in time
aws lambda invoke \
  --function-name B3Dashboard-RestoreFromBackup \
  --payload '{
    "restore_type": "point_in_time",
    "point_in_time": "<earlier-timestamp>",
    "tables": ["B3Dashboard-APIKeys"]
  }' \
  rollback-response.json
```

## Escalation

If recovery fails or takes longer than 2 hours:

1. **Contact AWS Support**
   - Open Priority 1 case
   - Request DynamoDB team assistance

2. **Internal Escalation**
   - Notify DevOps Lead
   - Activate incident response team
   - Consider failover to backup region

3. **Alternative Solutions**
   - Deploy read-only mode
   - Use cached authentication
   - Implement temporary bypass (with security approval)

## Prevention Measures

1. **Enable PITR on all tables**
2. **Schedule regular on-demand backups**
3. **Monitor table capacity and throttling**
4. **Implement proper error handling and retries**
5. **Regular DR drills**

## Contact Information

- **DevOps Lead:** [Contact Info]
- **AWS Support:** [Support Portal]
- **On-Call Engineer:** [PagerDuty]

## Related Runbooks

- [S3 Failure Recovery](./s3-failure-recovery.md)
- [Complete Region Failure](./complete-region-failure.md)
- [API Gateway Failure Recovery](./api-gateway-failure-recovery.md)
