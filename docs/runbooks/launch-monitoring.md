# Launch Monitoring Runbook

**Purpose**: Post-launch monitoring checklist for the B3 Tactical Ranking Dashboard v2.0.

---

## First 24 Hours

### 1. Health Check (every 2 hours)
- [ ] Dashboard loads successfully (< 3s)
- [ ] All 8 tabs render without errors
- [ ] API Gateway returns 200 on `/api/recommendations/latest`
- [ ] WebSocket connections establish and receive updates
- [ ] CloudFront CDN serves static assets with cache hits

### 2. Error Monitoring
- [ ] Sentry: check for new frontend exceptions (target: 0 critical)
- [ ] CloudWatch Logs: review Lambda error rate (target: < 0.1%)
- [ ] API Gateway: check 4xx/5xx error rates (target: < 1%)
- [ ] Browser console: no unhandled promise rejections

### 3. Performance Baseline
- [ ] Record Lighthouse scores (target: Performance > 80, Accessibility > 90)
- [ ] Record average API response times per endpoint
- [ ] Record average page load time
- [ ] Record WebSocket message latency

---

## First Week

### 4. User Adoption (daily)
- [ ] Check daily active users (DAU) via analytics dashboard
- [ ] Review session duration distribution
- [ ] Check feature usage by tab (identify unused tabs)
- [ ] Review feedback widget submissions (rating distribution)
- [ ] Monitor new user onboarding completion rate (guided tour)

### 5. Infrastructure (daily)
- [ ] Lambda cold start frequency and duration
- [ ] DynamoDB read/write capacity utilization
- [ ] ElastiCache hit rate (target: > 80%)
- [ ] S3 request rates and storage growth
- [ ] CloudWatch alarm status (all green)

### 6. Cost Monitoring (daily)
- [ ] Daily AWS spend vs. budget projection
- [ ] Lambda invocation count and duration
- [ ] API Gateway request volume
- [ ] Data transfer costs

---

## First Month

### 7. Stability Review (weekly)
- [ ] Error rate trend (should be decreasing)
- [ ] P95 response time trend (should be stable or improving)
- [ ] User retention rate (D1, D7, D30)
- [ ] Feature adoption rate for new tabs

### 8. Optimization Actions
- [ ] Adjust Lambda memory based on actual usage patterns
- [ ] Tune cache TTLs based on hit/miss ratios
- [ ] Adjust CloudWatch alarm thresholds based on baseline data
- [ ] Review and implement cost optimization suggestions

---

## Escalation Thresholds

| Metric | Warning | Critical | Action |
|--------|---------|----------|--------|
| Error rate | > 1% | > 5% | Page on-call engineer |
| API P95 latency | > 2s | > 5s | Investigate Lambda/DynamoDB |
| Dashboard load time | > 5s | > 10s | Check CDN, bundle size |
| Lambda errors | > 10/hour | > 50/hour | Check logs, rollback if needed |
| DynamoDB throttling | Any | Sustained | Increase capacity |
| User-reported bugs | > 5/day | > 20/day | Triage and hotfix |

---

## Rollback Procedure

If critical issues are discovered:

1. **Frontend**: Revert CloudFront to previous S3 deployment
   ```bash
   aws s3 sync s3://backup-bucket/previous-version/ s3://dashboard-bucket/ --delete
   aws cloudfront create-invalidation --distribution-id $DIST_ID --paths "/*"
   ```

2. **Backend**: Revert Lambda to previous version
   ```bash
   aws lambda update-function-code --function-name dashboard-api \
     --s3-bucket deployment-bucket --s3-key lambda/previous-version.zip
   ```

3. **Notify**: Send rollback notification to stakeholders

---

## Contacts

| Role | Contact |
|------|---------|
| On-call engineer | ops-oncall@example.com |
| Product owner | product@example.com |
| Infrastructure | infra-team@example.com |
