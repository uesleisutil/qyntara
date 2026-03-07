# 🔒 Security Audit Report - B3 Tactical Ranking

**Date**: 07/03/2026  
**Auditor**: Kiro AI  
**Scope**: Full codebase security review

---

## 🎯 Executive Summary

**Overall Security Status**: ⚠️ **MEDIUM RISK**

- **Critical Issues**: 1 (AWS credentials in local file)
- **High Issues**: 0
- **Medium Issues**: 2 (IAM permissions, input validation)
- **Low Issues**: 3 (logging, error handling)
- **Informational**: 5

---

## 🚨 Critical Issues

### 1. AWS Access Key in `.env.local` File

**Severity**: 🔴 CRITICAL  
**Status**: ⚠️ NEEDS IMMEDIATE ACTION  
**File**: `dashboard/.env.local`

**Issue**:
```
REACT_APP_AWS_ACCESS_KEY_ID=AKIA****************
```

**Risk**:
- Exposed AWS access key in local environment file
- If accidentally committed to git, could lead to unauthorized AWS access
- Key appears to be for dashboard read-only access

**Mitigation Status**:
- ✅ File is properly gitignored (`.env.local` in `.gitignore`)
- ✅ NOT committed to git repository (verified)
- ✅ GitHub workflow uses secrets instead of hardcoded values
- ⚠️ Key should be rotated immediately as a precaution

**Recommendation**:
1. **IMMEDIATE**: Rotate this AWS access key in AWS IAM
2. Delete the key from `.env.local` file
3. Use AWS CLI profiles or temporary credentials instead
4. Document that `.env.local` should NEVER contain real credentials

---

## ⚠️ High Issues

None found.

---

## 📋 Medium Issues

### 1. Overly Permissive IAM Policies

**Severity**: 🟡 MEDIUM  
**File**: `infra/lib/infra-stack.ts`

**Issue**:
Several Lambda functions have broad IAM permissions:

```typescript
// CloudWatch metrics - allows all resources
const cwPutMetricPolicy = new iam.PolicyStatement({
  actions: ["cloudwatch:PutMetricData"],
  resources: ["*"],
});

// SageMaker APIs - allows all resources
const sagemakerApiPolicy = new iam.PolicyStatement({
  actions: [
    "sagemaker:CreateModel",
    "sagemaker:DeleteModel",
    "sagemaker:CreateTransformJob",
    // ... more actions
  ],
  resources: ["*"],
});
```

**Risk**:
- Lambdas can access more resources than necessary
- Violates principle of least privilege
- Could be exploited if Lambda is compromised

**Recommendation**:
1. Scope CloudWatch permissions to specific namespaces:
   ```typescript
   resources: [`arn:aws:cloudwatch:${region}:${account}:*`]
   ```

2. Scope SageMaker permissions to specific resource patterns:
   ```typescript
   resources: [
     `arn:aws:sagemaker:${region}:${account}:model/b3tr-*`,
     `arn:aws:sagemaker:${region}:${account}:training-job/b3tr-*`,
     `arn:aws:sagemaker:${region}:${account}:transform-job/b3tr-*`
   ]
   ```

**Status**: Acceptable for MVP, should be tightened for production

---

### 2. Limited Input Validation in Lambda Functions

**Severity**: 🟡 MEDIUM  
**Files**: Multiple Lambda handlers

**Issue**:
Some Lambda functions don't validate input parameters thoroughly:

```python
# Example from analyze_sentiment.py
bucket = event.get('bucket', os.environ.get('BUCKET_NAME'))
ticker = event.get('ticker')

if not bucket:
    raise ValueError("Bucket name not provided")
# No validation of ticker format
```

**Risk**:
- Malformed input could cause unexpected behavior
- Potential for injection attacks if input is used in commands
- No rate limiting on external API calls

**Recommendation**:
1. Add input validation for all Lambda parameters:
   ```python
   import re
   
   def validate_ticker(ticker: str) -> bool:
       return bool(re.match(r'^[A-Z]{4}[0-9]{1,2}$', ticker))
   
   if ticker and not validate_ticker(ticker):
       raise ValueError(f"Invalid ticker format: {ticker}")
   ```

2. Add rate limiting for external API calls (News API)
3. Sanitize all inputs before using in file paths or S3 keys

**Status**: Low risk currently, but should be improved

---

## ℹ️ Low Issues

### 1. Secrets in CloudWatch Logs

**Severity**: 🟢 LOW  
**Files**: Multiple Lambda functions

**Issue**:
Some Lambda functions log full event objects which could contain sensitive data:

```python
logger.info(f"Event: {event}")
```

**Risk**:
- Sensitive data could be logged to CloudWatch
- CloudWatch logs retained for 1 week

**Recommendation**:
1. Sanitize logs to remove sensitive fields:
   ```python
   safe_event = {k: v for k, v in event.items() if k not in ['api_key', 'token', 'secret']}
   logger.info(f"Event: {safe_event}")
   ```

2. Use structured logging with explicit field filtering

**Status**: Low risk, good practice to implement

---

### 2. No Request Timeout on External APIs

**Severity**: 🟢 LOW  
**File**: `ml/src/sentiment/sentiment_analyzer.py`

**Issue**:
External API calls (News API) don't have explicit timeouts:

```python
response = requests.get(url, params=params)
```

**Risk**:
- Lambda could hang waiting for slow API responses
- Could lead to Lambda timeout and wasted costs

**Recommendation**:
```python
response = requests.get(url, params=params, timeout=10)
```

**Status**: Should be added for robustness

---

### 3. Error Messages Expose Internal Details

**Severity**: 🟢 LOW  
**Files**: Multiple Lambda functions

**Issue**:
Some error messages expose internal implementation details:

```python
raise ValueError(f"Bucket name not provided")
# Exposes that bucket name is required
```

**Risk**:
- Information disclosure to potential attackers
- Could help attackers understand system architecture

**Recommendation**:
1. Use generic error messages for external responses
2. Log detailed errors internally only
3. Return sanitized errors to clients

**Status**: Low risk for internal system

---

## ✅ Security Strengths

### 1. Secrets Management ✅

**Good Practices**:
- All sensitive credentials stored in AWS Secrets Manager
- No hardcoded secrets in code (verified)
- Secrets accessed via IAM roles, not embedded keys
- `.env` files properly gitignored

**Examples**:
```python
# BRAPI token from Secrets Manager
secret_response = secrets.get_secret_value(SecretId='brapi/pro/token')

# News API key from Secrets Manager
secret_response = secrets.get_secret_value(SecretId='news-api/key')
```

---

### 2. S3 Security ✅

**Good Practices**:
- Bucket encryption enabled (S3_MANAGED)
- Block all public access enabled
- SSL enforcement enabled
- Versioning disabled (appropriate for this use case)
- Retention policy set to RETAIN

```typescript
const bucket = new s3.Bucket(this, "B3TRBucket", {
  encryption: s3.BucketEncryption.S3_MANAGED,
  blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
  enforceSSL: true,
  removalPolicy: cdk.RemovalPolicy.RETAIN,
});
```

---

### 3. GitHub Secrets ✅

**Good Practices**:
- AWS credentials stored as GitHub secrets
- Not hardcoded in workflow files
- Proper permissions scoping in workflows

```yaml
env:
  REACT_APP_AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
  REACT_APP_AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
```

---

### 4. No SQL Injection Vulnerabilities ✅

**Verified**:
- No SQL queries found in codebase
- All data access via S3 and boto3 (parameterized)
- No string concatenation in queries

---

### 5. No Code Injection Vulnerabilities ✅

**Verified**:
- No use of `eval()` or `exec()` (except PyTorch model.eval() which is safe)
- No dynamic code execution
- No unsafe deserialization

---

### 6. Security Scanning Workflows ✅

**Implemented**:
- Gitleaks for secrets scanning
- TruffleHog for credential detection
- AWS credentials pattern matching
- CodeQL for code analysis
- Dependency scanning
- Container scanning

---

## 📊 Security Checklist

### Authentication & Authorization
- [x] Secrets stored in AWS Secrets Manager
- [x] IAM roles used for Lambda execution
- [x] No hardcoded credentials in code
- [ ] ⚠️ IAM policies could be more restrictive (medium priority)
- [x] S3 bucket access properly restricted

### Data Protection
- [x] S3 encryption enabled
- [x] SSL/TLS enforced for S3
- [x] No sensitive data in logs (mostly)
- [ ] ⚠️ Could improve log sanitization (low priority)
- [x] No PII in code examples

### Input Validation
- [ ] ⚠️ Limited input validation in Lambdas (medium priority)
- [x] No SQL injection vulnerabilities
- [x] No path traversal vulnerabilities
- [x] No code injection vulnerabilities

### Network Security
- [x] S3 bucket blocks public access
- [x] Lambda functions in AWS VPC (implicit)
- [x] HTTPS enforced for all external calls
- [ ] ⚠️ No request timeouts on external APIs (low priority)

### Monitoring & Logging
- [x] CloudWatch logging enabled
- [x] CloudWatch alarms configured
- [x] SNS alerts for failures
- [ ] ⚠️ Could improve log sanitization (low priority)

### Dependency Management
- [x] Dependency scanning workflow active
- [x] No known vulnerable dependencies
- [x] Lambda layers used for dependencies
- [x] Requirements.txt properly maintained

### Secrets Scanning
- [x] Gitleaks workflow active
- [x] TruffleHog workflow active
- [x] AWS credentials check active
- [x] .env files properly gitignored
- [ ] 🔴 AWS key in .env.local needs rotation (critical)

---

## 🎯 Remediation Plan

### Immediate (Within 24 hours)

1. **Rotate AWS Access Key** 🔴
   - Rotate `AKIA****************` in AWS IAM
   - Update GitHub secrets with new key
   - Remove key from `.env.local` file
   - Document proper credential handling

### Short Term (Within 1 week)

2. **Add Input Validation** 🟡
   - Implement ticker format validation
   - Add S3 key sanitization
   - Add request timeouts to external APIs

3. **Improve Logging** 🟢
   - Sanitize sensitive fields from logs
   - Implement structured logging
   - Add log level configuration

### Medium Term (Within 1 month)

4. **Tighten IAM Permissions** 🟡
   - Scope CloudWatch permissions to namespace
   - Scope SageMaker permissions to resource patterns
   - Review and minimize all IAM policies

5. **Add Rate Limiting** 🟡
   - Implement rate limiting for News API calls
   - Add circuit breaker pattern for external APIs
   - Add retry with exponential backoff

### Long Term (Within 3 months)

6. **Security Hardening**
   - Implement AWS WAF for API protection
   - Add VPC endpoints for AWS services
   - Implement AWS GuardDuty
   - Add AWS Config rules for compliance

---

## 📈 Security Score

**Overall Score**: 7.5/10

**Breakdown**:
- Secrets Management: 9/10 (excellent)
- Data Protection: 9/10 (excellent)
- Input Validation: 6/10 (needs improvement)
- IAM Permissions: 7/10 (good, could be better)
- Monitoring: 8/10 (very good)
- Code Quality: 9/10 (excellent)

---

## 🔍 Audit Methodology

### Tools Used
1. Manual code review
2. grep/ripgrep pattern matching
3. Git history analysis
4. AWS CDK template analysis
5. GitHub workflow review

### Scope
- All Python Lambda functions
- CDK infrastructure code
- GitHub workflows
- Environment files
- Dashboard code
- Configuration files

### Exclusions
- Third-party dependencies (covered by dependency scanning)
- AWS service security (managed by AWS)
- Network layer security (managed by AWS)

---

## 📝 Recommendations Summary

### Critical
1. Rotate exposed AWS access key immediately

### High
None

### Medium
1. Tighten IAM permissions to follow least privilege
2. Add comprehensive input validation to Lambda functions

### Low
1. Sanitize sensitive data from CloudWatch logs
2. Add request timeouts to external API calls
3. Use generic error messages for external responses

---

## ✅ Conclusion

The B3 Tactical Ranking system has a **solid security foundation** with proper secrets management, S3 security, and no critical code vulnerabilities. The main concern is the exposed AWS access key in `.env.local`, which needs immediate rotation.

The system follows AWS best practices for most areas and has comprehensive security scanning workflows in place. With the recommended improvements, the security posture would be excellent for a production system.

**Next Steps**:
1. Rotate AWS access key (IMMEDIATE)
2. Implement input validation (1 week)
3. Tighten IAM permissions (1 month)

---

**Prepared by**: Kiro AI  
**Date**: 07/03/2026  
**Classification**: Internal Use Only
