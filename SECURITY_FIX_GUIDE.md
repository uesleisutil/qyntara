# 🔒 Security Fix Guide - Immediate Actions Required

**Date**: 07/03/2026  
**Priority**: 🔴 CRITICAL

---

## 🚨 Critical Issue: Exposed AWS Access Key

An AWS access key was found in the local `.env.local` file:
```
AKIA****************
```

**Status**: 
- ✅ Key is NOT committed to git (properly gitignored)
- ✅ Key removed from `.env.local` file
- ⚠️ Key needs to be rotated in AWS IAM immediately

---

## 🎯 Immediate Actions (Do Now)

### 1. Rotate the AWS Access Key

```bash
# 1. Login to AWS Console
# https://console.aws.amazon.com/iam/

# 2. Navigate to IAM > Users > [your-user] > Security credentials

# 3. Find access key: AKIA****************

# 4. Click "Make inactive" to disable it

# 5. Create a new access key

# 6. Update GitHub Secrets with new key:
# Go to: https://github.com/uesleisutil/b3-tactical-ranking/settings/secrets/actions
# Update: AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY

# 7. After confirming new key works, delete the old key
```

### 2. Verify No Other Exposures

```bash
# Check git history for any accidental commits
git log --all --full-history -S "AKIA****************"

# Should return nothing - if it does, contact GitHub support immediately
```

### 3. Update Local Environment

```bash
# Option A: Use AWS CLI profiles (RECOMMENDED)
aws configure --profile b3tr-dashboard
# Enter new access key when prompted

# Then in your shell:
export AWS_PROFILE=b3tr-dashboard

# Option B: Use temporary credentials
aws sts get-session-token --duration-seconds 3600
# Copy the temporary credentials to .env.local
```

---

## 📋 Verification Checklist

After rotating the key, verify:

- [ ] Old key is deleted from AWS IAM
- [ ] New key is stored in GitHub Secrets
- [ ] Dashboard deployment workflow still works
- [ ] No errors in CloudWatch logs
- [ ] Dashboard can still access S3 bucket
- [ ] `.env.local` does not contain real credentials

---

## 🛡️ Prevention Measures

### 1. Never Store Real Credentials in Files

**Bad** ❌:
```bash
REACT_APP_AWS_ACCESS_KEY_ID=AKIA****************
```

**Good** ✅:
```bash
# Use AWS CLI profiles
export AWS_PROFILE=b3tr-dashboard

# Or use temporary credentials
aws sts get-session-token
```

### 2. Use AWS CLI Profiles

```bash
# Configure profile
aws configure --profile b3tr-dashboard

# Use profile
export AWS_PROFILE=b3tr-dashboard
npm start
```

### 3. Use IAM Roles (Production)

For production deployments:
- Use IAM roles for EC2/ECS/Lambda
- No credentials needed in environment
- Automatic credential rotation

### 4. Enable AWS CloudTrail

Monitor for unauthorized access:
```bash
# Check recent API calls with the key
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=AccessKeyId,AttributeValue=AKIA**************** \
  --max-results 50
```

---

## 🔍 Security Best Practices

### Environment Files

1. **Never commit** `.env` or `.env.local` files
2. **Always use** `.env.example` for documentation
3. **Store secrets** in AWS Secrets Manager or GitHub Secrets
4. **Use** AWS CLI profiles for local development

### AWS Credentials

1. **Rotate keys** every 90 days
2. **Use temporary credentials** when possible
3. **Enable MFA** for IAM users
4. **Monitor** CloudTrail for suspicious activity
5. **Use IAM roles** instead of access keys when possible

### GitHub Secrets

1. **Store** all production credentials as GitHub Secrets
2. **Never** hardcode secrets in workflow files
3. **Limit** secret access to specific workflows
4. **Rotate** secrets regularly

---

## 📞 If Key Was Compromised

If you suspect the key was used by unauthorized parties:

### 1. Immediate Response

```bash
# 1. Disable the key immediately
aws iam update-access-key \
  --access-key-id AKIA**************** \
  --status Inactive \
  --user-name [your-username]

# 2. Check CloudTrail for unauthorized access
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=AccessKeyId,AttributeValue=AKIA**************** \
  --start-time $(date -u -d '7 days ago' +%Y-%m-%dT%H:%M:%S) \
  --max-results 1000

# 3. Review AWS billing for unexpected charges
# https://console.aws.amazon.com/billing/

# 4. Enable AWS GuardDuty if not already enabled
aws guardduty create-detector --enable
```

### 2. Investigation

1. Review CloudTrail logs for:
   - Unusual API calls
   - Access from unknown IP addresses
   - Resource creation/deletion
   - IAM policy changes

2. Check for:
   - Unauthorized EC2 instances
   - Unexpected S3 buckets
   - New IAM users/roles
   - Modified security groups

3. Document findings and timeline

### 3. Remediation

1. Delete the compromised key
2. Create new key with minimal permissions
3. Review and tighten IAM policies
4. Enable MFA on all IAM users
5. Set up AWS Config rules
6. Enable AWS GuardDuty

### 4. Prevention

1. Implement AWS Organizations SCPs
2. Enable AWS CloudTrail in all regions
3. Set up CloudWatch alarms for suspicious activity
4. Regular security audits
5. Employee security training

---

## 📚 Additional Resources

### AWS Security

- [AWS Security Best Practices](https://aws.amazon.com/security/best-practices/)
- [IAM Best Practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html)
- [AWS CloudTrail](https://aws.amazon.com/cloudtrail/)
- [AWS GuardDuty](https://aws.amazon.com/guardduty/)

### Secrets Management

- [AWS Secrets Manager](https://aws.amazon.com/secrets-manager/)
- [GitHub Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [Git-secrets](https://github.com/awslabs/git-secrets)

### Security Tools

- [Gitleaks](https://github.com/gitleaks/gitleaks)
- [TruffleHog](https://github.com/trufflesecurity/trufflehog)
- [AWS IAM Access Analyzer](https://aws.amazon.com/iam/access-analyzer/)

---

## ✅ Completion Checklist

- [ ] AWS access key rotated
- [ ] Old key deleted from AWS
- [ ] New key stored in GitHub Secrets
- [ ] `.env.local` cleaned (no real credentials)
- [ ] Dashboard deployment tested
- [ ] CloudTrail reviewed for suspicious activity
- [ ] Security audit report reviewed
- [ ] Team notified of security best practices

---

**Status**: 🔴 CRITICAL - Action Required  
**Prepared by**: Kiro AI  
**Date**: 07/03/2026
