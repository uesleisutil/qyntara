# Complete Region Failure Recovery Runbook

## Overview
Procedures for recovering from a complete AWS region failure, including failover to backup region.

**RTO:** 4 hours  
**RPO:** 24 hours  
**Severity:** CRITICAL

## Prerequisites
- Backup region infrastructure deployed (us-west-2)
- Cross-region backups configured
- DNS/CloudFront configured for failover
- Team assembled and ready

## Decision Criteria

Declare complete region failure when:
- Multiple AWS services unavailable in primary region
- AWS confirms region-wide outage
- Recovery time estimate exceeds RTO
- Critical business impact

## Failure Assessment

### Step 1: Verify Region Status

```bash
# Check AWS Service Health
# Visit: https://health.aws.amazon.com/health/status

# Test primary region services
aws s3 ls --region us-east-1
aws dynamodb list-tables --region us-east-1
aws lambda list-functions --region us-east-1
```

### Step 2: Assess Impact

- [ ] S3 buckets inaccessible
- [ ] DynamoDB tables unavailable
- [ ] Lambda functions not executing
- [ ] API Gateway not responding
- [ ] Multiple services affected
- [ ] AWS confirms region issue

### Step 3: Make Decision

**Decision Matrix:**

| Criteria | Threshold | Status |
|----------|-----------|--------|
| Services Down | ≥3 critical services | ☐ |
| Duration | >30 minutes | ☐ |
| AWS Confirmation | Region-wide issue | ☐ |
| Business Impact | Revenue/operations stopped | ☐ |

**If 3+ criteria met:** Proceed with region failover

## Failover Procedure

### Phase 1: Activate Incident Response (0-15 minutes)

1. **Assemble Team**
   - [ ] Notify DevOps Lead
   - [ ] Notify CTO
   - [ ] Activate on-call engineers
   - [ ] Start incident bridge

2. **Communicate Status**
   ```bash
   # Send initial notification
   aws sns publish \
     --topic-arn arn:aws:sns:us-west-2:<account>:b3tr-alerts \
     --subject "CRITICAL: Region Failover Initiated" \
     --message "Primary region (us-east-1) failure detected. Initiating failover to us-west-2."
   ```

3. **Document Timeline**
   - Start incident log
   - Record all actions
   - Track decision points

### Phase 2: Restore Data from Backups (15-60 minutes)

1. **Verify Backup Region**
   ```bash
   # Switch to backup region
   export AWS_DEFAULT_REGION=us-west-2
   
   # Verify backup bucket
   aws s3 ls s3://b3tr-backup-<account>-us-west-2/
   
   # Check backup freshness
   aws s3 ls s3://b3tr-backup-<account>-us-west-2/backups/ --recursive | tail -20
   ```

2. **Deploy Infrastructure in Backup Region**
   ```bash
   cd infra
   
   # Deploy to backup region
   export CDK_DEFAULT_REGION=us-west-2
   npm run build
   cdk deploy --all --region us-west-2
   ```

3. **Restore DynamoDB Tables**
   ```bash
   # Invoke restore function in backup region
   aws lambda invoke \
     --function-name B3Dashboard-RestoreFromBackup \
     --region us-west-2 \
     --payload '{
       "restore_type": "full",
       "source_region": "us-east-1"
     }' \
     restore-response.json
   
   # Monitor restoration
   watch -n 10 'aws dynamodb list-tables --region us-west-2'
   ```

4. **Restore S3 Data**
   ```bash
   # Copy from backup bucket to new primary bucket
   aws s3 sync \
     s3://b3tr-backup-<account>-us-west-2/backups/$(date +%Y-%m-%d)/ \
     s3://b3tr-<account>-us-west-2/ \
     --region us-west-2
   ```

### Phase 3: Update DNS and Routing (60-90 minutes)

1. **Update CloudFront Origin**
   ```bash
   # Get new API Gateway endpoint
   NEW_API_URL=$(aws cloudformation describe-stacks \
     --stack-name B3TacticalRankingStackV2 \
     --region us-west-2 \
     --query 'Stacks[0].Outputs[?OutputKey==`APIEndpoint`].OutputValue' \
     --output text)
   
   echo "New API URL: $NEW_API_URL"
   ```

2. **Update CloudFront Distribution**
   ```bash
   # Update origin to point to new region
   aws cloudfront update-distribution \
     --id <distribution-id> \
     --distribution-config file://cloudfront-failover-config.json
   
   # Create invalidation
   aws cloudfront create-invalidation \
     --distribution-id <distribution-id> \
     --paths "/*"
   ```

3. **Update Route53 (if applicable)**
   ```bash
   # Update DNS records
   aws route53 change-resource-record-sets \
     --hosted-zone-id <zone-id> \
     --change-batch file://dns-failover.json
   ```

### Phase 4: Validate and Test (90-120 minutes)

1. **Test API Endpoints**
   ```bash
   # Test new API
   curl -H "X-Api-Key: <api-key>" \
     https://<new-api-id>.execute-api.us-west-2.amazonaws.com/prod/api/recommendations/latest
   ```

2. **Verify Data Integrity**
   ```bash
   # Check S3 data
   aws s3 ls s3://b3tr-<account>-us-west-2/config/
   aws s3 ls s3://b3tr-<account>-us-west-2/recommendations/ --recursive | head -20
   
   # Check DynamoDB data
   aws dynamodb scan \
     --table-name B3Dashboard-APIKeys \
     --region us-west-2 \
     --max-items 5
   ```

3. **Test Dashboard**
   - Open dashboard in browser
   - Verify data loads correctly
   - Test all major features
   - Check for errors in console

4. **Run Smoke Tests**
   ```bash
   # Run automated tests
   cd tests
   npm test -- --region us-west-2
   ```

### Phase 5: Resume Operations (120-180 minutes)

1. **Enable Scheduled Jobs**
   ```bash
   # Enable EventBridge rules
   aws events enable-rule --name B3Dashboard-IngestDuringB3 --region us-west-2
   aws events enable-rule --name B3Dashboard-RankSageMakerDaily --region us-west-2
   aws events enable-rule --name B3Dashboard-DailyBackup --region us-west-2
   ```

2. **Start Data Ingestion**
   ```bash
   # Manually trigger ingestion
   aws lambda invoke \
     --function-name B3Dashboard-IngestQuotes \
     --region us-west-2 \
     --payload '{}' \
     ingest-response.json
   ```

3. **Monitor System Health**
   ```bash
   # Check CloudWatch metrics
   aws cloudwatch get-metric-statistics \
     --namespace B3Dashboard \
     --metric-name APIResponseTime \
     --region us-west-2 \
     --start-time $(date -u -d '10 minutes ago' +%Y-%m-%dT%H:%M:%S) \
     --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
     --period 60 \
     --statistics Average
   ```

### Phase 6: Communicate and Document (180-240 minutes)

1. **Notify Stakeholders**
   ```bash
   # Send recovery notification
   aws sns publish \
     --topic-arn arn:aws:sns:us-west-2:<account>:b3tr-alerts \
     --subject "RESOLVED: System Recovered in Backup Region" \
     --message "System successfully failed over to us-west-2. All services operational."
   ```

2. **Update Status Page**
   - Mark incident as resolved
   - Provide summary of impact
   - Note current region (us-west-2)

3. **Document Incident**
   - Complete incident report
   - Record timeline
   - Note lessons learned

## Failback Procedure

When primary region is restored:

### Step 1: Verify Primary Region

```bash
# Test primary region services
aws s3 ls --region us-east-1
aws dynamodb list-tables --region us-east-1
aws lambda list-functions --region us-east-1
```

### Step 2: Sync Data Back

```bash
# Backup current state in us-west-2
aws lambda invoke \
  --function-name B3Dashboard-BackupConfiguration \
  --region us-west-2 \
  --payload '{"backup_type": "pre_failback"}' \
  backup-response.json

# Restore to primary region
aws lambda invoke \
  --function-name B3Dashboard-RestoreFromBackup \
  --region us-east-1 \
  --payload '{
    "restore_type": "full",
    "source_region": "us-west-2"
  }' \
  failback-response.json
```

### Step 3: Switch Traffic Back

```bash
# Update CloudFront to primary region
aws cloudfront update-distribution \
  --id <distribution-id> \
  --distribution-config file://cloudfront-primary-config.json

# Update Route53
aws route53 change-resource-record-sets \
  --hosted-zone-id <zone-id> \
  --change-batch file://dns-primary.json
```

### Step 4: Validate and Monitor

- Test all endpoints
- Monitor for 24 hours
- Keep backup region warm

## Monitoring During Failover

### Key Metrics to Watch

```bash
# API Response Time
aws cloudwatch get-metric-statistics \
  --namespace B3Dashboard \
  --metric-name APIResponseTime \
  --region us-west-2 \
  --start-time $(date -u -d '5 minutes ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 60 \
  --statistics Average,Maximum

# Error Rate
aws cloudwatch get-metric-statistics \
  --namespace B3Dashboard \
  --metric-name APIErrors \
  --region us-west-2 \
  --start-time $(date -u -d '5 minutes ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 60 \
  --statistics Sum

# Data Freshness
aws cloudwatch get-metric-statistics \
  --namespace B3Dashboard/DataQuality \
  --metric-name DataFreshness \
  --region us-west-2 \
  --start-time $(date -u -d '5 minutes ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 60 \
  --statistics Minimum
```

## Communication Templates

### Initial Notification

```
SUBJECT: CRITICAL - Region Failover Initiated

We have detected a complete failure of AWS us-east-1 region affecting the B3 Tactical Ranking Dashboard.

STATUS: Failover in progress to us-west-2
IMPACT: Dashboard temporarily unavailable
ETA: Service restoration within 4 hours
UPDATES: Every 30 minutes

Incident Commander: [Name]
Incident Bridge: [Conference Line]
```

### Progress Update

```
SUBJECT: UPDATE - Region Failover Progress

PROGRESS: Phase [X] of 6 complete
CURRENT ACTIVITY: [Description]
NEXT STEPS: [Description]
ETA: [Time]

Latest metrics:
- Data restoration: [X]% complete
- Services deployed: [X] of [Y]
- Tests passed: [X] of [Y]
```

### Resolution Notification

```
SUBJECT: RESOLVED - System Recovered

The B3 Tactical Ranking Dashboard has been successfully recovered in the backup region (us-west-2).

STATUS: Fully operational
REGION: us-west-2 (backup)
DOWNTIME: [Duration]
DATA LOSS: None (within RPO)

All services are functioning normally. We will continue monitoring and provide updates on failback to primary region.
```

## Post-Incident Actions

1. **Conduct Post-Mortem**
   - Schedule within 48 hours
   - Include all team members
   - Document timeline
   - Identify improvements

2. **Update Runbooks**
   - Document what worked
   - Note what didn't work
   - Add missing steps

3. **Improve DR Capabilities**
   - Automate manual steps
   - Reduce RTO/RPO
   - Add monitoring

4. **Test Regularly**
   - Schedule quarterly DR drills
   - Test failback procedures
   - Validate backups

## Contact Information

- **Incident Commander:** [Name, Phone]
- **DevOps Lead:** [Name, Phone]
- **CTO:** [Name, Phone]
- **AWS TAM:** [Name, Phone]
- **AWS Support:** [Priority 1 Case Portal]

## Related Runbooks

- [S3 Failure Recovery](./s3-failure-recovery.md)
- [DynamoDB Failure Recovery](./dynamodb-failure-recovery.md)
- [Lambda Failure Recovery](./lambda-failure-recovery.md)
- [API Gateway Failure Recovery](./api-gateway-failure-recovery.md)
