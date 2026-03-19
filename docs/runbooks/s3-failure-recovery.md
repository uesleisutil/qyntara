# S3 Failure Recovery Runbook

## Overview
This runbook provides step-by-step procedures for recovering from S3 bucket failures or data loss.

**RTO:** 4 hours  
**RPO:** 24 hours  
**Severity:** HIGH

## Prerequisites
- AWS CLI configured with appropriate credentials
- Access to backup bucket in secondary region
- Access to CloudWatch logs and metrics

## Failure Scenarios

### Scenario 1: S3 Bucket Inaccessible

**Symptoms:**
- API errors when accessing S3 bucket
- CloudWatch alarms for S3 access failures
- Dashboard unable to load data

**Recovery Steps:**

1. **Verify the Issue**
   ```bash
   # Check bucket accessibility
   aws s3 ls s3://b3tr-<account>-<region>/ --region us-east-1
   
   # Check bucket policy and permissions
   aws s3api get-bucket-policy --bucket b3tr-<account>-<region>
   ```

2. **Check AWS Service Health**
   - Visit AWS Service Health Dashboard
   - Check for S3 service disruptions in us-east-1

3. **Attempt Bucket Recovery**
   ```bash
   # Verify bucket exists
   aws s3api head-bucket --bucket b3tr-<account>-<region>
   
   # Check bucket versioning status
   aws s3api get-bucket-versioning --bucket b3tr-<account>-<region>
   ```

4. **If Bucket is Corrupted or Deleted**
   - Proceed to "Restore from Backup" section below

### Scenario 2: Data Corruption or Accidental Deletion

**Symptoms:**
- Missing or corrupted files in S3
- Incorrect data returned by API
- Data quality monitoring alerts

**Recovery Steps:**

1. **Identify Affected Data**
   ```bash
   # List recent deletions (if versioning enabled)
   aws s3api list-object-versions \
     --bucket b3tr-<account>-<region> \
     --prefix config/ \
     --query 'DeleteMarkers[?IsLatest==`true`]'
   ```

2. **Restore from S3 Versioning (if available)**
   ```bash
   # Restore specific object version
   aws s3api copy-object \
     --bucket b3tr-<account>-<region> \
     --copy-source b3tr-<account>-<region>/config/universe.txt?versionId=<version-id> \
     --key config/universe.txt
   ```

3. **If Versioning Not Available, Restore from Backup**
   - Proceed to "Restore from Backup" section below

## Restore from Backup

### Step 1: Identify Latest Backup

```bash
# List available backups
aws s3 ls s3://b3tr-backup-<account>-<backup-region>/backups/ --recursive

# Check backup metadata
aws s3 cp s3://b3tr-backup-<account>-<backup-region>/backups/metadata/<date>.json - | jq .
```

### Step 2: Invoke Restore Lambda

```bash
# Full restoration
aws lambda invoke \
  --function-name B3Dashboard-RestoreFromBackup \
  --payload '{"restore_type": "full"}' \
  --region us-east-1 \
  response.json

# Check response
cat response.json | jq .
```

### Step 3: Verify Restoration

```bash
# Verify config files restored
aws s3 ls s3://b3tr-<account>-<region>/config/

# Verify recommendations restored
aws s3 ls s3://b3tr-<account>-<region>/recommendations/ --recursive | head -20

# Test API endpoint
curl -H "X-Api-Key: <api-key>" \
  https://<api-id>.execute-api.us-east-1.amazonaws.com/prod/api/recommendations/latest
```

### Step 4: Validate Data Integrity

```bash
# Run data quality checks
aws lambda invoke \
  --function-name B3Dashboard-MonitorModelQuality \
  --region us-east-1 \
  quality-check.json

# Check CloudWatch metrics
aws cloudwatch get-metric-statistics \
  --namespace B3Dashboard/DataQuality \
  --metric-name CompletenessRate \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average
```

## Post-Recovery Actions

1. **Update Incident Log**
   - Document the incident in incident tracking system
   - Record root cause and recovery time

2. **Review and Improve**
   - Analyze what caused the failure
   - Update monitoring and alerting if needed
   - Consider additional preventive measures

3. **Notify Stakeholders**
   - Send recovery completion notification
   - Provide incident summary and timeline

4. **Schedule Post-Mortem**
   - Schedule team meeting within 48 hours
   - Document lessons learned
   - Create action items for improvements

## Rollback Procedures

If restoration causes issues:

```bash
# Stop any running processes
aws lambda update-function-configuration \
  --function-name B3Dashboard-RestoreFromBackup \
  --environment Variables={RESTORE_ENABLED=false}

# Revert to previous backup
aws lambda invoke \
  --function-name B3Dashboard-RestoreFromBackup \
  --payload '{"restore_type": "full", "backup_timestamp": "<previous-date>"}' \
  response.json
```

## Escalation

If recovery is not successful within 2 hours:

1. **Contact AWS Support**
   - Open Priority 1 support case
   - Provide incident details and recovery attempts

2. **Escalate Internally**
   - Notify DevOps Lead
   - Notify CTO
   - Activate incident response team

3. **Consider Alternative Solutions**
   - Deploy to backup region
   - Use cached data temporarily
   - Enable read-only mode

## Contact Information

- **DevOps Lead:** [Contact Info]
- **AWS Support:** [Support Case Portal]
- **On-Call Engineer:** [PagerDuty/On-Call System]

## Related Runbooks

- [DynamoDB Failure Recovery](./dynamodb-failure-recovery.md)
- [Complete Region Failure](./complete-region-failure.md)
- [Lambda Failure Recovery](./lambda-failure-recovery.md)
